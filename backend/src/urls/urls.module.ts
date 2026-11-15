import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UrlsController } from './urls.controller';
import { UrlsService } from './urls.service';

@Module({
  imports: [AuthModule],
  controllers: [UrlsController],
  providers: [UrlsService],
  exports: [UrlsService],
})
export class UrlsModule {}
