/**
 * Kings of Detailing – integração com Google Agenda e Planilha Google.
 *
 * Como instalar (uma vez só):
 * 1. Acesse https://script.google.com e clique em "Novo projeto".
 * 2. Apague o que estiver lá, cole este arquivo inteiro e troque a CHAVE abaixo.
 * 3. Clique em "Implantar" → "Nova implantação" → tipo "App da Web".
 *    Executar como: "Eu". Quem pode acessar: "Qualquer pessoa". Clique em "Implantar".
 * 4. Autorize o acesso (Avançado → Acessar projeto, se aparecer o aviso).
 * 5. Copie o link que termina em /exec e cole no sistema, em Preços → Google Agenda,
 *    junto com a mesma CHAVE.
 */

// Troque por uma senha só sua (letras e números). Use a mesma no sistema.
const CHAVE = 'TROQUE-ESTA-CHAVE';

const NOME_AGENDA = 'Kings of Detailing';
const NOME_PLANILHA = 'Kings of Detailing – Agenda';
const FUSO = 'America/New_York';
const HORAS_POR_CARRO = 3;
const DIAS_A_FRENTE = 15;
const COLS = ['id', 'data', 'hora', 'nome', 'tel', 'end', 'carro', 'serv', 'valor', 'dep', 'n', 'status', 'evento', 'criado', 'lat', 'lng', 'cidade'];

function doGet() {
  return saida({ ok: true, msg: 'Script da Kings of Detailing funcionando.' });
}

