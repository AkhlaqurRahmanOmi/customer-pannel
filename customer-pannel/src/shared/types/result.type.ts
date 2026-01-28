export interface Result<T> {
  statusCode: number;
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}
