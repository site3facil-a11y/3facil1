import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { 
  assertJwtSecret, 
  comparePassword, 
  hashPassword, 
  generateToken, 
  findUserByEmail, 
  findUserById, 
  registerAccount, 
  updateLoginAttempts, 
  DUMMY_HASH 
} from '../../server/authService.js';
import { authenticateToken, TokenPayload } from '../middlewares/auth.js';
import { diskStorage } from '../../server/diskStorage.js';
import { sendPasswordResetEmail, sendWelcomeEmail } from '../../server/emailService.js';
import crypto from 'crypto';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(cleanEmail);

    // Comparação em tempo constante para proteger contra enumeração e timing attacks
    if (!user) {
      await comparePassword(password, DUMMY_HASH);
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    // Verificar se a conta está temporariamente bloqueada por 5 tentativas falhas
    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      // Executa compare para manter tempo constante contra timing attacks
      await comparePassword(password, user.password_hash);
      const remainingMinutes = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      res.status(429).json({
        error: `Conta temporariamente bloqueada devido a 5 tentativas incorretas. Tente novamente em ${remainingMinutes} minutos.`
      });
      return;
    }

    const isMatch = await comparePassword(password, user.password_hash);

    if (!isMatch) {
      const nextAttempts = (user.failed_attempts || 0) + 1;
      const lockedUntil = nextAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await updateLoginAttempts(user.id, nextAttempts, lockedUntil);

      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    // Sucesso: zerar tentativas e desbloquear
    await updateLoginAttempts(user.id, 0, null);

    const token = generateToken({
      sub: user.id,
      role: user.role,
      storeId: user.loja_id || null
    });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      token,
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        storeId: user.loja_id || null
      }
    });
  } catch (err: any) {
    console.error('[Auth Route] Erro no processamento de login:', err);
    res.status(500).json({ error: 'Erro interno ao processar login.' });
  }
});

import { validateBody } from '../server/validation/validate.js';
import { registerSchema } from '../server/validation/schemas.js';
import { storeRepository } from '../server/repositories/storeRepository.js';
import { StoreProfile } from '../types/store.js';
import { registerIpLimiter, checkEmailRegistrationRateLimit, checkResendVerificationRateLimit } from '../server/middlewares/rateLimiters.js';
import { pool, isPostgresAvailable } from '../../server/postgres.js';

