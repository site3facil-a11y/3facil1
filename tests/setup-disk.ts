import { expect, vi, beforeEach, afterEach } from 'vitest';
import * as postgresModule from '../server/postgres.js';

const testPath = expect.getState()?.testPath || '';

if (!testPath.includes('api.pg.test.ts')) {
  // 1. Remove variáveis que apontam para o PostgreSQL
  delete process.env.DATABASE_URL;
  delete process.env.DB_HOST;
  delete process.env.PGHOST;
  delete process.env.PGDATABASE;
  delete process.env.PGUSER;
  delete process.env.PGPASSWORD;

  // 2. Mocka server/postgres.js com isPostgresAvailable -> false
  vi.spyOn(postgresModule, 'isPostgresAvailable').mockReturnValue(false);
  vi.spyOn(postgresModule, 'isDbConnected').mockReturnValue(false);

  afterEach(() => {
    const current = expect.getState()?.testPath || '';
    if (!current.includes('api.pg.test.ts')) {
      vi.spyOn(postgresModule, 'isPostgresAvailable').mockReturnValue(false);
      vi.spyOn(postgresModule, 'isDbConnected').mockReturnValue(false);
    }
  });
}
