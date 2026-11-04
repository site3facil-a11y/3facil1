import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authenticateToken, optionalAuthenticateToken, requireStoreOwner } from '../../middlewares/auth.js';
import { validateBody } from '../validation/validate.js';
import { updateStoreSchema } from '../validation/schemas.js';
import { storeRepository } from '../repositories/storeRepository.js';
import { isPostgresAvailable } from '../../../server/postgres.js';
import { diskStorage } from '../../../server/diskStorage.js';
import { AppError } from '../errors/AppError.js';
import { StoreProfile } from '../../types/store.js';
import { sendWelcomeEmail } from '../../../server/emailService.js';
import { findUserByEmail, registerAccount, generateToken } from '../../../server/authService.js';

const router = Router();

/**
 * POST /api/stores
 * Suporta criação pelo Super Admin e cadastro público / auto-registro de novos lojistas.
 */
router.post('/stores', optionalAuthenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawStore: StoreProfile = req.body;
    if (!rawStore || !rawStore.name || !rawStore.slug) {
      throw AppError.badRequest('Nome e slug da loja são obrigatórios.');
    }

    const isSuperAdmin = req.user?.role === 'superadmin';
    const cleanEmail = (rawStore.ownerEmail || rawStore.email || '').toLowerCase().trim();
    const cleanPassword = rawStore.password || '123456';

    // Se NÃO for Super Admin, aplica validação de duplicidade de e-mail
    if (!isSuperAdmin && cleanEmail) {
      const existingUser = await findUserByEmail(cleanEmail);
      if (existingUser) {
        throw AppError.badRequest('Este e-mail já está cadastrado na plataforma. Faça login ou use outro e-mail.');
      }
    }

    const newStoreId = rawStore.id || `store-${crypto.randomUUID()}`;
    const newStore: StoreProfile = {
      ...rawStore,
      id: newStoreId,
      createdAt: rawStore.createdAt || new Date().toISOString(),
      isPublished: true,
      // Se não for Super Admin, garante plano inicial seguro e sem escalonamento
      plan: isSuperAdmin ? (rawStore.plan || 'pro') : 'starter',
      planName: isSuperAdmin ? (rawStore.planName || 'Profissional') : 'Iniciante',
      monthlyFee: isSuperAdmin ? (rawStore.monthlyFee ?? 30.00) : 30.00,
      subscriptionStatus: isSuperAdmin ? (rawStore.subscriptionStatus || 'ativo') : 'trial',
      nextDueDate: rawStore.nextDueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      email: cleanEmail || rawStore.email,
      ownerEmail: cleanEmail || rawStore.ownerEmail,
      ownerName: rawStore.ownerName || rawStore.name,
      password: cleanPassword
    };

    let postgresSaved = false;
    let dbError: string | undefined;

    const pgReady = await isPostgresAvailable();
    if (pgReady) {
      try {
        await storeRepository.updateStore(newStore.id, newStore);
        postgresSaved = true;
      } catch (pgErr: any) {
        dbError = pgErr.message;
        if (process.env.NODE_ENV === 'production' && !isSuperAdmin) {
          throw new AppError(503, 'DB_UNAVAILABLE', 'Banco de dados PostgreSQL indisponível para gravação de loja.');
        }
      }
    } else if (process.env.NODE_ENV === 'production' && isSuperAdmin) {
      dbError = 'PostgreSQL indisponível no momento, gravado em disco local.';
    }

    diskStorage.saveStore(newStore);

    // Criação automática da conta do lojista em usuarios.contas
    let createdAccount: any = null;
    let token: string | undefined;

    if (cleanEmail) {
      try {
        const existing = await findUserByEmail(cleanEmail);
        if (!existing) {
          createdAccount = await registerAccount({
            email: cleanEmail,
            password: cleanPassword,
            role: 'lojista',
            loja_id: newStore.id,
            nome: newStore.ownerName || newStore.name
          });

          // Se for visitante não logado, gera token JWT para sessão imediata
          if (!req.user) {
            token = generateToken({
              sub: createdAccount.id,
              role: 'lojista',
              storeId: newStore.id
            });

            res.cookie('auth_token', token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 7 * 24 * 60 * 60 * 1000
            });
          }
        }
      } catch (accErr) {
        console.warn('[StoreRoutes] Aviso ao registrar conta de usuário para o lojista:', accErr);
      }
    }

    // Dispara e-mail de boas-vindas com confirmação de cadastro e credenciais
    let emailResult = { success: false, message: 'Serviço de e-mail não executado.' };
    try {
      const originUrl = req.get('origin') || process.env.APP_URL || 'https://www.3facil.com';
      emailResult = await sendWelcomeEmail(newStore, originUrl);
    } catch (welcomeErr: any) {
      console.warn('[StoreRoutes] Aviso ao enviar e-mail de boas-vindas da nova loja:', welcomeErr);
      emailResult = { success: false, message: welcomeErr.message || 'Erro ao disparar e-mail.' };
    }

    res.status(201).json({
      success: true,
      store: newStore,
      postgresSaved,
      dbError,
      emailResult,
      token,
      user: createdAccount ? {
        id: createdAccount.id,
        email: createdAccount.email,
        role: createdAccount.role,
        storeId: createdAccount.loja_id
      } : undefined
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/stores/:id
 * Apenas pelo dono da loja ou superadmin.
 * Campos sensíveis (mensalidade, status_assinatura, plano, vencimentos, is_published) só o superadmin altera.
 */
router.put(
  '/stores/:id',
  authenticateToken,
  requireStoreOwner('id'),
  validateBody(updateStoreSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updates = req.body as Partial<StoreProfile>;

      // 1. Verificar se a loja existe
      let existing = diskStorage.getStores().find(s => s.id === id);
      if (!existing) {
        existing = await storeRepository.findById(id);
      }
      if (!existing) {
        throw AppError.notFound('Loja não encontrada.');
      }

      // 2. Proteção de campos sensíveis para lojistas normais
      if (req.user?.role !== 'superadmin') {
        delete (updates as any).mensalidade;
        delete (updates as any).status_assinatura;
        delete (updates as any).plano;
        delete (updates as any).vencimentos;
        delete (updates as any).vencimento_mensalidade;
        delete (updates as any).data_ultimo_pagamento;
        delete (updates as any).is_published;

        updates.monthlyFee = existing.monthlyFee;
        updates.subscriptionStatus = existing.subscriptionStatus;
        updates.plan = existing.plan;
        updates.nextDueDate = existing.nextDueDate;
        updates.lastPaymentDate = existing.lastPaymentDate;
        updates.isPublished = existing.isPublished;
      }

      const merged: StoreProfile = { ...existing, ...updates };

      // 3. PostgreSQL é a fonte da verdade
      const pgReady = await isPostgresAvailable();
      let dbUpdated: StoreProfile | null = null;
      if (pgReady) {
        dbUpdated = await storeRepository.updateStore(id, merged);
      } else if (process.env.NODE_ENV === 'production') {
        throw new AppError(503, 'DB_UNAVAILABLE', 'Banco de dados PostgreSQL indisponível para atualização de loja.');
      }

      diskStorage.saveStore(merged);

      res.json({
        success: true,
        store: dbUpdated || merged
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/stores/:id
 * Apenas pelo dono da loja ou superadmin.
 */
router.delete(
  '/stores/:id',
  authenticateToken,
  requireStoreOwner('id'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      let existing = diskStorage.getStores().find(s => s.id === id);
      if (!existing) {
        existing = await storeRepository.findById(id);
      }
      if (!existing) {
        throw AppError.notFound('Loja não encontrada para exclusão.');
      }

      const pgReady = await isPostgresAvailable();
      if (pgReady) {
        await storeRepository.deleteStore(id);
      } else if (process.env.NODE_ENV === 'production') {
        throw new AppError(503, 'DB_UNAVAILABLE', 'Banco de dados PostgreSQL indisponível para exclusão de loja.');
      }

      diskStorage.deleteStore(id);

      res.json({ success: true, message: 'Loja e todos os seus itens associados foram removidos com sucesso.' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
