# Distributed Wagering Processor — Desafio Técnico

Este repositório contém a solução desenvolvida para o desafio técnico de processamento distribuído de apostas (**Distributed Wagering Processor**), focando em **corretude financeira**, **concorrência segura** e **resiliência a falhas**.

---

## Tecnologias e Arquitetura

O projeto foi construído utilizando uma stack moderna e enxuta, priorizando controle total sobre as transações e sem abstrações excessivas de ORMs pesados:

* **Framework**: NestJS (TypeScript)[cite: 18]
* **Banco de Dados**: PostgreSQL 16 (com queries em SQL puro via `pg.Pool`)[cite: 18]
* **Mensageria**: AWS SQS (Simulado localmente via **LocalStack**)[cite: 5, 18]
* **Containerização**: Docker Compose

### Decisões de Arquitetura & Padrões Implementados
1. **Concorrência Segura (Lock Pessimista)**: Utilização de `SELECT ... FOR UPDATE` por `wallet_id` dentro de transações atômicas para evitar *lost updates* e garantir consistência sob concorrência pesada[cite: 18, 46].
2. **Precisão Monetária Absoluta**: Uso de `BIGINT` no banco de dados para representar **centavos** e o Value Object `Money` no domínio, eliminando completamente bugs de ponto flutuante (`float`/`number`)[cite: 18, 32].
3. **Transactional Inbox**: Proteção atômica contra entregas duplicadas (*at-least-once*) da fila SQS utilizando a constraint única `(consumer_name, message_id)`[cite: 18].
4. **Transactional Outbox**: Resolução do *dual write problem* gravando eventos de integração na mesma transação do ledger, publicados de forma assíncrona com retry e backoff exponencial[cite: 18].
5. **Dead Letter Queues (DLQ)**: Configuração de políticas de repetição (`maxReceiveCount=5`) com encaminhamento automático para DLQs no LocalStack para falhas técnicas irrecuperáveis[cite: 18].

---

## Transparência e Desenvolvimento com Assistência de IA

Para maximizar a eficiência do tempo (*timebox*), manter um alto padrão de código limpo (*clean code*) e acelerar a implementação das camadas de mensageria assíncrona, este projeto contou com o apoio de ferramentas de Inteligência Artificial em planos gratuitos:

* **Gemini (Plano Gratuito)**: Atuou como assistente principal de planejamento arquitetural, estruturação de raciocínio lógico, desenho de migrações e refinamento de diretrizes de design de software.
* **Claude (Plano Gratuito)**: Atuou como co-piloto e revisor de código, auxiliando na escrita precisa dos workers, na refatoração segura do caso de uso para suportar transações externas (`executeWithClient`) e na eliminação de redundâncias.

A combinação dessas ferramentas permitiu focar nas decisões críticas de engenharia concorrente e transacional, garantindo uma entrega de nível de produção dentro de um prazo restrito.

---

## Como Executar o Projeto Localmente

### Pré-requisitos
* Docker e Docker Compose instalados.
* Node.js (versão 20+) e npm[cite: 15].

### 1. Subir a Infraestrutura (Postgres + LocalStack)
Na raiz do projeto, execute o Docker Compose para subir o banco de dados e as filas SQS simuladas:
```bash
docker compose up -d
