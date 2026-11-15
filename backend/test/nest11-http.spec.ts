import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { AuthGuard } from '../src/auth/auth.guard';
import { UrlsController } from '../src/urls/urls.controller';
import { UrlsService } from '../src/urls/urls.service';
import { RedisService } from '../src/redis/redis.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureHttpApp } from '../src/app-setup';

describe('NestJS 11 HTTP compatibility', () => {
  const jwtSecret = 'nest11-http-test-secret-with-at-least-32-characters';
  const config = new ConfigService({
    JWT_SECRET: jwtSecret,
    FRONTEND_URL: 'http://frontend.test',
  });
  const prisma = {
    user: {
      create: jest.fn(({ data }: { data: { email: string } }) =>
        Promise.resolve({ id: 'user-123', email: data.email })),
    },
  };
  const redis = { consumeRateLimit: jest.fn().mockResolvedValue(true) };
  const urls = {
    list: jest.fn().mockResolvedValue([{ id: 'url-123', originalUrl: 'https://example.test' }]),
    resolve: jest.fn().mockResolvedValue('https://destination.test/path'),
  };

  let moduleRef: TestingModule;
  let app: INestApplication | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [AuthController, UrlsController],
      providers: [
        AuthService,
        AuthGuard,
        { provide: ConfigService, useValue: config },
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: UrlsService, useValue: urls },
      ],
    }).compile();

    const application = moduleRef.createNestApplication();
    app = application;
    configureHttpApp(application, config);
    await application.listen(0);
    const address = application.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app?.close();
    await moduleRef?.close();
  });

  it('registers over HTTP, rejects unauthenticated access, and accepts its bearer token', async () => {
    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.test', password: 'a-valid-password' }),
    });
    expect(registration.status).toBe(201);
    const { token } = await registration.json() as { token: string };
    expect(token).toEqual(expect.any(String));

    const unauthorized = await fetch(`${baseUrl}/api/urls`);
    expect(unauthorized.status).toBe(401);

    const authorized = await fetch(`${baseUrl}/api/urls`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(authorized.status).toBe(200);
    expect(await authorized.json()).toEqual([{ id: 'url-123', originalUrl: 'https://example.test' }]);
  });

  it('preserves query parsing, CORS, redirect status, and DTO validation', async () => {
    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'search@example.test', password: 'a-valid-password' }),
    });
    const { token } = await registration.json() as { token: string };
    const headers = { Authorization: `Bearer ${token}` };

    const search = await fetch(`${baseUrl}/api/urls?search=launch%20campaign`, { headers });
    expect(search.status).toBe(200);
    expect(urls.list).toHaveBeenLastCalledWith('user-123', 'launch campaign');

    const redirect = await fetch(`${baseUrl}/api/r/demo`, { redirect: 'manual' });
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get('location')).toBe('https://destination.test/path');

    const preflight = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://frontend.test',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization',
      },
    });
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://frontend.test');

    const invalid = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'short', unexpected: true }),
    });
    expect(invalid.status).toBe(400);
  });

  it('uses the process environment value over a value from the environment file', async () => {
    const variable = `SMARTURL_CONFIG_PRECEDENCE_${randomUUID().replace(/-/g, '').toUpperCase()}`;
    const previousValue = process.env[variable];
    const directory = mkdtempSync(join(tmpdir(), 'smarturl-config-'));
    const envFile = join(directory, '.env');
    let configModule: TestingModule | undefined;

    try {
      writeFileSync(envFile, `${variable}=from-file\n`);
      process.env[variable] = 'from-process';
      configModule = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ envFilePath: envFile })],
      }).compile();

      expect(configModule.get(ConfigService).get(variable)).toBe('from-process');
    } finally {
      await configModule?.close();
      if (previousValue === undefined) {
        delete process.env[variable];
      } else {
        process.env[variable] = previousValue;
      }
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
