import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureHttpApp } from './app-setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  configureHttpApp(app, config);
  app.enableShutdownHooks();
  const port = Number(config.get('PORT') ?? config.get('API_PORT', 4000));
  await app.listen(port, '0.0.0.0');
}
bootstrap();
