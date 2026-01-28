import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@shared/interfaces';

/**
 * Service for building standardized API responses.
 */
@Injectable()
export class ResponseBuilderService {
  /**
   * Build a successful API response.
   */
  buildSuccess<T>(
    data: T,
    message: string,
    statusCode: number,
    traceId: string,
    version: string,
  ): ApiResponse<T> {
    return {
      success: true,
      statusCode,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        traceId,
        version,
      },
    };
  }
}
