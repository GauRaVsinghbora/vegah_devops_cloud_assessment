import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { MongoService } from './mongo/mongo.service';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mongo: MongoService,
  ) {}

  @Get()
  async check() {
    const results = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.client.ping(),
      this.mongo.events.estimatedDocumentCount(),
    ]);
    const services = {
      mysql: results[0].status === 'fulfilled' ? 'ok' : 'unavailable',
      redis: results[1].status === 'fulfilled' ? 'ok' : 'unavailable',
      mongodb: results[2].status === 'fulfilled' ? 'ok' : 'unavailable',
    };
    const body = { status: Object.values(services).every((state) => state === 'ok') ? 'ok' : 'degraded', services };
    if (body.status !== 'ok') throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE);
    return body;
  }
}
