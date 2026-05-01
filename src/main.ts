import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  // ── App híbrida: HTTP (REST) + Microservicio (RabbitMQ consumer) ───────────
  const app = await NestFactory.create(AppModule);

  // Cookie parser para leer el JWT del cookie en los endpoints REST
  app.use(cookieParser());

  // Validación automática de DTOs
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Socket.IO adapter para el WebSocket gateway
  app.useWebSocketAdapter(new IoAdapter(app));

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // Health check
  app.getHttpAdapter().get('/health', (_req, res) => res.json({ status: 'ok' }));

  // ── RabbitMQ consumer ──────────────────────────────────────────────────────
  // Se conecta a la queue "notifications_queue" que fue configurada por
  // RabbitMQSetupService (exchange "uniwheels.events", tipo topic).
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672'],
      queue: 'notifications_queue',
      queueOptions: { durable: true },
      // noAck:true = auto-ack a nivel de protocolo AMQP. RabbitMQ marca el
      // mensaje como entregado en cuanto sale al consumer; no hace falta
      // llamar channel.ack() manualmente. Aceptable para notificaciones:
      // si el handler crashea, perdemos esa notificacion (no es critica).
      // Esto evita el bloqueo previo donde el wrapper de amqp-connection-manager
      // no propagaba el ack y la cola se quedaba con messages_unacknowledged=10.
      noAck: true,
      // Heartbeat AMQP cada 30s impide que la conexion TCP quede idle y la corte el bridge de Docker.
      // reconnectTimeInSeconds activa el auto-recovery interno (amqp-connection-manager) de NestJS.
      socketOptions: {
        heartbeatIntervalInSeconds: 30,
        reconnectTimeInSeconds: 5,
      },
    },
  });

  await app.startAllMicroservices();

  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`Notifications service corriendo en puerto ${port}`);
}

bootstrap();