// POST /api/auth/register (Cadastro público blindado)
router.post('/register', registerIpLimiter, validateBody(registerSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Verificação Honeypot (antibot silencioso)
    const honeypot = req.body.website_hp || req.body.hp_field;
    if (honeypot && String(honeypot).trim().length > 0) {
      res.status(400).json({ error: 'Cadastro inválido.' });
      return;
    }

    // 2. Verificação Cloudflare Turnstile (se configurado em ambiente)
    if (process.env.TURNSTILE_SECRET_KEY) {
      const turnstileToken = req.body.turnstileToken || req.body['cf-turnstile-response'];
      if (!turnstileToken) {
        res.status(400).json({ error: 'Validação de segurança (Turnstile) obrigatória.' });
        return;
      }
      try {
        const formData = new URLSearchParams();
        formData.append('secret', process.env.TURNSTILE_SECRET_KEY);
        formData.append('response', turnstileToken);
        if (req.ip) formData.append('remoteip', req.ip);

        const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body: formData,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const cfData = await cfRes.json() as any;
        if (!cfData.success) {
          res.status(400).json({ error: 'Falha na verificação de segurança antibot (Turnstile).' });
          return;
        }
      } catch (cfErr: any) {
        console.warn('[Auth Register] Erro ao validar Turnstile:', cfErr.message);
        res.status(400).json({ error: 'Erro ao validar desafio de segurança antibot.' });
        return;
      }
    }

    // 3. Extração estrita dos campos permitidos (ignora id, role, plan, isVerified, etc. enviados pelo cliente)
    const { name, storeName, email, password, whatsapp, phone, city, state, type = 'produto' } = req.body;
    const finalName = (name || storeName || 'Minha Loja').trim();
    const cleanEmail = email.toLowerCase().trim();

    // 4. Rate limit por e-mail: máximo 3 cadastros por dia
    if (!checkEmailRegistrationRateLimit(cleanEmail)) {
      res.status(429).json({ error: 'Limite de cadastros para este e-mail excedido (máximo 3 por dia). Tente novamente mais tarde.' });
      return;
    }

    // 5. Verificar duplicidade de e-mail
    const existing = await findUserByEmail(cleanEmail);
    if (existing) {
      res.status(409).json({ error: 'Este e-mail já está cadastrado. Use outro ou faça login.' });
      return;
    }

    // 6. Preparar dados da nova loja e da conta
    const userRole = 'lojista';
    const newStoreId = `store-${crypto.randomUUID()}`;
    const accountId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const sanitizedType = (type.replace(/s$/, '') as any) || 'produto';
    const nowIso = new Date().toISOString();
    const nextDueDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const newStore: StoreProfile = {
      id: newStoreId,
      name: finalName,
      slug: `${finalName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
      type: sanitizedType,
      description: '',
      slogan: '',
      themeColor: '#2563eb',
      email: cleanEmail,
      whatsapp: whatsapp || '',
      phone: phone || whatsapp || '',
      city: city || 'São Paulo',
      state: state || 'SP',
      ownerName: finalName,
      ownerEmail: cleanEmail,
      ownerPhone: whatsapp || '',
      plan: 'starter',
      monthlyFee: 30,
      subscriptionStatus: 'trial',
      nextDueDate,
      isPublished: false, // Inicia não publicada até confirmação por e-mail
      enableWhatsApp: true,
      enableEmailProposal: true,
      currency: 'BRL',
      createdAt: nowIso
    };

    // 7. Persistência Atômica via Transação PostgreSQL
    const postgresActive = isPostgresAvailable();
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction && !postgresActive) {
      res.status(503).json({
        error: {
          message: 'Serviço de banco de dados indisponível em ambiente de produção.',
          code: 'DB_UNAVAILABLE'
        }
      });
      return;
    }

    let postgresSucceeded = false;
    if (postgresActive) {
      let client;
      try {
        client = await pool.connect();
      } catch (connErr: any) {
        console.error('[Auth Register] Erro ao conectar ao PostgreSQL:', connErr.message);
        res.status(503).json({
          error: {
            message: 'Serviço de banco de dados temporariamente indisponível.',
            code: 'DB_UNAVAILABLE'
          }
        });
        return;
      }

      try {
        await client.query('BEGIN');

        // Cria a loja em usuarios.lojas com is_published = false
        const storeConfig = { ...newStore };
        await client.query(`
          INSERT INTO usuarios.lojas (
            id, nome, slug, tipo, descricao, slogan, theme_color,
            whatsapp, email, telefone, cidade, estado,
            plano_tier, mensalidade, status_assinatura, vencimento_mensalidade,
            owner_name, owner_email, owner_phone, password_hash,
            configuracoes, is_published, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12,
            $13, $14, $15, $16,
            $17, $18, $19, $20,
            $21, $22, $23, $24
          )
        `, [
          newStoreId,
          newStore.name,
          newStore.slug,
          newStore.type,
          newStore.description || '',
          newStore.slogan || '',
          newStore.themeColor || '#2563eb',
          newStore.whatsapp || '',
          newStore.email || cleanEmail,
          newStore.phone || newStore.whatsapp || '',
          newStore.city || 'São Paulo',
          newStore.state || 'SP',
          'starter',
          30,
          'trial',
          nextDueDate,
          newStore.ownerName || newStore.name,
          cleanEmail,
          newStore.ownerPhone || newStore.whatsapp || '',
          passwordHash,
          JSON.stringify(storeConfig),
          false, // is_published = false
          nowIso,
          nowIso
        ]);

        // Cria a conta em usuarios.contas com email_verified = false
        await client.query(`
          INSERT INTO usuarios.contas (
            id, email, password_hash, role, loja_id, failed_attempts, locked_until, nome, email_verified, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          accountId,
          cleanEmail,
          passwordHash,
          userRole,
          newStoreId,
          0,
          null,
          finalName,
          false, // email_verified = false
          nowIso,
          nowIso
        ]);

        await client.query('COMMIT');
        postgresSucceeded = true;
      } catch (txErr: any) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Ignora erro no rollback
        }
        console.error('[Auth Register] Erro na transação PostgreSQL:', txErr.message);
        res.status(503).json({
          error: {
            message: 'Falha na transação ao registrar loja e conta.',
            code: 'DB_UNAVAILABLE'
          }
        });
        return;
      } finally {
        client.release();
      }
    }

    // Persistência em disco (apenas executada se PG teve sucesso ou se não estamos em produção e PG não estava disponível)
    diskStorage.saveStore(newStore);
    diskStorage.saveAccount({
      id: accountId,
      email: cleanEmail,
      password_hash: passwordHash,
      role: userRole,
      loja_id: newStoreId,
      failed_attempts: 0,
      locked_until: null,
      email_verified: false,
      created_at: nowIso
    });

    // 8. Gera token criptografado para verificação de e-mail (SHA-256, 24 horas, uso único)
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
    const verificationExpiresAt = Date.now() + 24 * 60 * 60 * 1000;

    diskStorage.saveEmailVerificationToken({
      tokenHash: verificationTokenHash,
      email: cleanEmail,
      storeId: newStoreId,
      expiresAt: verificationExpiresAt,
      used: false
    });

    const originUrl = req.get('origin') || process.env.APP_URL || 'https://www.3facil.com';
    const verificationUrl = `${originUrl}/api/auth/verify-email?token=${rawVerificationToken}`;

    // 9. Envio de e-mail de confirmação em segundo plano (com log sem dados sensíveis)
    let emailQueued = false;
    try {
      setImmediate(async () => {
        try {
          await sendWelcomeEmail(newStore, verificationUrl, originUrl);
          console.log(`[Auth Register] E-mail de confirmação despachado para ${cleanEmail}`);
        } catch (emailErr: any) {
          console.warn(`[Auth Register] Falha ao enviar e-mail de confirmação: ${emailErr?.message || 'erro desconhecido'}`);
        }
      });
      emailQueued = true;
    } catch {
      emailQueued = false;
    }

    const token = generateToken({
      sub: accountId,
      role: userRole,
      storeId: newStoreId
    });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      success: true,
      emailQueued,
      token,
      accessToken: token,
      user: {
        id: accountId,
        email: cleanEmail,
        role: userRole,
        storeId: newStoreId,
        emailVerified: false
      },
      store: {
        id: newStoreId,
        name: newStore.name,
        slug: newStore.slug,
        type: newStore.type,
        isPublished: false
      }
    });
  } catch (err: any) {
    console.error('[Auth Route] Erro inesperado ao registrar conta:', err);
    res.status(500).json({ error: 'Erro interno ao processar cadastro.' });
  }
});

