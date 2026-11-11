
import { Injectable } from '@nestjs/common';

import { InboxMessage } from '../../domain';
import { DbClient } from './db-client';

interface InboxMessageRow {
  id: string;
  message_id: string;
  consumer_name: string;
  payload_hash: string;
  received_at: Date;
  processed_at: Date | null;
}

export interface ClaimInboxMessageParams {
  id: string;
  messageId: string;
  consumerName: string;
  payloadHash: string;
}

@Injectable()
export class PostgresInboxRepository {

  async claim(
    client: DbClient,
    params: ClaimInboxMessageParams,
  ): Promise<InboxMessage | null> {
    const result = await client.query<InboxMessageRow>(
      `INSERT INTO inbox_messages (id, message_id, consumer_name, payload_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (consumer_name, message_id) DO NOTHING
       RETURNING id, message_id, consumer_name, payload_hash, received_at, processed_at`,
      [params.id, params.messageId, params.consumerName, params.payloadHash],
    );

    const row = result.rows[0];
    return row ? this.toDomain(row) : null;
  }

  async markProcessed(client: DbClient, inboxMessage: InboxMessage): Promise<void> {
    await client.query(
      `UPDATE inbox_messages SET processed_at = $1 WHERE id = $2`,
      [inboxMessage.processedAt, inboxMessage.id],
    );
  }

  private toDomain(row: InboxMessageRow): InboxMessage {
    return InboxMessage.reconstitute({
      id: row.id,
      messageId: row.message_id,
      consumerName: row.consumer_name,
      payloadHash: row.payload_hash,
      receivedAt: row.received_at,
      processedAt: row.processed_at,
    });
  }
}