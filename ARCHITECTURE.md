# ARCHITECTURE.md — Distributed Wagering Processor

Este documento registra as decisões de arquitetura e de **escopo (timebox)**
tomadas durante a construção deste desafio técnico, para que fiquem
explícitas — não acidentais — e para que o avaliador entenda o raciocínio
por trás de cada corte.

## 1. Visão geral da arquitetura

O projeto segue uma separação enxuta inspirada em Clean Architecture / DDD,
em 4 camadas:

```
src/
├── domain/          # TypeScript puro. Zero dependências externas.
│                     # Money (Value Object), Wallet e WagerTransaction
│                     # (Entidades), erros de domínio.
├── application/      # Casos de uso. Depende apenas do domínio e de
│                     # interfaces (DbClient) — não depende do NestJS nem
│                     # do driver `pg` diretamente em sua lógica de negócio.
├── infra/            # Implementações concretas: repositórios Postgres
│                     # (SQL puro via `pg.Pool`), pool de conexões.
└── presentation/      # NestJS: controllers, DTOs, guards, filtros de exceção.
```

A regra de dependência é sempre **de fora para dentro**: `presentation` conhece
`application`, que conhece `domain`; o inverso nunca acontece. Isso é o que
permite testar o caso de uso central (Step 3/4) instanciando-o com `new`,
sem precisar subir um módulo NestJS inteiro — veja
`test/concurrency/process-wager-transaction.concurrency.spec.ts`.

## 2. Decisões de escopo (timebox)

Dado o tempo limitado deste desafio, as seguintes decisões foram tomadas
**conscientemente** para priorizar a competência central avaliada
(processamento financeiro concorrente, seguro e auditável) em vez de
infraestrutura periférica:

### 2.1 Autenticação — OMITIDA (AuthGuard no-op)

Não foi integrado um Identity Provider real (Keycloak, Zitadel, Auth0, etc.).
Em vez disso, o endpoint é protegido por um `NoOpAuthGuard`
(`src/presentation/guards/no-op-auth.guard.ts`) que sempre autoriza a
requisição.

**Justificativa:** configurar um IdP completo (realm, client, fluxo OIDC,
validação de JWT, refresh tokens) é um esforço de infraestrutura
significativo que não testa a competência central deste desafio. O ponto de
extensão já está pronto: todo endpoint sensível já passa por
`@UseGuards(NoOpAuthGuard)`, então plugar autenticação real no futuro exige
apenas reescrever `canActivate`, sem tocar em nenhum controller.

**Risco aceito:** em produção, isso significa que a API está completamente
aberta. Isso é adequado para o escopo de um desafio técnico, mas seria
inaceitável fora dele.

### 2.2 Modelo contábil — Ledger simples por wallet (sem partidas dobradas)

Adotamos um modelo de **ledger auditável por wallet** (tabela
`wager_transactions`, append-only, com `balance_after_cents` como fotografia
do saldo pós-transação) em vez de um sistema de **partidas dobradas**
completo (onde toda movimentação teria um lançamento a débito E um a
crédito em contas contábeis distintas, como em um livro-razão contábil
tradicional).

**Justificativa:** partidas dobradas adicionam complexidade de modelagem
(plano de contas, balanceamento entre contas) que não é estritamente
necessária para o requisito central: garantir que o saldo de uma wallet
nunca fique inconsistente ou negativo, com rastreabilidade completa de cada
movimentação. O modelo atual já entrega auditoria completa (todo
`balance_cents` é reconstituível a partir do histórico de transações) com
uma fração da complexidade.

### 2.3 Observabilidade — Dashboards, testes de carga e OpenTelemetry OMITIDOS

Não foram implementados: dashboards de monitoramento, testes de carga
(k6, Artillery, etc.) ou instrumentação OpenTelemetry (tracing distribuído,
métricas).

