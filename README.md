# SandExpress

Sistema web para operacao de quiosques, barracas e servicos de praia. O SandExpress conecta o cliente ao quiosque por QR Code no guarda-sol, permite abrir comanda, fazer pedidos, acompanhar a conta, chamar atendimento e solicitar fechamento. Para o quiosque, oferece painel de pedidos, cardapio, estoque, guarda-sois, QR Codes, clientes, equipe e relatorios. Para a plataforma, oferece painel administrativo para cadastro, acompanhamento comercial e analytics dos quiosques.

## Visao geral

O produto foi pensado para reduzir atrito no atendimento de praia:

1. O cliente escaneia o QR Code do guarda-sol.
2. O sistema identifica o quiosque e o guarda-sol.
3. O cliente informa nome, celular e quantidade de pessoas.
4. A comanda e aberta no navegador do cliente.
5. O cliente escolhe produtos do cardapio e envia pedidos.
6. O quiosque recebe os pedidos no painel operacional.
7. A equipe acompanha preparo, entrega, estoque e fechamento.
8. O cliente pode pedir a conta e o quiosque confirma o pagamento.
9. A plataforma acompanha faturamento, assinaturas e desempenho geral.

## Stack

- Next.js 16.2.2 com App Router.
- React 19.2.4.
- TypeScript.
- Supabase para banco, storage e acesso administrativo.
- Tailwind CSS 4.
- Lucide React para icones.
- QRCode para geracao de QR Codes.
- next-pwa e service worker para experiencia instalavel.

## Perfis do sistema

### Cliente

Pessoa sentada em um guarda-sol, acessando o sistema pelo celular via QR Code.

O cliente deve conseguir:

- Abrir o cardapio pelo QR Code do guarda-sol.
- Ver o nome do quiosque e o numero do guarda-sol.
- Abrir uma comanda com nome, celular e quantidade de pessoas.
- Manter a sessao da comanda no mesmo navegador por 12 horas.
- Navegar por categorias do cardapio.
- Ver nome, descricao, categoria, preco normal e preco promocional dos produtos.
- Adicionar produtos ao carrinho.
- Aumentar e diminuir quantidades.
- Inserir observacoes para cozinha ou atendimento.
- Enviar pedido para o quiosque.
- Ver pedidos enviados e total em aberto.
- Chamar garcom pelo botao de atendimento.
- Solicitar fechamento da conta.
- Instalar atalho/PWA quando suportado pelo navegador.

O MVP atual tem validacao por WhatsApp/OTP via Meta Cloud API para cadastro publico e abertura de comanda. Sem as chaves da Meta preenchidas, o sistema principal continua compilando, mas o envio real de OTP fica bloqueado e o `/api/health` aponta a pendencia.

### Quiosque

Proprietario, gerente, vendedor ou operador responsavel pela operacao diaria.

O quiosque deve conseguir:

- Fazer login por CPF/CNPJ ou login de equipe e senha.
- Recuperar senha por email cadastrado.
- Acessar painel operacional.
- Ver pedidos em formato kanban por status.
- Avancar pedidos entre etapas operacionais.
- Cadastrar, editar, ativar, desativar e remover produtos.
- Definir categorias, descricoes, precos, preco promocional, ordem, combo e disponibilidade.
- Enviar imagens de produtos.
- Usar galeria de imagens por plano.
- Gerenciar estoque na abertura do dia.
- Bloquear venda automaticamente quando o estoque chegar a zero.
- Gerar e visualizar QR Codes dos guarda-sois.
- Cadastrar, ativar e desativar guarda-sois.
- Visualizar clientes, busca-los por nome ou telefone e consultar dados de consumo.
- Criar usuarios de equipe com login, senha e papel.
- Fechar conta por guarda-sol ou telefone do cliente.
- Confirmar metodo de pagamento.
- Liberar guarda-sol apos pagamento.
- Gerar relatorios do dia.
- Exportar relatorio diario por impressao/PDF do navegador.
- Consultar indicadores do periodo.
- Fechar o dia e consolidar dados em relatorios.

### Administrador da plataforma

Operador interno da SandExpress, com acesso ao painel global.

O administrador deve conseguir:

