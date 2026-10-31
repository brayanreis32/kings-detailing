# Kings of Detailing

Sistema de orçamento e agenda da Kings of Detailing.

Site: https://brayanreis32.github.io/kings-detailing/

## Integração com o Google Agenda (opcional)

Com a integração, a agenda e os preços ficam iguais em todos os aparelhos, cada
agendamento vira um evento na agenda "Kings of Detailing" do Google (3 horas por
carro) e os horários ocupados no seu Google Agenda ficam bloqueados no sistema.
Os agendamentos também ficam guardados numa planilha "Kings of Detailing – Agenda".
Também bloqueia, num dia que já tem cliente, os clientes que moram mais longe que o
limite de milhas definido em Preços.

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
