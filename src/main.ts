import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';

const logger = new Logger('Main');

// Prevent unhandled promise rejections from crashing the process.
// This is critical because Telegraf/bot interactions can throw
// in async contexts that are not always properly awaited.
process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  logger.error(`Unhandled Rejection: ${message}`);
  if (reason instanceof Error && reason.stack) {
    logger.error(reason.stack);
  }
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  if (error.stack) {
    logger.error(error.stack);
  }
  // For truly fatal errors (e.g. out of memory), still exit.
  // But for Telegram API errors that bubble up, keep running.
  // Only exit for system-level errors.
  if (
    error.message.includes('ENOMEM') ||
    error.message.includes('ENOSPC')
  ) {
    process.exit(1);
  }
});

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  app.setBaseViewsDir(join(process.cwd(), 'views'));
  app.setViewEngine('ejs');
  app.useStaticAssets(join(process.cwd(), 'public'));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  const port = configService.get<number>('PORT', 5000);
  await app.listen(port);
  logger.log(`Application listening on port ${port}`);
}

void bootstrap();