- Fazer login com senha administrativa.
- Visualizar KPIs gerais da plataforma.
- Cadastrar novos quiosques com 3 dias gratis de avaliacao.
- Registrar responsavel, telefone, email, CPF ou CNPJ, praia, cidade, estado e senha inicial.
- Listar quiosques.
- Buscar quiosques por nome, responsavel ou cidade.
- Ver detalhes do quiosque.
- Acompanhar status de assinatura: trial, ativo, inadimplente e bloqueado.
- Identificar trials proximos do vencimento.
- Contatar responsaveis por WhatsApp ou email.
- Acompanhar faturamento total, pedidos, visitantes, itens vendidos, ticket medio e pico de venda.
- Filtrar analytics por quiosque, cidade, praia, produto e periodo.
- Ver rankings de quiosques, produtos, categorias, cidades e praias.
- Acompanhar valores recebidos, a receber e inadimplencia.

## Rotas principais

### Publicas e cliente

- `/` - pagina inicial/redirecionamento do projeto.
- `/u/[umbrella_id]` - rota antiga de cliente. No MVP atual, sem `vendor_id`, exibe mensagem para gerar novo QR Code.
- `/u/[vendor_id]/[umbrella_id]` - rota atual do QR Code do cliente.

### Quiosque

- `/vendor/login` - login do quiosque e recuperacao de senha.
- `/vendor/dashboard` - painel gerencial principal.
- `/vendor/close-account` - fechamento de conta.
- `/vendor/daily-report` - relatorio diario.
- `/vendor/reset-password` - redefinicao de senha.

### Administracao

- `/admin` - painel administrativo da plataforma.
- `/admin/adjustments` - gerenciador de ajustes de conta.
- `/kiosk-config` - configuracao visual do quiosque.

## Fluxo do cliente em detalhes

### 1. Entrada por QR Code

O QR Code deve apontar para:

```text
/u/{vendor_id}/{umbrella_id}
```

Ao abrir a rota, o frontend chama:

```text
GET /api/public/umbrella/{umbrellaId}?vendor_id={vendorId}
```

O sistema deve retornar:

- Dados do quiosque.
- Dados do guarda-sol.
- Produtos ativos do quiosque.

Se o QR for antigo, sem `vendor_id`, o sistema orienta gerar um novo QR Code no painel.

### 2. Abertura da comanda

O cliente informa:

- Nome.
- Celular.
- Quantidade de pessoas.

O sistema chama:

```text
POST /api/customers/login
```

Regras:

- Nome deve ter pelo menos 2 caracteres.
- Celular deve ter pelo menos 10 digitos.
- `vendor_id` e obrigatorio.
- Se houver `umbrella_id`, o guarda-sol deve pertencer ao quiosque.
- Guarda-sol inativo nao pode abrir comanda.
- Guarda-sol ocupado por outro cliente nao pode abrir nova comanda.
- Quantidade de pessoas deve ficar entre 1 e 50.
- Cliente existente por telefone e atualizado.
- Cliente novo e criado.
- Cookie `customer_session` e criado por 12 horas.

### 3. Cardapio e carrinho

O cliente deve ver:

- Total em aberto.
- Categorias dinamicas a partir dos produtos.
- Lista de produtos filtravel por categoria.
- Preco efetivo considerando preco promocional quando existir.

No carrinho, o cliente deve conseguir:

- Adicionar produto.
- Somar quantidade.
- Reduzir quantidade.
- Remover item ao reduzir para zero.
- Adicionar observacoes.
- Enviar pedido.

### 4. Criacao de pedido

O envio chama:

```text
POST /api/orders
```

Regras:

- `vendor_id`, `customer_id`, `umbrella_id` e itens sao obrigatorios.
- A sessao deve existir.
- Cliente so pode criar pedido para sua propria sessao.
- Quiosque so pode criar pedido para o seu proprio `vendor_id`.
- Guarda-sol deve existir, estar ativo e pertencer ao quiosque.
- Produtos devem existir, estar ativos, pertencer ao mesmo quiosque e ao mesmo tenant.
- O preco nunca deve ser confiado no cliente; o backend recalcula usando o banco.
- Produto bloqueado por estoque nao pode ser vendido.
- Estoque insuficiente deve impedir o pedido.
- Ao criar pedido, o sistema cria tambem os itens.
- Se houver estoque controlado, o sistema decrementa estoque.
- Quando o estoque chega a zero, o produto deve ser bloqueado por estoque.
- O guarda-sol e marcado como ocupado.
- O total gasto do cliente e atualizado.

Status previstos de pedido:

