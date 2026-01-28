import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from "@nestjs/common";
import { Worker } from "worker_threads";
import { join } from "path";
import fs from "fs";
import { Subject, Observable } from "rxjs";

import { PrismaService } from "@/core/config/prisma/prisma.service";

export type CsvWorkerMessage =
  | {
  type: "progress";
  jobId: string;
  rowsProcessed: string;
  rowsInserted: string;
  bytesRead: string;
  rate: number;
  elapsedSec: number;
  lastRowHash?: string;
}
  | { type: "done"; jobId: string }
  | { type: "error"; jobId: string; error: string }
  | { type: "log"; jobId: string; message: string };

export type StartCsvImportPayload = {
  jobId: string;
  filePath: string;
  batchSize?: number;
  progressUpdateEveryMs?: number;
  totalRows?: number;

  // resume support
  resume?: {
    startBytes?: string | number | bigint;
    overlapBytes?: number;
    lastRowHash?: string;
    rowsProcessed?: string | number | bigint;
    rowsInserted?: string | number | bigint;
  };
};

@Injectable()
export class WorkerManager implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(WorkerManager.name);

  private worker: Worker | null = null;
  private currentJobId: string | null = null;

  private readonly events$ = new Subject<CsvWorkerMessage>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Used by SSE controller/service to stream worker messages
   */
  get eventStream(): Observable<CsvWorkerMessage> {
    return this.events$.asObservable();
  }

  isRunning(): boolean {
    return !!this.worker;
  }

  getRunningJobId(): string | null {
    return this.currentJobId;
  }

  /**
   * Auto-resume if server restarted while a job was running.
   * This satisfies: "remain consistent if process restarts".
   */
  async onModuleInit() {
    const running = await this.prisma.importJob.findFirst({
      where: { status: "RUNNING" },
    });

    if (!running) return;

    this.logger.warn(
      `Found running ImportJob on boot. Resuming jobId=${running.id}`,
    );

    this.startCsvImport({
      jobId: running.id,
      filePath: running.filePath,
      resume: {
        startBytes: running.bytesRead?.toString?.() ?? String(running.bytesRead),
        lastRowHash: running.lastRowHash ?? undefined,
        rowsProcessed:
          running.rowsProcessed?.toString?.() ?? String(running.rowsProcessed),
        rowsInserted:
          running.rowsInserted?.toString?.() ?? String(running.rowsInserted),
        overlapBytes: 1024 * 1024, // 1MB overlap for safe resume
      },
    });
  }

  async onApplicationShutdown() {
    await this.stopWorker("Application shutdown");
    this.events$.complete();
  }

  /**
   * Starts the CSV worker thread (one at a time).
   * ImportService should already enforce DB lock (status=running).
   */
  startCsvImport(payload: StartCsvImportPayload) {
    if (this.worker) {
      throw new Error(
        `Import already running (jobId=${this.currentJobId ?? "unknown"})`,
      );
    }

    const workerPath = this.resolveWorkerPath();

    this.currentJobId = payload.jobId;

    this.logger.log(
      `Starting CSV worker: jobId=${payload.jobId}, filePath=${payload.filePath}, worker=${workerPath}`,
    );

    const worker = new Worker(workerPath, {
      workerData: payload,
      // If you run Nest in watch/ts-node mode, spawning a TS worker requires ts-node.
      // This is only used when the resolved worker path ends with ".ts".
      execArgv: workerPath.endsWith(".ts")
        ? ["-r", "ts-node/register/transpile-only"]
        : undefined,
    });

    this.worker = worker;

    worker.on("message", (msg: CsvWorkerMessage) => this.handleWorkerMessage(msg));

    worker.on("error", async (err) => {
      this.logger.error(
        `Worker error (jobId=${this.currentJobId}): ${err?.message ?? err}`,
      );

      // best-effort: mark failed if still running
      await this.failJobIfStillRunning(
        this.currentJobId,
        err?.message ?? String(err),
      );

      this.events$.next({
        type: "error",
        jobId: this.currentJobId ?? payload.jobId,
        error: err?.message ?? String(err),
      });

      this.cleanupWorker();
    });

    worker.on("exit", async (code) => {
      // Worker may exit after sending done/error; cleanup anyway.
      if (code !== 0) {
        this.logger.error(
          `Worker exited with code=${code} (jobId=${this.currentJobId})`,
        );

        await this.failJobIfStillRunning(
          this.currentJobId,
          `Worker exited with code ${code}`,
        );

        if (this.currentJobId) {
          this.events$.next({
            type: "error",
            jobId: this.currentJobId,
            error: `Worker exited with code ${code}`,
          });
        }
      } else {
        this.logger.log(`Worker exited cleanly (jobId=${this.currentJobId})`);
      }

      this.cleanupWorker();
    });
  }

  /**
   * Optional: allow manual stop (not required, but useful for dev)
   */
  async stopWorker(reason = "Stopped by server") {
    if (!this.worker) return;

    const jobId = this.currentJobId;
    this.logger.warn(`Stopping worker (jobId=${jobId}): ${reason}`);

    try {
      await this.worker.terminate();
    } catch (e) {
      this.logger.error(`Failed to terminate worker: ${String(e)}`);
    } finally {
      await this.failJobIfStillRunning(jobId, reason);
      this.cleanupWorker();
    }
  }

  private handleWorkerMessage(msg: CsvWorkerMessage) {
    // Forward to SSE subscribers (via eventStream)
    this.events$.next(msg);

    if (msg.type === "done") {
      this.logger.log(`Worker done (jobId=${msg.jobId})`);
      // Cleanup will happen on exit too, but keep it responsive:
      this.cleanupWorker();
      return;
    }

    if (msg.type === "error") {
      this.logger.error(`Worker error (jobId=${msg.jobId}): ${msg.error}`);
      this.cleanupWorker();
      return;
    }
  }

  private cleanupWorker() {
    if (this.worker) {
      try {
        this.worker.removeAllListeners();
      } catch {}
    }
    this.worker = null;
    this.currentJobId = null;
  }

  private resolveWorkerPath(): string {
    // When built, Nest outputs JS to dist. In that case __dirname points to dist/.../workers.
    const distJs = join(__dirname, "csv-import.worker.js");
    if (fs.existsSync(distJs)) return distJs;

    // In dev (ts-node/watch), the JS may not exist. Fallback to TS source path.
    // Assumes project structure includes "src/import/workers/csv-import.worker.ts".
    const tsPath = join(process.cwd(), "src", "import", "workers", "csv-import.worker.ts");
    if (fs.existsSync(tsPath)) return tsPath;

    // Last resort: return the JS path so you get a clear error
    return distJs;
  }

  private async failJobIfStillRunning(jobId: string | null, error: string) {
    if (!jobId) return;

    try {
      const job = await this.prisma.importJob.findUnique({ where: { id: jobId } });
      if (!job) return;

      if (job.status === "RUNNING") {
        await this.prisma.importJob.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            error,
          },
        });
      }
    } catch (e) {
      // best-effort only
      this.logger.error(
        `failJobIfStillRunning failed (jobId=${jobId}): ${String(e)}`,
      );
    }
  }
}
