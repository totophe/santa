import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express from 'express';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AppModule } from './app.module';
import { CONFIG, type AppConfig } from './config/env';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  });
  const config = app.get<AppConfig>(CONFIG);

  if (config.trustProxy) {
    app.set('trust proxy', 1);
  }

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API under /api; /healthz stays at the root for container health checks.
  app.setGlobalPrefix('api', { exclude: ['healthz'] });

  // Serve the built web app and fall back to its index for client-side routes.
  const webDir = resolveWebDir();
  if (webDir) {
    const server = app.getHttpAdapter().getInstance();
    server.use(express.static(webDir));
    server.get(/^\/(?!api\/|healthz).*/, (_req, res) => {
      res.sendFile(join(webDir, 'index.html'));
    });
    logger.log(`Serving web app from ${webDir}`);
  } else {
    logger.warn('No built web app found; serving API only.');
  }

  await app.listen(config.port);
  logger.log(`Santa API listening on :${config.port}`);
}

function resolveWebDir(): string | null {
  const candidates = [
    resolve(__dirname, '..', '..', 'web', 'dist'),
    resolve(process.cwd(), 'apps', 'web', 'dist'),
  ];
  return candidates.find((p) => existsSync(join(p, 'index.html'))) ?? null;
}

void bootstrap();
