import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server/app.js';
import { generateToken, hashPassword } from '../server/authService.js';
import { diskStorage } from '../server/diskStorage.js';
import { parseAppUrl, normalizeClientStoreType } from '../src/utils/urlRouting.js';

const app = createApp();
let adminToken = '';

beforeAll(async () => {
  const hashedPw = await hashPassword('password123');
  diskStorage.saveAccount({
    id: 'spec-admin',
    email: 'spec-admin@3facil.com',
    password_hash: hashedPw,
    role: 'superadmin',
    failed_attempts: 0,
    locked_until: null,
    created_at: new Date().toISOString(),
  });
  adminToken = generateToken({
    sub: 'spec-admin',
    role: 'superadmin',
  });
});

describe('Modelos Especializados - Roteamento de URL e Cadastro Completo', () => {
  describe('parseAppUrl & normalizeClientStoreType', () => {
    it('interpreta /?loja=<slug>, /<slug>, /painel, /?admin=true&store=<id>, /master e reset-token', () => {
      const qSlug = parseAppUrl('/', '?loja=oficina-alpha');
      expect(qSlug.requestedSlug).toBe('oficina-alpha');
      expect(qSlug.isAdminRoute).toBe(false);

      const pSlug = parseAppUrl('/oficina-alpha', '');
      expect(pSlug.requestedSlug).toBe('oficina-alpha');
      expect(pSlug.isAdminRoute).toBe(false);

      const painel = parseAppUrl('/painel', '');
      expect(painel.requestedSlug).toBe('');
      expect(painel.isAdminRoute).toBe(true);

      const verifyRedirect = parseAppUrl('/', '?admin=true&store=store-svc-99');
      expect(verifyRedirect.isAdminRoute).toBe(true);
      expect(verifyRedirect.queryStoreId).toBe('store-svc-99');

      const master = parseAppUrl('/master', '');
      expect(master.isMasterRoute).toBe(true);
      expect(master.requestedSlug).toBe('');

      const resetEmailLink = parseAppUrl('/', '?token=tok123&reset=true');
      expect(resetEmailLink.resetToken).toBe('tok123');
    });

    it('normaliza tipos plurais e singulares sem cair em imovel por engano', () => {
      expect(normalizeClientStoreType('veiculos')).toBe('veiculo');
      expect(normalizeClientStoreType('imoveis')).toBe('imovel');
      expect(normalizeClientStoreType('produtos')).toBe('produto');
      expect(normalizeClientStoreType('servicos')).toBe('servico');
      expect(normalizeClientStoreType('locadoras')).toBe('locadora');
    });
  });

  describe('Persistência de Todos os 4 Modelos no Register + Bootstrap', () => {
    it('registra e retorna type exato para veiculo, imovel, produto e servico em register, bootstrap e public/bootstrap', async () => {
      const models: Array<{ type: 'veiculo' | 'imovel' | 'produto' | 'servico'; label: string }> = [
        { type: 'veiculo', label: 'Motors Teste Veículos' },
        { type: 'imovel', label: 'Imobi Teste Imóveis' },
        { type: 'produto', label: 'Shop Teste Produtos' },
        { type: 'servico', label: 'Studio Teste Serviços' },
      ];

      const suffix = Date.now().toString(36);

      for (let i = 0; i < models.length; i++) {
        const m = models[i];
        const regRes = await request(app)
          .post('/api/auth/register')
          .set('X-Forwarded-For', `203.0.113.${210 + i}`)
          .send({
            name: `${m.label} ${suffix}`,
            email: `modelo-${m.type}-${suffix}@teste.com`,
            password: 'SenhaSuperForte123!',
            type: m.type,
            whatsapp: `1198888770${i}`,
            city: 'Curitiba',
            state: 'PR',
          });

        expect(regRes.status).toBe(201);
        expect(regRes.body.success).toBe(true);
        expect(regRes.body.store.type).toBe(m.type);

        // Publica loja para simular confirmação de e-mail
        const pubRes = await request(app)
          .put(`/api/stores/${regRes.body.store.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ isPublished: true });
        expect(pubRes.status).toBe(200);
        expect(pubRes.body.store.type).toBe(m.type);

        // Valida presença com type correto em /api/bootstrap autenticado
        const bootRes = await request(app)
          .get('/api/bootstrap')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(bootRes.status).toBe(200);
        const foundBoot = bootRes.body.stores.find((s: any) => s.id === regRes.body.store.id);
        expect(foundBoot).toBeDefined();
        expect(foundBoot.type).toBe(m.type);

        // Valida presença com type correto em /api/public/bootstrap
        const pubBootRes = await request(app).get('/api/public/bootstrap');
        expect(pubBootRes.status).toBe(200);
        const foundPub = pubBootRes.body.stores.find((s: any) => s.id === regRes.body.store.id);
        expect(foundPub).toBeDefined();
        expect(foundPub.type).toBe(m.type);
      }
    });
  });
});
