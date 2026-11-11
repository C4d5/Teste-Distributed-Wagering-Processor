
import { Pool, types } from 'pg';

types.setTypeParser(20, (value: string) => value);

export function createPool(): Pool {
  return new Pool({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'wagering',
    password: process.env.DB_PASSWORD ?? 'wagering_dev_password',
    database: process.env.DB_NAME ?? 'wagering_db',
    max: Number(process.env.DB_POOL_MAX ?? 10),
  });
}