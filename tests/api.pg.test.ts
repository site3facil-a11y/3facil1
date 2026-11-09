import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server/app.js';
import { generateToken, hashPassword } from '../server/authService.js';
import { pool, initDatabase, isPostgresAvailable } from '../server/postgres.js';
import { diskStorage } from '../server/diskStorage.js';
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
      await client.query("DELETE FROM usuarios.contas WHERE email IN ('lojista-pg-a@real.com', 'admin-pg@real.com')");
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

      // 3. Semear contas no PostgreSQL (com UUIDs válidos para usuarios.contas.id)
      await client.query(`
        INSERT INTO usuarios.contas (
          id, email, password_hash, role, loja_id, failed_attempts
        ) VALUES 
          ('a0000000-0000-0000-0000-000000000001', 'lojista-pg-a@real.com', $1, 'lojista', 'store-pg-a', 0),
          ('a0000000-0000-0000-0000-000000000002', 'admin-pg@real.com', $1, 'superadmin', NULL, 0)
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

      lojistaAToken = generateToken({ sub: 'a0000000-0000-0000-0000-000000000001', role: 'lojista', storeId: 'store-pg-a' });
      adminToken = generateToken({ sub: 'a0000000-0000-0000-0000-000000000002', role: 'superadmin' });
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
        await client.query("DELETE FROM usuarios.contas WHERE email IN ('lojista-pg-a@real.com', 'admin-pg@real.com')");
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

  it('Migra banco em esquema LEGADO (sem email_verified), aplica 001_initial_schema_and_column_fixes, registra com 201 (is_published=false, email_verified=false), efetua login, retorna 409 em e-mail duplicado e publica loja no verify-email', async () => {
    if (!pgAvailable) return;

    const client = await pool.connect();
    const testEmail = `legacy-test-${Date.now()}@exemplo.com`;
    const testPass = 'SenhaForte123@#';
    const testStoreName = `Loja Migracao Legada ${Date.now()}`;

    try {
      // 1. Simular esquema LEGADO no PostgreSQL:
      // Remove a migração 001 da tabela de controle e remove a coluna email_verified
      await client.query("DELETE FROM public.schema_migrations WHERE id = '001_initial_schema_and_column_fixes'").catch(() => {});
      await client.query('ALTER TABLE usuarios.contas DROP COLUMN IF EXISTS email_verified CASCADE');

      // 2. Chama initDatabase(true) para rodar as migrações automáticas
      await initDatabase(true);

      // Verifica que a migração 001 foi registrada na tabela schema_migrations
      const migCheck = await client.query("SELECT id FROM public.schema_migrations WHERE id = '001_initial_schema_and_column_fixes'");
      expect(migCheck.rows.length).toBe(1);

      // Verifica que a coluna email_verified agora existe em usuarios.contas
      const colCheck = await client.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_schema = 'usuarios' AND table_name = 'contas' AND column_name = 'email_verified'
      `);
      expect(colCheck.rows.length).toBe(1);
      expect(String(colCheck.rows[0].column_default).toLowerCase()).toContain('false');

      // 3. Cadastra nova loja e conta via POST /api/auth/register
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Proprietário Legado',
          storeName: testStoreName,
          email: testEmail,
          password: testPass,
          whatsapp: '11977776666',
          city: 'Campinas',
          state: 'SP',
          type: 'produto'
        });

      expect(registerRes.status).toBe(201);
      expect(registerRes.body.success).toBe(true);
      expect(registerRes.body.user.emailVerified).toBe(false);
      expect(registerRes.body.store.isPublished).toBe(false);

      const storeId = registerRes.body.store.id;

      // 4. Verifica diretamente no PostgreSQL que a loja nasce com is_published = false e conta com email_verified = false
      const contaDb = await client.query('SELECT email_verified FROM usuarios.contas WHERE email = $1', [testEmail]);
      expect(contaDb.rows.length).toBe(1);
      expect(contaDb.rows[0].email_verified).toBe(false);

      const lojaDb = await client.query('SELECT is_published FROM usuarios.lojas WHERE id = $1', [storeId]);
      expect(lojaDb.rows.length).toBe(1);
      expect(lojaDb.rows[0].is_published).toBe(false);

      // 5. Verifica que o login funciona
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPass
        });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.token).toBeDefined();

      // 6. Verifica que o cadastro com e-mail duplicado retorna 409
      const dupRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Outro Nome',
          storeName: 'Outra Loja',
          email: testEmail,
          password: 'OutraSenha456!@#',
          whatsapp: '11977776666',
          city: 'Campinas',
          state: 'SP'
        });
      expect(dupRes.status).toBe(409);
      expect(dupRes.body.error).toContain('já está cadastrado');

      // 7. Localiza o token de verificação gerado para o e-mail
      const verificationTokens = diskStorage.getEmailVerificationTokens();
      const userToken = verificationTokens.find(t => t.email.toLowerCase() === testEmail.toLowerCase());
      expect(userToken).toBeDefined();

      // 8. Confirmação de e-mail via GET /api/auth/verify-email
      const verifyRes = await request(app)
        .get(`/api/auth/verify-email?token=${userToken?.tokenHash}`);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.verified).toBe(true);

      // 9. Confere no PostgreSQL que email_verified = true e loja is_published = true
      const contaVerifiedDb = await client.query('SELECT email_verified FROM usuarios.contas WHERE email = $1', [testEmail]);
      expect(contaVerifiedDb.rows[0].email_verified).toBe(true);

      const lojaVerifiedDb = await client.query('SELECT is_published FROM usuarios.lojas WHERE id = $1', [storeId]);
      expect(lojaVerifiedDb.rows[0].is_published).toBe(true);

      // Limpeza dos dados do teste
      await client.query('DELETE FROM usuarios.contas WHERE email = $1', [testEmail]);
      await client.query('DELETE FROM usuarios.lojas WHERE id = $1', [storeId]);
    } finally {
      client.release();
    }
  });

  it('Retorna 503 com code DB_SCHEMA_ERROR quando o banco possui erro de esquema na transação', async () => {
    if (!pgAvailable) return;

    const client = await pool.connect();
    const schemaErrEmail = `schema-err-${Date.now()}@exemplo.com`;

    try {
      // Remove temporariamente a coluna email_verified para simular erro de coluna inexistente
      await client.query('ALTER TABLE usuarios.contas DROP COLUMN IF EXISTS email_verified CASCADE');

      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Teste Erro Esquema',
          storeName: 'Loja Esquema Quebrado',
          email: schemaErrEmail,
          password: 'SenhaValida123!',
          whatsapp: '11999990000',
          city: 'São Paulo',
          state: 'SP'
        });

      expect(registerRes.status).toBe(503);
      expect(registerRes.body.error).toBeDefined();
      expect(registerRes.body.error.code).toBe('DB_SCHEMA_ERROR');

    } finally {
      // Garante restauração da coluna no banco de dados
      await client.query('ALTER TABLE usuarios.contas ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;').catch(() => {});
      client.release();
    }
  });
});
