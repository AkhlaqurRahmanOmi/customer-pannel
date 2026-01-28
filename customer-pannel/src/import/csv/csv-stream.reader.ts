// src/import/csv/csv-stream.reader.ts
import fs from "fs";
import { parse, Options as CsvParseOptions } from "csv-parse";

export type CsvRecord = Record<string, any>;

export type CsvStreamReaderOptions = {
  filePath: string;

  startByte?: number | bigint;


  highWaterMark?: number;


  parser?: Partial<CsvParseOptions>;


  onBytes?: (deltaBytes: number, absoluteBytesRead: bigint) => void;

  signal?: AbortSignal;
};

export type CsvStreamReaderHandle<T extends CsvRecord = CsvRecord> = {
  records: AsyncGenerator<T>;
  close: () => void;
  getAbsoluteBytesRead: () => bigint;
};

function toSafeNumber(v: number | bigint | undefined): number {
  if (v === undefined) return 0;
  if (typeof v === "number") return v;
  const asNum = Number(v);
  if (!Number.isSafeInteger(asNum)) {
    throw new Error(
      `startByte is too large for a safe JS number: ${v.toString()}`,
    );
  }
  return asNum;
}

export function createCsvStreamReader<T extends CsvRecord = CsvRecord>(
  opts: CsvStreamReaderOptions,
): CsvStreamReaderHandle<T> {
  const start = toSafeNumber(opts.startByte);

  const highWaterMark = opts.highWaterMark ?? 1024 * 1024; // 1MB
  const parserOptions: CsvParseOptions = {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
    ...opts.parser,
  };

  let bytesReadInThisRun = 0n;
  let absoluteBytesRead = BigInt(start);

  const fileStream = fs.createReadStream(opts.filePath, {
    start,
    highWaterMark,
  });

  const parser = parse(parserOptions);

  const onAbort = () => {
    // This will cause the async iterator to throw; caller can treat as stop.
    fileStream.destroy(new Error("CSV import aborted"));
    parser.destroy(new Error("CSV import aborted"));
  };

  if (opts.signal) {
    if (opts.signal.aborted) onAbort();
    opts.signal.addEventListener("abort", onAbort, { once: true });
  }

  fileStream.on("data", (chunk: Buffer) => {
    bytesReadInThisRun += BigInt(chunk.length);
    absoluteBytesRead = BigInt(start) + bytesReadInThisRun;
    opts.onBytes?.(chunk.length, absoluteBytesRead);
  });

  fileStream.on("error", (err) => {
    parser.destroy(err);
  });

  parser.on("error", (err) => {
    fileStream.destroy(err);
  });

  // Pipe stream -> parser
  fileStream.pipe(parser);

  const close = () => {
    try {
      fileStream.destroy();
    } catch {}
    try {
      parser.destroy();
    } catch {}
    if (opts.signal) {
      try {
        opts.signal.removeEventListener("abort", onAbort);
      } catch {}
    }
  };

  async function* recordGenerator(): AsyncGenerator<T> {
    try {
      for await (const record of parser as AsyncIterable<CsvRecord>) {
        yield record as T;
      }
    } finally {
      close();
    }
  }

  return {
    records: recordGenerator(),
    close,
    getAbsoluteBytesRead: () => absoluteBytesRead,
  };
}