**Justificativa:** são preocupações operacionais importantes para um sistema
em produção, mas ortogonais à prova de corretude transacional/concorrencial
que este desafio avalia. O `/health/ready` (Seção 3) cobre o mínimo
indispensável de observabilidade operacional (saber se a aplicação está
pronta para tráfego).

## 3. Estratégia de concorrência: lock pessimista

Decisão: `SELECT ... FOR UPDATE` por `wallet_id`, dentro de uma transação
SQL (`BEGIN`/`COMMIT`/`ROLLBACK`), em vez de lock otimista (ex: coluna
`version` com `UPDATE ... WHERE version = $X` e retry em caso de conflito).

**Justificativa:**
- **Simplicidade:** lock pessimista não exige lógica de retry na camada de
  aplicação — a segunda transação concorrente simplesmente ESPERA (é
  bloqueada pelo Postgres) até a primeira terminar, em vez de falhar e
  precisar ser reexecutada.
- **Contenção esperada é baixa-a-moderada por wallet:** é incomum um único
  usuário disparar múltiplas apostas na MESMA wallet exatamente ao mesmo
  tempo; quando acontece, bloquear por alguns milissegundos é aceitável.
- **Previsibilidade:** sob lock pessimista, a ORDEM de chegada das
  requisições determina deterministicamente qual "ganha" o lock primeiro,
  facilitando raciocinar sobre o sistema e escrever testes de concorrência
  determinísticos (ver `test/concurrency/`).

A validação de **idempotência** (checagem de `reference_id` já processado)
acontece **depois** de adquirir o lock da wallet — nunca antes — exatamente
para que a checagem seja livre de race conditions (ver comentários detalhados
em `ProcessWagerTransactionUseCase`).

## 4. Representação monetária: sem `number`/`float`, em qualquer lugar

Todo valor monetário trafega como:
- `BIGINT` (centavos) no Postgres;
- `string` (BIGINT vem do driver `pg` como string, nunca `number` — ver
  `src/infra/database/pool.ts`) na fronteira banco ↔ aplicação;
- `bigint` nativo do JavaScript dentro do Value Object `Money`
  (`src/domain/money.ts`);
- `string` decimal (ex: `"10.50"`) na fronteira HTTP ↔ aplicação (requisição
  e resposta da API).

Em nenhum ponto do sistema um valor monetário passa por `Number` ou
`parseFloat`. Isso elimina por construção a classe inteira de bugs de
arredondamento de ponto flutuante (`0.1 + 0.2 !== 0.3` em JS puro).

## 5. Por que SQL puro (`pg.Pool`) em vez de um ORM

Optamos por não usar TypeORM, Prisma ou MikroORM.

**Justificativa:** o core deste desafio é precisamente a corretude da
query `SELECT ... FOR UPDATE` e da transação que a envolve. ORMs tendem a
abstrair (e às vezes ofuscar) exatamente este tipo de controle fino sobre
transações e locks — o que é contraproducente quando esse controle é o
próprio objeto de avaliação. SQL explícito também torna o código mais fácil
de auditar linha a linha, o que se alinha ao pedido de comentários didáticos.

## 7. Mensageria: Transactional Inbox + Outbox (SQS via LocalStack)

Introduzimos um caminho assíncrono de processamento, paralelo ao endpoint
HTTP síncrono (`POST /wagering/transactions`), consumindo comandos de uma
fila SQS FIFO (`wager-transactions.fifo`) e publicando eventos de integração
em outra (`wager-events.fifo`). Ambos reaproveitam o **mesmo**
`ProcessWagerTransactionUseCase` — nenhuma regra financeira foi duplicada.

**Inbox (deduplicação):** o SQS garante entrega **at-least-once** — a MESMA
mensagem pode chegar mais de uma vez. A tabela `inbox_messages`, com
`UNIQUE(consumer_name, message_id)`, e o `INSERT ... ON CONFLICT DO NOTHING`
em `PostgresInboxRepository.claim`, tornam essa checagem atômica: nunca há
uma janela de tempo entre "verificar se já existe" e "inserir" onde duas
execuções concorrentes poderiam ambas pensar que são a primeira.

