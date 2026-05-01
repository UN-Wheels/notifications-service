import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { NotificationType } from '../../notifications/schemas/notification.schema';

interface RouteDeletedEvent {
  routeId: string;
  origin: string;
  destination: string;
  affectedPassengers: string[]; // emails de pasajeros con reservas confirmadas
}

@Controller()
export class RouteHandler {
  private readonly logger = new Logger(RouteHandler.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  // ── route.deleted → notificar a TODOS los pasajeros afectados ─────────────
  // noAck:true en main.ts → RabbitMQ ackea automaticamente al entregar.

  @EventPattern('route.deleted')
  async handleRouteDeleted(@Payload() data: RouteDeletedEvent) {
    try {
      this.logger.log(
        `route.deleted → ${data.affectedPassengers.length} pasajeros afectados`,
      );

      await Promise.all(
        data.affectedPassengers.map(async (passengerEmail) => {
          const notification = await this.notificationsService.create({
            recipientEmail: passengerEmail,
            type:  NotificationType.ROUTE_DELETED,
            title: 'Ruta cancelada',
            body:  `La ruta de ${data.origin} a ${data.destination} fue cancelada por el conductor`,
            data: {
              routeId:     data.routeId,
              origin:      data.origin,
              destination: data.destination,
            },
          });

          await this.notificationsGateway.sendToUser(passengerEmail, notification);
        }),
      );
    } catch (err) {
      this.logger.error(
        `Error procesando route.deleted: ${(err as Error).message}`,
      );
    }
  }
}
