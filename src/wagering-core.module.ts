
import { Module } from '@nestjs/common';
import type { Pool } from 'pg';

import { ProcessWagerTransactionUseCase } from './application/use-cases/process-wager-transaction.use-case';
import { DatabaseModule } from './infra/database/database.module';
import { PG_POOL } from './infra/database/pool.provider';
import { PostgresWagerTransactionRepository } from './infra/database/postgres-wager-transaction.repository';
import { PostgresWalletRepository } from './infra/database/postgres-wallet.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    PostgresWalletRepository,
    PostgresWagerTransactionRepository,
    {
      provide: ProcessWagerTransactionUseCase,
      useFactory: (
        pool: Pool,
        walletRepository: PostgresWalletRepository,
        transactionRepository: PostgresWagerTransactionRepository,
      ) =>
        new ProcessWagerTransactionUseCase(
          pool,
          walletRepository,
          transactionRepository,
        ),
      inject: [PG_POOL, PostgresWalletRepository, PostgresWagerTransactionRepository],
    },
  ],
  exports: [
    ProcessWagerTransactionUseCase,
    PostgresWalletRepository,
    PostgresWagerTransactionRepository,
  ],
})
export class WageringCoreModule {}