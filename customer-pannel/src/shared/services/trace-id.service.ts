import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class TraceIdService {

  generate(): string {
    return randomUUID();
  }
  getOrGenerate(headers: Record<string, any>): string {
    const existingTraceId = headers['x-trace-id'] || headers['X-Trace-Id'];
    return existingTraceId || this.generate();
  }
}
