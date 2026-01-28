/**
 * Validation error structure for API error responses
 */
export interface ValidationError {
  /** Field name that failed validation */
  field: string;
  /** Validation error message */
  message: string;
  /** Validation constraint that failed (e.g., 'isEmail', 'minLength') */
  constraint?: string;
  /** Value that was rejected */
  value?: any;
}
