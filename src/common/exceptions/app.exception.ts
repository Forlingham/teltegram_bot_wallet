import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    message: string,
    public readonly errorCode: string,
    status: HttpStatus,
    details?: unknown,
  ) {
    super(
      {
        message,
        code: errorCode,
        details,
      },
      status,
    );
  }
}
