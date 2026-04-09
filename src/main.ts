import * as dotenv from 'dotenv';
dotenv.config();

import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { AppModule } from './app.module';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(Logger);
  app.useLogger(logger);

  app.enableShutdownHooks();

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  app.use(helmet());

  app.useGlobalFilters(new HttpExceptionFilter(isProduction));

  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:8081'),
    credentials: true,
  });

  const port = configService.get<number>('PORT', 8080);
  await app.listen(port);
  logger.log(`Inference gateway running on port ${port}`);
}
void bootstrap();