// GET /api/auth/verify-email?token=...
router.get('/verify-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';

    if (!rawToken) {
      res.status(400).json({ error: 'Token de confirmação não fornecido.' });
      return;
    }

    const verification = diskStorage.consumeEmailVerificationToken(rawToken);
    if (!verification) {
      res.status(400).json({ error: 'Link de confirmação expirado ou inválido. Por favor, solicite um novo link.' });
      return;
    }

    // 1. Atualizar conta para email_verified = true
    const account = diskStorage.findAccountByEmail(verification.email);
    if (account) {
      diskStorage.updateAccount(account.id, { email_verified: true });
    }

    // 2. Publicar a loja associada (isPublished = true)
    if (verification.storeId) {
      const stores = diskStorage.getStores();
      const storeIdx = stores.findIndex(s => s.id === verification.storeId);
      if (storeIdx >= 0) {
        stores[storeIdx].isPublished = true;
        diskStorage.saveStores(stores);
      }
    }

    // 3. Sincronizar com PostgreSQL se disponível
    if (isPostgresAvailable()) {
      try {
        const client = await pool.connect();
        try {
          await client.query(
            'UPDATE usuarios.contas SET email_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE email = $1',
            [verification.email]
          );
          if (verification.storeId) {
            await client.query(
              'UPDATE usuarios.lojas SET is_published = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
              [verification.storeId]
            );
          }
        } finally {
          client.release();
        }
      } catch (pgErr: any) {
        console.warn('[Auth Verify] Aviso ao sincronizar verificação no PostgreSQL:', pgErr.message);
      }
    }

    if (req.headers.accept?.includes('text/html') && !req.headers.accept?.includes('application/json')) {
      res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>Cadastro Confirmado - 3Fácil</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-50 min-h-screen flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full p-8 text-center">
            <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">✓</div>
            <h1 class="text-2xl font-bold text-slate-800 mb-2">E-mail Confirmado!</h1>
            <p class="text-slate-600 mb-6">Sua conta foi verificada com sucesso e sua vitrine já está online e publicada.</p>
            <a href="/painel" class="inline-block w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition">Acessar Painel da Loja</a>
          </div>
        </body>
        </html>
      `);
      return;
    }

    res.json({
      success: true,
      verified: true,
      message: 'E-mail confirmado com sucesso e vitrine publicada!',
      storeId: verification.storeId
    });
  } catch (err: any) {
    console.error('[Auth] Erro ao verificar e-mail:', err);
    res.status(500).json({ error: 'Erro interno ao validar confirmação de e-mail.' });
  }
});

// POST /api/auth/resend-verification (Reenvio com rate limit de 3/hora por e-mail e resposta genérica)
router.post('/resend-verification', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const cleanEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';

    const genericResponse = {
      success: true,
      message: 'Se o e-mail estiver cadastrado e ainda não verificado, um novo link de confirmação foi enviado.'
    };

    if (!cleanEmail || !cleanEmail.includes('@')) {
      res.json(genericResponse);
      return;
    }

    if (!checkResendVerificationRateLimit(cleanEmail)) {
      res.status(429).json({ error: 'Limite de reenvio de confirmação excedido (máximo 3 por hora). Tente mais tarde.' });
      return;
    }

    const account = await findUserByEmail(cleanEmail);
    if (!account || account.email_verified) {
      res.json(genericResponse);
      return;
    }

    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
    const verificationExpiresAt = Date.now() + 24 * 60 * 60 * 1000;

    diskStorage.saveEmailVerificationToken({
      tokenHash: verificationTokenHash,
      email: cleanEmail,
      storeId: account.loja_id || '',
      expiresAt: verificationExpiresAt,
      used: false
    });

    const originUrl = req.get('origin') || process.env.APP_URL || 'https://www.3facil.com';
    const verificationUrl = `${originUrl}/api/auth/verify-email?token=${rawVerificationToken}`;

    const store = account.loja_id ? diskStorage.findStoreById(account.loja_id) : null;
    if (store) {
      setImmediate(async () => {
        try {
          await sendWelcomeEmail(store, verificationUrl, originUrl);
          console.log(`[Auth Resend] Link de confirmação reenviado para ${cleanEmail}`);
        } catch (emailErr: any) {
          console.warn(`[Auth Resend] Aviso ao reenviar confirmação: ${emailErr?.message || 'erro'}`);
        }
      });
    }

    res.json(genericResponse);
  } catch (err: any) {
    console.error('[Auth] Erro ao reenviar confirmação:', err);
    res.json({
      success: true,
      message: 'Se o e-mail estiver cadastrado e ainda não verificado, um novo link de confirmação foi enviado.'
    });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.body?.token;

  if (!token) {
    res.status(401).json({ error: 'Token não fornecido para renovação.' });
    return;
  }

  try {
    const secret = assertJwtSecret();
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as TokenPayload;
    const sub = decoded.sub || decoded.userId;

    if (!sub) {
      res.status(401).json({ error: 'Token inválido.' });
      return;
    }

    const newToken = generateToken({
      sub,
      role: decoded.role,
      storeId: decoded.storeId || null
    });

    res.json({
      success: true,
      token: newToken,
      accessToken: newToken
    });
  } catch (err) {
    res.status(403).json({ error: 'Token expirado ou inválido para renovação.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const sub = req.user?.sub || req.user?.userId;
    if (!sub) {
      res.status(401).json({ error: 'Não autenticado.' });
      return;
    }

    const user = await findUserById(sub);

    res.json({
      success: true,
      user: {
        id: sub,
        email: user?.email || '',
        role: req.user?.role,
        storeId: req.user?.storeId || user?.loja_id || null
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao consultar perfil do usuário.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response): void => {
  res.clearCookie('auth_token');
  res.json({
    success: true,
    message: 'Sessão encerrada com sucesso.'
  });
});

// POST /api/auth/forgot-password (Token criptografado com SHA-256, 30min, resposta constante)
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const cleanEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';

    // Resposta padrão estritamente idêntica para impedir enumeração de usuários
    const genericResponse = {
      success: true,
      message: 'Se este e-mail estiver cadastrado em nossa plataforma, as instruções para redefinição foram enviadas.'
    };

    if (!cleanEmail || !cleanEmail.includes('@')) {
      res.json(genericResponse);
      return;
    }

    const user = await findUserByEmail(cleanEmail);
    if (!user) {
      // Computação constante de tempo para proteger contra timing attacks
      crypto.createHash('sha256').update(cleanEmail).digest('hex');
      res.json(genericResponse);
      return;
    }

    // 1. Gera token criptograficamente seguro (32 bytes = 64 hex chars)
    const rawToken = crypto.randomBytes(32).toString('hex');
    // 2. Guarda apenas o hash SHA-256 do token em disco/banco
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    // 3. Expiração de 30 minutos
    const expiresAt = Date.now() + 30 * 60 * 1000;

    // Salva hash e invalida tokens anteriores do usuário (uso único)
    diskStorage.saveResetToken({
      tokenHash,
      email: cleanEmail,
      role: user.role === 'superadmin' ? 'superadmin' : 'store',
      storeId: user.loja_id || undefined,
      expiresAt
    });

    const originUrl = req.get('origin') || process.env.APP_URL || 'https://www.3facil.com';
    const resetLink = `${originUrl}/?reset-token=${rawToken}`;

    // Disparo de e-mail seguro
    await sendPasswordResetEmail(
      cleanEmail,
      resetLink,
      user.email,
      user.role === 'superadmin' ? 'superadmin' : 'store'
    );

    res.json(genericResponse);
  } catch (err: any) {
    console.error('[Auth] Erro em forgot-password:', err);
    res.json({
      success: true,
      message: 'Se este e-mail estiver cadastrado em nossa plataforma, as instruções para redefinição foram enviadas.'
    });
  }
});

// POST /api/auth/reset-password (Validação com SHA-256, hash bcrypt e invalidação total)
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ error: 'Token ou nova senha inválidos (mínimo 6 caracteres).' });
      return;
    }

    const rawToken = typeof token === 'string' ? token.trim() : '';
    const resetData = diskStorage.getResetToken(rawToken);

    if (!resetData || resetData.expiresAt < Date.now()) {
      res.status(400).json({ error: 'Link de redefinição expirado ou inválido. Por favor, solicite um novo link.' });
      return;
    }

    // Troca de senha por hash bcrypt seguro (custo >= 12)
    const passwordHash = await hashPassword(newPassword);

    const user = await findUserByEmail(resetData.email);
    if (user) {
      diskStorage.updateAccount(user.id, { 
        password_hash: passwordHash, 
        failed_attempts: 0, 
        locked_until: null 
      });

      // Sincroniza com Postgres se conectado
      try {
        const { pool } = await import('../../server/postgres.js');
        const client = await pool.connect();
        try {
          await client.query(
            'UPDATE usuarios.contas SET password_hash = $1, failed_attempts = 0, locked_until = NULL WHERE id = $2',
            [passwordHash, user.id]
          );
          if (user.loja_id) {
            await client.query(
              'UPDATE usuarios.lojas SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [passwordHash, user.loja_id]
            );
          }
        } finally {
          client.release();
        }
      } catch (pgErr: any) {
        console.warn('[Auth] Postgres indisponível para sincronizar reset:', pgErr.message);
      }
    } else {
      // Cria conta para lojista existente que definiu a senha via link de convite
      const newAccountId = crypto.randomUUID();
      const newAccount = {
        id: newAccountId,
        email: resetData.email,
        password_hash: passwordHash,
        role: (resetData.role as 'lojista' | 'superadmin') || 'lojista',
        loja_id: resetData.storeId,
        failed_attempts: 0,
        locked_until: null,
        created_at: new Date().toISOString()
      };
      diskStorage.saveAccount(newAccount);

      try {
        const { pool } = await import('../../server/postgres.js');
        const client = await pool.connect();
        try {
          await client.query(
            `INSERT INTO usuarios.contas (id, email, password_hash, role, loja_id, failed_attempts, locked_until)
             VALUES ($1, $2, $3, $4, $5, 0, NULL)
             ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, failed_attempts = 0, locked_until = NULL`,
            [newAccountId, resetData.email, passwordHash, resetData.role || 'lojista', resetData.storeId || null]
          );
          if (resetData.storeId) {
            await client.query(
              'UPDATE usuarios.lojas SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [passwordHash, resetData.storeId]
            );
          }
        } finally {
          client.release();
        }
      } catch (pgErr: any) {
        console.warn('[Auth] Postgres indisponível para criar conta pós-convite:', pgErr.message);
      }
    }

    // Sincroniza nos arquivos de fallback
    if (resetData.role === 'superadmin') {
      const settings = diskStorage.getSettings();
      settings.superAdminPassword = newPassword;
      diskStorage.saveSettings(settings);
    }

    // Invalida todos os tokens associados ao e-mail (garante uso único)
    diskStorage.invalidateUserResetTokens(resetData.email);

    res.json({
      success: true,
      message: 'Senha redefinida com sucesso. Faça login com suas novas credenciais.'
    });
  } catch (err: any) {
    console.error('[Auth] Erro ao redefinir senha:', err);
    res.status(500).json({ error: 'Erro interno ao redefinir senha.' });
  }
});

export default router;
