import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export interface DbOptions {
  maxConnections?: number;
}

export function createDb(url: string, options: DbOptions = {}) {
  const client = postgres(url, {
    max: options.maxConnections ?? 10,
    onnotice: () => undefined,
  });
  const db = drizzle(client, { schema });

  return {
    db,
    ping: async () => {
      await client`select 1`;
    },
    close: () => client.end({ timeout: 5 }),
  };
}

export type DbHandle = ReturnType<typeof createDb>;
export type Database = DbHandle['db'];
