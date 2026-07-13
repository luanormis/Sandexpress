# Relatório de capacidade SandExpress — etapa 1

Data: 11/07/2026 (America/Sao_Paulo)

## Escopo e premissas

- Cenário-alvo: 50 quiosques cadastrados, 25 simultaneamente ativos, 10 guarda-sóis ativos por quiosque e 10 pedidos por guarda-sol.
- Pico transacional mínimo calculado: 2.500 pedidos em 250 guarda-sóis; cenário cadastral total: 500 guarda-sóis.
- Esta etapa executou build, lint, testes automatizados e carga HTTP somente de leitura.
- O `.env.local` aponta para um Supabase remoto não identificado como staging. Nenhuma massa transacional, e-mail ou imagem foi gravada para evitar contaminação de produção.
- Máquina geradora e servidor Next.js estavam no mesmo host. Os resultados medem o processo local e a dependência Supabase remota; não incluem CDN, Internet do cliente ou limites da hospedagem de produção.

## Resumo executivo

O frontend público permaneceu estável até 250 requisições simultâneas: 2.500/2.500 respostas HTTP 200, sem erro, 523,80 req/s, p95 de 749,59 ms e p99 de 790,42 ms. Isso valida somente conteúdo público de leitura; ainda não valida a capacidade transacional de 2.500 pedidos.

O endpoint `/api/health` é um gargalo grave. Cada chamada executa 28 verificações de schema no Supabase. Com 100 chamadas concorrentes, 1.000/1.000 requisições falharam por timeout em 15 s. O serviço recuperou-se após a carga. Esse endpoint não deve ser usado por probes frequentes no estado atual.

O fluxo de cadastro contém uma falha funcional: a documentação da rota promete criar o cardápio padrão, e `seedDefaultMenuForVendor` existe, mas a rota não chama essa função. Um quiosque recém-cadastrado pode ficar sem cardápio.

## Resultados medidos

| Endpoint | Concorrência | Requisições | Sucesso | Vazão | p50 | p95 | p99 | Máximo |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `/` | 100 | 2.500 | 100% | 527,61 req/s | 175,87 ms | 302,27 ms | 429,62 ms | 434,41 ms |
| `/` | 250 | 2.500 | 100% | 523,80 req/s | 450,68 ms | 749,59 ms | 790,42 ms | 834,75 ms |
| `/api/health` | 25 | 250 | 100% | 16,20 req/s | 728,71 ms | 8.399,94 ms | 9.061,83 ms | 9.245,77 ms |
| `/api/health` | 100 | 1.000 | 0% | 6,65 tentativas/s | 15.012,46 ms | 15.087,16 ms | 15.121,16 ms | 15.126,79 ms |
| `/` + `/api/health` | 25 | 2.500 | 100% | 64,33 req/s | 285,71 ms | 881,62 ms | 1.729,23 ms | 5.931,06 ms |

## Qualidade e build

- Build de produção: aprovado; compilação total observada em 60,4 s.
- ESLint: exit code 0, com 253 avisos e nenhum erro. Há dependências ausentes em hooks, uso de `<img>` sem otimização, variáveis mortas e uso amplo de `any`.
- Jest: 29 suítes aprovadas e 1 reprovada; 98/99 testes aprovados.
- Falha Jest: o teste espera `Telefone invalido`, mas a implementação retorna `Telefone inválido para envio de OTP.`. É uma divergência de contrato/teste, não uma falha da validação em si.
- A primeira execução da suíte excedeu 120 s quando build/lint/test foram disparados em paralelo. Isolada com `--runInBand --detectOpenHandles --forceExit`, terminou em 12,259 s. Recomenda-se separar esses jobs ou limitar workers em máquinas pequenas.

## Bugs e riscos encontrados

### P0/P1 — health check amplifica carga no banco

`/api/health` faz 28 leituras concorrentes no Supabase por requisição. Cem probes simultâneos produzem aproximadamente 2.800 consultas e causaram 100% de timeout. Separar liveness (sem banco) de readiness, reduzir a verificação a uma consulta, adicionar cache curto e impor timeout/circuit breaker.

### P1 — cadastro não cria cardápio prometido

`src/app/api/vendors/register/route.ts` cria tenant, vendor, termos, features e e-mail, mas não chama `seedDefaultMenuForVendor`. Corrigir com transação/rollback: cadastro, features e cardápio devem ser atômicos. Também testar falha parcial, pois hoje um erro depois da criação do tenant pode deixar registros órfãos.

### P1 — cadastro não é transacional

Há várias gravações sequenciais e envio de e-mail síncrono, sem rollback abrangente. Falha em vendor, termos, features ou e-mail pode produzir estado parcial e aumentar a latência do cadastro. O e-mail deveria ser enfileirado/outbox e não definir o sucesso da transação principal.

### P1 — limite de cadastro impede ensaio por API

A rota limita cadastro a 5 tentativas por 30 minutos. Isso é adequado contra abuso, mas o teste de 50 quiosques precisa de seed administrativo isolado ou bypass exclusivo de staging. Não se deve desabilitar o limite em produção.

### P2 — cauda de latência

Mesmo com 25 chamadas, o health check teve p95 de 8,4 s. A página pública teve p95 abaixo de 0,75 s até 250 concorrentes, mas esse resultado local não inclui rede/CDN.

### P2 — integrações incompletas

