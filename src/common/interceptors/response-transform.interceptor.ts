import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { RENDER_METADATA } from '@nestjs/common/constants';
import { Observable, map } from 'rxjs';
import { ApiSuccessResponse } from '../types/api-response.type';

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, T | ApiSuccessResponse<T>>
{
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<T | ApiSuccessResponse<T>> {
    const isRenderRoute = Reflect.getMetadata(RENDER_METADATA, context.getHandler());
    if (isRenderRoute) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
      })),
    );
  }
}
