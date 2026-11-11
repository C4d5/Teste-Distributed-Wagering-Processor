#!/bin/bash
# localstack-init/create-queues.sh
# Script de inicialização do LocalStack: roda AUTOMATICAMENTE assim que o
# container fica pronto (LocalStack executa tudo em
# /etc/localstack/init/ready.d/*.sh — ver o volume montado em docker-compose.yml).
#
# Cria 4 filas:
#   - wager-transactions.fifo      (entrada: comandos de aposta a processar)
#   - wager-transactions-dlq.fifo  (Dead Letter Queue da fila acima)
#   - wager-events.fifo            (saída: eventos publicados pela Outbox)
#   - wager-events-dlq.fifo        (Dead Letter Queue da fila acima)
#
# A RedrivePolicy (maxReceiveCount=5) é o que garante que NENHUMA mensagem
# problemática fique presa para sempre sendo reentregue: depois de 5
# tentativas de processamento sem sucesso TÉCNICO (ver
# WagerTransactionConsumerService), o próprio SQS a move automaticamente
# para a DLQ — é a "mensagem de falha" definitiva do sistema, nunca perdida.
set -euo pipefail

echo "[localstack-init] Criando filas SQS..."

awslocal sqs create-queue \
  --queue-name wager-transactions-dlq.fifo \
  --attributes FifoQueue=true,ContentBasedDeduplication=true

WAGER_TX_DLQ_ARN=$(awslocal sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/wager-transactions-dlq.fifo \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' --output text)

awslocal sqs create-queue \
  --queue-name wager-transactions.fifo \
  --attributes "{
    \"FifoQueue\": \"true\",
    \"ContentBasedDeduplication\": \"true\",
    \"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"${WAGER_TX_DLQ_ARN}\\\",\\\"maxReceiveCount\\\":\\\"5\\\"}\"
  }"

awslocal sqs create-queue \
  --queue-name wager-events-dlq.fifo \
  --attributes FifoQueue=true,ContentBasedDeduplication=true

WAGER_EVENTS_DLQ_ARN=$(awslocal sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/wager-events-dlq.fifo \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' --output text)

awslocal sqs create-queue \
  --queue-name wager-events.fifo \
  --attributes "{
    \"FifoQueue\": \"true\",
    \"ContentBasedDeduplication\": \"true\",
    \"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"${WAGER_EVENTS_DLQ_ARN}\\\",\\\"maxReceiveCount\\\":\\\"5\\\"}\"
  }"

echo "[localstack-init] Filas criadas com sucesso:"
awslocal sqs list-queues