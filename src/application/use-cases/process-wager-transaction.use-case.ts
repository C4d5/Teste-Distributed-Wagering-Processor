
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

import {
  InvalidWagerTransactionError,
  Money,
  WagerTransaction,
  WagerTransactionStatus,
  WagerTransactionType,
} from '../../domain';
import { DbClient } from '../../infra/database/db-client';
import { PostgresWagerTransactionRepository } from '../../infra/database/postgres-wager-transaction.repository';
import { PostgresWalletRepository } from '../../infra/database/postgres-wallet.repository';
import { WalletNotFoundError } from '../errors';


const VALID_TRANSACTION_TYPES = new Set<WagerTransactionType>([
  'BET',
  'WIN',
  'DEPOSIT',
  'WITHDRAWAL',
  'REFUND',
]);

export interface ProcessWagerTransactionRequest {
  walletId: string;
  type: WagerTransactionType;
  amount: string;
  referenceId: string;
  metadata?: Record<string, unknown>;
}

export interface ProcessWagerTransactionResult {
  transactionId: string;
  walletId: string;
  type: WagerTransactionType;
  amount: string;
  balanceAfter: string;
  referenceId: string;
  status: WagerTransactionStatus;
  idempotent: boolean;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

export class ProcessWagerTransactionUseCase {
  constructor(
    private readonly pool: Pool,
    private readonly walletRepository: PostgresWalletRepository,
    private readonly transactionRepository: PostgresWagerTransactionRepository,
  ) {}


  async execute(
    request: ProcessWagerTransactionRequest,
  ): Promise<ProcessWagerTransactionResult> {
    const client: PoolClient = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const result = await this.executeWithClient(client, request);

      await client.query('COMMIT');

      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);

      if (isUniqueViolation(error)) {
        const existingTransaction =
          await this.transactionRepository.findByWalletAndReference(
            this.pool,
            request.walletId,
            request.referenceId,
          );
        if (existingTransaction) {
          return this.toResult(existingTransaction, true);
        }
      }

      throw error;
    } finally {
      client.release();
    }
  }


  async executeWithClient(
    client: DbClient,
    request: ProcessWagerTransactionRequest,
  ): Promise<ProcessWagerTransactionResult> {
    if (!VALID_TRANSACTION_TYPES.has(request.type)) {
      throw new InvalidWagerTransactionError(
        `Tipo de transação desconhecido: "${request.type}".`,
      );
    }
    const amount = Money.fromDecimalString(request.amount);

    const wallet = await this.walletRepository.findByIdForUpdate(
      client,
      request.walletId,
    );

    if (!wallet) {
      throw new WalletNotFoundError(request.walletId);
    }

    const existingTransaction =
      await this.transactionRepository.findByWalletAndReference(
        client,
        wallet.id,
        request.referenceId,
      );

    if (existingTransaction) {
      return this.toResult(existingTransaction, true);
    }

    if (WagerTransaction.isDebit(request.type)) {
      wallet.debit(amount);
    } else {
      wallet.credit(amount);
    }

    const transaction = WagerTransaction.create({
      id: randomUUID(),
      walletId: wallet.id,
      type: request.type,
      amount,
      balanceAfter: wallet.balance,
      referenceId: request.referenceId,
      metadata: request.metadata,
    });

    await this.transactionRepository.save(client, transaction);
    await this.walletRepository.updateBalanceAndVersion(client, wallet);

    return this.toResult(transaction, false);
  }


  private toResult(
    transaction: WagerTransaction,
    idempotent: boolean,
  ): ProcessWagerTransactionResult {
    return {
      transactionId: transaction.id,
      walletId: transaction.walletId,
      type: transaction.type,
      amount: transaction.amount.format(),
      balanceAfter: transaction.balanceAfter.format(),
      referenceId: transaction.referenceId,
      status: transaction.status,
      idempotent,
    };
  }
}