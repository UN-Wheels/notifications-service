import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { NotificationsService } from './notifications.service';
import { NotificationDocument } from './schemas/notification.schema';

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: (origin: string, cb: Function) => cb(null, true),
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  // ── Ciclo de vida ──────────────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  // ── Eventos del cliente ────────────────────────────────────────────────────

  /**
   * El cliente emite "join" después de conectar para unirse a su room personal.
   * El room key es el email del usuario.
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('join')
  async handleJoin(@ConnectedSocket() client: Socket) {
    const { email } = client.data.user;
    client.join(email);

    const unread = await this.notificationsService.countUnread(email);
    client.emit('unread_count', { count: unread });

    this.logger.log(`Usuario ${email} unido a su room`);
  }

  /**
   * El cliente marca una notificación como leída desde la conexión WS.
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { notificationId: string },
  ) {
    const { email } = client.data.user;
    await this.notificationsService.markRead(payload.notificationId, email);

    const unread = await this.notificationsService.countUnread(email);
    client.emit('unread_count', { count: unread });
  }

  // ── Métodos internos usados por los event handlers ─────────────────────────

  /**
   * Envía una notificación en tiempo real al room del usuario destinatario.
   * Si el usuario no está conectado el mensaje simplemente no llega (ya quedó
   * persistido en MongoDB para cuando abra la app).
   */
  async sendToUser(recipientEmail: string, notification: NotificationDocument): Promise<void> {
    this.server.to(recipientEmail).emit('notification', {
      id:        notification._id,
      type:      notification.type,
      title:     notification.title,
      body:      notification.body,
      data:      notification.data,
      read:      notification.read,
      createdAt: notification.createdAt,
    });

    // Actualizar el contador de no leídas en el cliente
    const unread = await this.notificationsService.countUnread(recipientEmail);
    this.server.to(recipientEmail).emit('unread_count', { count: unread });
  }
}
