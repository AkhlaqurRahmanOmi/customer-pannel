import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/core/config/prisma/prisma.service";
import { ImportStatus } from "@/generated/prisma/enums";

const TOTAL_ROWS_DEFAULT = 2_000_000; // given in requirements
const RECENT_ROWS_DEFAULT = 20;

function bigIntToNumberSafe(v: bigint): number {
  return Number(v);
}

function asStringBigInt(v: bigint | null | undefined): string {
  if (v === null || v === undefined) return "0";
  return v.toString();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export type ImportProgressSnapshot = {
  jobId: string | null;
  status: ImportStatus | "idle";
  filePath?: string | null;

  rowsProcessed: string;
  rowsInserted: string;
  bytesRead: string;

  percent: number; // 0..100
  rateRowsPerSec: number;
  elapsedSec: number;
  etaSec: number | null;

  startedAt?: string | null;
  updatedAt?: string | null;
  completedAt?: string | null;

  lastRowHash?: string | null;
  error?: string | null;

  disableSync: boolean;

  recentCustomers: Array<{
    id: number;
    customerId: string;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    city: string | null;
    country: string | null;
    phone1: string | null;
    phone2: string | null;
    email: string | null;
    subscriptionDate: string | null;
    website: string | null;
    aboutCustomer: string | null;
    updatedAt: string;
  }>;
};

@Injectable()
export class ImportProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async getLatestJob() {
    const running = await this.prisma.importJob.findFirst({
      where: { status: ImportStatus.RUNNING },
      orderBy: { updatedAt: "desc" },
    });

    if (running) return running;

    const latest = await this.prisma.importJob.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    return latest;
  }

  /**
   * Recent imported/updated customers for the UI (last N inserted/updated).
   */
  async getRecentCustomers(since?: Date, limit = RECENT_ROWS_DEFAULT) {
    const rows = await this.prisma.customer.findMany({
      where: since ? { updatedAt: { gte: since } } : undefined,
      orderBy: { updatedAt: "desc" },
      take: clamp(limit, 1, 200),
      select: {
        id: true,
        customerId: true,
        firstName: true,
        lastName: true,
        company: true,
        city: true,
        country: true,
        phone1: true,
        phone2: true,
        email: true,
        subscriptionDate: true,
        website: true,
        aboutCustomer: true,
        updatedAt: true,
      },
    });

    return rows.map((c) => ({
      ...c,
      subscriptionDate: c.subscriptionDate ? c.subscriptionDate.toISOString() : null,
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  /**
   * Main API used by GET /customers/progress
   */
  async getProgressSnapshot(params?: {
    totalRows?: number;
    recentLimit?: number;
  }): Promise<ImportProgressSnapshot> {
    const totalRows = params?.totalRows ?? TOTAL_ROWS_DEFAULT;
    const recentLimit = params?.recentLimit ?? RECENT_ROWS_DEFAULT;

    const job = await this.getLatestJob();

    // No jobs ever created yet
    if (!job) {
      return {
        jobId: null,
        status: "idle",
        rowsProcessed: "0",
        rowsInserted: "0",
        bytesRead: "0",
        percent: 0,
        rateRowsPerSec: 0,
        elapsedSec: 0,
        etaSec: null,
        disableSync: false,
        recentCustomers: [],
      };
    }

    const rowsProcessed = job.rowsProcessed ?? 0n;
    const rowsInserted = job.rowsInserted ?? 0n;
    const bytesRead = job.bytesRead ?? 0n;

    const startedAtMs = job.startedAt ? job.startedAt.getTime() : job.updatedAt.getTime();
    const nowMs = Date.now();
    const elapsedSec = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));

    const processedNum = bigIntToNumberSafe(rowsProcessed);
    const percent = totalRows > 0 ? clamp((processedNum / totalRows) * 100, 0, 100) : 0;

    // Derived rate and ETA from persisted state
    const rateRowsPerSec = elapsedSec > 0 ? processedNum / elapsedSec : 0;
    const remaining = Math.max(0, totalRows - processedNum);
    const etaSec = rateRowsPerSec > 0 ? Math.ceil(remaining / rateRowsPerSec) : null;

    const recentCustomers =
      job.id && (job.status === ImportStatus.RUNNING || job.status === ImportStatus.COMPLETED)
        ? await this.getRecentCustomers(job.startedAt ?? job.updatedAt, recentLimit)
        : [];

    return {
      jobId: job.id,
      status: job.status,
      filePath: job.filePath,

      rowsProcessed: asStringBigInt(rowsProcessed),
      rowsInserted: asStringBigInt(rowsInserted),
      bytesRead: asStringBigInt(bytesRead),

      percent,
      rateRowsPerSec,
      elapsedSec,
      etaSec,

      startedAt: job.startedAt ? job.startedAt.toISOString() : null,
      updatedAt: job.updatedAt ? job.updatedAt.toISOString() : null,
      completedAt: job.completedAt ? job.completedAt.toISOString() : null,

      lastRowHash: job.lastRowHash ?? null,
      error: job.error ?? null,

      disableSync: job.status === ImportStatus.RUNNING,

      recentCustomers,
    };
  }
}
