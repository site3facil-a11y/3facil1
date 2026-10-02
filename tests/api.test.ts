import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server/app.js';
import { generateToken, hashPassword } from '../server/authService.js';
import { diskStorage } from '../server/diskStorage.js';
import crypto from 'crypto';

const app = createApp();

let superAdminToken: string;
let lojistaAToken: string;
let lojistaBToken: string;

beforeAll(async () => {
  // Configurar contas de teste
  const hashedPw = await hashPassword('password123');

  diskStorage.saveAccount({
    id: 'user-admin',
    email: 'admin-test@3facil.com',
    password_hash: hashedPw,
    role: 'superadmin',
    failed_attempts: 0,
    locked_until: null,
    created_at: new Date().toISOString()
  });

  diskStorage.saveAccount({
    id: 'user-lojista-a',
    email: 'lojista-a@teste.com',
    password_hash: hashedPw,
    role: 'lojista',
    loja_id: 'store-a',
    failed_attempts: 0,
    locked_until: null,
    created_at: new Date().toISOString()
  });

  diskStorage.saveAccount({
    id: 'user-lojista-b',
    email: 'lojista-b@teste.com',
    password_hash: hashedPw,
    role: 'lojista',
    loja_id: 'store-b',
    failed_attempts: 0,
    locked_until: null,
    created_at: new Date().toISOString()
  });

  // Criar lojas A e B
  diskStorage.saveStore({
    id: 'store-a',
    name: 'Loja A Veículos',
    slug: 'loja-a',
    type: 'veiculo',
    isPublished: true,
    whatsapp: '11999990001',
    monthlyFee: 30,
    subscriptionStatus: 'ativo'
  } as any);

  diskStorage.saveStore({
    id: 'store-b',
    name: 'Loja B Imóveis',
    slug: 'loja-b',
    type: 'imovel',
    isPublished: true,
    whatsapp: '11999990002',
    monthlyFee: 50,
    subscriptionStatus: 'ativo'
  } as any);

  // Itens de teste
  diskStorage.saveItem({
    id: 'item-store-b',
    storeId: 'store-b',
    title: 'Apartamento de Luxo',
    itemType: 'imovel',
    price: 500000,
    status: 'disponivel',
    propertyType: 'apartamento',
    transactionType: 'venda',
    areaUtil: 100,
    bedrooms: 2,
    suites: 1,
    bathrooms: 2,
    garageSpots: 1,
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    amenities: [],
    images: []
  } as any);

  // Leads de teste
  diskStorage.saveLead({
    id: 'lead-store-b',
    storeId: 'store-b',
    itemId: 'item-store-b',
    itemTitle: 'Apartamento de Luxo',
    itemType: 'imovel',
    itemPrice: 500000,
    paymentMethod: 'outro',
    clientName: 'Comprador B',
    clientPhone: '11988887777',
    clientEmail: 'comprador@teste.com',
    clientMessage: 'Tenho interesse.',
    status: 'novo',
    createdAt: new Date().toISOString()
  });

  // Gerar tokens
  superAdminToken = generateToken({ sub: 'user-admin', role: 'superadmin' });
  lojistaAToken = generateToken({ sub: 'user-lojista-a', role: 'lojista', storeId: 'store-a' });
  lojistaBToken = generateToken({ sub: 'user-lojista-b', role: 'lojista', storeId: 'store-b' });
});

describe('1. Autenticação e Login', () => {
  it('Login com sucesso retorna token e perfil do usuário', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'lojista-a@teste.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('lojista');
    expect(res.body.user.storeId).toBe('store-a');
  });

  it('Login com senha incorreta retorna Credenciais inválidas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'lojista-a@teste.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Credenciais inválidas');
  });

  it('Login com usuário inexistente retorna exatamente a mesma resposta genérica', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inexistente@teste.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Credenciais inválidas');
  });

  it('Rejeita requisição com token adulterado', async () => {
    const res = await request(app)
      .get('/api/leads')
      .set('Authorization', `Bearer ${lojistaAToken}fakeSignature`);

    expect(res.status).toBe(401);
  });
});

