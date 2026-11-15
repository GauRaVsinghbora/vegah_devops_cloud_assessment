import { Injectable, NotFoundException } from '@nestjs/common';
import { MongoService } from '../mongo/mongo.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService, private readonly mongo: MongoService) {}

  async dashboard(userId: string) {
    const urls = await this.prisma.url.findMany({ where: { userId }, select: { shortCode: true, originalUrl: true } });
    const codes = urls.map((url) => url.shortCode);
    const match = { short_code: { $in: codes } };
    const [totalUrls, activeUrls, totalClicks, topUrls, activity, browsers, devices, referrers, recent] = await Promise.all([
      this.prisma.url.count({ where: { userId } }),
      this.prisma.url.count({ where: { userId, status: 'ACTIVE' } }),
      this.mongo.events.countDocuments(match),
      this.mongo.events.aggregate<{ _id: string; clicks: number }>([
        { $match: match }, { $group: { _id: '$short_code', clicks: { $sum: 1 } } },
        { $sort: { clicks: -1 } }, { $limit: 5 },
      ]).toArray(),
      this.mongo.events.aggregate<{ _id: string; clicks: number }>([
        { $match: { ...match, clicked_at: { $gte: new Date(Date.now() - 7 * 86400000) } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$clicked_at' } }, clicks: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).toArray(),
      this.breakdown(match, 'browser'),
      this.breakdown(match, 'device_type'),
      this.breakdown(match, 'referrer'),
      this.mongo.events.find(match).sort({ clicked_at: -1 }).limit(10).project({
        _id: 0, short_code: 1, browser: 1, device_type: 1, referrer: 1, clicked_at: 1,
      }).toArray(),
    ]);
    const urlMap = new Map(urls.map((url) => [url.shortCode, url.originalUrl]));
    return {
      totalUrls,
      activeUrls,
      totalClicks,
      topUrls: topUrls.map((entry) => ({ shortCode: entry._id, originalUrl: urlMap.get(entry._id), clicks: entry.clicks })),
      clicksOverTime: activity,
      browsers,
      devices,
      referrers,
      recentActivity: recent,
    };
  }

  async details(userId: string, urlId: string) {
    const url = await this.prisma.url.findFirst({ where: { id: urlId, userId } });
    if (!url) throw new NotFoundException('URL not found');
    const match = { short_code: url.shortCode };
    const [totalClicks, activity, browsers, devices, referrers, recentActivity] = await Promise.all([
      this.mongo.events.countDocuments(match),
      this.mongo.events.aggregate([
        { $match: match }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$clicked_at' } }, clicks: { $sum: 1 } } },
        { $sort: { _id: 1 } }, { $limit: 90 },
      ]).toArray(),
      this.breakdown(match, 'browser'),
      this.breakdown(match, 'device_type'),
      this.breakdown(match, 'referrer'),
      this.mongo.events.find(match).sort({ clicked_at: -1 }).limit(30).project({
        _id: 0, browser: 1, operating_system: 1, device_type: 1, referrer: 1, clicked_at: 1,
      }).toArray(),
    ]);
    return { url, totalClicks, clicksOverTime: activity, browsers, devices, referrers, recentActivity };
  }

  private breakdown(match: object, field: string) {
    return this.mongo.events.aggregate<{ _id: string | null; count: number }>([
      { $match: match },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).toArray();
  }
}
