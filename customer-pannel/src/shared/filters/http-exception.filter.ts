import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ErrorCode, ErrorCodes, ErrorMessages } from '../constants/error-codes.constant';
import { ApiErrorResponse } from '@shared/interfaces';
import { ValidationError } from '@shared/interfaces';

const TRACE_ID_KEY = 'traceId';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly version: string;

  constructor(private readonly configService: ConfigService) {
    this.version = this.configService.get<string>('app.apiVersion', '1');
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { [TRACE_ID_KEY]?: string }>();
    const response = ctx.getResponse<Response>();

    const status = this.getStatus(exception);
    const code = this.getErrorCode(status);
    const message = this.getMessage(exception, code);
    const details = this.getDetails(exception);
    const traceId = request[TRACE_ID_KEY] || 'unknown';

    const errorResponse: ApiErrorResponse = {
      success: false,
      statusCode: status,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      meta: {
        timestamp: new Date().toISOString(),
        traceId,
        version: this.version,
      },
    };

    if (status >= 500) {
      this.logger.error(
        `[${traceId}] ${code}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(errorResponse);
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getErrorCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCodes.VALIDATION_ERROR;
      case HttpStatus.NOT_FOUND:
        return ErrorCodes.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCodes.CONFLICT;
      default:
        return ErrorCodes.INTERNAL_ERROR;
    }
  }

  private getMessage(exception: unknown, code: ErrorCode): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return response;
      }

      if (typeof response === 'object' && response !== null) {
        const responseObj = response as Record<string, unknown>;

        if (typeof responseObj.message === 'string') {
          return responseObj.message;
        }

        if (Array.isArray(responseObj.message)) {
          return 'Validation failed';
        }
      }
    }

    return ErrorMessages[code];
  }

  private getDetails(exception: unknown): ValidationError[] | undefined {
    if (!(exception instanceof HttpException)) {
      return undefined;
    }

    const response = exception.getResponse();

    if (typeof response === 'object' && response !== null) {
      const responseObj = response as Record<string, unknown>;

      if (Array.isArray(responseObj.message)) {
        return responseObj.message.map((msg: string) => ({
          field: 'unknown',
          message: msg,
        }));
      }
    }

    return undefined;
  }
}