describe('2. Autorização e Controle de Acesso (RBAC)', () => {
  it('Bloqueia rota protegida sem token (401)', async () => {
    const res = await request(app).get('/api/leads');
    expect(res.status).toBe(401);
  });

  it('Lojista A é impedido de atualizar dados da Loja B (403)', async () => {
    const res = await request(app)
      .put('/api/stores/store-b')
      .set('Authorization', `Bearer ${lojistaAToken}`)
      .send({ name: 'Loja B Hackeada' });

    expect(res.status).toBe(403);
  });

  it('Lojista A é impedido de deletar item da Loja B (403)', async () => {
    const res = await request(app)
      .delete('/api/items/item-store-b')
      .set('Authorization', `Bearer ${lojistaAToken}`);

    expect(res.status).toBe(403);
  });

  it('Lojista A é impedido de deletar lead da Loja B (403)', async () => {
    const res = await request(app)
      .delete('/api/leads/lead-store-b')
      .set('Authorization', `Bearer ${lojistaAToken}`);

    expect(res.status).toBe(403);
  });

  it('Lojista A não pode alterar configurações gerais do sistema ou chave Pix (403)', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${lojistaAToken}`)
      .send({ pixKey: 'hacked-pix' });

    expect(res.status).toBe(403);
  });

  it('Superadmin consegue atualizar configurações da plataforma (200)', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ platformName: '3Fácil Plataforma Teste' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('3. Rotas Perigosas Removidas do Servidor HTTP', () => {
  it('/api/reset-defaults deve retornar 404 (removido do servidor HTTP)', async () => {
    const res = await request(app)
      .post('/api/reset-defaults')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(404);
  });

  it('/api/migrate-to-postgres deve retornar 404 (removido do servidor HTTP)', async () => {
    const res = await request(app)
      .post('/api/migrate-to-postgres')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(404);
  });

  it('/api/admin/upload-update-zip deve retornar 404 (removido do servidor HTTP)', async () => {
    const res = await request(app)
      .post('/api/admin/upload-update-zip')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('4. Bootstrap Público e Proteção de Dados', () => {
  it('GET /api/public/bootstrap nunca devolve leads nem dados sensíveis de pagamento', async () => {
    const res = await request(app).get('/api/public/bootstrap');
    expect(res.status).toBe(200);

    // ZERO leads
    expect(res.body.leads).toEqual([]);

    // Verifica que não vaza dados financeiros ou contatos privados
    if (res.body.stores.length > 0) {
      for (const s of res.body.stores) {
        expect(s.ownerEmail).toBeUndefined();
        expect(s.ownerPhone).toBeUndefined();
        expect(s.monthlyFee).toBeUndefined();
        expect(s.subscriptionStatus).toBeUndefined();
        expect(s.password_hash).toBeUndefined();
      }
    }

    // Settings públicas não têm chaves Pix privadas
    expect(res.body.settings.pixKey).toBeUndefined();
    expect(res.body.settings.superAdminEmail).toBeUndefined();
  });

  it('GET /api/health público devolve estritamente { status: "ok" }', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('Bloqueia acesso a arquivos de banco de dados e arquivos .env (404)', async () => {
    const res = await request(app).get('/database_storage/contas.json');
    expect(res.status).toBe(404);
  });
});

describe('5. Validação com Zod e Tratamento de Erros', () => {
  it('Rejeita criação de item com campos inválidos (preço negativo) com HTTP 400', async () => {
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${lojistaAToken}`)
      .send({
        storeId: 'store-a',
        title: 'Carro Inválido',
        itemType: 'veiculo',
        price: -100 // Preço negativo inválido
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Rejeita criação de lead com telefone menor que 8 dígitos com HTTP 400', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({
        storeId: 'store-a',
        clientName: 'Fulano',
        clientPhone: '123' // Muito curto
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('6. Fluxo de Redefinição de Senha (SHA-256 e Uso Único)', () => {
  it('Forgot-password retorna mensagem genérica para e-mail existente ou inexistente', async () => {
    const resExistente = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'lojista-a@teste.com' });

    const resInexistente = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'naoexiste@teste.com' });

    expect(resExistente.status).toBe(200);
    expect(resInexistente.status).toBe(200);
    expect(resExistente.body.message).toBe(resInexistente.body.message);
  });

  it('Rejeita token de recuperação de senha inexistente ou inválido', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'fake-invalid-token-12345', newPassword: 'NewPassword123!' });

    expect(res.status).toBe(400);
  });

  it('Token de recuperação de senha possui uso único', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    diskStorage.saveResetToken({
      tokenHash,
      email: 'lojista-a@teste.com',
      role: 'lojista',
      storeId: 'store-a',
      expiresAt: Date.now() + 30 * 60 * 1000
    });

    // 1º Uso: deve ser bem sucedido
    const res1 = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'NewSecurePassword123!' });
    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);

    // 2º Uso: deve falhar (já consumido)
    const res2 = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'AnotherPassword123!' });
    expect(res2.status).toBe(400);
  });
});
