
import { InvalidMoneyError } from './errors';

const DECIMAL_PLACES = 2;

const CENTS_MULTIPLIER = 10n ** BigInt(DECIMAL_PLACES);

const DECIMAL_STRING_PATTERN = /^\d+(\.\d{1,2})?$/;

export class Money {
  private constructor(private readonly cents: bigint) {
    if (cents < 0n) {
      throw new InvalidMoneyError(
        `Money não pode representar um valor negativo (recebido: ${cents} centavos).`,
      );
    }
  }

  static zero(): Money {
    return new Money(0n);
  }

  static fromCents(cents: bigint): Money {
    return new Money(cents);
  }


  static fromDecimalString(value: string): Money {
    const trimmed = value.trim();

    if (trimmed.startsWith('-')) {
      throw new InvalidMoneyError(
        `Money não aceita valores negativos (recebido: "${value}").`,
      );
    }

    if (!DECIMAL_STRING_PATTERN.test(trimmed)) {
      throw new InvalidMoneyError(
        `Formato de valor monetário inválido: "${value}". Use o formato "123.45".`,
      );
    }

    const [integerPart, fractionPart = ''] = trimmed.split('.');

    const normalizedFraction = fractionPart.padEnd(DECIMAL_PLACES, '0');


    const cents =
      BigInt(integerPart) * CENTS_MULTIPLIER + BigInt(normalizedFraction);

    return new Money(cents);
  }



  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }


  subtract(other: Money): Money {
    return new Money(this.cents - other.cents);
  }


  isGreaterThanOrEqual(other: Money): boolean {
    return this.cents >= other.cents;
  }

  isZero(): boolean {
    return this.cents === 0n;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }



  toCents(): bigint {
    return this.cents;
  }

  format(): string {
    const integerPart = this.cents / CENTS_MULTIPLIER;
    const fractionPart = this.cents % CENTS_MULTIPLIER;

    const fractionStr = fractionPart.toString().padStart(DECIMAL_PLACES, '0');

    return `${integerPart.toString()}.${fractionStr}`;
  }

  toString(): string {
    return this.format();
  }
}