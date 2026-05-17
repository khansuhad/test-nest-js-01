import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = new Logger('Bootstrap');
  const port = Number(process.env.PORT ?? 3000);
  const prefix = process.env.GLOBAL_API_PREFIX ?? 'api/v1';
  const corsOrigins = (process.env.CORS_ORIGINS ?? '*')
    .split(',')
    .map((s) => s.trim());

  app.setGlobalPrefix(prefix);
  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  });

  app.use(helmet());
  app.use(compression());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  app.enableShutdownHooks();

  // Swagger (disabled in production unless explicitly enabled)
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Hisab247 API')
      .setDescription('Production-grade SaaS POS backend.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${prefix}/docs`, app, doc);
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`Hisab247 backend listening on :${port}/${prefix}`);
}

bootstrap();
