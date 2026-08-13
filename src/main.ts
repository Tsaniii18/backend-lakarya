import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppModule } from './app.module';

type HttpHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => unknown;

let applicationPromise: Promise<INestApplication> | undefined;

function getAllowedOrigins() {
  const configuredOrigins =
    process.env.CORS_ORIGINS?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    'http://localhost:5173';

  return configuredOrigins
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

async function createApplication() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: getAllowedOrigins(),
    exposedHeaders: ['Content-Disposition'],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('LaKarya API')
    .setDescription('API Employee Service Portal LaKarya')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.init();

  return app;
}

function getApplication() {
  applicationPromise ??= createApplication();

  return applicationPromise;
}

async function bootstrap() {
  const app = await getApplication();
  await app.listen(process.env.PORT ?? 3000);
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const app = await getApplication();
  const httpHandler = app.getHttpAdapter().getInstance() as HttpHandler;

  return httpHandler(request, response);
}

if (!process.env.VERCEL) {
  void bootstrap();
}
