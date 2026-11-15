import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthenticatedRequest } from '../auth/auth.guard';
import { AnalyticsService } from './analytics.service';

@UseGuards(AuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  dashboard(@Req() req: AuthenticatedRequest) {
    return this.analytics.dashboard(req.userId);
  }

  @Get(':urlId')
  details(@Req() req: AuthenticatedRequest, @Param('urlId') urlId: string) {
    return this.analytics.details(req.userId, urlId);
  }
}