- `received` - recebido.
- `preparing` - em preparo.
- `delivering` - em entrega.
- `completed` - finalizado/pago.
- `cancelled` - cancelado.
- `closing_requested` - cliente pediu fechamento da conta.

### 5. Pedido de fechamento de conta

O cliente pode solicitar fechamento chamando:

```text
POST /api/close-account
```

Com `request_only: true`.

Regras:

- Deve existir conta aberta.
- A conta deve pertencer ao cliente da sessao.
- O pedido passa para `closing_requested`.
- O quiosque deve visualizar o pedido para cobrar e finalizar.

## Painel do quiosque em detalhes

### Login e sessao

Endpoint:

```text
POST /api/auth/vendor
```

O sistema deve aceitar:

- Proprietario do quiosque via `document_login` e senha.
- Usuario de equipe via login e senha.

Regras:

- Senhas sao verificadas por hash com `crypto.scrypt`.
- Quiosque inativo ou bloqueado nao pode entrar.
- Sessao `vendor_session` dura 12 horas.
- O frontend tambem guarda `vendor_id` e token em `sessionStorage`/`localStorage` para uso nas telas.
- Quando `must_change_password` vier ativo, o usuario deve ser orientado a trocar a senha.

### Pedidos

No dashboard, a aba de pedidos deve:

- Listar pedidos do quiosque.
- Exibir guarda-sol, cliente, telefone, horario, itens e total.
- Destacar novos pedidos.
- Exibir observacoes do pedido.
- Organizar por colunas/status.
- Permitir avancar pedido para a proxima etapa.

Endpoints:

```text
GET /api/orders?vendor_id={id}
GET /api/orders?vendor_id={id}&status={status}
PATCH /api/orders/{id}
```

### Cardapio

O quiosque deve conseguir:

- Criar produto.
- Editar produto.
- Excluir produto.
- Ativar/desativar produto.
- Informar nome, categoria, descricao, preco, preco promocional, imagem, combo e ordem.
- Filtrar produtos por categoria.
- Enviar imagem do produto.

Endpoints:

```text
GET /api/products?vendor_id={id}
POST /api/products
PATCH /api/products/{id}
DELETE /api/products/{id}
POST /api/products/upload
POST /api/products/{id}/upload-image
GET /api/products/gallery
```

Categorias usadas no painel:

- Bebidas.
- Alcoolicos.
- Nao Alcoolicos.
- Comidas.
- Petiscos.
- Sobremesas.
- Combos.
- Extras.

### Imagens e planos

O sistema diferencia imagens:

- Imagem padrao.
- Imagem personalizada.
- Imagem liberada por plano `free` ou `plus`.

O plano do quiosque deve controlar:

- Se pode enviar imagens.
- Quantidade maxima de imagens personalizadas.
- Quantidade ja usada.
- Possibilidade de tema customizado.

Tabelas envolvidas:

- `product_images`.
- `vendor_plans`.
- `products`.

### Guarda-sois e QR Codes

O painel deve permitir:

- Listar guarda-sois.
- Criar guarda-sol por numero.
- Definir label.
- Ativar/desativar guarda-sol.
- Gerar QR Code.
- Armazenar `qr_url` no banco.
- Armazenar `qr_path` no banco.
- Excluir guarda-sol somente com senha do admin do quiosque; admin da plataforma usa `ADMIN_PASSWORD`.

Endpoints:

```text
GET /api/umbrellas?vendor_id={id}
POST /api/umbrellas
PATCH /api/umbrellas/{id}
DELETE /api/umbrellas/{id}
GET /api/qr?umbrella_id={id}&format=svg
GET /api/qr?umbrella_id={id}&format=png
```

Regras do QR Code:

- Em producao, `NEXT_PUBLIC_APP_URL` deve estar configurado.
- QR Code so pode ser gerado para guarda-sol ativo.
- O destino novo usa um caminho legivel por quiosque e guarda-sol: `/u/{slug-do-quiosque}/guarda-sol-{numero}-{umbrella_id}`.
- Exemplo: `/u/quiosque-x/guarda-sol-123-00000000-0000-0000-0000-000000000000`.
- O QR Code continua unico porque o UUID real do guarda-sol fica no final do caminho.
- O sistema ainda aceita o QR antigo `/u/{vendor_id}/{umbrella_id}` para compatibilidade.
- A geracao e feita no proprio codigo com a biblioteca gratuita `qrcode`; nao depende de ferramenta externa.
- Formato SVG retorna imagem SVG.
- Formato PNG retorna JSON com `qr_image_url` em data URL.
- `DELETE /api/umbrellas/{id}` exige corpo JSON com `vendor_password` para sessao de quiosque ou `admin_password` para sessao admin, e recusa excluir guarda-sol com conta aberta.

