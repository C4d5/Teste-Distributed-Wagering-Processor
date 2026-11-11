
import { Injectable } from '@nestjs/common';

import { Money, Wallet } from '../../domain';
import { DbClient } from './db-client';

interface WalletRow {
  id: string;
  user_id: string;
  balance_cents: string;
  currency: string;
  version: number;
}

@Injectable()
export class PostgresWalletRepository {
  
  async findByIdForUpdate(client: DbClient, walletId: string): Promise<Wallet | null> {
    const result = await client.query<WalletRow>(
      `SELECT id, user_id, balance_cents, currency, version
         FROM wallets
        WHERE id = $1
        FOR UPDATE`,
      [walletId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return this.toDomain(row);
  }

  
  async updateBalanceAndVersion(client: DbClient, wallet: Wallet): Promise<void> {
    await client.query(
      `UPDATE wallets
          SET balance_cents = $1,
              version = $2
        WHERE id = $3`,
      [
        wallet.balance.toCents().toString(),
        wallet.version,
        wallet.id,
      ],
    );
  }

  private toDomain(row: WalletRow): Wallet {
    return Wallet.reconstitute({
      id: row.id,
      userId: row.user_id,
      balance: Money.fromCents(BigInt(row.balance_cents)),
      currency: row.currency,
      version: row.version,
    });
  }
}