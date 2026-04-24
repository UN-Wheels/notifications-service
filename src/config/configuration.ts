export default () => ({
  port: parseInt(process.env.PORT || '3002', 10),

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/uniwheels_notifications',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_secret_change_me',
  },

  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672',
    exchange: 'uniwheels.events',
    exchangeType: 'topic' as const,
    queue: 'notifications_queue',
    dlqExchange: 'notifications.dlq',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
});
