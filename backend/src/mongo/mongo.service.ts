import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Collection, MongoClient } from 'mongodb';

export type ClickEvent = {
  short_code: string;
  user_id: string;
  browser: string;
  operating_system: string;
  device_type: string;
  referrer: string | null;
  clicked_at: Date;
};

@Injectable()
export class MongoService implements OnModuleDestroy {
  readonly events: Collection<ClickEvent>;

  constructor(@Inject('MONGO_CLIENT') private readonly client: MongoClient) {
    this.events = client.db().collection<ClickEvent>('click_events');
  }

  async onModuleInit() {
    await this.events.createIndex({ short_code: 1, clicked_at: -1 });
    await this.events.createIndex({ user_id: 1, clicked_at: -1 });
  }

  async onModuleDestroy() {
    await this.client.close();
  }
}
