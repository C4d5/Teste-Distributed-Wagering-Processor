
import { InsufficientFundsError } from './errors';
import { Money } from './money';

export interface CreateWalletParams {
  id: string;
  userId: string;
  currency: string;
  initialBalance?: Money;
}

export interface ReconstituteWalletParams {
  id: string;
  userId: string;
  balance: Money;
  currency: string;
  version: number;
}

export class Wallet {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private _balance: Money,
    private readonly _currency: string,
    private _version: number,
  ) {}


  static create(params: CreateWalletParams): Wallet {
    return new Wallet(
      params.id,
      params.userId,
      params.initialBalance ?? Money.zero(),
      params.currency,
      0, 
    );
  }


  static reconstitute(params: ReconstituteWalletParams): Wallet {
    return new Wallet(
      params.id,
      params.userId,
      params.balance,
      params.currency,
      params.version,
    );
  }


  get id(): string {
    return this._id;
  }

  get userId(): string {
    return this._userId;
  }

  get balance(): Money {
    return this._balance;
  }

  get currency(): string {
    return this._currency;
  }

  get version(): number {
    return this._version;
  }



  credit(amount: Money): void {
    this._balance = this._balance.add(amount);
    this._version += 1;
  }

  
  debit(amount: Money): void {
    if (!this._balance.isGreaterThanOrEqual(amount)) {
      throw new InsufficientFundsError(
        this._id,
        this._balance.toCents(),
        amount.toCents(),
      );
    }

    this._balance = this._balance.subtract(amount);
    this._version += 1;
  }

 
  canDebit(amount: Money): boolean {
    return this._balance.isGreaterThanOrEqual(amount);
  }
}