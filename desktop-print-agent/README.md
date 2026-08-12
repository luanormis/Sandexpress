# Agente de Impressão SandExpress

Aplicativo local para descobrir impressoras térmicas na rede privada e receber trabalhos enviados pelo painel HTTPS.

## Teste no desktop

1. Instale Node.js 20 ou superior.
2. Abra esta pasta e execute `npm start`.
3. No painel do quiosque, abra **Impressoras** e clique em **Buscar Wi‑Fi**.
4. Selecione **SandExpress térmica virtual** em uma rota e imprima um pedido.
5. Confira o ticket criado na pasta `spool`.

O agente só escuta no próprio computador (`127.0.0.1`), aceita origens SandExpress e só envia trabalhos a endereços IPv4 privados.
