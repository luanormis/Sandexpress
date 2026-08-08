# Impressoras por quiosque

## O que foi implementado

- Cadastro, busca, ativação e remoção de impressoras no painel do quiosque.
- Três destinos: alimentos/cozinha, bebidas/bar e caixa.
- Separação dos itens pela categoria cadastrada no produto.
- Via do caixa sempre consolidada, com todos os itens e o total da conta.
- Comandas de produção sem valores financeiros, preservando o foco operacional.
- Configuração isolada por `vendor_id`, salva no histórico de `analytics_events` com o evento `printer_config`.

## Como usar

1. Abra o painel do quiosque e acesse **Impressoras**.
2. Digite o nome que identifica a impressora no computador ou tablet.
3. Escolha o destino e clique em **Adicionar**.
4. Cadastre uma impressora para cada destino desejado. É possível ter mais de uma impressora no mesmo destino.
5. Em **Pedidos**, abra um pedido e clique em **Imprimir comandas**.
6. Em cada janela do navegador, selecione a impressora cujo nome aparece no cabeçalho.

## Limite técnico do navegador

Uma aplicação web comum não pode enumerar impressoras instaladas, escolher uma impressora física nem imprimir silenciosamente. Essa restrição é deliberada nos navegadores. Por isso, a busca disponível procura impressoras já cadastradas no quiosque, e a seleção física é confirmada na janela de impressão do navegador.

Para impressão totalmente automática e silenciosa, será necessário instalar no equipamento do quiosque um agente local de impressão (por exemplo, QZ Tray ou um serviço próprio) e integrá-lo por conexão segura. A estrutura de destinos criada nesta alteração pode ser reutilizada por esse agente.

## Regra de roteamento

São tratadas como bebidas as categorias que contenham termos como bebida, cerveja, drink, dose, álcool, refrigerante, suco, água, energético ou vinho. Os demais itens são enviados a alimentos/cozinha. A via do caixa recebe todos os itens, sem alterar a comanda ou os cálculos existentes.

## Arquivos principais

- `src/components/vendor/PrinterManager.tsx`: tela de configuração.
- `src/components/vendor/OrderPrintButton.tsx`: geração das comandas.
- `src/lib/printer-routing.ts`: validação e regra de separação.
- `src/app/api/printer-settings/route.ts`: persistência autenticada.
- `src/app/api/orders/route.ts` e `src/lib/order-kanban.ts`: inclusão da categoria no item exibido no painel.

## Validação

Os testes de roteamento cobrem categorias com acentos, separação de alimentos/bebidas, consolidação do caixa e rejeição de configuração inválida.
