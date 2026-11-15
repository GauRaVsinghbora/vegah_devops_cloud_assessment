import { MongoService } from '../src/mongo/mongo.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AnalyticsService } from '../src/analytics/analytics.service';

describe('AnalyticsService', () => {
  it('limits per-link click history to the most recent 90 days before grouping', async () => {
    const cursor = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      project: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([]),
    };
    const mongo = {
      events: {
        countDocuments: jest.fn().mockResolvedValue(120),
        aggregate: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
        find: jest.fn().mockReturnValue(cursor),
      },
    };
    const prisma = {
      url: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'url-1',
          shortCode: 'code-1',
          originalUrl: 'https://example.com',
        }),
      },
    };
    const service = new AnalyticsService(
      prisma as unknown as PrismaService,
      mongo as unknown as MongoService,
    );

    await service.details('user-1', 'url-1');

    const activityPipeline = mongo.events.aggregate.mock.calls[0][0];
    expect(activityPipeline[0]).toMatchObject({
      $match: {
        short_code: 'code-1',
        clicked_at: { $gte: expect.any(Date) },
      },
    });
    expect(activityPipeline[1]).toHaveProperty('$group');
    expect(activityPipeline[3]).toEqual({ $limit: 90 });
    const cutoff = activityPipeline[0].$match.clicked_at.$gte;
    expect(Math.abs(Date.now() - cutoff.getTime() - 90 * 86400000)).toBeLessThan(1000);
  });
});
