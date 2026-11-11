
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  InsufficientFundsError,
  InvalidMoneyError,
  InvalidWagerTransactionError,
} from '../../domain';
import { WalletNotFoundError } from '../../application/errors';

@Catch(
  WalletNotFoundError,
  InsufficientFundsError,
  InvalidMoneyError,
  InvalidWagerTransactionError,
)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const response = httpContext.getResponse<Response>();

    const statusCode = this.resolveStatusCode(exception);

    response.status(statusCode).json({
      statusCode,
      error: exception.constructor.name,
      message: exception.message,
    });
  }

  private resolveStatusCode(exception: Error): number {
    if (exception instanceof WalletNotFoundError) {
      return HttpStatus.NOT_FOUND; // 404
    }
    if (exception instanceof InsufficientFundsError) {
      return HttpStatus.UNPROCESSABLE_ENTITY; // 422
    }
    return HttpStatus.BAD_REQUEST; // 400
  }
}