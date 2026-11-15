import { ValidationPipe, type INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

export function configureHttpApp(app: INestApplication, config: ConfigService): void {
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
}
