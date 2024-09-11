import { ConfigType } from '@nestjs/config';

import appConfig from './app.config';
import dbConfig from './db.config';
import grpcConfig from './grpc.config';
import rmqConfig from './rmq.config';
import corsConfig from './cors.config';

const configs = {
  app: appConfig,
  cors: corsConfig,
  db: dbConfig,
  grpc: grpcConfig,
  rmq: rmqConfig,
};

export type Configs = {
  [K in keyof typeof configs]: ConfigType<(typeof configs)[K]>;
};
export default Object.values(configs);
