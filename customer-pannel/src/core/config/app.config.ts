import { registerAs } from '@nestjs/config';

/**
 * Application configuration
 * Contains general application settings
 */
export default registerAs('app', () => ({
  /** Node environment (development, production, test) */
  nodeEnv: process.env.NODE_ENV || 'development',

  /** Server port */
  port: parseInt(process.env.PORT || '3000', 10),

  /** Application name */
  name: 'Customer Panel',

  /** Global API prefix */
  globalPrefix: 'api',
}));
