import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiResponse } from '@shared/interfaces';

/**
 * Service for building standardized API responses.
 */
@Injectable()
export class ResponseBuilderService {
  private readonly defaultVersion: string;

  constructor(private readonly configService: ConfigService) {
    // Use version from config or default to '1'
    this.defaultVersion = '1';
  }

  /**
   * Build a successful API response.
   */
  buildSuccess<T>(
    data: T,
    message: string,
    statusCode: number,
    traceId: string,
  ): ApiResponse<T> {
    return {
      success: true,
      statusCode,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        traceId,
        version: this.defaultVersion,
      },
    };
  }
}
