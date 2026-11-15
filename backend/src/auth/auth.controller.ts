import { Body, Controller, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import { RedisService } from '../redis/redis.service';
import { AuthService } from './auth.service';

class CredentialsDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly redis: RedisService) {}

  @Post('register')
  async register(@Body() body: CredentialsDto, @Req() request: Request) {
    await this.ensureAllowed(`auth-register:${body.email.toLowerCase()}`, request.ip ?? 'unknown');
    return this.auth.register(body.email, body.password);
  }

  @Post('login')
  async login(@Body() body: CredentialsDto, @Req() request: Request) {
    await this.ensureAllowed(`auth-login:${body.email.toLowerCase()}`, request.ip ?? 'unknown');
    return this.auth.login(body.email, body.password);
  }

  private async ensureAllowed(key: string, ip: string) {
    const ipHash = createHash('sha256').update(ip || 'unknown').digest('hex').slice(0, 24);
    const [emailAllowed, ipAllowed] = await Promise.all([
      this.redis.consumeRateLimit(key, 10, 60),
      this.redis.consumeRateLimit(`auth-ip:${ipHash}`, 60, 60),
    ]);
    if (!emailAllowed || !ipAllowed) {
      throw new HttpException('Too many authentication attempts; try again shortly', HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
