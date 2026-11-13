import 'reflect-metadata';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';

function ensureDatabaseUrl(): void {
  if (process.env.DATABASE_URL) return;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is required');
  }
  process.env.DATABASE_URL = 'postgresql://knazawy:knazawy@localhost:5432/knazawy?schema=public';
}

function buildCorsOrigins(): string[] {
  const baseOrigins = [
    process.env.WEB_BASE_URL ?? 'http://localhost:3000',
    process.env.PORTAL_BASE_URL ?? 'http://localhost:3002',
  ];
  const localNetworkOrigins = (process.env.LOCAL_NETWORK_BASE_URLS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (localNetworkOrigins.length > 0 && process.env.NODE_ENV === 'production') {
    Logger.warn(
      'LOCAL_NETWORK_BASE_URLS is set in production and will be ignored.',
      'Bootstrap',
    );
    return baseOrigins;
  }

  return [...baseOrigins, ...localNetworkOrigins];
}

async function bootstrap(): Promise<void> {
  ensureDatabaseUrl();
  const corsOrigins = buildCorsOrigins();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: { origin: corsOrigins, credentials: true },
  });

  app.set('trust proxy', 1);
  const isProd = process.env.NODE_ENV === 'production';
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: isProd ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
      frameguard: { action: 'deny' },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), camera=(self), microphone=(), interest-cohort=()',
    );
    next();
  });

  app.use(cookieParser());
  app.use(json({ limit: '8mb' }));
  app.use(urlencoded({ extended: true, limit: '8mb' }));
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Karam Restaurant Platform API')
      .setDescription('Airline catering, inventory, finance, and hotel coordination.')
      .setVersion('0.1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('v1/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    Logger.log('Swagger UI available at /v1/docs', 'Bootstrap');
  }

  const port = Number(process.env.PORT_API ?? 3001);
  await app.listen(port);
  Logger.log(`Karam API listening on :${port} (prefix /v1)`, 'Bootstrap');
}

void bootstrap();
