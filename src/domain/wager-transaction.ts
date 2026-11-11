
import { InvalidWagerTransactionError } from './errors';
import { Money } from './money';


export type WagerTransactionType =
  | 'BET'
  | 'WIN'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'REFUND';

export type WagerTransactionStatus = 'COMPLETED' | 'FAILED' | 'REVERSED';

const DEBIT_TYPES = new Set<WagerTransactionType>(['BET', 'WITHDRAWAL']);

const CREDIT_TYPES = new Set<WagerTransactionType>([
  'WIN',
  'DEPOSIT',
  'REFUND',
]);

export interface CreateWagerTransactionParams {
  id: string;
  walletId: string;
  type: WagerTransactionType;
  amount: Money;
  balanceAfter: Money;
  referenceId: string;
  metadata?: Record<string, unknown>;
}

export interface ReconstituteWagerTransactionParams
  extends CreateWagerTransactionParams {
  status: WagerTransactionStatus;
  createdAt: Date;
}

export class WagerTransaction {
  private constructor(
    private readonly props: {
      id: string;
      walletId: string;
      type: WagerTransactionType;
      amount: Money;
      balanceAfter: Money;
      referenceId: string;
      status: WagerTransactionStatus;
      metadata?: Record<string, unknown>;
      createdAt: Date;
    },
  ) {
    if (props.amount.isZero()) {
      throw new InvalidWagerTransactionError(
        'Uma WagerTransaction não pode ter valor igual a zero.',
      );
    }
  }


  static create(params: CreateWagerTransactionParams): WagerTransaction {
    return new WagerTransaction({
      ...params,
      status: 'COMPLETED',
      createdAt: new Date(),
    });
  }


  static reconstitute(
    params: ReconstituteWagerTransactionParams,
  ): WagerTransaction {
    return new WagerTransaction(params);
  }

  static isDebit(type: WagerTransactionType): boolean {
    return DEBIT_TYPES.has(type);
  }

  static isCredit(type: WagerTransactionType): boolean {
    return CREDIT_TYPES.has(type);
  }


  get id(): string {
    return this.props.id;
  }

  get walletId(): string {
    return this.props.walletId;
  }

  get type(): WagerTransactionType {
    return this.props.type;
  }

  get amount(): Money {
    return this.props.amount;
  }

  get balanceAfter(): Money {
    return this.props.balanceAfter;
  }

  get referenceId(): string {
    return this.props.referenceId;
  }

  get status(): WagerTransactionStatus {
    return this.props.status;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this.props.metadata;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  /** Atalho de instância para `WagerTransaction.isDebit(this.type)`. */
  isDebit(): boolean {
    return WagerTransaction.isDebit(this.type);
  }

  /** Atalho de instância para `WagerTransaction.isCredit(this.type)`. */
  isCredit(): boolean {
    return WagerTransaction.isCredit(this.type);
  }
}