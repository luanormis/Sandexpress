# Agente de Impressão SandExpress

Aplicativo local para descobrir filas USB do Windows e impressoras térmicas na rede privada, recebendo trabalhos enviados pelo painel HTTPS.

## Modelos validados pelo fluxo

- Epson TM-T20 / M249A (USB ou rede, conforme a interface instalada).
- Elgin/Bematech i8 (USB ou rede, conforme a interface instalada).
- Térmicas genéricas compatíveis com fila do Windows ou RAW/ESC-POS.

No Windows, instale primeiro o driver oficial do fabricante e confirme uma página de teste. Portas como `USB003` são encontradas automaticamente pelo agente. O nome mostrado em **Dispositivos e Impressoras** será o mesmo exibido no painel SandExpress.

## Teste no desktop

1. Instale Node.js 20 ou superior.
2. Abra esta pasta e execute `npm start`.
3. No painel do quiosque, abra **Impressoras** e clique em **Buscar USB e rede**.
4. Dê um nome operacional (Bar ou Cozinha), marque o destino e clique em **Adicionar**.
5. Para testar sem gastar papel, selecione **SandExpress térmica virtual** e imprima um pedido.
6. Confira o ticket criado na pasta `spool`.

As observações do pedido e as opções “Com gelo”, “Sem açúcar” e “Com limão” são impressas na seção **OBSERVAÇÕES DO PEDIDO**. A cópia do Bar contém bebidas, a da Cozinha contém alimentos e a do Caixa permanece consolidada.

O agente só escuta no próprio computador (`127.0.0.1`), aceita origens SandExpress e só envia trabalhos a endereços IPv4 privados.
