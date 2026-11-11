
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidMoneyError extends DomainError {}

export class InsufficientFundsError extends DomainError {
  constructor(walletId: string, balanceCents: bigint, requestedCents: bigint) {
    super(
      `Saldo insuficiente na wallet ${walletId}: saldo atual é ${balanceCents} centavos, ` +
        `mas foi solicitado um débito de ${requestedCents} centavos.`,
    );
  }
}


export class InvalidWagerTransactionError extends DomainError {}