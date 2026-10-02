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
import { sendPasswordResetEmail } from '../../server/emailService.js';
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
      // Executa compare para manter tempo constante
      await comparePassword(password, user.password_hash);
      res.status(401).json({ error: 'Credenciais inválidas.' });
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

// POST /api/auth/register
router.post('/register', validateBody(registerSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, storeName, email, password, whatsapp, phone, city, state, type = 'produto' } = req.body;
    const finalName = (name || storeName || 'Minha Loja').trim();
    const cleanEmail = email.toLowerCase().trim();

    const existing = await findUserByEmail(cleanEmail);
    if (existing) {
      res.status(400).json({ error: 'E-mail já cadastrado na plataforma.' });
      return;
    }

    // REGRA DE SEGURANÇA: Registro público cria SEMPRE role 'lojista' e uma loja NOVA exclusiva
    const userRole = 'lojista';
    const newStoreId = `store-${crypto.randomUUID()}`;

    // Cria a nova loja para o lojista
    const newStore: StoreProfile = {
      id: newStoreId,
      name: finalName,
      slug: `${finalName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
      type: (type.replace(/s$/, '') as any) || 'produto',
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
      nextDueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      isPublished: true,
      enableWhatsApp: true,
      enableEmailProposal: true,
      currency: 'BRL',
      createdAt: new Date().toISOString()
    };

    diskStorage.saveStore(newStore);
    await storeRepository.updateStore(newStoreId, newStore).catch(() => {});

    const account = await registerAccount({
      email: cleanEmail,
      password,
      role: userRole,
      loja_id: newStoreId,
      nome: finalName
    });

    const token = generateToken({
      sub: account.id,
      role: userRole,
      storeId: newStoreId
    });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      success: true,
      token,
      accessToken: token,
      user: {
        id: account.id,
        email: account.email,
        role: userRole,
        storeId: newStoreId
      }
    });
  } catch (err: any) {
    console.error('[Auth Route] Erro ao registrar conta:', err);
    res.status(500).json({ error: 'Erro interno ao criar conta.' });
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
    }

    // Sincroniza nos arquivos de fallback
    if (resetData.role === 'superadmin') {
      const settings = diskStorage.getSettings();
      settings.superAdminPassword = newPassword;
      diskStorage.saveSettings(settings);
    } else if (resetData.storeId) {
      const stores = diskStorage.getStores();
      const storeIdx = stores.findIndex(s => s.id === resetData.storeId);
      if (storeIdx >= 0) {
        stores[storeIdx].password = newPassword;
        diskStorage.saveStores(stores);
      }
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
