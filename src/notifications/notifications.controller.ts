import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  private extractEmail(req: Request): string {
    const cookieName = 'access_token';
    const token =
      req.cookies?.[cookieName] ||
      req.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) throw new Error('No autenticado');

    const secret = this.configService.get<string>('jwt.accessSecret');
    const decoded = jwt.verify(token, secret!) as any;
    const email = decoded.sub ?? decoded.user_id;
    if (!email) throw new Error('Token sin identificador');
    return email;
  }

  // ── Endpoints ─────────────────────────────────────────────────────────────

  /** GET /notifications?page=1&limit=20 */
  @Get()
  async findAll(
    @Req() req: Request,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const email = this.extractEmail(req);
    return this.notificationsService.findForUser(
      email,
      parseInt(page),
      parseInt(limit),
    );
  }

  /** GET /notifications/unread — badge count */
  @Get('unread')
  async unreadCount(@Req() req: Request) {
    const email = this.extractEmail(req);
    const count = await this.notificationsService.countUnread(email);
    return { count };
  }

  /** PATCH /notifications/:id/read */
  @Patch(':id/read')
  async markRead(@Param('id') id: string, @Req() req: Request) {
    const email = this.extractEmail(req);
    return this.notificationsService.markRead(id, email);
  }

  /** PATCH /notifications/read-all */
  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllRead(@Req() req: Request) {
    const email = this.extractEmail(req);
    await this.notificationsService.markAllRead(email);
  }

  /** DELETE /notifications/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOne(@Param('id') id: string, @Req() req: Request) {
    const email = this.extractEmail(req);
    await this.notificationsService.deleteOne(id, email);
  }
}