function doPost(e) {
  let p;
  try { p = JSON.parse(e.postData.contents); } catch (err) { return saida({ ok: false, erro: 'json' }); }
  if (CHAVE === 'TROQUE-ESTA-CHAVE' || p.key !== CHAVE) return saida({ ok: false, erro: 'chave' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    switch (p.action) {
      case 'list': return saida({ ok: true, appts: listar(), busy: ocupados(), cfg: lerCfg() });
      case 'geo': return saida({ ok: true, geo: geo(p.end) });
      case 'add': adicionar(p.appt); break;
      case 'status': mudarStatus(p.id, p.status); break;
      case 'del': remover(p.id); break;
      case 'cfg': PropertiesService.getScriptProperties().setProperty('cfg', JSON.stringify(p.cfg)); break;
      // Financeiro
      case 'fin_list': return saida({ ok: true, tx: finListar(), cfg: finCfg(), banco: finBancoInfo() });
      case 'fin_add': finAdicionar(p.txs); break;
      case 'fin_upd': finAtualizar(p.tx); break;
      case 'fin_del': finRemover(p.id); break;
      case 'fin_cfg': PropertiesService.getScriptProperties().setProperty('fin_cfg', JSON.stringify(p.cfg)); break;
      case 'fin_banco': return saida(finConectar(p.token));
      case 'fin_puxar': return saida(finPuxar());
      case 'fin_desligar': finDesligar(); break;
      default: return saida({ ok: false, erro: 'acao' });
    }
    return saida({ ok: true });
  } catch (err) {
    return saida({ ok: false, erro: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function saida(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Planilha ----------

function planilha() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('planilha');
  if (id) {
    // A agenda é a primeira aba que não seja a do Financeiro.
    const s = SpreadsheetApp.openById(id).getSheets().filter(function (x) { return x.getName() !== 'Financeiro'; })[0];
    if (s.getLastColumn() < COLS.length) s.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold');
    return s;
  }
  const ss = SpreadsheetApp.create(NOME_PLANILHA);
  const sh = ss.getSheets()[0];
  sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold');
  sh.setFrozenRows(1);
  props.setProperty('planilha', ss.getId());
  return sh;
}

function linhas() {
  const sh = planilha();
  const n = sh.getLastRow() - 1;
  if (n < 1) return { sh: sh, rows: [] };
  return { sh: sh, rows: sh.getRange(2, 1, n, COLS.length).getDisplayValues() };
}

function acharLinha(rows, id) {
  for (let i = 0; i < rows.length; i++) if (rows[i][0] === id) return i;
  return -1;
}

function listar() {
  const t = linhas();
  const iLat = COLS.indexOf('lat');
  let faltam = 10; // localiza no mapa até 10 endereços antigos por vez
  return t.rows.map(function (r, i) {
    if (r[iLat] === '' && r[COLS.indexOf('end')] && faltam-- > 0) {
      const g = geo(r[COLS.indexOf('end')]);
      if (g) {
        r[iLat] = String(g.lat); r[iLat + 1] = String(g.lng); r[iLat + 2] = g.cidade;
        t.sh.getRange(i + 2, iLat + 1, 1, 3).setNumberFormat('@').setValues([[r[iLat], r[iLat + 1], r[iLat + 2]]]);
      }
    }
    const a = {};
    COLS.forEach(function (c, j) { a[c] = r[j]; });
    a.valor = Number(a.valor) || 0;
    a.dep = Number(a.dep) || 0;
    a.n = Number(a.n) || 1;
    a.lat = a.lat === '' ? '' : Number(a.lat);
    a.lng = a.lng === '' ? '' : Number(a.lng);
    delete a.evento;
    delete a.criado;
    return a;
  });
}

function adicionar(a) {
  const t = linhas();
  if (!a || !a.id || acharLinha(t.rows, a.id) > -1) return; // já existe: ignora repetido
  if (a.lat === undefined || a.lat === '') {
    const g = geo(a.end);
    if (g) { a.lat = g.lat; a.lng = g.lng; a.cidade = g.cidade; }
  }
  const ev = agenda().createEvent(titulo(a), inicio(a), fim(a), { description: descricao(a), location: a.end || '' });
  const row = COLS.map(function (c) {
    if (c === 'evento') return ev.getId();
    if (c === 'criado') return Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd HH:mm');
    return a[c] === undefined ? '' : String(a[c]);
  });
  // Texto puro, para a planilha não transformar data e horário em outros formatos.
  t.sh.getRange(t.sh.getLastRow() + 1, 1, 1, COLS.length).setNumberFormat('@').setValues([row]);
}

function mudarStatus(id, status) {
  const t = linhas();
  const i = acharLinha(t.rows, id);
  if (i < 0) return;
  t.sh.getRange(i + 2, COLS.indexOf('status') + 1).setNumberFormat('@').setValue(status);
  const a = {};
  COLS.forEach(function (c, j) { a[c] = t.rows[i][j]; });
  a.status = status;
  const ev = evento(a.evento);
  if (ev) ev.setTitle(titulo(a));
}

function remover(id) {
  const t = linhas();
  const i = acharLinha(t.rows, id);
  if (i < 0) return;
  const ev = evento(t.rows[i][COLS.indexOf('evento')]);
  if (ev) ev.deleteEvent();
  t.sh.deleteRow(i + 2);
}

// ---------- Mapa ----------

// Localiza um endereço (serviço de mapas do próprio Google, sem chave de API).
// Devolve {lat, lng, cidade} ou null se não encontrar.
function geo(end) {
  end = String(end || '').trim();
  if (!end) return null;
  const cache = CacheService.getScriptCache();
  const k = 'geo:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, end.toLowerCase()));
  const salvo = cache.get(k);
  if (salvo) return JSON.parse(salvo);
  const r = Maps.newGeocoder().setRegion('us').geocode(end);
  let g = null;
  if (r.status === 'OK' && r.results.length) {
    const res = r.results[0];
    const cid = res.address_components.filter(function (c) { return c.types.indexOf('locality') > -1; })[0];
    g = { lat: res.geometry.location.lat, lng: res.geometry.location.lng, cidade: cid ? cid.long_name : '' };
  }
  cache.put(k, JSON.stringify(g), 21600);
  return g;
}

function lerCfg() {
  const s = PropertiesService.getScriptProperties().getProperty('cfg');
  return s ? JSON.parse(s) : null;
}

// ---------- Google Agenda ----------

function agenda() {
  const lista = CalendarApp.getCalendarsByName(NOME_AGENDA);
  return lista.length ? lista[0] : CalendarApp.createCalendar(NOME_AGENDA, { color: CalendarApp.Color.BLUE });
}

function evento(id) {
  if (!id) return null;
  try { return agenda().getEventById(id); } catch (err) { return null; }
}

function titulo(a) {
  return (a.status === 'confirmado' ? '✅ ' : '⏳ ') + 'Detail – ' + a.nome + ' (' + a.carro + ')';
}

function descricao(a) {
  return 'Cliente: ' + a.nome + '\nTelefone: ' + a.tel + '\nCarro(s): ' + a.carro + '\nServiço(s): ' + a.serv +
    '\nTotal: $' + Number(a.valor).toFixed(2) + (Number(a.dep) ? '\nSinal: $' + Number(a.dep).toFixed(2) : '');
}

function inicio(a) {
  const m = String(a.hora).match(/(\d+):(\d+) (AM|PM)/);
  const h = m ? (Number(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0) : 9;
  const min = m ? m[2] : '00';
  return Utilities.parseDate(a.data + ' ' + h + ':' + min, FUSO, 'yyyy-MM-dd H:mm');
}

function fim(a) {
  return new Date(inicio(a).getTime() + (Number(a.n) || 1) * HORAS_POR_CARRO * 3600000);
}

// Horários ocupados na agenda principal e compromissos colocados à mão na agenda da Kings.
// Os eventos criados pelo sistema já vêm da planilha, então não entram aqui.
function ocupados() {
  const de = new Date();
  de.setHours(0, 0, 0, 0);
  const ate = new Date(de.getTime() + DIAS_A_FRENTE * 86400000);
  const doSistema = {};
  linhas().rows.forEach(function (r) { doSistema[r[COLS.indexOf('evento')]] = true; });

  const eventos = CalendarApp.getDefaultCalendar().getEvents(de, ate)
    .concat(agenda().getEvents(de, ate).filter(function (ev) { return !doSistema[ev.getId()]; }));

  const busy = [];
  eventos.forEach(function (ev) {
    if (ev.getMyStatus && ev.getMyStatus() === CalendarApp.GuestStatus.NO) return;
    const s = ev.getStartTime(), f = ev.getEndTime();
    const diaS = dia(s), diaF = dia(new Date(f.getTime() - 1));
    let d = diaS;
    while (d <= diaF) {
      busy.push({ data: d, ini: d === diaS ? minutos(s) : 0, fim: d === diaF ? (minutos(f) || 1440) : 1440 });
      d = dia(new Date(Utilities.parseDate(d + ' 12:00', FUSO, 'yyyy-MM-dd HH:mm').getTime() + 86400000));
    }
  });
  return busy;
}

function dia(d) { return Utilities.formatDate(d, FUSO, 'yyyy-MM-dd'); }
function minutos(d) { const p = Utilities.formatDate(d, FUSO, 'H:mm').split(':'); return Number(p[0]) * 60 + Number(p[1]); }


// ---------- Financeiro ----------
// Lançamentos ficam na aba "Financeiro" da mesma planilha. O valor é com sinal:
// positivo = entrou, negativo = saiu.

const COLS_FIN = ['id', 'data', 'valor', 'desc', 'cat', 'conta', 'nchk', 'nota', 'origem', 'ext', 'contaNome', 'criado'];
const HORAS_BANCO = 6; // de quantas em quantas horas o script busca o banco sozinho

function finAba() {
  const ss = planilha().getParent();
  let sh = ss.getSheetByName('Financeiro');
  if (!sh) {
    sh = ss.insertSheet('Financeiro');
    sh.getRange(1, 1, 1, COLS_FIN.length).setValues([COLS_FIN]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function finLinhas() {
  const sh = finAba();
  const n = sh.getLastRow() - 1;
  return { sh: sh, rows: n < 1 ? [] : sh.getRange(2, 1, n, COLS_FIN.length).getDisplayValues() };
}

function finObj(r) {
  const t = {};
  COLS_FIN.forEach(function (c, j) { t[c] = r[j]; });
  t.valor = Number(t.valor) || 0;
  return t;
}

function finLinha(t) {
  return COLS_FIN.map(function (c) {
    if (c === 'valor') return (Number(t.valor) || 0).toFixed(2);
    return t[c] === undefined || t[c] === null ? '' : String(t[c]);
  });
}

function finListar() {
  return finLinhas().rows.filter(function (r) { return r[0]; }).map(finObj);
}

function finAdicionar(txs) {
  if (!txs || !txs.length) return 0;
  const t = finLinhas();
  const ids = {}, exts = {};
  t.rows.forEach(function (r) { ids[r[0]] = 1; if (r[9]) exts[r[9]] = 1; });
  const novas = [];
  txs.forEach(function (x) {
    if (!x || !x.id || ids[x.id] || (x.ext && exts[x.ext])) return; // repetido: ignora
    ids[x.id] = 1;
    if (x.ext) exts[x.ext] = 1;
    if (!x.criado) x.criado = new Date().toISOString();
    novas.push(finLinha(x));
  });
  if (novas.length) t.sh.getRange(t.sh.getLastRow() + 1, 1, novas.length, COLS_FIN.length).setNumberFormat('@').setValues(novas);
  return novas.length;
}

function finAtualizar(x) {
  if (!x || !x.id) return;
  const t = finLinhas();
  const i = acharLinha(t.rows, x.id);
  if (i < 0) { finAdicionar([x]); return; }
  t.sh.getRange(i + 2, 1, 1, COLS_FIN.length).setNumberFormat('@').setValues([finLinha(x)]);
}

function finRemover(id) {
  const t = finLinhas();
  const i = acharLinha(t.rows, id);
  if (i > -1) t.sh.deleteRow(i + 2);
}

function finCfg() {
  const s = PropertiesService.getScriptProperties().getProperty('fin_cfg');
  return s ? JSON.parse(s) : null;
}

// Mesmas regras do sistema: a primeira palavra que aparecer na descrição define a categoria.
function finRegra(cfg, desc, conta) {
  if (!cfg || !cfg.regras) return '';
  const d = String(desc || '').toLowerCase();
  for (let i = 0; i < cfg.regras.length; i++) {
    const r = cfg.regras[i];
    if (r.k && d.indexOf(String(r.k).toLowerCase()) > -1 && (!r.conta || r.conta === conta)) return r.cat;
  }
  return '';
}

// ---------- Banco (SimpleFIN Bridge) ----------
// O SimpleFIN se conecta ao Bank of America (somente leitura). O sistema manda o
// "Setup Token" uma vez; aqui ele vira um link de acesso guardado só neste script.

function finConectar(token) {
  let claim;
  try { claim = Utilities.newBlob(Utilities.base64Decode(String(token || '').trim())).getDataAsString(); } catch (err) { claim = ''; }
  if (!/^https:\/\//.test(claim)) return { ok: false, erro: 'Setup Token inválido. Copie de novo do SimpleFIN.' };
  const r = UrlFetchApp.fetch(claim, { method: 'post', muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { ok: false, erro: 'O SimpleFIN recusou o token (cada token só funciona uma vez). Gere um novo.' };
  const props = PropertiesService.getScriptProperties();
  props.setProperty('fin_sf', r.getContentText().trim());
  props.deleteProperty('fin_pull');
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'puxarBanco') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('puxarBanco').timeBased().everyHours(HORAS_BANCO).create();
  return finPuxar();
}

function finDesligar() {
  const props = PropertiesService.getScriptProperties();
  ['fin_sf', 'fin_pull', 'fin_contas', 'fin_erro'].forEach(function (k) { props.deleteProperty(k); });
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'puxarBanco') ScriptApp.deleteTrigger(t); });
}

function finBancoInfo() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('fin_sf')) return { on: false };
  return {
    on: true,
    pull: Number(props.getProperty('fin_pull')) || 0,
    contas: JSON.parse(props.getProperty('fin_contas') || '[]'),
    erro: props.getProperty('fin_erro') || ''
  };
}

// Roda sozinho a cada HORAS_BANCO horas (gatilho criado ao conectar o banco).
function puxarBanco() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { finPuxar(); } finally { lock.releaseLock(); }
}

function finPuxar() {
  const props = PropertiesService.getScriptProperties();
  const acesso = props.getProperty('fin_sf');
  if (!acesso) return { ok: false, erro: 'banco_off' };
  const m = acesso.match(/^(https?:\/\/)([^:@\/]+):([^@\/]+)@(.+)$/);
  if (!m) return { ok: false, erro: 'Link do SimpleFIN inválido. Conecte o banco de novo.' };

  // Primeira vez: últimos 60 dias. Depois: desde a última busca, com folga de 10 dias.
  const ultima = Number(props.getProperty('fin_pull')) || 0;
  const desde = Math.floor((ultima ? ultima - 10 * 86400000 : Date.now() - 60 * 86400000) / 1000);
  const r = UrlFetchApp.fetch(m[1] + m[4] + '/accounts?start-date=' + desde, {
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(decodeURIComponent(m[2]) + ':' + decodeURIComponent(m[3])) },
    muteHttpExceptions: true
  });
  if (r.getResponseCode() === 403) return { ok: false, erro: 'O SimpleFIN cancelou o acesso. Conecte o banco de novo.' };
  if (r.getResponseCode() !== 200) return { ok: false, erro: 'SimpleFIN respondeu ' + r.getResponseCode() + '. Tente mais tarde.' };
  const d = JSON.parse(r.getContentText());
  const cfg = finCfg();
  const txs = [], contas = [];

  (d.accounts || []).forEach(function (a) {
    const org = a.org && (a.org.name || a.org.domain) || '';
    const conta = /venmo/i.test(org + ' ' + a.name) ? 'venmo' : /bank of america|bofa/i.test(org + ' ' + a.name) ? 'boa' : 'outro';
    contas.push({ nome: a.name, org: org, saldo: Number(a.balance) || 0, data: Number(a['balance-date']) || 0 });
    (a.transactions || []).forEach(function (t) {
      if (t.pending || !t.posted) return;
      const valor = Number(t.amount) || 0;
      if (!valor) return;
      const desc = String(t.description || t.payee || '').replace(/\s+/g, ' ').trim();
      const ext = 'sf:' + a.id + ':' + t.id;
      txs.push({
        id: 'sf' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, ext)).slice(0, 16),
        data: Utilities.formatDate(new Date(t.posted * 1000), FUSO, 'yyyy-MM-dd'),
        valor: valor,
        desc: desc,
        cat: finRegra(cfg, desc + ' ' + (t.payee || ''), conta) || 'nc',
        conta: conta,
        nchk: '',
        nota: t.memo || '',
        origem: 'banco',
        ext: ext,
        contaNome: a.name
      });
    });
  });

  const novos = finAdicionar(txs);
  const erros = (d.errors || []).concat((d.errlist || []).map(function (e) { return e.msg || e.message || String(e); }));
  props.setProperty('fin_pull', String(Date.now()));
  props.setProperty('fin_contas', JSON.stringify(contas));
  props.setProperty('fin_erro', erros.join(' ').slice(0, 500));
  return { ok: true, novos: novos, banco: finBancoInfo() };
}
