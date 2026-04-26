import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

/**
 * Corre una sola vez al arrancar el módulo.
 * Garantiza que el exchange, la queue y los bindings existen en RabbitMQ
 * ANTES de que el microservicio empiece a consumir mensajes.
 */
@Injectable()
export class RabbitMQSetupService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQSetupService.name);

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const url      = this.configService.get<string>('rabbitmq.url')!;
    const exchange = this.configService.get<string>('rabbitmq.exchange')!;
    const queue    = this.configService.get<string>('rabbitmq.queue')!;
    const dlq      = this.configService.get<string>('rabbitmq.dlqExchange')!;

    let connection: amqp.ChannelModel | null = null;

    try {
      connection = await amqp.connect(url);
      const channel = await connection.createChannel();

      // Dead-letter exchange (recibe mensajes que fallaron 3 veces)
      await channel.assertExchange(dlq, 'fanout', { durable: true });

      // Topic exchange principal — todos los servicios publican aquí
      await channel.assertExchange(exchange, 'topic', { durable: true });

      // Queue de notificaciones con DLQ configurada
      await channel.assertQueue(queue, {
        durable: true,
      });

      // Bindings: filtra sólo los eventos que nos interesan
      await channel.bindQueue(queue, exchange, 'reservation.#');
      await channel.bindQueue(queue, exchange, 'route.#');
      await channel.bindQueue(queue, exchange, 'chat.#');

      await channel.close();
      this.logger.log(`RabbitMQ listo: exchange="${exchange}", queue="${queue}"`);
    } catch (err) {
      this.logger.error('Error configurando RabbitMQ', (err as Error).message);
      throw err;
    } finally {
      if (connection) await connection.close();
    }
  }
}
