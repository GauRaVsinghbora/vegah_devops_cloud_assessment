import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaService } from '../prisma/prisma.service';

const scrypt = promisify(scryptCallback);

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(private readonly prisma: PrismaService, config: ConfigService) {
    this.jwtSecret = config.getOrThrow<string>('JWT_SECRET');
    if (this.jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  }

  async register(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    const salt = randomBytes(16).toString('hex');
    const hash = (await scrypt(password, salt, 64)) as Buffer;
    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash: `${salt}:${hash.toString('hex')}` },
        select: { id: true, email: true },
      });
      return { user, token: this.sign(user.id) };
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }

  async login(emailInput: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: emailInput.trim().toLowerCase() } });
    if (!user) throw new UnauthorizedException('Invalid email or password');
    const [salt, storedHash] = user.passwordHash.split(':');
    const candidate = (await scrypt(password, salt, 64)) as Buffer;
    const expected = Buffer.from(storedHash, 'hex');
    if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return { user: { id: user.id, email: user.email }, token: this.sign(user.id) };
  }

  verify(token: string): string | null {
    const [header, encoded, signature] = token.split('.');
    if (!header || !encoded || !signature) return null;
    const signedContent = `${header}.${encoded}`;
    const expected = createHmac('sha256', this.jwtSecret).update(signedContent).digest();
    let received: Buffer;
    try {
      received = Buffer.from(signature, 'base64url');
    } catch {
      return null;
    }
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    try {
      const metadata = JSON.parse(Buffer.from(header, 'base64url').toString()) as { alg?: string; typ?: string };
      if (metadata.alg !== 'HS256' || metadata.typ !== 'JWT') return null;
      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as { sub?: string; exp?: number };
      return payload.sub && payload.exp && payload.exp > Date.now() / 1000 ? payload.sub : null;
    } catch {
      return null;
    }
  }

  private sign(userId: string): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }))
      .toString('base64url');
    const signedContent = `${header}.${payload}`;
    const signature = createHmac('sha256', this.jwtSecret).update(signedContent).digest('base64url');
    return `${signedContent}.${signature}`;
  }
}