**Outbox (publicação atômica):** nunca publicamos diretamente no SQS durante
o processamento de uma aposta — isso criaria o clássico **dual write
problem** (e se o INSERT no Postgres funcionar mas a chamada ao SQS falhar,
ou vice-versa?). Em vez disso, o evento é gravado na tabela
`outbox_messages` **na mesma transação SQL** que grava o ledger. Um processo
separado (`OutboxPublisherService`) lê essa tabela de forma assíncrona e
publica no SQS, com retry e backoff exponencial.

**Refactor do caso de uso:** para que o consumidor SQS consiga envolver
"processar a aposta" + "gravar o evento" + "marcar o inbox como processado"
em uma ÚNICA transação (não é possível aninhar transações Postgres), o
núcleo de `ProcessWagerTransactionUseCase` foi extraído para o método
`executeWithClient` (recebe um `client` já em transação). O método público
`execute()` (usado pelo controller HTTP) continua se comportando
EXATAMENTE como antes — apenas delega seu núcleo para `executeWithClient`.
Nenhuma regra de negócio (ordem de lock, verificação de idempotência,
cálculo de saldo) foi alterada.

**"Falhas de negócio" vs. "falhas técnicas" — a resposta para "não tem
mensagem de falha":** o `WagerTransactionConsumerService` distingue
explicitamente as duas coisas (`isBusinessRuleError`):
- Uma rejeição de negócio (ex: `InsufficientFundsError`) é um resultado
  FINAL e válido — a mensagem é confirmada (ack) no SQS, e um evento
  `WagerTransactionRejected` é gravado na Outbox com o motivo exato,
  disponível para sistemas downstream (ex: notificar o usuário).
- Uma falha técnica (bug, conexão caída) NÃO é confirmada — o SQS reentrega
  a mensagem automaticamente, e após `maxReceiveCount=5` tentativas sem
  sucesso, a move para uma Dead Letter Queue dedicada
  (`wager-transactions-dlq.fifo`), configurada no próprio LocalStack via
  `localstack-init/create-queues.sh`.
- Toda falha de PUBLICAÇÃO (Outbox -> SQS) é registrada na própria linha do
  evento, na coluna `outbox_messages.last_error` — nunca desaparece
  silenciosamente em um log que pode rotacionar.

**Por que não `@nestjs/schedule` para o publisher periódico:** optamos por
`setInterval` nativo para não introduzir mais uma dependência externa,
consistente com a filosofia enxuta do projeto (SQL puro em vez de ORM, etc.).

## 8. O que faria diferente com mais tempo

- Implementar um `WalletRepository`/`WagerTransactionRepository` como
  **interfaces** (ports) na camada de aplicação, com as classes `Postgres*`
  implementando-as explicitamente (`implements WalletRepositoryPort`) — hoje
  a tipagem estrutural do TypeScript já garante compatibilidade, mas uma
  interface explícita tornaria a inversão de dependência mais visível.
- Construir o PRODUCER que publica na fila `wager-transactions.fifo` (hoje
  fora de escopo — assumimos um gateway/API externa publicando os comandos).
  Também não existe ainda um consumidor de exemplo para `wager-events.fifo`
  (o lado downstream que consumiria `WagerTransactionProcessed`/`Rejected`).
- Testes de integração para o consumidor SQS e o Outbox Publisher (hoje
  cobertos apenas pela leitura de código — o teste automatizado do padrão
  Inbox/Outbox exigiria subir LocalStack + Postgres juntos).
- Testes unitários isolados para `Money`, `Wallet` e `WagerTransaction` (hoje
  cobertos apenas pelo smoke test manual do Step 2 e pelo teste de
  integração de concorrência do Step 4).
