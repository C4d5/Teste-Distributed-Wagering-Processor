
import { randomUUID, createHash } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import type { Pool } from 'pg';

import { OutboxMessage, WagerTransactionType } from '../../domain';
import { isBusinessRuleError } from '../../application/errors';
import {
  WAGER_TRANSACTION_PROCESSED_EVENT,
  WAGER_TRANSACTION_REJECTED_EVENT,
} from '../../application/events/wager-transaction-events';
import { ProcessWagerTransactionUseCase } from '../../application/use-cases/process-wager-transaction.use-case';
import { PG_POOL } from '../database/pool.provider';
import { PostgresInboxRepository } from '../database/postgres-inbox.repository';
import { PostgresOutboxRepository } from '../database/postgres-outbox.repository';
import { SQS_CLIENT } from './sqs-client.provider';
import {
  WAGER_TRANSACTIONS_CONSUMER_NAME,
  WAGER_TRANSACTIONS_QUEUE_URL,
} from './queue-config';

interface WagerTransactionMessagePayload {
  walletId: string;
  type: WagerTransactionType;
  amount: string;
  referenceId: string;
  metadata?: Record<string, unknown>;
}

const MAX_MESSAGES_PER_POLL = 5;
const POLL_WAIT_TIME_SECONDS = 10;
const VISIBILITY_TIMEOUT_SECONDS = 30;

@Injectable()
export class WagerTransactionConsumerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(WagerTransactionConsumerService.name);
  private stopRequested = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(SQS_CLIENT) private readonly sqsClient: SQSClient,
    private readonly inboxRepository: PostgresInboxRepository,
    private readonly outboxRepository: PostgresOutboxRepository,
    private readonly processWagerTransaction: ProcessWagerTransactionUseCase,
  ) {}

  onModuleInit(): void {
    this.loopPromise = this.pollLoop();
  }


  async onModuleDestroy(): Promise<void> {
    this.stopRequested = true;
    if (this.loopPromise) {
      await this.loopPromise;
    }
  }

  private async pollLoop(): Promise<void> {
    while (!this.stopRequested) {
      try {
        await this.pollOnce();
      } catch (error) {
        this.logger.error(
          `Falha ao consultar a fila SQS: ${(error as Error).message}`,
        );
      }
    }
  }

  private async pollOnce(): Promise<void> {
    const response = await this.sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: WAGER_TRANSACTIONS_QUEUE_URL,
        MaxNumberOfMessages: MAX_MESSAGES_PER_POLL,
        WaitTimeSeconds: POLL_WAIT_TIME_SECONDS,
        VisibilityTimeout: VISIBILITY_TIMEOUT_SECONDS,
      }),
    );

    const messages = response.Messages ?? [];
    for (const message of messages) {
      await this.processMessage(message);
    }
  }

  private async processMessage(message: Message): Promise<void> {
    const body = message.Body ?? '';
    const messageId = message.MessageId;

    if (!messageId) {
      this.logger.error('Mensagem recebida sem MessageId — descartando.');
      await this.deleteMessage(message);
      return;
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const payloadHash = createHash('sha256').update(body).digest('hex');
      const claimedMessage = await this.inboxRepository.claim(client, {
        id: randomUUID(),
        messageId,
        consumerName: WAGER_TRANSACTIONS_CONSUMER_NAME,
        payloadHash,
      });

      if (!claimedMessage) {
        await client.query('ROLLBACK');
        this.logger.warn(
          `Mensagem ${messageId} já havia sido processada — ignorando duplicata.`,
        );
        await this.deleteMessage(message);
        return;
      }

      const payload = this.parseMessageBody(body);

      let outboxEvent: OutboxMessage;
      try {
        const result = await this.processWagerTransaction.executeWithClient(
          client,
          {
            walletId: payload.walletId,
            type: payload.type,
            amount: payload.amount,
            referenceId: payload.referenceId,
            metadata: payload.metadata,
          },
        );

        outboxEvent = OutboxMessage.create({
          id: randomUUID(),
          aggregateId: result.walletId,
          eventType: WAGER_TRANSACTION_PROCESSED_EVENT,
          payload: { ...result },
        });
      } catch (error) {
        if (!isBusinessRuleError(error)) {
          throw error;
        }

        const businessError = error as Error;
        this.logger.warn(
          `Aposta rejeitada (wallet=${payload.walletId}, referenceId=${payload.referenceId}): ${businessError.message}`,
        );

        outboxEvent = OutboxMessage.create({
          id: randomUUID(),
          aggregateId: payload.walletId,
          eventType: WAGER_TRANSACTION_REJECTED_EVENT,
          payload: {
            walletId: payload.walletId,
            referenceId: payload.referenceId,
            type: payload.type,
            amount: payload.amount,
            reason: businessError.constructor.name,
            message: businessError.message,
          },
        });
      }

      await this.outboxRepository.save(client, outboxEvent);
      await this.inboxRepository.markProcessed(
        client,
        claimedMessage.markProcessed(),
      );

      await client.query('COMMIT');

      await this.deleteMessage(message);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      this.logger.error(
        `Falha técnica ao processar mensagem ${messageId}: ${(error as Error).message}`,
      );
    } finally {
      client.release();
    }
  }

  private async deleteMessage(message: Message): Promise<void> {
    await this.sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: WAGER_TRANSACTIONS_QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle,
      }),
    );
  }

  private parseMessageBody(body: string): WagerTransactionMessagePayload {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error(`Corpo da mensagem não é um JSON válido: "${body}"`);
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('walletId' in parsed) ||
      !('type' in parsed) ||
      !('amount' in parsed) ||
      !('referenceId' in parsed)
    ) {
      throw new Error(
        'Payload da mensagem incompleto — esperado: walletId, type, amount, referenceId.',
      );
    }

    return parsed as WagerTransactionMessagePayload;
  }
}