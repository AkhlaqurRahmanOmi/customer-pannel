export type ErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL_ERROR';

export const ErrorCodes: Record<string, ErrorCode> = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

export const ErrorMessages: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Validation failed',
  NOT_FOUND: 'Resource not found',
  CONFLICT: 'Resource conflict',
  INTERNAL_ERROR: 'Internal server error',
};
