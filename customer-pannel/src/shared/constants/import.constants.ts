export const IMPORT = {
  // CSV
  TOTAL_ROWS: Number(process.env.IMPORT_TOTAL_ROWS ?? 2_000_000), // requirement: exactly 2,000,000
  DEFAULT_CSV_PATH: process.env.CSV_PATH ?? "",

  // Streaming
  HIGH_WATER_MARK_BYTES: Number(process.env.IMPORT_HIGH_WATER_MARK ?? 1024 * 1024), // 1MB
  RESUME_OVERLAP_BYTES: Number(process.env.IMPORT_RESUME_OVERLAP ?? 1024 * 1024), // 1MB overlap for safe resume

  // Batching / DB
  BATCH_SIZE: Number(process.env.IMPORT_BATCH_SIZE ?? 1000), // tune 500-2000 based on DB capacity
  PROGRESS_PERSIST_EVERY_MS: Number(process.env.IMPORT_PROGRESS_EVERY_MS ?? 1000), // update ImportJob ~1/sec

  // UI partial results
  RECENT_CUSTOMERS_LIMIT: Number(process.env.IMPORT_RECENT_LIMIT ?? 20),

  // SSE
  SSE_HEARTBEAT_MS: Number(process.env.SSE_HEARTBEAT_MS ?? 15000),
} as const;


export const IMPORT_STATUS = {
  IDLE: "IDLE",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type ImportStatusValue =
  (typeof IMPORT_STATUS)[keyof typeof IMPORT_STATUS];


export function assertCsvPath(filePath: string) {
  if (!filePath || !filePath.trim()) {
    throw new Error(
      "CSV path is missing. Set CSV_PATH env or pass filePath explicitly.",
    );
  }
}
