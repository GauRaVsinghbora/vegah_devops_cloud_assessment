import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient } from 'mongodb';
import { MongoService } from './mongo.service';

@Global()
@Module({
  providers: [
    {
      provide: 'MONGO_CLIENT',
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const client = new MongoClient(config.getOrThrow<string>('MONGODB_URI'));
        await client.connect();
        return client;
      },
    },
    MongoService,
  ],
  exports: [MongoService],
})
export class MongoModule {}
