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

describe('7. Blindagem do Registro Público (Falha 1)', () => {
  it('Register com role superadmin no payload resulta SEMPRE em role lojista', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Tentativa Hacker Admin',
        email: `hacker-admin-${Date.now()}@teste.com`,
        password: 'ValidPassword123!',
        type: 'produtos',
        whatsapp: '11999998888',
        role: 'superadmin' // Tentativa de escalar privilégio
      });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('lojista');
    expect(res.body.user.role).not.toBe('superadmin');
  });

  it('Register com storeId de outra loja cria uma loja NOVA e não vincula à existente', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Tentativa Roubo de Loja',
        email: `hacker-loja-${Date.now()}@teste.com`,
        password: 'ValidPassword123!',
        type: 'produtos',
        whatsapp: '11999998888',
        storeId: 'store-b' // Tentativa de vincular à Loja B
      });

    expect(res.status).toBe(201);
    expect(res.body.user.storeId).toBeDefined();
    expect(res.body.user.storeId).not.toBe('store-b');
  });

  it('Token de conta recém-registrada recebe 403 em PUT /api/settings', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Nova Loja Varejo',
        email: `novo-lojista-${Date.now()}@teste.com`,
        password: 'ValidPassword123!',
        type: 'produtos',
        whatsapp: '11999998888'
      });

    expect(regRes.status).toBe(201);
    const newToken = regRes.body.token;

    const settingsRes = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${newToken}`)
      .send({ platformName: 'Nome Alterado' });

    expect(settingsRes.status).toBe(403);
  });

  it('Rejeita registro com senha menor que 10 caracteres', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Loja Senha Curta',
        email: `curta-${Date.now()}@teste.com`,
        password: 'curta', // < 10 caracteres
        type: 'produtos',
        whatsapp: '11999998888'
      });

    expect(res.status).toBe(400);
  });
});

describe('8. Proteção contra Sequestro de Item (Falha 2)', () => {
  it('Lojista A envia POST com id de item da loja B -> 403 e item de B permanece intacto', async () => {
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${lojistaAToken}`)
      .send({
        id: 'item-store-b', // ID do item pertencente à Loja B
        storeId: 'store-a', // Tentando transferir para loja A
        title: 'Apartamento Roubado',
        itemType: 'imovel',
        price: 1000,
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
      });

    expect(res.status).toBe(403);

    // Confere que o item no banco/disco ainda pertence à Loja B com seus dados intactos
    const originalItem = diskStorage.getItems().find(i => i.id === 'item-store-b');
    expect(originalItem).toBeDefined();
    expect(originalItem?.storeId).toBe('store-b');
    expect(originalItem?.title).toBe('Apartamento de Luxo');
  });
});

describe('9. Proteção de Leads Públicos (Falha 3)', () => {
  it('POST /api/leads com id de lead existente gera ID novo e não altera o lead original', async () => {
    const leadOriginal = diskStorage.getLeads().find(l => l.id === 'lead-store-b');
    expect(leadOriginal).toBeDefined();
    const mensagemOriginal = leadOriginal?.clientMessage;

    const res = await request(app)
      .post('/api/leads')
      .send({
        id: 'lead-store-b', // ID do lead existente
        storeId: 'store-b',
        itemId: 'item-store-b',
        clientName: 'Atacante',
        clientPhone: '11999999999',
        clientMessage: 'Sobrescrevendo lead original!'
      });

    expect(res.status).toBe(201);
    expect(res.body.lead.id).not.toBe('lead-store-b');

    // Confere que o lead original permanece inalterado
    const leadDepois = diskStorage.getLeads().find(l => l.id === 'lead-store-b');
    expect(leadDepois?.clientMessage).toBe(mensagemOriginal);
    expect(leadDepois?.clientName).toBe('Comprador B');
  });

  it('POST /api/leads rejeita envio quando itemId não pertence à storeId indicada', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({
        storeId: 'store-a', // Loja A
        itemId: 'item-store-b', // Item que pertence à Loja B!
        clientName: 'Cliente Confuso',
        clientPhone: '11999999999',
        clientMessage: 'Quero este item.'
      });

    expect([400, 404]).toContain(res.status);
  });
});

describe('10. Prevenção de Imagens Fantasma e Uploads Seguros (Falha 6)', () => {
  it('GET em imagem inexistente retorna 404 real (nunca 200 com foto de estoque)', async () => {
    const res = await request(app).get('/uploads/arquivo-que-nao-existe-9999.jpg');
    expect(res.status).toBe(404);
  });

  it('POST /api/uploads sem token de autenticação retorna 401', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .field('storeId', 'store-a');

    expect(res.status).toBe(401);
  });

  it('POST /api/uploads com storeId de outra loja retorna 403', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${lojistaAToken}`)
      .field('storeId', 'store-b'); // Lojista A tentando subir na loja B

    expect(res.status).toBe(403);
  });

  it('POST /api/uploads com arquivo de imagem válido (magic bytes JPEG) realiza upload com sucesso', async () => {
    // Buffer com cabeçalho JPEG real (FF D8 FF E0 ...)
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01]);

    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${lojistaAToken}`)
      .field('storeId', 'store-a')
      .attach('image', jpegBuffer, 'foto.jpg');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.url).toMatch(/^\/uploads\/upload-/);
  });

  it('POST /api/uploads com arquivo falso (texto disfarçado) é rejeitado com 400', async () => {
    const fakeBuffer = Buffer.from('<?php echo "fake php script"; ?>');

    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${lojistaAToken}`)
      .field('storeId', 'store-a')
      .attach('image', fakeBuffer, 'malicioso.jpg');

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Arquivo inválido');
  });
});

describe('11. Integridade do Repositório e .gitignore (Falha 5)', () => {
  it('Garante que nenhum arquivo dentro de src/ (incluindo src/data) é ignorado pelo .gitignore', async () => {
    const { execSync } = await import('child_process');
    try {
      const output = execSync('git check-ignore src/data/demoStores.ts src/data/initialData.ts src/data/real3facilData.ts', {
        encoding: 'utf-8'
      }).trim();
      // Se git check-ignore encontrar correspondência, ela vem na saída
      expect(output).toBe('');
    } catch (e: any) {
      // Código de saída 1 do git check-ignore significa que nenhum arquivo é ignorado (sucesso!)
      expect(e.status).toBe(1);
    }
  });
});

describe('12. Erros do Banco Não Podem Virar Sucesso (Falha 4)', () => {
  it('Simulação de falha do pool em operação de escrita retorna 503 com código DB_UNAVAILABLE (nunca 200)', async () => {
    const postgresModule = await import('../server/postgres.js');
    const { vi } = await import('vitest');

    // Simula que a aplicação detectou o banco online, mas a tentativa de conectar ao pool falha
    const spyAvail = vi.spyOn(postgresModule, 'isPostgresAvailable').mockReturnValue(true);
    const spyConnect = vi.spyOn(postgresModule.pool, 'connect').mockImplementationOnce(async () => {
      const err: any = new Error('Connection terminated unexpectedly');
      err.code = 'ECONNREFUSED';
      throw err;
    });

    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${lojistaAToken}`)
      .send({
        storeId: 'store-a',
        title: 'Item com Banco Fora',
        itemType: 'produto',
        price: 50
      });

    spyAvail.mockRestore();
    spyConnect.mockRestore();

    // Deve retornar 503 e nunca 2xx com success: true
    expect(res.status).toBe(503);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('DB_UNAVAILABLE');
    expect(res.body.success).toBeUndefined();
  });
});

