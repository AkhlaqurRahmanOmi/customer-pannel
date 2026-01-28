import { Controller, Get, Query, Sse, MessageEvent } from "@nestjs/common";
import { Observable, from, interval, merge, of } from "rxjs";
import { catchError, map } from "rxjs/operators";

import { ImportProgressService } from "./import-progress.service";
import { WorkerManager } from "../workers/worker.manager";

@Controller("customers")
export class ImportProgressGateway {
  constructor(
    private readonly progressService: ImportProgressService,
    private readonly workerManager: WorkerManager,
  ) {}

  @Get("progress")
  async getProgress(
    @Query("totalRows") totalRows?: string,
    @Query("recentLimit") recentLimit?: string,
  ) {
    return this.progressService.getProgressSnapshot({
      totalRows: totalRows ? Number(totalRows) : undefined,
      recentLimit: recentLimit ? Number(recentLimit) : undefined,
    });
  }

  @Sse("progress/stream")
  progressStream(
    @Query("totalRows") totalRows?: string,
    @Query("recentLimit") recentLimit?: string,
  ): Observable<MessageEvent> {
    const totalRowsNum = totalRows ? Number(totalRows) : undefined;
    const recentLimitNum = recentLimit ? Number(recentLimit) : undefined;

    // 1) Immediately send a snapshot on connect (important for instant UI restore)
    const initial$ = from(
      this.progressService.getProgressSnapshot({
        totalRows: totalRowsNum,
        recentLimit: recentLimitNum,
      }),
    ).pipe(
      map((snapshot) => ({
        data: { type: "snapshot", ...snapshot },
      })),
    );

    // 2) Stream worker messages (progress/done/error)
    const live$ = this.workerManager.eventStream.pipe(
      map((msg) => ({ data: msg })),
    );

    // 3) Heartbeat so proxies don’t silently kill SSE connections
    const heartbeat$ = interval(15000).pipe(
      map(() => ({
        data: { type: "heartbeat", ts: new Date().toISOString() },
      })),
    );

    return merge(initial$, live$, heartbeat$).pipe(
      catchError((err) =>
        of({
          data: {
            type: "error",
            error: err?.message ?? String(err),
          },
        }),
      ),
    );
  }
}
