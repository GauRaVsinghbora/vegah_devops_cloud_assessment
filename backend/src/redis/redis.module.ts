import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.get('REDIS_URL') || {
          host: config.get('REDIS_HOST', 'localhost'),
          port: Number(config.get('REDIS_PORT', 6379)),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          maxRetriesPerRequest: 2,
          lazyConnect: false,
        }),
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
