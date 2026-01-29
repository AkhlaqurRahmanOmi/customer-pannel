import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from '@shared/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  app.useGlobalFilters(new HttpExceptionFilter(configService));

  // Set global prefix
  app.setGlobalPrefix('api');

  //enable cors
  app.enableCors()

  // Enable versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Swagger configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Customer Panel API')
    .setDescription('Customer Panel API Documentation')
    .setVersion('1.0')
    .build();

  const documentation = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, documentation, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: http://localhost:${process.env.PORT}/api/docs`);
}
bootstrap();
