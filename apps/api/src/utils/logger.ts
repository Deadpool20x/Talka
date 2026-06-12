import { env } from '@/config/env';

export const logger = {
  debug: (...args: unknown[]) => env.LOG_LEVEL === 'debug' && console.log(JSON.stringify({ level: 'debug', time: new Date().toISOString(), args })),
  info: (...args: unknown[]) => ['debug', 'info'].includes(env.LOG_LEVEL) && console.log(JSON.stringify({ level: 'info', time: new Date().toISOString(), args })),
  warn: (...args: unknown[]) => ['debug', 'info', 'warn'].includes(env.LOG_LEVEL) && console.warn(JSON.stringify({ level: 'warn', time: new Date().toISOString(), args })),
  error: (...args: unknown[]) => console.error(JSON.stringify({ level: 'error', time: new Date().toISOString(), args })),
};