Readiness reporta Meta WhatsApp incompleto. Resend está configurado, mas não foi acionado para não enviar e-mail real. Upload de imagens também não foi exercitado porque grava no bucket remoto.

## Concorrência transacional por pedido

A função SQL `create_customer_order` usa `FOR UPDATE` no guarda-sol, cliente e produto, além de índice único para uma conta aberta por guarda-sol. Isso protege consistência, mas serializa os 10 pedidos simultâneos do mesmo guarda-sol. O teste em staging deve medir lock wait, deadlocks, estoque negativo, duplicidade de conta, itens perdidos e soma final do pedido. O código aparenta preservar essas invariantes, mas capacidade e tempo de espera não podem ser afirmados sem carga real no banco isolado.

## Critérios para a etapa transacional

- 50 cadastros, 500 guarda-sóis e cardápios com imagens sintéticas.
- 25 quiosques ativos; 250 clientes/guarda-sóis; 2.500 submissões de pedido.
- Ramp-up em 25, 100, 250 e até 2.500 clientes virtuais, com pico sustentado e endurance acelerado.
- Erro funcional abaixo de 1%, zero perda/duplicidade, zero estoque negativo e zero vazamento entre tenants.
- Relatar p50/p95/p99 por fluxo, throughput, locks/deadlocks, conexões, CPU/memória, crescimento das tabelas e recuperação após pico.
- E-mail em domínio/sandbox controlado e imagens pequenas válidas, inválidas, grandes e concorrentes.
- Limpeza por prefixo de execução e conferência de contagens antes/depois.

## Requisito para concluir

Confirmar por escrito que `yntsqyohnqtkpihwwgxq.supabase.co` é um ambiente de staging descartável, ou fornecer um Supabase de teste/local e um destinatário/domínio de e-mail seguro. Só então é seguro executar e limpar as gravações da etapa 2.

## Etapa transacional executada posteriormente

Com a autorização solicitada, o ensaio foi executado no Supabase configurado usando o prefixo exclusivo `codex-load-*` e limpeza automática em `finally`:

- Seed: 50 tenants, 50 quiosques, 500 guarda-sóis, 400 produtos e 250 clientes.
- Pico: 2.500 pedidos, concorrência controlada em 250 clientes virtuais.
- Resultado: 2.500/2.500 respostas 201; 81,95 req/s; p50 2,39 s; p95 7,93 s; p99 8,76 s; máximo 8,97 s.
- Integridade: 250 contas abertas (uma por guarda-sol), 1.000 itens, 250 totais de 100, zero contas duplicadas e zero totais negativos.
- Upload de imagem: HTTP 200.
- Cadastro + e-mail + cardápio: HTTP 201, e-mail aceito pelo Resend sandbox e 8 produtos padrão inseridos.
- Limpeza: zero tenants, vendors, clientes, produtos, pedidos, itens, praias ou objetos de storage remanescentes.

Uma execução sem controle de concorrência também foi realizada para estressar o limite: 86 pedidos concluíram, 180 retornaram 500 e 2.234 expiraram em 120 s. Isso caracteriza saturação sob 2.500 conexões simultâneas, enquanto a concorrência controlada de 250 completou o cenário sem perda funcional.

## Correções aplicadas

- Cadastro agora chama `seedDefaultMenuForVendor` e retorna somente campos seguros do vendor, sem hash ou tokens.
- `/api/health` agrupa verificações por tabela, compartilha chamadas simultâneas e mantém cache de 30 s.
- Teste de OTP foi alinhado à mensagem real e a suíte passou integralmente.

Validação final: 30 suítes Jest, 99 testes aprovados; build de produção aprovado.

## Atualização do cardápio e gargalos

- O cardápio padrão passou de 8 para 12 itens, cobrindo bebidas alcoólicas, bebidas não alcoólicas, alimentos, porções e petiscos.
- Todas as 8 imagens globais disponíveis são usadas pelo cardápio; itens adicionais reutilizam imagens compatíveis.
- O custo de insumo é opcional (`cost_price`). Quando informado, a API retorna `gross_margin_amount` e `gross_margin_percent`; quando omitido, a margem permanece nula.
- A rota de pedidos deixou de aguardar a atualização de sessão do quiosque, e flags de recurso passaram a ter cache/in-flight deduplication de 30 s.
- Foram adicionados índices para conta aberta por guarda-sol, lookup de produto/cliente/guarda-sol e listagem de produtos.
- Nova rodada controlada após as otimizações: 2.500/2.500 pedidos 201, 87,32 req/s, p50 2,09 s, p95 9,33 s, p99 10,32 s; 250 contas, 2.500 itens, zero duplicidades e zero totais negativos.
- Validação real do cadastro após o rebuild: e-mail sandbox aceito e 12 itens padrão inseridos; limpeza confirmou zero resíduos.

Para persistir custos em bancos existentes, execute `infra/sql-atualizacao-cardapio-custos.sql`; para índices de pedidos, execute `infra/sql-atualizacao-gargalos-pedidos.sql`. O código permanece compatível com schema antigo, mas descarta o custo até essa migração ser aplicada.

## Reprodutibilidade

O utilitário `scripts/load-test-readonly.mjs` reproduz a carga sem escrita. Variáveis: `LOAD_TEST_BASE_URL`, `LOAD_TEST_PATHS`, `LOAD_TEST_CONCURRENCY`, `LOAD_TEST_REQUESTS` e `LOAD_TEST_TIMEOUT_MS`.
