import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { MongoService } from '../src/mongo/mongo.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { UrlsService } from '../src/urls/urls.service';

describe('UrlsService redirects', () => {
  it('serves cache hits without a MySQL lookup and records click metadata', async () => {
    const redis = {
      client: { get: jest.fn().mockResolvedValue(JSON.stringify({ destination: 'https://example.com', userId: 'u1' })) },
      consumeRateLimit: jest.fn().mockResolvedValue(true),
    };
    const prisma = { url: { findUnique: jest.fn() } };
    const mongo = { events: { insertOne: jest.fn().mockResolvedValue(undefined) } };
    const config = { get: () => 'https://short.test' } as unknown as ConfigService;
    const service = new UrlsService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      mongo as unknown as MongoService,
      config,
    );
    const destination = await service.resolve('abc123', {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Chrome/120', referer: 'https://referrer.test' },
    } as unknown as Request);
    expect(destination).toBe('https://example.com');
    expect(prisma.url.findUnique).not.toHaveBeenCalled();
    await new Promise((resolve) => setImmediate(resolve));
    expect(mongo.events.insertOne).toHaveBeenCalledWith(expect.objectContaining({
      short_code: 'abc123',
      user_id: 'u1',
      browser: 'Chrome',
      referrer: 'https://referrer.test',
    }));
  });

  it('loads cache misses from MySQL and caches the active URL mapping', async () => {
    const redis = {
      client: { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue('OK') },
      consumeRateLimit: jest.fn().mockResolvedValue(true),
    };
    const prisma = { url: { findUnique: jest.fn().mockResolvedValue({ originalUrl: 'https://example.org', userId: 'u2', status: 'ACTIVE' }) } };
    const mongo = { events: { insertOne: jest.fn().mockResolvedValue(undefined) } };
    const config = { get: () => 'http://localhost:4000' } as unknown as ConfigService;
    const service = new UrlsService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      mongo as unknown as MongoService,
      config,
    );
    const destination = await service.resolve('xyz789', { ip: '127.0.0.1', headers: {} } as unknown as Request);
    expect(destination).toBe('https://example.org');
    expect(redis.client.set).toHaveBeenCalledWith(
      'short-url:xyz789',
      JSON.stringify({ destination: 'https://example.org', userId: 'u2' }),
      'EX',
      3600,
    );
  });

  it('evicts structurally invalid cache entries and resolves from MySQL', async () => {
    const redis = {
      client: {
        get: jest.fn().mockResolvedValue(JSON.stringify({ destination: 'https://stale.example.org', userId: 7 })),
        del: jest.fn().mockResolvedValue(1),
        set: jest.fn().mockResolvedValue('OK'),
      },
      consumeRateLimit: jest.fn().mockResolvedValue(true),
    };
    const prisma = {
      url: {
        findUnique: jest.fn().mockResolvedValue({
          originalUrl: 'https://example.org/current',
          userId: 'u2',
          status: 'ACTIVE',
        }),
      },
    };
    const mongo = { events: { insertOne: jest.fn().mockResolvedValue(undefined) } };
    const service = new UrlsService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      mongo as unknown as MongoService,
      { get: () => 'http://localhost:4000' } as unknown as ConfigService,
    );

    await expect(service.resolve('xyz789', { ip: '127.0.0.1', headers: {} } as unknown as Request))
      .resolves.toBe('https://example.org/current');

    expect(redis.client.del).toHaveBeenCalledWith('short-url:xyz789');
    expect(prisma.url.findUnique).toHaveBeenCalledWith({ where: { shortCode: 'xyz789' } });
    expect(redis.client.set).toHaveBeenCalledWith(
      'short-url:xyz789',
      JSON.stringify({ destination: 'https://example.org/current', userId: 'u2' }),
      'EX',
      3600,
    );
  });

  it('rejects redirects after the per-address rate limit is exceeded', async () => {
    const redis = {
      client: { get: jest.fn() },
      consumeRateLimit: jest.fn().mockResolvedValue(false),
    };
    const service = new UrlsService(
      {} as PrismaService,
      redis as unknown as RedisService,
      {} as MongoService,
      { get: () => 'http://localhost:4000' } as unknown as ConfigService,
    );
    await expect(service.resolve('limited', { ip: '127.0.0.1', headers: {} } as unknown as Request))
      .rejects.toMatchObject({ status: 429 });
  });
});
