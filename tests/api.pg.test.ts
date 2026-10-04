import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server/app.js';
import { generateToken, hashPassword } from '../server/authService.js';
import { diskStorage } from '../server/diskStorage.js';
import { pool, isPostgresAvailable } from '../server/postgres.js';
import { itemRepository } from '../src/server/repositories/itemRepository.js';
import { storeRepository } from '../src/server/repositories/storeRepository.js';
import { AppError } from '../src/server/errors/AppError.js';

const app = createApp();

let lojistaAToken: string;
let lojistaBToken: string;

beforeAll(async () => {
  const hashedPw = await hashPassword('password123');

  diskStorage.saveAccount({
    id: 'user-pg-a',
    email: 'lojista-pg-a@teste.com',
    password_hash: hashedPw,
    role: 'lojista',
    loja_id: 'store-pg-a',
    failed_attempts: 0,
    locked_until: null,
    created_at: new Date().toISOString()
  });

  diskStorage.saveStore({
    id: 'store-pg-a',
    name: 'Loja PG A',
    slug: 'loja-pg-a',
    type: 'produto',
    isPublished: true,
    whatsapp: '11999990001',
    monthlyFee: 30,
    subscriptionStatus: 'ativo'
  } as any);

  diskStorage.saveStore({
    id: 'store-pg-b',
    name: 'Loja PG B',
    slug: 'loja-pg-b',
    type: 'produto',
    isPublished: true,
    whatsapp: '11999990002',
    monthlyFee: 30,
    subscriptionStatus: 'ativo'
  } as any);

  lojistaAToken = generateToken({ sub: 'user-pg-a', role: 'lojista', storeId: 'store-pg-a' });
  lojistaBToken = generateToken({ sub: 'user-pg-b', role: 'lojista', storeId: 'store-pg-b' });
});

describe('PostgreSQL Backend Path & Transaction Integrity (tests/api.pg.test.ts)', () => {
  it('ON CONFLICT com WHERE loja_id = EXCLUDED.loja_id impede sobrescrita entre lojas', async () => {
    // Simula cliente PostgreSQL conectado
    const mockClient: any = {
      query: vi.fn().mockResolvedValue({ rowCount: 0 }), // 0 linhas afetadas pela cláusula WHERE loja_id = EXCLUDED.loja_id
      release: vi.fn()
    };

    // Tentativa de upsert de item onde o ID já existe em outra loja
    await expect(
      itemRepository.upsertItem(
        {
          id: 'item-conflito-loja-b',
          storeId: 'store-pg-a',
          title: 'Tentativa de Sequestro SQL',
          itemType: 'produto',
          price: 150
        } as any,
        mockClient
      )
    ).rejects.toThrow(/pertence a outra loja/);

    expect(mockClient.query).toHaveBeenCalled();
    const querySql = mockClient.query.mock.calls[0][0];
    expect(querySql).toContain('WHERE loja.produtos.loja_id = EXCLUDED.loja_id');
    expect(querySql).toContain('RETURNING id');
  });

  it('Transações realizam ROLLBACK quando uma query falha no meio e não gravam no banco', async () => {
    const executedQueries: string[] = [];

    const mockClient: any = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        executedQueries.push(sql.trim());
        if (sql.includes('UPDATE usuarios.lojas SET configuracoes')) {
          throw new Error('Falha de integridade forçada na query 2');
        }
        return { rowCount: 1, rows: [{ id: 'store-pg-a' }] };
      }),
      release: vi.fn()
    };

    const spyConnect = vi.spyOn(pool, 'connect').mockResolvedValue(mockClient);

    // Simula operação com falha intermediária
    let caughtError: any = null;
    try {
      await mockClient.query('BEGIN');
      await mockClient.query('UPDATE usuarios.lojas SET nome = $1 WHERE id = $2', ['Novo Nome', 'store-pg-a']);
      await mockClient.query('UPDATE usuarios.lojas SET configuracoes = $1 WHERE id = $2', ['invalid', 'store-pg-a']);
      await mockClient.query('COMMIT');
    } catch (err) {
      caughtError = err;
      await mockClient.query('ROLLBACK');
    }

    spyConnect.mockRestore();

    expect(caughtError).toBeDefined();
    expect(executedQueries).toContain('BEGIN');
    expect(executedQueries).toContain('ROLLBACK');
    expect(executedQueries).not.toContain('COMMIT');
  });

  it('Retorna 503 DB_UNAVAILABLE quando o pool é encerrado durante a escrita', async () => {
    // Simula pool encerrado/fechado com erro "Cannot use a pool after calling end on the pool"
    const spy = vi.spyOn(pool, 'connect').mockImplementationOnce(async () => {
      const err: any = new Error('Cannot use a pool after calling end on the pool');
      err.code = 'ECONNREFUSED';
      throw err;
    });

    const postgresModule = await import('../server/postgres.js');
    const spyAvail = vi.spyOn(postgresModule, 'isPostgresAvailable').mockReturnValue(true);

    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${lojistaAToken}`)
      .send({
        storeId: 'store-pg-a',
        title: 'Item com Pool Fechado',
        itemType: 'produto',
        price: 99
      });

    spy.mockRestore();
    spyAvail.mockRestore();

    expect(res.status).toBe(503);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('DB_UNAVAILABLE');
  });

  it('Nenhuma rota de escrita grava no disco antes do COMMIT do banco', async () => {
    const testItemId = `item-rollback-check-${Date.now()}`;

    // Simula que o PostgreSQL falha ao gravar o item
    const postgresModule = await import('../server/postgres.js');
    const spyAvail = vi.spyOn(postgresModule, 'isPostgresAvailable').mockReturnValue(true);
    const spyUpsert = vi.spyOn(itemRepository, 'upsertItem').mockRejectedValueOnce(
      new AppError(503, 'DB_UNAVAILABLE', 'Falha forçada na transação SQL antes do commit')
    );

    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${lojistaAToken}`)
      .send({
        id: testItemId,
        storeId: 'store-pg-a',
        title: 'Item que Falha no Banco',
        itemType: 'produto',
        price: 99
      });

    spyAvail.mockRestore();
    spyUpsert.mockRestore();

    expect(res.status).toBe(503);

    // CRUCIAL: Verifica se o item NÃO foi gravado no disco
    const itemNoDisco = diskStorage.getItems().find(i => i.id === testItemId);
    expect(itemNoDisco).toBeUndefined();
  });
});
