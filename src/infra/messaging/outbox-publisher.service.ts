
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import type { Pool } from 'pg';

import { OutboxMessage } from '../../domain';
import { DbClient } from '../database/db-client';
import { PG_POOL } from '../database/pool.provider';
import { PostgresOutboxRepository } from '../database/postgres-outbox.repository';
import { SQS_CLIENT } from './sqs-client.provider';
import { WAGER_EVENTS_QUEUE_URL } from './queue-config';

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const BATCH_SIZE = 10;

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(SQS_CLIENT) private readonly sqsClient: SQSClient,
    private readonly outboxRepository: PostgresOutboxRepository,
  ) {}

  onModuleInit(): void {
    const intervalMs = Number(
      process.env.OUTBOX_POLL_INTERVAL_MS ?? DEFAULT_POLL_INTERVAL_MS,
    );
    this.intervalHandle = setInterval(() => {
      void this.runOnce();
    }, intervalMs);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }
  }

  /**
   * Executa UMA iteração do publisher: busca um lote de eventos pendentes e
   * tenta publicar cada um. Público (não `private`) para permitir disparar
   * manualmente em testes, sem precisar esperar o `setInterval`.
   */
  async runOnce(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const pendingMessages = await this.outboxRepository.findPendingBatch(
        client,
        BATCH_SIZE,
      );

      for (const message of pendingMessages) {
        await this.publishOne(client, message);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      this.logger.error(
        `Falha ao processar lote da Outbox: ${(error as Error).message}`,
      );
    } finally {
      client.release();
      this.isRunning = false;
    }
  }

  /**
   * Tenta publicar UM evento no SQS. Em caso de sucesso, marca como
   * publicado. Em caso de falha, agenda um retry com backoff exponencial e
   * GRAVA o motivo da falha (`last_error`) — nenhuma falha de publicação
   * desaparece silenciosamente.
   */
  private async publishOne(
    client: DbClient,
    message: OutboxMessage,
  ): Promise<void> {
    try {
      await this.sqsClient.send(
        new SendMessageCommand({
          QueueUrl: WAGER_EVENTS_QUEUE_URL,
          MessageBody: JSON.stringify({
            eventType: message.eventType,
            aggregateId: message.aggregateId,
            occurredAt: message.occurredAt.toISOString(),
            payload: message.payload,
          }),
          MessageGroupId: message.aggregateId,
          MessageDeduplicationId: message.id,
        }),
      );

      await this.outboxRepository.markPublished(client, message.markPublished());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const retriedMessage = message.scheduleRetry(errorMessage);

      await this.outboxRepository.scheduleRetry(client, retriedMessage);

      this.logger.warn(
        `Falha ao publicar evento ${message.id} (${message.eventType}), ` +
          `tentativa ${retriedMessage.attempts}: ${errorMessage}. ` +
          `Próxima tentativa às ${retriedMessage.nextAttemptAt.toISOString()}.`,
      );
    }
  }
}