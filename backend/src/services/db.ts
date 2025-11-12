import { Pool, PoolClient } from 'pg';
import env from '../config/env';

export const pool = env.databaseUrl ? new Pool({ connectionString: env.databaseUrl }) : new Pool(env.pg);

pool.on('error', (err) => {
  console.error('Erro inesperado no pool do Postgres', err);
});

export const db = {
  async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
    const client = await pool.connect();
    try {
      return await client.query(text, params);
    } finally {
      client.release();
    }
  },
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};

export type DbClient = typeof db;
