
import { Body, Controller, HttpStatus, Post, Res, UseFilters, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import { ProcessWagerTransactionUseCase } from '../../application/use-cases/process-wager-transaction.use-case';
import { ProcessWagerTransactionDto } from '../dto/process-wager-transaction.dto';
import { DomainExceptionFilter } from '../filters/domain-exception.filter';
import { NoOpAuthGuard } from '../guards/no-op-auth.guard';

@Controller('wagering')
@UseGuards(NoOpAuthGuard)
@UseFilters(DomainExceptionFilter)
export class WageringController {
  constructor(
    private readonly processWagerTransaction: ProcessWagerTransactionUseCase,
  ) {}

  @Post('transactions')
  async processTransaction(
    @Body() dto: ProcessWagerTransactionDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.processWagerTransaction.execute(dto);

    response.status(result.idempotent ? HttpStatus.OK : HttpStatus.CREATED);

    return result;
  }
}