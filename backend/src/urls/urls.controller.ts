import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AuthGuard, AuthenticatedRequest } from '../auth/auth.guard';
import { UrlsService } from './urls.service';

class CreateUrlDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  originalUrl!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{3,16}$/)
  customCode?: string;
}

@Controller()
export class UrlsController {
  constructor(private readonly urls: UrlsService) {}

  @UseGuards(AuthGuard)
  @Post('urls')
  create(@Req() req: AuthenticatedRequest, @Body() body: CreateUrlDto) {
    return this.urls.create(req.userId, body.originalUrl, body.customCode);
  }

  @UseGuards(AuthGuard)
  @Get('urls')
  list(@Req() req: AuthenticatedRequest, @Query('search') search?: string) {
    return this.urls.list(req.userId, search);
  }

  @UseGuards(AuthGuard)
  @Patch('urls/:id')
  setStatus(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body('status') status: string) {
    return this.urls.setStatus(req.userId, id, status);
  }

  @UseGuards(AuthGuard)
  @Delete('urls/:id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.urls.remove(req.userId, id);
  }

  @Get('r/:code')
  async redirect(
    @Param('code') code: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const originalUrl = await this.urls.resolve(code, req);
    return res.redirect(302, originalUrl);
  }
}
