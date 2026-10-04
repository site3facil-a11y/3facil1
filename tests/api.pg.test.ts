import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server/app.js';
import { generateToken, hashPassword } from '../server/authService.js';
import { pool, initDatabase, isPostgresAvailable } from '../server/postgres.js';
import { itemRepository } from '../src/server/repositories/itemRepository.js';

const app = createApp();

let pgAvailable = false;
let lojistaAToken = '';
let adminToken = '';

beforeAll(async () => {
  try {
    const initialized = await initDatabase();
    pgAvailable = Boolean(initialized);
    if (!pgAvailable) {
      console.warn('[PostgreSQL Test] Servidor PostgreSQL indisponível. Testes de banco serão pulados.');
      return;
    }

    const client = await pool.connect();
    try {
      const hashedPw = await hashPassword('password123');

      // 1. Limpar dados anteriores de teste
      await client.query("DELETE FROM loja.pedidos WHERE loja_id IN ('store-pg-a', 'store-pg-b')");
      await client.query("DELETE FROM loja.produtos WHERE loja_id IN ('store-pg-a', 'store-pg-b')");
      await client.query("DELETE FROM usuarios.contas WHERE id IN ('user-pg-a', 'user-pg-admin')");
      await client.query("DELETE FROM usuarios.lojas WHERE id IN ('store-pg-a', 'store-pg-b')");

      // 2. Semear lojas diretamente no PostgreSQL (não no disco)
      await client.query(`
        INSERT INTO usuarios.lojas (
          id, nome, slug, tipo, whatsapp, is_published, mensalidade, status_assinatura
        ) VALUES 
          ('store-pg-a', 'Loja PG A Real', 'loja-pg-a', 'produto', '11999990001', true, 30.00, 'ativo'),
          ('store-pg-b', 'Loja PG B Real', 'loja-pg-b', 'produto', '11999990002', true, 30.00, 'ativo')
        ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, is_published = EXCLUDED.is_published
      `);

      // 3. Semear contas no PostgreSQL
      await client.query(`
        INSERT INTO usuarios.contas (
          id, email, password_hash, role, loja_id, failed_attempts
        ) VALUES 
          ('user-pg-a', 'lojista-pg-a@real.com', $1, 'lojista', 'store-pg-a', 0),
          ('user-pg-admin', 'admin-pg@real.com', $1, 'superadmin', NULL, 0)
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      `, [hashedPw]);

      // 4. Semear item original da Loja B no PostgreSQL
      await client.query(`
        INSERT INTO loja.produtos (
          id, loja_id, titulo, preco, status, dados_extras
        ) VALUES (
          'item-pg-b-real', 'store-pg-b', 'Fone Original da Loja B', 199.90, 'disponivel', '{}'::jsonb
        )
        ON CONFLICT (id) DO UPDATE SET titulo = EXCLUDED.titulo, loja_id = EXCLUDED.loja_id
      `);

      // 5. Semear lead inicial na Loja B
      await client.query(`
        INSERT INTO loja.pedidos (
          id, loja_id, item_id, item_title, client_name, client_phone, client_message
        ) VALUES (
          'lead-existente-pg', 'store-pg-b', 'item-pg-b-real', 'Fone Original', 'Cliente Inicial', '11999998888', 'Mensagem inicial'
        )
        ON CONFLICT (id) DO NOTHING
      `);

      lojistaAToken = generateToken({ sub: 'user-pg-a', role: 'lojista', storeId: 'store-pg-a' });
      adminToken = generateToken({ sub: 'user-pg-admin', role: 'superadmin' });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn('[PostgreSQL Test] Erro ao conectar ao Postgres:', err?.message || err);
    pgAvailable = false;
  }
});

afterAll(async () => {
  if (pgAvailable) {
    try {
      const client = await pool.connect();
      try {
        await client.query("DELETE FROM loja.pedidos WHERE loja_id IN ('store-pg-a', 'store-pg-b')");
        await client.query("DELETE FROM loja.produtos WHERE loja_id IN ('store-pg-a', 'store-pg-b')");
        await client.query("DELETE FROM usuarios.contas WHERE id IN ('user-pg-a', 'user-pg-admin')");
        await client.query("DELETE FROM usuarios.lojas WHERE id IN ('store-pg-a', 'store-pg-b')");
      } finally {
        client.release();
      }
    } catch {}
  }
});

describe('PostgreSQL Backend Path & Real Integration Tests (tests/api.pg.test.ts)', () => {
  it('ON CONFLICT com WHERE loja_id = EXCLUDED.loja_id impede sobrescrita entre lojas no banco real', async () => {
    if (!pgAvailable) return;

    // Lojista A tenta sequestrar o item da Loja B via upsertItem
    await expect(
      itemRepository.upsertItem({
        id: 'item-pg-b-real',
        storeId: 'store-pg-a',
        title: 'Tentativa de Sequestro SQL Real',
        itemType: 'produto',
        price: 150
      } as any)
    ).rejects.toThrow(/pertence a outra loja/);

    // Confere no banco real PostgreSQL que o item original da Loja B continua intacto
    const res = await pool.query('SELECT loja_id, titulo FROM loja.produtos WHERE id = $1', ['item-pg-b-real']);
    expect(res.rows[0].loja_id).toBe('store-pg-b');
    expect(res.rows[0].titulo).toBe('Fone Original da Loja B');
  });

  it('Transações realizam ROLLBACK quando uma query falha no meio e não gravam no banco real', async () => {
    if (!pgAvailable) return;

    const client = await pool.connect();
    const tempStoreId = `store-rollback-${Date.now()}`;
    let caught = false;

    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO usuarios.lojas (id, nome, slug, tipo, whatsapp)
        VALUES ($1, 'Loja Transação Falha', $2, 'produto', '11999990000')
      `, [tempStoreId, `slug-rollback-${Date.now()}`]);

      // Query que causa erro intencional no PostgreSQL
      await client.query('INSERT INTO tabela_inexistente_para_erro (coluna) VALUES (1)');
      await client.query('COMMIT');
    } catch (err) {
      caught = true;
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    expect(caught).toBe(true);

    // Verifica que o ROLLBACK reverteu a inserção da loja no banco real
    const check = await pool.query('SELECT * FROM usuarios.lojas WHERE id = $1', [tempStoreId]);
    expect(check.rows.length).toBe(0);
  });

  it('Retorna 503 DB_UNAVAILABLE ao encerrar o pool durante a escrita', async () => {
    if (!pgAvailable) return;

    // Simula interrupção / encerramento do pool na conexão
    const spy = vi.spyOn(pool, 'connect').mockImplementationOnce(async () => {
      const err: any = new Error('Cannot use a pool after calling end on the pool');
      err.code = 'ECONNREFUSED';
      throw err;
    });

    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${lojistaAToken}`)
      .send({
        storeId: 'store-pg-a',
        title: 'Item com Falha no Pool',
        itemType: 'produto',
        price: 99
      });

    spy.mockRestore();

    expect(res.status).toBe(503);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('DB_UNAVAILABLE');
  });

  it('POST /api/leads com id existente gera id novo no banco real e não altera o lead original', async () => {
    if (!pgAvailable) return;

    // Lead existente no banco real: 'lead-existente-pg'
    const res = await request(app)
      .post('/api/leads')
      .send({
        id: 'lead-existente-pg',
        storeId: 'store-pg-b',
        itemId: 'item-pg-b-real',
        clientName: 'Atacante Lead',
        clientPhone: '11988887777',
        clientMessage: 'Tentando sobrescrever o lead no PostgreSQL!'
      });

    expect(res.status).toBe(201);
    expect(res.body.lead.id).not.toBe('lead-existente-pg');

    // Confere no banco real que o lead original permanece inalterado
    const originalDb = await pool.query('SELECT client_name, client_message FROM loja.pedidos WHERE id = $1', ['lead-existente-pg']);
    expect(originalDb.rows[0].client_name).toBe('Cliente Inicial');
    expect(originalDb.rows[0].client_message).toBe('Mensagem inicial');

    // Confere que o novo lead foi gravado no banco real com o novo ID
    const novoDb = await pool.query('SELECT client_name, client_message FROM loja.pedidos WHERE id = $1', [res.body.lead.id]);
    expect(novoDb.rows[0].client_name).toBe('Atacante Lead');
  });

  it('PUT /api/settings grava no banco real e GET /api/public/bootstrap lê do PostgreSQL', async () => {
    if (!pgAvailable) return;

    // 1. PUT /api/settings por Super Admin
    const putRes = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        platformName: 'Plataforma 3Fácil PG Teste Real',
        superAdminName: 'Admin Postgres'
      });

    expect(putRes.status).toBe(200);

    // Confere gravação no PostgreSQL em configuracoes_gerais
    const settingsDb = await pool.query("SELECT valor FROM usuarios.configuracoes_gerais WHERE chave = 'platform_settings'");
    expect(settingsDb.rows.length).toBeGreaterThan(0);
    const parsed = typeof settingsDb.rows[0].valor === 'string' ? JSON.parse(settingsDb.rows[0].valor) : settingsDb.rows[0].valor;
    expect(parsed.platformName).toBe('Plataforma 3Fácil PG Teste Real');

    // 2. GET /api/public/bootstrap lê diretamente do banco
    const bootstrapRes = await request(app).get('/api/public/bootstrap');
    expect(bootstrapRes.status).toBe(200);
    expect(bootstrapRes.body.stores).toBeDefined();
    expect(bootstrapRes.body.items).toBeDefined();
    expect(bootstrapRes.body.settings.platformName).toBe('Plataforma 3Fácil PG Teste Real');

    // Verifica que encontrou a loja PG A no bootstrap do banco
    const storePgA = bootstrapRes.body.stores.find((s: any) => s.id === 'store-pg-a');
    expect(storePgA).toBeDefined();
    expect(storePgA.name).toBe('Loja PG A Real');
  });

  it('POST /api/leads para loja inexistente retorna 404 (nunca 500 por violação de FK)', async () => {
    if (!pgAvailable) return;

    const res = await request(app)
      .post('/api/leads')
      .send({
        storeId: 'loja-inexistente-fk-test',
        clientName: 'Cliente Teste',
        clientPhone: '11999990000',
        clientMessage: 'Interesse'
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(res.status).not.toBe(500);
  });
});
