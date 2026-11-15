import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject('REDIS_CLIENT') readonly client: Redis) {}

  async onModuleDestroy() {
    await this.client.quit();
  }

  async consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const count = await this.client.incr(key);
    if (count === 1) await this.client.expire(key, windowSeconds);
    return count <= limit;
  }
}
