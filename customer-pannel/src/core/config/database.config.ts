import { registerAs } from '@nestjs/config';

/**
 * Database configuration
 * Contains PostgreSQL connection settings
 */
export default registerAs('database', () => ({
  /** Database connection URL */
  url: process.env.DATABASE_URL,

  /** Enable query logging (only in development) */
  logging: process.env.NODE_ENV === 'development',

  /** Connection pool settings */
  pool: {
    min: 2,
    max: 10,
  },
}));
