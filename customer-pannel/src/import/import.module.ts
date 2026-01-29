import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { WorkerManager } from './workers/worker.manager';
import { ImportProgressService } from './progress/import-progress.service';
import { ImportProgressGateway } from './progress/import-progress.gateway';

@Module({
  providers: [
    ImportService,
    WorkerManager,
    ImportProgressService,
  ],
  controllers: [
    ImportController,
    ImportProgressGateway,
  ],
})
export class ImportModule {}
