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
  UnauthorizedException,
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
    const gatewayUserId = req.headers?.['x-user-id'];
    if (typeof gatewayUserId === 'string' && gatewayUserId.trim().length > 0) {
      return gatewayUserId;
    }

    if (Array.isArray(gatewayUserId) && gatewayUserId.length > 0 && gatewayUserId[0]) {
      return gatewayUserId[0];
    }

    const cookieName = 'access_token';
    const token =
      req.cookies?.[cookieName] ||
      req.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) throw new UnauthorizedException('No autenticado');

    const secret = this.configService.get<string>('jwt.accessSecret');
    try {
      const decoded = jwt.verify(token, secret!) as any;
      const email = decoded.sub ?? decoded.user_id;
      if (!email) throw new UnauthorizedException('Token sin identificador');
      return email;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
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
