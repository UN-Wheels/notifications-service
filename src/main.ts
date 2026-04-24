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
      noAck: false,
      prefetchCount: 10,
    },
  });

  await app.startAllMicroservices();

  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`Notifications service corriendo en puerto ${port}`);
}

bootstrap();
