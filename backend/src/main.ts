import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  const allowedOrigins = config.get<string>('FRONTEND_URL', 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim());
  const trustedProxy = config.get<string>('TRUST_PROXY');
  if (trustedProxy) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustedProxy === 'true' ? true : Number(trustedProxy));
  }
  app.enableCors({ origin: allowedOrigins, allowedHeaders: ['Content-Type', 'Authorization'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.enableShutdownHooks();
  await app.listen(Number(config.get('API_PORT', 4000)));
}
bootstrap();
