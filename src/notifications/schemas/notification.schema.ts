import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  RESERVATION_REQUESTED = 'RESERVATION_REQUESTED',
  RESERVATION_ACCEPTED  = 'RESERVATION_ACCEPTED',
  RESERVATION_REJECTED  = 'RESERVATION_REJECTED',
  ROUTE_DELETED         = 'ROUTE_DELETED',
  CHAT_MESSAGE          = 'CHAT_MESSAGE',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true, index: true })
  recipientEmail: string;

  @Prop({ required: true, enum: NotificationType })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  // Payload variable por tipo de notificación
  @Prop({ type: Object, default: {} })
  data: Record<string, any>;

  @Prop({ default: false, index: true })
  read: boolean;

  // TTL: Mongoose eliminará el documento 30 días después de createdAt
  @Prop({
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 30, // 30 días en segundos
  })
  createdAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Índice compuesto para las queries más frecuentes
NotificationSchema.index({ recipientEmail: 1, read: 1, createdAt: -1 });
