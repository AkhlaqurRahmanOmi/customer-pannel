import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './core/config/prisma/prisma.module';
import { SharedModule } from '@shared/shared.module';
import { CustomersModule } from './customers/customers.module';
import { ImportModule } from './import/import.module';
import appConfig from './core/config/app.config';
import databaseConfig from './core/config/database.config';
import envValidation from './core/config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig, databaseConfig],
      validationSchema: envValidation,
    }),
    PrismaModule,
    SharedModule,
    CustomersModule,
    ImportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
