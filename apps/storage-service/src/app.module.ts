import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import configs from 'src/configs';
import providers from 'src/app';

import { PersistencesModule } from './infa/persistence';
import { controllers } from './infa/controllers';
import { HTTPLogger } from './infa/middlewares';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env', '.env.local'],
      load: configs,
      expandVariables: true,
      isGlobal: true,
      cache: true,
    }),
    PersistencesModule,
  ],
  controllers,
  providers,
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HTTPLogger).forRoutes('*');
  }
}

// import { Global, Module, Provider } from '@nestjs/common';
// import { commands, queries, services } from './application';
// import { adapters, controllers } from './infra';
// import { CacheModule } from '@nestjs/cache-manager';

// const imports = [CacheModule.register(), ...adapters];

// // =====================
// const providers: Provider[] = [];
// providers.push(...queries);
// providers.push(...commands);
// providers.push(...services);
// // =====================

// @Global()
// @Module({ imports, providers, controllers })
// export class StorageModule {}
