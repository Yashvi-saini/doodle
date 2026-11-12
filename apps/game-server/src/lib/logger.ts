import { pino, type Logger } from 'pino';
import type { GameServerConfig } from '../config/env.js';

export type { Logger };

export function createLogger(config: Pick<GameServerConfig, 'NODE_ENV' | 'LOG_LEVEL'>): Logger {
  if (config.NODE_ENV === 'test') {
    return pino({ level: 'silent' });
  }
  if (config.NODE_ENV === 'development') {
    return pino({
      level: config.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    });
  }
  return pino({ level: config.LOG_LEVEL });
}
