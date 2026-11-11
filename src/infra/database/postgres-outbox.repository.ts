
import { Injectable } from '@nestjs/common';

import { OUTBOX_MAX_ATTEMPTS, OutboxMessage } from '../../domain';
import { DbClient } from './db-client';

interface OutboxMessageRow {
  id: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
  attempts: number;
  next_attempt_at: Date;
  published_at: Date | null;
  last_error: string | null;
}

@Injectable()
export class PostgresOutboxRepository {

  async save(client: DbClient, message: OutboxMessage): Promise<void> {
    await client.query(
      `INSERT INTO outbox_messages
          (id, aggregate_id, event_type, payload, occurred_at, attempts, next_attempt_at, published_at, last_error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        message.id,
        message.aggregateId,
        message.eventType,
        JSON.stringify(message.payload),
        message.occurredAt,
        message.attempts,
        message.nextAttemptAt,
        message.publishedAt,
        message.lastError,
      ],
    );
  }

 
  async findPendingBatch(client: DbClient, limit: number): Promise<OutboxMessage[]> {
    const result = await client.query<OutboxMessageRow>(
      `SELECT id, aggregate_id, event_type, payload, occurred_at, attempts,
              next_attempt_at, published_at, last_error
         FROM outbox_messages
        WHERE published_at IS NULL
          AND next_attempt_at <= now()
          AND attempts < $1
        ORDER BY occurred_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED`,
      [OUTBOX_MAX_ATTEMPTS, limit],
    );

    return result.rows.map((row) => this.toDomain(row));
  }

  async markPublished(client: DbClient, message: OutboxMessage): Promise<void> {
    await client.query(
      `UPDATE outbox_messages SET published_at = $1 WHERE id = $2`,
      [message.publishedAt, message.id],
    );
  }

  async scheduleRetry(client: DbClient, message: OutboxMessage): Promise<void> {
    await client.query(
      `UPDATE outbox_messages
          SET attempts = $1, next_attempt_at = $2, last_error = $3
        WHERE id = $4`,
      [message.attempts, message.nextAttemptAt, message.lastError, message.id],
    );
  }

  private toDomain(row: OutboxMessageRow): OutboxMessage {
    return OutboxMessage.reconstitute({
      id: row.id,
      aggregateId: row.aggregate_id,
      eventType: row.event_type,
      payload: row.payload,
      occurredAt: row.occurred_at,
      attempts: row.attempts,
      nextAttemptAt: row.next_attempt_at,
      publishedAt: row.published_at,
      lastError: row.last_error,
    });
  }
}