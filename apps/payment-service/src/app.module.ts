import { APP_FILTER } from '@nestjs/core';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HttpExceptionFilter, HTTPLogger } from 'libs/common';
import { AuthClientModule } from 'libs/auth-client';
import { PaymentClientModule } from 'libs/payment-client';

import config from 'src/config';
import { CacheModule, StripeModule } from 'src/infa/apdaters';
import { PersistencesModule } from 'src/infa/persistence';
import { controllers } from 'src/infa/controllers';

import services from './app/services';
import processors from './app/processors';
import { StorageClientModule } from 'libs/storage-client';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
      expandVariables: true,
      load: config,
    }),
    HttpModule,
    TerminusModule,

    PersistencesModule,
    CacheModule,
    StripeModule,

    PaymentClientModule,
    AuthClientModule,
    StorageClientModule,
  ],
  controllers,
  providers: [
    ...services,
    ...processors,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HTTPLogger).forRoutes('*');
  }
}
