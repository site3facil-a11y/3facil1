import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server/app.js';

const app = createApp();


import { 
  getSmtpConfig, 
  getSmtpConfigWithSources, 
  createTransporter, 
  isLocalHost, 
  getDefaultLocalHost, 
  isRunningInDocker,
  translateSmtpError,
  isTransientError,
  maskEmail,
  maskSecret,
  extractFromDomain,
  getAllowedFromDomains
} from '../server/emailService.js';
import { generateToken } from '../server/authService.js';


describe('Testes de Envio de E-mail via Relay Postfix Local & Resend', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('1. Precedência de EMAIL_PROVIDER e SMTP_HOST sobre chaves do Resend', () => {
    // Caso A: EMAIL_PROVIDER='smtp' explícito no .env vence tudo, mesmo com RESEND_API_KEY
    process.env.EMAIL_PROVIDER = 'smtp';
    process.env.RESEND_API_KEY = 're_test_secret_api_key_12345';
    process.env.SMTP_HOST = 'host.docker.internal';
    process.env.SMTP_PORT = '25';

    const config = getSmtpConfig();
    expect(config.provider).toBe('smtp');
    expect(config.host).toBe('host.docker.internal');
    expect(config.port).toBe(25);

    // Caso B: Sem EMAIL_PROVIDER, mas com SMTP_HOST presente -> provider torna-se 'smtp'
    delete process.env.EMAIL_PROVIDER;
    const configWithoutProvider = getSmtpConfig();
    expect(configWithoutProvider.provider).toBe('smtp');

    // Caso C: Sem EMAIL_PROVIDER e sem SMTP_HOST, mas com RESEND_API_KEY -> provider torna-se 'resend'
    delete process.env.SMTP_HOST;
    const configResend = getSmtpConfig();
    expect(configResend.provider).toBe('resend');
  });

  it('2. getSmtpConfigWithSources identifica a ORIGEM de cada campo e mascara credenciais', () => {
    process.env.EMAIL_PROVIDER = 'smtp';
    process.env.SMTP_HOST = 'host.docker.internal';
    process.env.SMTP_PORT = '25';
    process.env.SMTP_PASS = 'superSecretPassword123';
    process.env.RESEND_API_KEY = 're_prod_api_key_secret_9999';

    const withSources = getSmtpConfigWithSources();

    expect(withSources.provider.origin).toBe('env');
    expect(withSources.provider.value).toBe('smtp');

    expect(withSources.host.origin).toBe('env');
    expect(withSources.host.value).toBe('host.docker.internal');

    expect(withSources.port.origin).toBe('env');
    expect(withSources.port.value).toBe(25);

    // Senha deve ser mascarada, NUNCA vazada em texto claro
    expect(withSources.pass.origin).toBe('env');
    expect(withSources.pass.masked).toBe('••••••••');
    expect(withSources.pass.value).toBe('••••••••');
    expect(withSources.pass.value).not.toContain('superSecretPassword123');

    // Chave do Resend deve ser mascarada
    expect(withSources.apiKey.origin).toBe('env');
    expect(withSources.apiKey.masked).toContain('••••');
    expect(withSources.apiKey.value).not.toBe('re_prod_api_key_secret_9999');
  });

  it('3. createTransporter: NUNCA adiciona auth se o host for local e na porta 25', () => {
    // Configura host local na porta 25 com user e pass definidos
    process.env.SMTP_HOST = 'host.docker.internal';
    process.env.SMTP_PORT = '25';
    process.env.SMTP_USER = 'qualquer_usuario';
    process.env.SMTP_PASS = 'qualquer_senha';

    const transporter = createTransporter() as any;
    expect(transporter).not.toBeNull();
    // O objeto de transporte não deve possuir a propriedade auth
    expect(transporter.options.auth).toBeUndefined();
    // Host local na porta 25 deve ter rejectUnauthorized desativado (compatível com Postfix local)
    expect(transporter.options.tls.rejectUnauthorized).toBe(false);

    // Agora teste com host externo (ex: smtp.resend.com na 587):
    process.env.SMTP_HOST = 'smtp.resend.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'resend';
    process.env.SMTP_PASS = 're_123456';

    const externalTransporter = createTransporter() as any;
    expect(externalTransporter).not.toBeNull();
    // Servidor remoto DEVE possuir autenticação configurada
    expect(externalTransporter.options.auth).toBeDefined();
    expect(externalTransporter.options.auth.user).toBe('resend');
    expect(externalTransporter.options.auth.pass).toBe('re_123456');
    // Servidor remoto DEVE validar certificados estritamente
    expect(externalTransporter.options.tls.rejectUnauthorized).toBe(true);
  });

  it('4. Detecção de Docker e seleção do host padrão (host.docker.internal vs 127.0.0.1)', () => {
    // Em container Docker
    process.env.RUNNING_IN_DOCKER = 'true';
    expect(isRunningInDocker()).toBe(true);
    expect(getDefaultLocalHost()).toBe('host.docker.internal');

    // Fora de container Docker
    delete process.env.RUNNING_IN_DOCKER;
    // Se não tiver /.dockerenv no disco de teste:
    if (!isRunningInDocker()) {
      expect(getDefaultLocalHost()).toBe('127.0.0.1');
    }

    // Reconhecimento de sub-redes Docker (172.16.0.0/12)
    expect(isLocalHost('127.0.0.1')).toBe(true);
    expect(isLocalHost('localhost')).toBe(true);
    expect(isLocalHost('host.docker.internal')).toBe(true);
    expect(isLocalHost('172.17.0.1')).toBe(true);
    expect(isLocalHost('172.20.0.2')).toBe(true);
    expect(isLocalHost('smtp.resend.com')).toBe(false);
    expect(isLocalHost('smtp.gmail.com')).toBe(false);
  });

  it('5. GET /api/email/config exige SuperAdmin e devolve dados mascarados', async () => {
    // 1. Visitante anônimo -> 401
    const unauthRes = await request(app).get('/api/email/config');
    expect(unauthRes.status).toBe(401);

    // 2. Lojista comum -> 403
    const lojistaToken = generateToken({ sub: 'user-lojista', role: 'lojista', storeId: 'store-a' });
    const lojistaRes = await request(app)
      .get('/api/email/config')
      .set('Authorization', `Bearer ${lojistaToken}`);
    expect(lojistaRes.status).toBe(403);

    // 3. SuperAdmin -> 200 com payload mascarado
    const adminToken = generateToken({ sub: 'admin-1', role: 'superadmin' });
    const adminRes = await request(app)
      .get('/api/email/config')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);
    expect(adminRes.body.data).toBeDefined();
    expect(adminRes.body.data.provider.origin).toMatch(/^(env|arquivo|padrao)$/);
    expect(adminRes.body.data.defaultLocalHost).toBeDefined();
    // A chave pass e apiKey nunca devem retornar senhas em texto claro
    if (adminRes.body.data.pass.value) {
      expect(adminRes.body.data.pass.value).toMatch(/^•+$/);
    }
  });

  it('6. Tradução de erros SMTP para português e detecção de erros transitórios vs permanentes', () => {
    // Erro de porta bloqueada ou Postfix inativo
    const errConn = translateSmtpError({ code: 'ECONNREFUSED' }, 'host.docker.internal', 25);
    expect(errConn).toContain('Postfix não responde em host.docker.internal:25');

    // Erro de autenticação quando Postfix local não espera SASL
    const errAuth = translateSmtpError({ code: 'EAUTH' }, '127.0.0.1', 25);
    expect(errAuth).toContain('Servidor não aceita autenticação');

    // Erro de domínio não autorizado (550 / 553)
    const errDomain = translateSmtpError({ response: '550 Relaying denied' });
    expect(errDomain).toContain('Remetente ou domínio não autorizado');

    // Transient vs Permanent
    expect(isTransientError({ code: 'ECONNREFUSED' })).toBe(true);
    expect(isTransientError({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isTransientError({ responseCode: 421 })).toBe(true);
    expect(isTransientError({ responseCode: 450 })).toBe(true);

    // Erros 5xx de rejeição são permanentes e NUNCA devem sofrer retry
    expect(isTransientError({ responseCode: 550, response: '550 User unknown' })).toBe(false);
    expect(isTransientError({ responseCode: 553, response: '553 Domain not allowed' })).toBe(false);
    expect(isTransientError({ code: 'EAUTH', response: '535 Authentication failed' })).toBe(false);
  });

  it('7. Utilitários de mascaramento de dados sensíveis e extração de domínios', () => {
    expect(maskEmail('wilsonlimamn@gmail.com')).toBe('wi***@gmail.com');
    expect(maskEmail('c@loja.com')).toBe('c***@loja.com');
    expect(maskEmail('')).toBe('***@***');

    expect(maskSecret('re_123456789abcdef', true)).toBe('re_••••cdef');
    expect(maskSecret('myPassword123', false)).toBe('••••••••');

    expect(extractFromDomain('"3Fácil" <contato@3facil.com>')).toBe('3facil.com');
    expect(extractFromDomain('notificacoes@minhaloja.com.br')).toBe('minhaloja.com.br');

    const allowed = getAllowedFromDomains();
    expect(allowed).toContain('3facil.com');
    expect(allowed).toContain('mail.3facil.com');
  });
});
