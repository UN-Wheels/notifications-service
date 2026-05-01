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

    const MAX_ATTEMPTS = 10;
    const RETRY_DELAY_MS = 3000;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let connection: amqp.ChannelModel | null = null;
      try {
        connection = await amqp.connect(url, { heartbeat: 30 });
        const channel = await connection.createChannel();

        await channel.assertExchange(dlq, 'fanout', { durable: true });
        await channel.assertExchange(exchange, 'topic', { durable: true });
        await channel.assertQueue(queue, { durable: true });

        await channel.bindQueue(queue, exchange, 'reservation.#');
        await channel.bindQueue(queue, exchange, 'route.#');
        await channel.bindQueue(queue, exchange, 'chat.#');

        await channel.close();
        await connection.close();
        this.logger.log(`RabbitMQ listo: exchange="${exchange}", queue="${queue}"`);
        return;
      } catch (err) {
        if (connection) {
          try { await connection.close(); } catch { /* noop */ }
        }
        this.logger.warn(
          `Setup RabbitMQ intento ${attempt}/${MAX_ATTEMPTS} fallo: ${(err as Error).message}`,
        );
        if (attempt === MAX_ATTEMPTS) {
          this.logger.error('No se pudo configurar RabbitMQ tras los reintentos');
          throw err;
        }
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
}
