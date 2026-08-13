import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: getAllowedOrigins(),
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('LaKarya API')
    .setDescription('API Employee Service Portal LaKarya')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
