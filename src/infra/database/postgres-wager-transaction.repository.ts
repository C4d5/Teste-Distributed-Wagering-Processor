
import { Injectable } from '@nestjs/common';

import {
  Money,
  WagerTransaction,
  WagerTransactionStatus,
  WagerTransactionType,
} from '../../domain';
import { DbClient } from './db-client';

interface WagerTransactionRow {
  id: string;
  wallet_id: string;
  type: WagerTransactionType;
  amount_cents: string;
  balance_after_cents: string;
  reference_id: string;
  status: WagerTransactionStatus;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

@Injectable()
export class PostgresWagerTransactionRepository {
  
  async findByWalletAndReference(
    client: DbClient,
    walletId: string,
    referenceId: string,
  ): Promise<WagerTransaction | null> {
    const result = await client.query<WagerTransactionRow>(
      `SELECT id, wallet_id, type, amount_cents, balance_after_cents,
              reference_id, status, metadata, created_at
         FROM wager_transactions
        WHERE wallet_id = $1 AND reference_id = $2`,
      [walletId, referenceId],
    );

    const row = result.rows[0];
    return row ? this.toDomain(row) : null;
  }

  
  async save(client: DbClient, transaction: WagerTransaction): Promise<void> {
    await client.query(
      `INSERT INTO wager_transactions
          (id, wallet_id, type, amount_cents, balance_after_cents,
           reference_id, status, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        transaction.id,
        transaction.walletId,
        transaction.type,
        transaction.amount.toCents().toString(),
        transaction.balanceAfter.toCents().toString(),
        transaction.referenceId,
        transaction.status,
        transaction.metadata ? JSON.stringify(transaction.metadata) : null,
        transaction.createdAt,
      ],
    );
  }

  private toDomain(row: WagerTransactionRow): WagerTransaction {
    return WagerTransaction.reconstitute({
      id: row.id,
      walletId: row.wallet_id,
      type: row.type,
      amount: Money.fromCents(BigInt(row.amount_cents)),
      balanceAfter: Money.fromCents(BigInt(row.balance_after_cents)),
      referenceId: row.reference_id,
      status: row.status,
      metadata: row.metadata ?? undefined,
      createdAt: row.created_at,
    });
  }
}