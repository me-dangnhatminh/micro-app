import { Logger } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerCustomOptions,
  SwaggerModule,
} from '@nestjs/swagger';
import { Server } from 'http';

export function setupSwagger(app) {
  const docPrefix = 'api/docs';
  const docName = 'Identity Service';
  const docDesc = 'API Documentation';
  const docVersion = '1.0';

  const documentBuild = new DocumentBuilder()
    .setTitle(docName)
    .setDescription(docDesc)
    .setVersion(docVersion)
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, documentBuild, {
    deepScanRoutes: true,
  });

  const customOptions: SwaggerCustomOptions = {
    explorer: true,
    customSiteTitle: docName,
    swaggerOptions: {
      docExpansion: 'none',
      persistAuthorization: true,
      displayOperationId: true,
      operationsSorter: 'method',
      tagsSorter: 'alpha',
      tryItOutEnabled: true,
      filter: true,
    },
  };

  SwaggerModule.setup(docPrefix, app, document, customOptions);

  const http: Server = app.getHttpServer();
  http.on('listening', () => {
    const address = http.address() as { address: string; port: number };
    Logger.log(
      `Swagger UI is available on: http://${address.address}:${address.port}/${docPrefix}`,
      'NestApplication',
    );
  });

  return document;
}

export default setupSwagger;
