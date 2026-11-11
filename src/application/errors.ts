
import {
  InsufficientFundsError,
  InvalidMoneyError,
  InvalidWagerTransactionError,
} from '../domain';

export class WalletNotFoundError extends Error {
  constructor(walletId: string) {
    super(`Wallet não encontrada: ${walletId}`);
    this.name = 'WalletNotFoundError';
  }
}
export function isBusinessRuleError(
  error: unknown,
): error is
  | InsufficientFundsError
  | InvalidMoneyError
  | InvalidWagerTransactionError
  | WalletNotFoundError {
  return (
    error instanceof InsufficientFundsError ||
    error instanceof InvalidMoneyError ||
    error instanceof InvalidWagerTransactionError ||
    error instanceof WalletNotFoundError
  );
}