### Abertura do dia e estoque

Na abertura do dia, o quiosque deve:

- Carregar produtos ativos.
- Informar estoque inicial por produto.
- Salvar atualizacoes em lote.
- Bloquear automaticamente produto com estoque zero.
- Desbloquear produto quando estoque voltar a ser positivo.

Endpoints:

```text
GET /api/stock?vendor_id={id}
PUT /api/stock
```

Campos envolvidos:

- `products.stock_quantity`.
- `products.stock_tracking_enabled`.
- `products.physical_stock_quantity`.
- `products.beach_stock_quantity`.
- `products.blocked_by_stock`.
- `products.updated_at`.

Regras atuais:

- Cada produto pode marcar se contabiliza estoque.
- Estoque fisico representa a base/armazem.
- Estoque praia representa o saldo ativo para venda no dia.
- Na abertura do dia, a quantidade informada sai do estoque fisico e vai para o estoque praia.
- Vendas descontam apenas do estoque praia e apenas de produtos com `stock_tracking_enabled`.
- No fechamento do dia, a sobra do estoque praia volta para o estoque fisico.

### Fechamento de conta

O quiosque deve poder fechar conta:

- Por guarda-sol.
- Por telefone do cliente.

Endpoint:

```text
GET /api/close-account?vendor_id={id}&umbrella_id={umbrellaId}
GET /api/close-account?vendor_id={id}&customer_phone={phone}
POST /api/close-account
```

Regras:

- Busca apenas contas abertas e nao pagas.
- Status considerados abertos: `received`, `preparing`, `delivering`, `closing_requested`.
- Pode filtrar por telefone quando houver multiplas contas.
- Ao confirmar pagamento:
  - Pedido vira `completed`.
  - `paid` vira `true`.
  - Metodo de pagamento e gravado.
  - Guarda-sol e liberado.
  - Cliente recebe atualizacao de visita.

Metodos de pagamento previstos:

- Dinheiro.
- PIX.
- Cartao de debito.
- Cartao de credito.

O quiosque pode configurar taxas percentuais de PIX, debito e credito na area de personalizacao. Ao fechar conta, o sistema grava valor bruto, taxa, valor liquido e metodo de pagamento para alimentar os relatorios.

### Clientes

O quiosque deve conseguir:

- Listar clientes.
- Buscar por nome ou telefone.
- Ver telefone, visitas, total gasto e ultima visita.
- Abrir detalhe do cliente.
- Ver ticket medio calculado por total gasto dividido por visitas.
- Identificar cliente novo, recorrente ou fiel.

Endpoint:

```text
GET /api/customers?vendor_id={id}
GET /api/customers/{id}/orders
```

### Equipe

O quiosque deve conseguir:

- Criar usuario de equipe.
- Informar nome, email opcional, login, papel e senha.
- Confirmar senha.
- Exigir senha minima de 8 caracteres.
- Listar usuarios cadastrados.

Endpoint:

```text
GET /api/vendor-users?vendor_id={id}
POST /api/vendor-users
```

Papeis previstos:

- `seller` - vendedor.
- `manager` - gerente.
- `owner` - proprietario.

### Relatorios do quiosque

O dashboard deve exibir:

- Receita total.
- Total de pedidos.
- Ticket medio.
- Clientes unicos.
- Produtos disponiveis.
- Guarda-sois ativos.
- Pedidos de hoje.
- Receita de hoje.
- Novos clientes do dia.
- Produtos mais vendidos.
- Clientes principais.
- Vendas por hora.

Endpoint:

```text
GET /api/reports?vendor_id={id}&period={period}
```

Periodos previstos:

- Dia.
- Semana.
- Mes.
- Intervalos implementados pela API.

### Relatorio diario e fechamento do dia

O sistema deve permitir:

- Buscar relatorio por data.
- Ver faturamento total.
- Ver pedidos completados.
- Ver clientes unicos.
- Ver ticket medio.
- Ver metodos de pagamento.
- Ver top produtos.
- Ver vendas por hora.
- Ver todos os pedidos do dia.
- Exportar por impressao/PDF do navegador.
- Consolidar vendas pagas no fechamento do dia.

