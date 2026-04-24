import { IsEmail, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { NotificationType } from '../schemas/notification.schema';

export class CreateNotificationDto {
  @IsEmail()
  recipientEmail: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsObject()
  @IsOptional()
  data?: Record<string, any>;
}
