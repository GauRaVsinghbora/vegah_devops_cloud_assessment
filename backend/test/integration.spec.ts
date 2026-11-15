import { PrismaClient } from '../src/generated/prisma/client';
import { MongoClient } from 'mongodb';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { createMariaDbAdapter } from '../src/prisma/mysql-connection';

describe('SmartURL database integration', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL must be set for integration tests');
  const prisma = new PrismaClient({ adapter: createMariaDbAdapter(databaseUrl) });
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const mongo = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/smarturl');

  afterAll(async () => {
    await Promise.all([prisma.$disconnect(), redis.quit(), mongo.close()]);
  });

  it('persists relational URL data, Redis mappings, and Mongo click events', async () => {
    const client = mongo.db().collection('click_events');
    const email = `ci-${randomUUID()}@example.test`;
    const code = randomUUID().replace(/-/g, '').slice(0, 12);
    const user = await prisma.user.create({ data: { email, passwordHash: 'test-hash' } });
    try {
      const url = await prisma.url.create({ data: { userId: user.id, originalUrl: 'https://example.test', shortCode: code } });
      expect(url.status).toBe('ACTIVE');
      const disabledUrl = await prisma.url.update({
        where: { id: url.id },
        data: { status: 'DISABLED' },
      });
      expect(disabledUrl.status).toBe('DISABLED');
      await redis.set(`integration:${code}`, url.originalUrl, 'EX', 30);
      expect(await redis.get(`integration:${code}`)).toBe(url.originalUrl);
      await client.insertOne({ short_code: code, user_id: user.id, browser: 'Test', clicked_at: new Date() });
      expect(await client.countDocuments({ short_code: code })).toBe(1);
      await client.deleteMany({ short_code: code });
      await redis.del(`integration:${code}`);
      await prisma.url.delete({ where: { id: url.id } });
      expect(await prisma.url.findUnique({ where: { id: url.id } })).toBeNull();
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