Endpoints:

```text
GET /api/daily-report?vendor_id={id}&date={yyyy-mm-dd}
POST /api/daily-report
```

## Administracao da plataforma

### Autenticacao admin

Endpoint:

```text
POST /api/auth/admin
```

Regras:

- Senha vem de `ADMIN_PASSWORD`.
- Se `ADMIN_PASSWORD` nao estiver configurada, o login admin falha. Nao existe fallback local.
- Sessao `admin_session` dura 12 horas.
- Comparacao usa `crypto.timingSafeEqual`.

### Cadastro de quiosques

O admin deve cadastrar:

- Nome do quiosque.
- Praia.
- Cidade.
- Estado.
- Nome do responsavel.
- WhatsApp.
- Email.
- CPF ou CNPJ.
- Senha inicial.
- Confirmacao de senha.

Endpoint:

```text
POST /api/vendors/register
```

Regras:

- Email e obrigatorio.
- Telefone e obrigatorio.
- Praia, cidade e estado sao obrigatorios.
- CPF ou CNPJ e obrigatorio.
- Senha deve ter pelo menos 8 caracteres.
- Confirmacao de senha deve bater.
- O quiosque inicia em trial de 3 dias.
- O limite inicial de guarda-sois e 50.

### Gestao de quiosques

Endpoints:

```text
GET /api/vendors
GET /api/vendors/{id}
PATCH /api/vendors/{id}
```

O painel deve exibir:

- Nome do quiosque.
- Responsavel.
- Telefone.
- Email.
- Cidade/estado.
- Praia.
- CPF/CNPJ.
- Plano.
- Status de assinatura.
- Data de cadastro.
- Maximo de guarda-sois.
- Acoes de contato.

Status de assinatura:

- `trial`.
- `active`.
- `overdue`.
- `blocked`.

### Analytics da plataforma

Endpoint:

```text
GET /api/reports/platform
```

Filtros:

- `vendor_id`.
- `city`.
- `beach`.
- `product`.
- `from`.
- `to`.

Indicadores:

- GMV.
- Pedidos totais.
- Clientes totais.
- Visitantes.
- Produtos vendidos.
- Ticket medio.
- Quiosques ativos.
- Quiosques em trial.
- Quiosques inadimplentes.
- Quiosques bloqueados.
- Retencao.
- Recebido mensal.
- A receber no proximo ciclo.
- Valor inadimplente.
- Hora de pico.

Rankings:

- Quiosques por receita.
- Produtos mais vendidos.
- Categorias.
- Cidades.
- Praias/localizacoes.
- Horario mais forte por produto.

## Ajustes de conta

A area de ajustes deve permitir:

- Selecionar cliente.
- Escolher tipo de ajuste.
- Informar valor.
- Informar motivo.
- Confirmar senha do quiosque.
- Registrar historico.
- Atualizar listagens apos o ajuste.

Tipos de ajuste:

- `cancellation` - cancelamento.
- `deduction` - abatimento.
- `credit` - credito.

Endpoint:

```text
GET /api/adjustments?vendor_id={id}
POST /api/adjustments
```

## PWA e instalacao

O sistema inclui componentes para:

- Registrar service worker.
- Exibir botao de instalacao/atalho.
- Melhorar uso em celular por clientes e operadores.

Componentes:

- `ServiceWorkerRegister`.
- `InstallShortcutButton`.

## Modelo de dados principal

### `tenants`

Representa isolamento logico da operacao.

Campos principais:

- `id`.
- `name`.
- `status`.
- `city`.
- `state`.
- `region`.
- `beach_name`.
- `primary_color`.
- `secondary_color`.
- `button_color`.
- `button_text_color`.
- `logo_url`.

### `vendors`

Representa o quiosque/barraca.

Campos principais:

- `id`.
- `tenant_id`.
- `name`.
- `document_login`.
- `cpf`.
- `cnpj`.
- `owner_name`.
- `owner_phone`.
- `owner_email`.
- `logo_url`.
- `primary_color`.
- `secondary_color`.
- `button_color`.
- `button_text_color`.
- `password_hash`.
- `password_needs_reset`.
- `subscription_status`.
- `trial_ends_at`.
- `plan_type`.
- `plan_expires_at`.
- `max_umbrellas`.
- `is_active`.

### Dados reais e storage

