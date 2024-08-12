import { Catch, ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { ZodError } from 'zod';

@Catch(ZodError)
export class ZodErrFilter<T extends ZodError> implements ExceptionFilter {
  catch(exception: T, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = 400;
    response.status(status).json({
      errors: exception.errors,
      message: exception.message,
      statusCode: status,
    });
  }
}
