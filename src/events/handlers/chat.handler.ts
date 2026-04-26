import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { NotificationType } from '../../notifications/schemas/notification.schema';

interface ChatMessageEvent {
  messageId: string;
  conversationId: string;
  senderId: string;
  // chat-service publica `recipientId` (normalmente email / userId)
  // pero mantenemos compatibilidad si algún productor envía `recipientEmail`.
  recipientId?: string;
  recipientEmail?: string;
  senderName: string;
  preview: string;
  createdAt: string;
}

@Controller()
export class ChatHandler {
  private readonly logger = new Logger(ChatHandler.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  @EventPattern('chat.message')
  async handleChatMessage(@Payload() data: ChatMessageEvent) {
    const recipientEmail = data.recipientEmail ?? data.recipientId;
    if (!recipientEmail) {
      this.logger.warn('chat.message → sin recipientEmail/recipientId; se ignora');
      return;
    }

    this.logger.log(`chat.message → recipient: ${recipientEmail}`);

    const notification = await this.notificationsService.create({
      recipientEmail,
      type:  NotificationType.CHAT_MESSAGE,
      title: `Mensaje de ${data.senderName || data.senderId}`,
      body:  data.preview,
      data: {
        conversationId: data.conversationId,
        messageId:      data.messageId,
        senderId:       data.senderId,
        senderName:     data.senderName,
      },
    });

    await this.notificationsGateway.sendToUser(recipientEmail, notification);
  }
}
