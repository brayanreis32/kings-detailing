# Kings of Detailing

Sistema de orçamento, agenda e financeiro da Kings of Detailing.

Site: https://brayanreis32.github.io/kings-detailing/

## Integração com o Google Agenda (opcional)

Com a integração, a agenda e os preços ficam iguais em todos os aparelhos, cada
agendamento vira um evento na agenda "Kings of Detailing" do Google (3 horas por
carro) e os horários ocupados no seu Google Agenda ficam bloqueados no sistema.
Os agendamentos também ficam guardados numa planilha "Kings of Detailing – Agenda".
Também bloqueia, num dia que já tem cliente, os clientes que moram mais longe que o
limite de milhas definido em Preços (padrão: 5 milhas).

1. Acesse https://script.google.com e clique em **Novo projeto**.
2. Apague o que estiver lá e cole o conteúdo de `google-apps-script/Code.gs`.
3. Troque `TROQUE-ESTA-CHAVE` por uma senha só sua e salve.
4. **Implantar → Nova implantação → App da Web**. Executar como: **Eu**.
   Quem pode acessar: **Qualquer pessoa**. Clique em **Implantar** e autorize.
5. Copie o link que termina em `/exec`.
6. No sistema, abra **Preços → Google Agenda**, cole o link e a chave e toque em **Salvar**.

Faça o passo 6 em cada aparelho que for usar.

**Atualizar o script depois de uma mudança:** cole o código novo no mesmo projeto,
salve e vá em **Implantar → Gerenciar implantações → ✏️ Editar → Versão: Nova versão
→ Implantar**. O link `/exec` continua o mesmo.

## Financeiro

Abra **Financeiro** no topo do site (ou `financeiro.html`). Lá você vê quanto entrou, quanto
saiu e com o que gastou, com gráficos de pizza por categoria e por forma de pagamento,
barras mês a mês e a lista de lançamentos com busca e filtros.

- **Cash, cheque, Zelle, cartão:** toque no **+** e lance na mão (cheque guarda o número).
- **Bank of America automático:** feito pelo [SimpleFIN Bridge](https://beta-bridge.simplefin.org),
  um serviço pago e barato que se conecta ao BoA só para leitura (o BoA não libera acesso
  direto para sistemas pessoais). Com o Google ligado, vá em **Contas → Bank of America
  automático**, cole o *Setup Token* e toque em Conectar. O script busca as transações
  sozinho a cada 6 horas e ao abrir o Financeiro.
- **Venmo:** se o Venmo aparecer no SimpleFIN, entra automático também. Se não, baixe o
  extrato em venmo.com → Statements → Download CSV e importe em **Contas → Importar extrato**.
  O CSV do Bank of America também pode ser importado do mesmo jeito.
- **Regras automáticas** (Ajustes) colocam cada gasto do banco na categoria certa pela
  descrição (ex.: "shell" → Combustível). Ao trocar a categoria de um lançamento do banco,
  marque "Sempre colocar nesta categoria" para criar a regra na hora.
- Depósitos, saques, pagamento do cartão e envios para o Venmo contam como
  **Transferência**, que não soma em Entrou/Saiu. Assim o cheque ou cash lançado na mão
  não é contado de novo quando você deposita no banco.

Os lançamentos ficam numa aba **Financeiro** da mesma planilha da agenda. Depois de
atualizar o `Code.gs` para esta versão, faça uma **Nova versão** da implantação (passo
acima) e autorize de novo: o Google vai pedir permissão para acessar serviços externos
(o SimpleFIN) e para rodar o script sozinho de tempos em tempos.
