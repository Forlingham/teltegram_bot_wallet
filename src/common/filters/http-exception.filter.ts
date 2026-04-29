import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiErrorResponse } from '../types/api-response.type';
import { AppException } from '../exceptions/app.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();

      if (exception instanceof AppException) {
        const appBody = exception.getResponse() as {
          message: string;
          code: string;
          details?: unknown;
        };

        const payload: ApiErrorResponse = {
          success: false,
          error: {
            message: appBody.message,
            code: appBody.code,
            details: appBody.details,
          },
        };

        response.status(status).json(payload);
        return;
      }

      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : Array.isArray((body as Record<string, unknown>).message)
            ? ((body as Record<string, unknown>).message as string[]).join('; ')
            : ((body as Record<string, unknown>).message as string) || exception.message;

      const payload: ApiErrorResponse = {
        success: false,
        error: {
          message,
          code: `HTTP_${status}`,
          details: typeof body === 'object' ? body : undefined,
        },
      };

      this.logger.warn(`HTTP ${status} - ${message}`);

      response.status(status).json(payload);
      return;
    }

    const prismaCode =
      typeof exception === 'object' && exception !== null && 'code' in exception
        ? String((exception as { code?: unknown }).code)
        : null;

    if (prismaCode === 'P2021') {
      const payload: ApiErrorResponse = {
        success: false,
        error: {
          message: 'Database schema not up to date, please run Prisma migrations',
          code: 'DB_SCHEMA_OUTDATED',
        },
      };

      this.logger.error('Prisma table missing (P2021). Run Prisma migration.');
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(payload);
      return;
    }

    const message = exception instanceof Error ? exception.message : 'Internal server error';
    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(`Unhandled exception: ${message}`, stack);

    // Allow blockchain RPC errors to reach the client so the frontend
    // can translate them into user-friendly Chinese messages.
    const isRpcError = message.startsWith('RPC ') || message.includes('sendrawtransaction');

    const payload: ApiErrorResponse = {
      success: false,
      error: {
        message: isRpcError ? message : 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
      },
    };

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(payload);
  }
}
