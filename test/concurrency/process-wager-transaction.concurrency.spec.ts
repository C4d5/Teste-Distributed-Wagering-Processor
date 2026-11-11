
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

import { InsufficientFundsError } from '../../src/domain';
import { ProcessWagerTransactionUseCase } from '../../src/application/use-cases/process-wager-transaction.use-case';
import { createPool } from '../../src/infra/database/pool';
import { PostgresWagerTransactionRepository } from '../../src/infra/database/postgres-wager-transaction.repository';
import { PostgresWalletRepository } from '../../src/infra/database/postgres-wallet.repository';

describe('ProcessWagerTransactionUseCase — concorrência (lock pessimista)', () => {
  let pool: Pool;
  let useCase: ProcessWagerTransactionUseCase;
  let walletId: string;

  beforeAll(() => {
    pool = createPool();
    const walletRepository = new PostgresWalletRepository();
    const transactionRepository = new PostgresWagerTransactionRepository();

    useCase = new ProcessWagerTransactionUseCase(
      pool,
      walletRepository,
      transactionRepository,
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    walletId = randomUUID();
    await pool.query(
      `INSERT INTO wallets (id, user_id, balance_cents, currency)
       VALUES ($1, $2, 10000, 'BRL')`,
      [walletId, randomUUID()],
    );
  });

  afterEach(async () => {
    await pool.query('DELETE FROM wager_transactions WHERE wallet_id = $1', [
      walletId,
    ]);
    await pool.query('DELETE FROM wallets WHERE id = $1', [walletId]);
  });

  it(
    'aplica exatamente UMA de duas apostas concorrentes de R$80 contra um ' +
      'saldo de R$100, rejeitando a outra por saldo insuficiente, sem lost update',
    async () => {
      const outcomes = await Promise.allSettled([
        useCase.execute({
          walletId,
          type: 'BET',
          amount: '80.00',
          referenceId: `bet-A-${randomUUID()}`,
        }),
        useCase.execute({
          walletId,
          type: 'BET',
          amount: '80.00',
          referenceId: `bet-B-${randomUUID()}`,
        }),
      ]);

      const fulfilled = outcomes.filter(
        (outcome): outcome is PromiseFulfilledResult<Awaited<ReturnType<typeof useCase.execute>>> =>
          outcome.status === 'fulfilled',
      );
      const rejected = outcomes.filter(
        (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
      );

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const winningResult = fulfilled[0].value;
      expect(winningResult.status).toBe('COMPLETED');
      expect(winningResult.type).toBe('BET');
      expect(winningResult.balanceAfter).toBe('20.00');
      expect(winningResult.idempotent).toBe(false);

      expect(rejected[0].reason).toBeInstanceOf(InsufficientFundsError);

      const { rows: walletRows } = await pool.query<{ balance_cents: string }>(
        'SELECT balance_cents FROM wallets WHERE id = $1',
        [walletId],
      );
      expect(walletRows[0].balance_cents).toBe('2000'); // R$ 20,00 em centavos

      const { rows: transactionRows } = await pool.query(
        'SELECT reference_id, status FROM wager_transactions WHERE wallet_id = $1',
        [walletId],
      );
      expect(transactionRows).toHaveLength(1);
      expect(transactionRows[0].status).toBe('COMPLETED');
    },
    15_000,
  );
});