O script `infra/sql-iniciar-novo-projeto.sql` nao insere quiosques, praias, produtos, guarda-sois, clientes ou pedidos de exemplo. Ele cria somente estrutura, politicas, indices, buckets e configuracoes de plataforma necessarias para o sistema iniciar com dados reais.

Buckets esperados no Supabase Storage:

- `product-images`: imagens reais de produtos e galeria publica.
- `kiosk-assets`: logos e assets reais dos quiosques, usando `logos/{vendor_id}/`.
- `order-archives`: arquivos privados de auditoria/fechamento.

Para bancos ja criados, rode `infra/sql-atualizacao-branding-quiosque-assets.sql` antes de testar upload de logo e cores de botao.

### `vendor_users`

Representa usuarios internos do quiosque.

Campos esperados:

- `id`.
- `tenant_id`.
- `vendor_id`.
- `name`.
- `email`.
- `login`.
- `role`.
- `password_hash`.
- `active`.

### `customers`

Representa clientes do quiosque.

Campos principais:

- `id`.
- `tenant_id`.
- `vendor_id`.
- `name`.
- `phone`.
- `party_size`.
- `visit_count`.
- `total_spent`.
- `last_visit_at`.

### `umbrellas`

Representa guarda-sois, mesas ou pontos de atendimento.

Campos principais:

- `id`.
- `tenant_id`.
- `vendor_id`.
- `number`.
- `label`.
- `location_hint`.
- `active`.
- `qr_url`.
- `qr_path`.
- `is_occupied`.
- `current_order_id`.

### `products`

Representa itens do cardapio.

Campos principais:

- `id`.
- `tenant_id`.
- `vendor_id`.
- `category`.
- `name`.
- `description`.
- `price`.
- `promotional_price`.
- `image_url`.
- `is_default_image`.
- `image_plan_type`.
- `active`.
- `is_combo`.
- `sort_order`.
- `stock_quantity`.
- `blocked_by_stock`.

### `orders`

Representa uma conta/pedido.

Campos principais:

- `id`.
- `tenant_id`.
- `vendor_id`.
- `customer_id`.
- `umbrella_id`.
- `status`.
- `total`.
- `notes`.
- `paid`.
- `payment_method`.
- `close_requested_at`.

### `order_items`

Representa itens de um pedido.

Campos principais:

- `id`.
- `tenant_id`.
- `order_id`.
- `product_id`.
- `quantity`.
- `unit_price`.
- `subtotal`.
- `cancelled`.

### `vendor_plans`

Controla recursos por plano.

Campos principais:

- `id`.
- `vendor_id`.
- `plan_type`.
- `can_upload_images`.
- `max_custom_images`.
- `custom_images_used`.
- `custom_theme`.

### `product_images`

Galeria de imagens padrao por categoria/plano.

Campos principais:

- `id`.
- `category`.
- `title`.
- `image_url`.
- `description`.
- `plan_type`.

## APIs do sistema

### Autenticacao

- `POST /api/auth/admin` - login administrativo.
- `POST /api/auth/admin/recover` - recuperacao administrativa.
- `POST /api/auth/admin/reset-vendor` - redefinicao de senha de quiosque pelo admin.
- `POST /api/auth/vendor` - login do quiosque/equipe.
- `POST /api/auth/vendor/reset` - solicitacao de recuperacao de senha do quiosque.
- `POST /api/auth/vendor/change-password` - troca de senha do quiosque.
- `POST /api/customers/login` - abertura de comanda/sessao do cliente.

### Cliente e pedidos

- `GET /api/public/umbrella/[umbrellaId]` - dados publicos do guarda-sol, quiosque e cardapio.
- `GET /api/orders` - lista pedidos do quiosque.
- `POST /api/orders` - cria pedido.
- `PATCH /api/orders/[id]` - atualiza pedido.
- `GET /api/customers` - lista clientes.
- `GET /api/customers/[id]/orders` - pedidos de um cliente.
- `GET /api/close-account` - consulta conta aberta.
- `POST /api/close-account` - solicita ou confirma fechamento.

### Operacao do quiosque

- `GET /api/products` - lista produtos.
- `POST /api/products` - cria produto.
- `PATCH /api/products/[id]` - atualiza produto.
- `DELETE /api/products/[id]` - remove produto.
- `GET /api/products/gallery` - lista galeria de imagens.
- `POST /api/products/upload` - upload de imagem.
- `POST /api/products/[id]/upload-image` - upload para produto existente.
- `GET /api/stock` - consulta estoque.
- `PUT /api/stock` - atualiza estoque.
- `GET /api/umbrellas` - lista guarda-sois.
- `POST /api/umbrellas` - cria guarda-sol.
- `PATCH /api/umbrellas/[id]` - atualiza guarda-sol.
- `GET /api/qr` - gera QR Code.
- `GET /api/vendor-users` - lista equipe.
- `POST /api/vendor-users` - cria usuario de equipe.

