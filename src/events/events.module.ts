import { Module } from '@nestjs/common';
import { RabbitMQSetupService } from './rabbitmq-setup.service';
import { ReservationHandler } from './handlers/reservation.handler';
import { RouteHandler } from './handlers/route.handler';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [RabbitMQSetupService],
  controllers: [ReservationHandler, RouteHandler],
})
export class EventsModule {}
