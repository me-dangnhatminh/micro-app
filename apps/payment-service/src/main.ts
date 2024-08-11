import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, VersioningType } from '@nestjs/common';
import setupSwagger from './docs';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

const logger = new Logger('PaymentService');
const port = process.env.PORT || 4000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, prefix: 'v' });

  setupSwagger(app);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://localhost:5672'],
      queue: 'payment_queue',
      noAck: false,
      queueOptions: { durable: false },
    },
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://localhost:5672'],
      queue: 'identity_queue.token',
      prefetchCount: 1,
      queueOptions: { durable: false },
    },
  });

  await app.startAllMicroservices();
  await app.listen(port, () => {
    logger.log('Payment Service is running on http://localhost:' + port);
  });
}
bootstrap();
