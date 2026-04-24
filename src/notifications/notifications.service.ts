import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async create(dto: CreateNotificationDto): Promise<NotificationDocument> {
    const notification = new this.notificationModel(dto);
    const saved = await notification.save();
    this.logger.log(`Notificación creada [${dto.type}] → ${dto.recipientEmail}`);
    return saved;
  }

  async findForUser(
    email: string,
    page = 1,
    limit = 20,
  ): Promise<{ notifications: NotificationDocument[]; total: number; unread: number }> {
    const skip = (page - 1) * limit;

    const [notifications, total, unread] = await Promise.all([
      this.notificationModel
        .find({ recipientEmail: email })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.notificationModel.countDocuments({ recipientEmail: email }),
      this.notificationModel.countDocuments({ recipientEmail: email, read: false }),
    ]);

    return { notifications: notifications as any, total, unread };
  }

  async countUnread(email: string): Promise<number> {
    return this.notificationModel.countDocuments({ recipientEmail: email, read: false });
  }

  async markRead(id: string, email: string): Promise<NotificationDocument | null> {
    return this.notificationModel.findOneAndUpdate(
      { _id: id, recipientEmail: email },
      { read: true },
      { new: true },
    );
  }

  async markAllRead(email: string): Promise<void> {
    await this.notificationModel.updateMany({ recipientEmail: email, read: false }, { read: true });
  }

  async deleteOne(id: string, email: string): Promise<void> {
    await this.notificationModel.deleteOne({ _id: id, recipientEmail: email });
  }
}
