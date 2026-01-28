import * as Joi from 'joi';

export default Joi.object({
  // Application Configuration
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  // Database Configuration
  DATABASE_URL: Joi.string().required(),
  POSTGRES_USER: Joi.string().optional(),
  POSTGRES_PASSWORD: Joi.string().optional(),
  POSTGRES_DB: Joi.string().optional(),
  POSTGRES_PORT: Joi.number().optional(),

  // Import / CSV
  CSV_PATH: Joi.string().optional(),
  IMPORT_TOTAL_ROWS: Joi.number().default(2000000),
  IMPORT_BATCH_SIZE: Joi.number().default(1000),
  IMPORT_PROGRESS_EVERY_MS: Joi.number().default(1000),
  IMPORT_HIGH_WATER_MARK: Joi.number().default(1048576),
  IMPORT_RESUME_OVERLAP: Joi.number().default(1048576),
  IMPORT_RECENT_LIMIT: Joi.number().default(20),
  SSE_HEARTBEAT_MS: Joi.number().default(15000),
});
