
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

import { WagerTransactionType } from '../../domain';

const VALID_TRANSACTION_TYPES: WagerTransactionType[] = [
  'BET',
  'WIN',
  'DEPOSIT',
  'WITHDRAWAL',
  'REFUND',
];

export class ProcessWagerTransactionDto {
  @IsUUID('4', { message: 'walletId deve ser um UUID v4 válido.' })
  walletId!: string;

  @IsIn(VALID_TRANSACTION_TYPES, {
    message: `type deve ser um dos seguintes valores: ${VALID_TRANSACTION_TYPES.join(', ')}.`,
  })
  type!: WagerTransactionType;

  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount deve ser uma string decimal no formato "123.45" (até 2 casas decimais, sem sinal negativo).',
  })
  amount!: string;

  @IsString()
  @IsNotEmpty({
    message: 'referenceId é obrigatório — é ele que garante idempotência em caso de retries.',
  })
  referenceId!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}