### Relatorios e plataforma

- `GET /api/reports` - relatorios do quiosque.
- `GET /api/reports/platform` - analytics da plataforma.
- `GET /api/daily-report` - relatorio diario.
- `POST /api/daily-report` - fechamento/consolidacao do dia.
- `GET /api/vendors` - lista quiosques.
- `POST /api/vendors/register` - cadastra quiosque.
- `GET/PATCH /api/vendors/[id]` - consulta/atualiza quiosque.
- `GET /api/adjustments` - lista ajustes.
- `POST /api/adjustments` - cria ajuste.
- `GET /api/health` - saude da aplicacao.

## Variaveis de ambiente

Crie `.env.local` com:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=
ADMIN_PASSWORD=
NEXT_PUBLIC_APP_URL=
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_ACCESS_TOKEN=
META_GRAPH_API_VERSION=v25.0
META_WHATSAPP_OTP_TEMPLATE_NAME=sandexpress_otp_ptbr
META_WHATSAPP_OTP_TEMPLATE_LANGUAGE=pt_BR
OTP_PEPPER=
OTP_TTL_SECONDS=300
RESEND_API_KEY=
EMAIL_FROM=
```

Recomendacoes:

- `SESSION_SECRET` deve ter pelo menos 32 caracteres em producao.
- `ADMIN_PASSWORD` deve ser configurada em producao.
- `NEXT_PUBLIC_APP_URL` deve apontar para o dominio publico usado nos QR Codes.
- `OTP_PEPPER` deve ter pelo menos 32 caracteres e ser diferente de `SESSION_SECRET`.
- `META_WHATSAPP_ACCESS_TOKEN` deve ser o token permanente do System User da Meta com permissao de WhatsApp.
- `META_WHATSAPP_PHONE_NUMBER_ID` e o ID do numero conectado na Cloud API, nao o numero de telefone em si.
- O template `META_WHATSAPP_OTP_TEMPLATE_NAME` precisa estar aprovado na Meta antes do envio real.
- `RESEND_API_KEY` habilita recuperacao/cadastro com email real.
- `EMAIL_FROM` e obrigatorio quando `RESEND_API_KEY` estiver configurado. Use um remetente de dominio verificado, como `SandExpress <noreply@seudominio.com.br>`.
- Nunca versionar chaves reais de Supabase.

## Logo oficial

O logo oficial da marca fica publico em:

```text
/logo-sandexpress.png
```

Em emails e sistemas externos, use a URL absoluta do deploy:

```text
https://SEU-DOMINIO/logo-sandexpress.png
```

O SVG antigo foi mantido apenas como arquivo legado, mas os defaults do sistema, emails, PWA, telas e cadastro usam o PNG oficial.

Passo a passo detalhado para pegar as chaves reais e preencher o ambiente:

- `docs/configuracao-chaves-reais.md`.
- `docs/banco-do-zero.md`.

## Como rodar localmente

```bash
npm install
npm run dev
```

Acesse:

```text
http://localhost:3000
```

Rotas uteis para teste:

```text
http://localhost:3000/admin
http://localhost:3000/vendor/login
http://localhost:3000/vendor/dashboard
http://localhost:3000/u/{vendor_id}/{umbrella_id}
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Banco de dados e infraestrutura

Arquivos SQL e de infraestrutura ficam em:

```text
infra/
```

Principais arquivos:

- `infra/sql-iniciar-novo-projeto.sql`.
- `infra/sql-atualizacao-branding-quiosque-assets.sql`.
- `infra/sql-atualizacao-cardapio-por-quiosque.sql`.
- `infra/sql-atualizacao-recuperacao-equipe.sql`.
- `infra/cloudbuild/production.yaml`.
- `infra/cloudbuild/staging.yaml`.

O script principal de banco inicia o projeto sem quiosques, produtos, guarda-sois, pedidos ou praias pre-carregadas. Quiosques, produtos e guarda-sois devem ser cadastrados pelo painel com dados reais.

