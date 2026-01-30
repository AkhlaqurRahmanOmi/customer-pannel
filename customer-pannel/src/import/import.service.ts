// src/import/import.service.ts
import fs from "fs";
import path from "path";
import { BadRequestException, ConflictException, Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "@/core/config/prisma/prisma.service";
import { WorkerManager } from "./workers/worker.manager";
import { StartImportDto } from "./dto/start-import.dto";
import { IMPORT, assertCsvPath } from '@shared/constants/import.constants';
import { ImportStatus } from "@/generated/prisma/enums";

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workerManager: WorkerManager,
  ) {}
  async startImport(dto: StartImportDto) {
    const filePath = this.resolveFilePath(dto.filePath);
    this.ensureFileExists(filePath);

    // 1) If DB shows a running job, do not create a new one.
    const runningJob = await this.prisma.importJob.findFirst({
      where: { status: ImportStatus.RUNNING },
      orderBy: { updatedAt: "desc" },
    });

    if (runningJob) {
      // If worker is already running, reject.
      if (this.workerManager.isRunning()) {
        throw new ConflictException({
          message: "Import already running",
          jobId: runningJob.id,
          status: runningJob.status,
        });
      }

      // DB says RUNNING but no worker => resume (covers server restarts / worker crash scenarios)
      this.logger.warn(
        `ImportJob is RUNNING but no worker is active. Resuming jobId=${runningJob.id}`,
      );

      this.workerManager.startCsvImport({
        jobId: runningJob.id,
        filePath: runningJob.filePath,
        batchSize: dto.batchSize ?? IMPORT.BATCH_SIZE,
        progressUpdateEveryMs: dto.progressUpdateEveryMs ?? IMPORT.PROGRESS_PERSIST_EVERY_MS,
        totalRows: dto.totalRows ?? IMPORT.TOTAL_ROWS,
        resume: {
          startBytes: runningJob.bytesRead?.toString?.() ?? String(runningJob.bytesRead ?? 0),
          lastRowHash: runningJob.lastRowHash ?? undefined,
          rowsProcessed: runningJob.rowsProcessed?.toString?.() ?? String(runningJob.rowsProcessed ?? 0),
          rowsInserted: runningJob.rowsInserted?.toString?.() ?? String(runningJob.rowsInserted ?? 0),
          overlapBytes: IMPORT.RESUME_OVERLAP_BYTES,
        },
      });

      return this.serializeJob(runningJob);
    }

    // 2) Create new job
    const job = await this.prisma.importJob.create({
      data: {
        filePath,
        status: ImportStatus.RUNNING,
        startedAt: new Date(),
        error: null,
        lastRowHash: null,
        // bytesRead/rowsProcessed/rowsInserted default to 0 via schema
      },
    });

    // 3) Spawn worker thread (non-blocking)
    this.workerManager.startCsvImport({
      jobId: job.id,
      filePath: job.filePath,
      batchSize: dto.batchSize ?? IMPORT.BATCH_SIZE,
      progressUpdateEveryMs: dto.progressUpdateEveryMs ?? IMPORT.PROGRESS_PERSIST_EVERY_MS,
      totalRows: dto.totalRows ?? IMPORT.TOTAL_ROWS,
      resume: {
        overlapBytes: IMPORT.RESUME_OVERLAP_BYTES,
      },
    });

    return this.serializeJob(job);
  }

  async getRunningJob() {
    return this.prisma.importJob.findFirst({
      where: { status: ImportStatus.RUNNING },
      orderBy: { updatedAt: "desc" },
    });
  }

  private serializeJob(job: any) {
    return {
      ...job,
      bytesRead: job.bytesRead?.toString?.() ?? String(job.bytesRead ?? 0),
      rowsProcessed:
        job.rowsProcessed?.toString?.() ?? String(job.rowsProcessed ?? 0),
      rowsInserted:
        job.rowsInserted?.toString?.() ?? String(job.rowsInserted ?? 0),
    };
  }

  private resolveFilePath(input?: string) {
    const p = (input?.trim() || IMPORT.DEFAULT_CSV_PATH || "").trim();
    assertCsvPath(p);
    return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  }

  private ensureFileExists(filePath: string) {
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(`CSV file not found at path: ${filePath}`);
    }
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      throw new BadRequestException(`CSV path is not a file: ${filePath}`);
    }
  }
}
