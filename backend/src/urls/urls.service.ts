import {
  ConflictException, Injectable, NotFoundException, BadRequestException, Logger, HttpException, HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { MongoService } from '../mongo/mongo.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class UrlsService {
  private readonly logger = new Logger(UrlsService.name);
  private readonly publicApiUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mongo: MongoService,
    config: ConfigService,
  ) {
    this.publicApiUrl = config.get('PUBLIC_API_URL', 'http://localhost:4000').replace(/\/+$/, '');
  }

  async create(userId: string, originalUrl: string, customCode?: string) {
    if (customCode) {
      try {
        return await this.saveUrl(userId, originalUrl, customCode);
      } catch (error) {
        if (this.isUniqueViolation(error)) throw new ConflictException('That short code is already in use');
        throw error;
      }
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const shortCode = randomBytes(5).toString('base64url');
      try {
        return await this.saveUrl(userId, originalUrl, shortCode);
      } catch (error) {
        if (!this.isUniqueViolation(error)) throw error;
      }
    }
    throw new ConflictException('Unable to generate a unique short code; please try again');
  }

  async list(userId: string, search?: string) {
    const urls = await this.prisma.url.findMany({
      where: {
        userId,
        ...(search?.trim() ? {
          OR: [
            { originalUrl: { contains: search.trim() } },
            { shortCode: { contains: search.trim() } },
          ],
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const codes = urls.map((url) => url.shortCode);
    const clickCounts = codes.length
      ? await this.mongo.events.aggregate<{ _id: string; count: number }>([
        { $match: { short_code: { $in: codes } } },
        { $group: { _id: '$short_code', count: { $sum: 1 } } },
      ]).toArray()
      : [];
    const counts = new Map(clickCounts.map((entry) => [entry._id, entry.count]));
    return urls.map((url) => ({
      ...url,
      shortUrl: `${this.publicApiUrl}/api/r/${url.shortCode}`,
      clicks: counts.get(url.shortCode) ?? 0,
    }));
  }

  async setStatus(userId: string, id: string, status: string) {
    if (!['ACTIVE', 'DISABLED'].includes(status)) throw new BadRequestException('Status must be ACTIVE or DISABLED');
    const url = await this.prisma.url.findFirst({ where: { id, userId } });
    if (!url) throw new NotFoundException('URL not found');
    const updated = await this.prisma.url.update({ where: { id }, data: { status } });
    await this.redis.client.del(this.cacheKey(url.shortCode));
    return { ...updated, shortUrl: `${this.publicApiUrl}/api/r/${updated.shortCode}` };
  }

  async remove(userId: string, id: string) {
    const url = await this.prisma.url.findFirst({ where: { id, userId } });
    if (!url) throw new NotFoundException('URL not found');
    await this.prisma.url.delete({ where: { id } });
    await this.redis.client.del(this.cacheKey(url.shortCode));
    return { deleted: true };
  }

  async resolve(code: string, request: Request): Promise<string> {
    const ipFingerprint = createHash('sha256').update(request.ip || 'unknown').digest('hex').slice(0, 24);
    if (!(await this.redis.consumeRateLimit(`redirect:${ipFingerprint}`, 120, 60))) {
      throw new HttpException('Redirect rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    const key = this.cacheKey(code);
    let cached: string | null;
    try {
      cached = await this.redis.client.get(key);
    } catch (error) {
      this.logger.error('Redis cache lookup failed', error instanceof Error ? error.stack : undefined);
      cached = null;
    }

    let destination: string;
    let userId: string;
    if (cached) {
      let mapping: unknown;
      try {
        mapping = JSON.parse(cached);
      } catch {
        mapping = null;
      }
      if (!this.isCacheMapping(mapping)) {
        await this.redis.client.del(key);
        return this.resolveFromDatabase(code, request);
      }
      destination = mapping.destination;
      userId = mapping.userId;
    } else {
      const result = await this.findActive(code);
      destination = result.originalUrl;
      userId = result.userId;
      await this.cacheMapping(key, destination, userId);
    }

    void this.recordClick(code, userId, request);
    return destination;
  }

  private async resolveFromDatabase(code: string, request: Request): Promise<string> {
    const url = await this.findActive(code);
    await this.cacheMapping(this.cacheKey(code), url.originalUrl, url.userId);
    void this.recordClick(code, url.userId, request);
    return url.originalUrl;
  }

  private async cacheMapping(key: string, destination: string, userId: string) {
    try {
      await this.redis.client.set(key, JSON.stringify({ destination, userId }), 'EX', 3600);
    } catch (error) {
      this.logger.error('Redis cache write failed', error instanceof Error ? error.stack : undefined);
    }
  }

  private async findActive(code: string) {
    const url = await this.prisma.url.findUnique({ where: { shortCode: code } });
    if (!url || url.status !== 'ACTIVE') throw new NotFoundException('Short URL not found or disabled');
    return url;
  }

  private async recordClick(code: string, userId: string, request: Request) {
    const userAgent = request.headers['user-agent'] ?? '';
    const ua = Array.isArray(userAgent) ? userAgent.join(' ') : userAgent;
    const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other';
    const operatingSystem = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
    const deviceType = /tablet|ipad/i.test(ua) ? 'Tablet' : /mobile|iphone|android/i.test(ua) ? 'Mobile' : 'Desktop';
    try {
      await this.mongo.events.insertOne({
        short_code: code,
        user_id: userId,
        browser,
        operating_system: operatingSystem,
        device_type: deviceType,
        referrer: typeof request.headers.referer === 'string' ? request.headers.referer.slice(0, 2048) : null,
        clicked_at: new Date(),
      });
    } catch (error) {
      this.logger.error('Unable to record click event', error instanceof Error ? error.stack : undefined);
    }
  }

  private async saveUrl(userId: string, originalUrl: string, shortCode: string) {
    const url = await this.prisma.url.create({ data: { userId, originalUrl, shortCode } });
    const shortUrl = `${this.publicApiUrl}/api/r/${shortCode}`;
    return { ...url, shortUrl, clicks: 0 };
  }

  private cacheKey(code: string) {
    return `short-url:${code}`;
  }

  private isCacheMapping(value: unknown): value is { destination: string; userId: string } {
    if (typeof value !== 'object' || value === null) return false;
    return 'destination' in value
      && typeof value.destination === 'string'
      && value.destination.length > 0
      && 'userId' in value
      && typeof value.userId === 'string'
      && value.userId.length > 0;
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
