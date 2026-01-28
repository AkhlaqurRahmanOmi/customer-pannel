
export type BatchBufferOptions<T> = {
  maxSize: number;
  flush: (items: T[]) => Promise<void>;
  onFlushError?: (err: unknown, items: T[]) => void;
};

export class BatchBuffer<T> {
  private readonly maxSize: number;
  private readonly flushFn: (items: T[]) => Promise<void>;
  private readonly onFlushError?: (err: unknown, items: T[]) => void;

  private buf: T[] = [];
  private flushing: Promise<void> | null = null;

  constructor(opts: BatchBufferOptions<T>) {
    if (!opts.maxSize || opts.maxSize < 1) {
      throw new Error("BatchBuffer maxSize must be >= 1");
    }
    this.maxSize = opts.maxSize;
    this.flushFn = opts.flush;
    this.onFlushError = opts.onFlushError;
  }

  get size(): number {
    return this.buf.length;
  }


  async add(item: T): Promise<boolean> {
    this.buf.push(item);
    if (this.buf.length >= this.maxSize) {
      await this.flush();
      return true;
    }
    return false;
  }


  async addMany(items: T[]): Promise<void> {
    for (const it of items) {
      // eslint-disable-next-line no-await-in-loop
      await this.add(it);
    }
  }


  async flush(): Promise<number> {
    if (this.buf.length === 0) return 0;

    // If a flush is already in progress, wait for it.
    if (this.flushing) {
      await this.flushing;
      // after waiting, buffer might still have items
      if (this.buf.length === 0) return 0;
    }

    const items = this.buf;
    this.buf = [];

    this.flushing = (async () => {
      try {
        await this.flushFn(items);
      } catch (err) {
        this.onFlushError?.(err, items);
        throw err;
      }
    })();

    try {
      await this.flushing;
    } finally {
      this.flushing = null;
    }

    return items.length;
  }


  async close(): Promise<void> {
    await this.flush();
    if (this.flushing) await this.flushing;
  }


  drain(): T[] {
    const items = this.buf;
    this.buf = [];
    return items;
  }
}
