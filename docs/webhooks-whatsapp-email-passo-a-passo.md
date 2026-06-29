# Webhooks WhatsApp e Email - passo a passo

## WhatsApp oficial Meta

1. Entre em https://developers.facebook.com/.
2. Clique em **Meus apps**.
3. Abra o app usado pelo SandExpress ou crie um app do tipo **Business**.
4. No menu do app, clique em **WhatsApp**.
5. Entre em **API Setup**.
6. Copie o **Phone number ID** e coloque no Vercel como `META_WHATSAPP_PHONE_NUMBER_ID`.
7. Copie o **Temporary access token** para teste, ou gere um token permanente no Business Manager, e coloque como `META_WHATSAPP_ACCESS_TOKEN`.
8. No Vercel, coloque também:
   - `META_GRAPH_API_VERSION=v25.0`
   - `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN=uma-palavra-secreta-que-voce-criou`
   - `OTP_STATIC_CODE=102121`
   - `OTP_PEPPER=um-texto-secreto-com-32-ou-mais-caracteres`
   - `OTP_TTL_SECONDS=300`

## Configurar o webhook na Meta

1. Ainda no app da Meta, vá em **WhatsApp > Configuration**.
2. Em **Webhook**, clique em **Edit**.
3. Em **Callback URL**, coloque:
   `https://SEU-DOMINIO/api/whatsapp/meta/webhook`
4. Em **Verify token**, coloque o mesmo texto salvo em `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
5. Salve.
6. Em **Webhook fields**, assine o campo **messages**.

## Como o cliente valida o telefone

1. O cliente escaneia o QR Code do guarda-sol.
2. Ele informa nome e telefone.
3. Ele manda no WhatsApp do quiosque exatamente:
   `obter codigo de validação para o sandexpress`
4. O webhook responde com:
   `102121`
5. O cliente digita `102121` no SandExpress e abre a comanda.
6. Se esse telefone já estiver salvo para o quiosque, o próximo login não exige validar de novo.

## Email com Resend

1. Entre em https://resend.com/.
2. Clique em **API Keys**.
3. Clique em **Create API Key**.
4. Copie a chave que começa com `re_`.
5. No Vercel, salve como `RESEND_API_KEY`.
6. Em **Domains**, adicione o domínio de envio, por exemplo `sandexpress.com.br`.
7. Copie os registros DNS que o Resend mostrar.
8. Abra o painel onde comprou o domínio.
9. Cole os registros DNS.
10. Volte no Resend e clique para verificar o domínio.
11. No Vercel, salve `EMAIL_FROM=SandExpress <no-reply@sandexpress.com.br>`.

Se o email ou WhatsApp falhar por chave inválida, confira primeiro se a variável foi salva no projeto certo do Vercel e faça um novo deploy.
