import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';
import { MongoModule } from './mongo/mongo.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { UrlsModule } from './urls/urls.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
    PrismaModule,
    RedisModule,
    MongoModule,
    AuthModule,
    UrlsModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
