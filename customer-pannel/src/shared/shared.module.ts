import { Global, Module } from '@nestjs/common';
import { UnitOfWorkService } from './services/unit-of-work';
import { ResponseBuilderService } from './services/response-builder.service';
import { TraceIdService } from './services/trace-id.service';

@Global()
@Module({
  providers: [UnitOfWorkService, ResponseBuilderService, TraceIdService],
  exports: [UnitOfWorkService, ResponseBuilderService, TraceIdService],
})
export class SharedModule {}
