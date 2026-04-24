import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { NotificationType } from '../../notifications/schemas/notification.schema';

interface ReservationEvent {
  reservationId: string;
  routeId: string;
  passengerEmail: string;
  driverEmail: string;
  origin: string;
  destination: string;
  travelDate: string;
}

@Controller()
export class ReservationHandler {
  private readonly logger = new Logger(ReservationHandler.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  // ── reservation.requested → notificar al CONDUCTOR ────────────────────────

  @EventPattern('reservation.requested')
  async handleRequested(@Payload() data: ReservationEvent) {
    this.logger.log(`reservation.requested → driver: ${data.driverEmail}`);

    const notification = await this.notificationsService.create({
      recipientEmail: data.driverEmail,
      type:  NotificationType.RESERVATION_REQUESTED,
      title: 'Nueva solicitud de reserva',
      body:  `Un pasajero quiere viajar de ${data.origin} a ${data.destination} el ${this.formatDate(data.travelDate)}`,
      data: {
        reservationId: data.reservationId,
        routeId:       data.routeId,
        passengerEmail: data.passengerEmail,
        origin:        data.origin,
        destination:   data.destination,
        travelDate:    data.travelDate,
      },
    });

    await this.notificationsGateway.sendToUser(data.driverEmail, notification);
  }

  // ── reservation.accepted → notificar al PASAJERO ──────────────────────────

  @EventPattern('reservation.accepted')
  async handleAccepted(@Payload() data: ReservationEvent) {
    this.logger.log(`reservation.accepted → passenger: ${data.passengerEmail}`);

    const notification = await this.notificationsService.create({
      recipientEmail: data.passengerEmail,
      type:  NotificationType.RESERVATION_ACCEPTED,
      title: '¡Reserva confirmada!',
      body:  `Tu viaje de ${data.origin} a ${data.destination} el ${this.formatDate(data.travelDate)} fue aceptado`,
      data: {
        reservationId: data.reservationId,
        routeId:       data.routeId,
        driverEmail:   data.driverEmail,
        origin:        data.origin,
        destination:   data.destination,
        travelDate:    data.travelDate,
      },
    });

    await this.notificationsGateway.sendToUser(data.passengerEmail, notification);
  }

  // ── reservation.rejected → notificar al PASAJERO ──────────────────────────

  @EventPattern('reservation.rejected')
  async handleRejected(@Payload() data: ReservationEvent) {
    this.logger.log(`reservation.rejected → passenger: ${data.passengerEmail}`);

    const notification = await this.notificationsService.create({
      recipientEmail: data.passengerEmail,
      type:  NotificationType.RESERVATION_REJECTED,
      title: 'Reserva no aceptada',
      body:  `Tu solicitud de viaje de ${data.origin} a ${data.destination} el ${this.formatDate(data.travelDate)} no fue aceptada`,
      data: {
        reservationId: data.reservationId,
        routeId:       data.routeId,
        origin:        data.origin,
        destination:   data.destination,
        travelDate:    data.travelDate,
      },
    });

    await this.notificationsGateway.sendToUser(data.passengerEmail, notification);
  }

  private formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  }
}