Para banco existente, aplique tambem `infra/sql-atualizacao-branding-quiosque-assets.sql`. Essa migracao cria `button_color`, `button_text_color` e o bucket publico `kiosk-assets`, necessario para logo real do quiosque em `logos/{vendor_id}/`.

## Regras de seguranca

O sistema deve:

- Usar cookies httpOnly para sessoes sensiveis.
- Validar acesso por `vendor_id`.
- Permitir admin acessar todos os quiosques.
- Restringir vendor ao proprio quiosque.
- Restringir cliente a propria comanda.
- Recalcular precos de pedido no backend.
- Bloquear produtos inativos ou sem estoque.
- Validar posse de guarda-sol pelo quiosque.
- Recusar guarda-sol inativo.
- Recusar abertura de comanda em guarda-sol ocupado por outro cliente.
- Usar rate limit no login do cliente.
- Exigir senha forte para producao via `SESSION_SECRET`.
- Nao expor `SUPABASE_SERVICE_ROLE_KEY` no cliente.

## Status do MVP

Implementado no codigo atual:

- Fluxo de cliente por QR Code com abertura de comanda.
- Cardapio por quiosque.
- Carrinho e envio de pedidos.
- Sessao de cliente.
- Pedido de fechamento de conta.
- Login de quiosque e equipe.
- Painel operacional do quiosque.
- Produtos, imagens, categorias e disponibilidade.
- Guarda-sois e QR Code.
- Estoque e bloqueio por falta de estoque.
- Fechamento de conta.
- Clientes e historico resumido.
- Equipe do quiosque.
- Relatorios do quiosque e relatorio diario.
- Admin global com cadastro de quiosques e analytics.
- PWA/atalho instalavel.
- Branding por quiosque com logo propria, cor principal, cor secundaria, cor de botao e cor do texto do botao.

Pontos que ainda dependem de integracao externa ou refinamento:

- Chaves reais da Meta WhatsApp Cloud API e template OTP aprovado para envio em producao.
- Pagamento online por PIX/cartao.
- Notificacoes push reais.
- Tempo real por websocket/realtime para pedidos.
- Automacao financeira completa de assinatura.
- Auditoria avancada de usuarios e permissoes granulares por papel.

## Prontidao para deploy

Antes de publicar, chame:

```text
GET /api/health
```

O endpoint retorna:

- `status: "blocked"` quando falta configuracao obrigatoria para o sistema rodar.
- `status: "degraded"` quando o banco esta conectado, mas alguma integracao externa ainda esta pendente.
- `status: "ok"` quando banco, schema e integracoes configuradas estao prontos.

Campos importantes da resposta:

- `readiness.required` - variaveis obrigatorias para operar com dados reais.
- `readiness.external` - chaves externas como Meta WhatsApp/OTP.
- `readiness.recommended` - configuracoes recomendadas para producao.
- `database` - indica se o Supabase esta conectado, sem schema ou inacessivel.

Passos para evoluir com seguranca:

1. Preencher `.env.local` com Supabase real, `SESSION_SECRET`, `ADMIN_PASSWORD` e `NEXT_PUBLIC_APP_URL`.
2. Rodar `infra/sql-iniciar-novo-projeto.sql` no SQL Editor do Supabase.
3. Rodar `npm test`, `npm run lint` e `npm run build`.
4. Abrir `/api/health` localmente e resolver tudo que aparecer em `readiness.required`.
5. Criar/aprovar o template OTP na Meta e preencher `META_WHATSAPP_*` e `OTP_PEPPER`.
6. Copiar as mesmas variaveis para o ambiente de deploy.
7. Testar cadastro de quiosque, QR Code, abertura de comanda, pedido e fechamento de conta com dados reais.

## Checklist de aceite funcional

- Cliente abre QR Code novo com `vendor_id` e `umbrella_id`.
- Cliente abre comanda com nome, celular e quantidade de pessoas.
- Cliente adiciona produtos, envia pedido e ve pedido na conta.
- Pedido aparece no painel do quiosque.
- Quiosque avanca status do pedido.
- Produto sem estoque nao pode ser vendido.
- Fechamento de conta marca pedido como pago e libera guarda-sol.
- QR Code gerado no painel aponta para a URL publica correta.
- Admin cadastra novo quiosque com trial.
- Quiosque consegue entrar com senha cadastrada.
- Relatorios mostram dados do quiosque e da plataforma.
- Variaveis de ambiente de producao estao configuradas.

