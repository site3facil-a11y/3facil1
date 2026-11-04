import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authenticateToken, requireSuperAdmin, requireStoreOwner } from '../../middlewares/auth.js';
import { validateBody } from '../validation/validate.js';
import { createStoreSchema, updateStoreSchema } from '../validation/schemas.js';
import { storeRepository } from '../repositories/storeRepository.js';
import { isPostgresAvailable } from '../../../server/postgres.js';
import { diskStorage, hashTokenSha256 } from '../../../server/diskStorage.js';
import { AppError } from '../errors/AppError.js';
import { StoreProfile } from '../../types/store.js';
import { sendStoreInviteEmail } from '../../../server/emailService.js';

const router = Router();

/**
 * POST /api/stores
 * Restrito estritamente ao Super Admin. Cria uma nova loja e gera convite seguro para o lojista definir sua senha.
 */
router.post(
  '/stores',
  authenticateToken,
  requireSuperAdmin,
  validateBody(createStoreSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawStore = req.body;
      const cleanEmail = (rawStore.ownerEmail || rawStore.email).toLowerCase().trim();

      // O servidor sempre gera o ID da loja — nunca aceita ID do cliente
      const newStoreId = `store-${crypto.randomUUID()}`;
      const newStore: StoreProfile = {
        id: newStoreId,
        name: rawStore.name,
        slug: rawStore.slug,
        type: (rawStore.type.replace(/s$/, '') as any),
        slogan: rawStore.slogan || '',
        description: rawStore.description || '',
        themeColor: rawStore.themeColor || '#2563eb',
        logoUrl: rawStore.logoUrl || null,
        bannerUrl: rawStore.bannerUrl || null,
        whatsapp: rawStore.whatsapp,
        phone: rawStore.phone || rawStore.whatsapp,
        email: rawStore.email.toLowerCase().trim(),
        ownerName: rawStore.ownerName || rawStore.name,
        ownerEmail: cleanEmail,
        ownerPhone: rawStore.ownerPhone || rawStore.whatsapp,
        city: rawStore.city || 'São Paulo',
        state: rawStore.state || 'SP',
        plan: rawStore.plan || 'pro',
        planName: rawStore.planName || 'Profissional',
        monthlyFee: rawStore.monthlyFee ?? 30,
        subscriptionStatus: rawStore.subscriptionStatus || 'ativo',
        nextDueDate: rawStore.nextDueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        isPublished: rawStore.isPublished !== false,
        enableWhatsApp: rawStore.enableWhatsApp !== false,
        enableEmailProposal: rawStore.enableEmailProposal !== false,
        currency: rawStore.currency || 'BRL',
        internalNotes: rawStore.internalNotes || '',
        createdAt: new Date().toISOString()
      };

      const pgReady = await isPostgresAvailable();
      if (pgReady) {
        try {
          await storeRepository.updateStore(newStore.id, newStore);
        } catch (pgErr: any) {
          if (process.env.NODE_ENV === 'production') {
            throw new AppError(503, 'DB_UNAVAILABLE', 'Banco de dados PostgreSQL indisponível para gravação de loja.');
          }
        }
      } else if (process.env.NODE_ENV === 'production') {
        throw new AppError(503, 'DB_UNAVAILABLE', 'Banco de dados PostgreSQL indisponível para gravação de loja.');
      }

      diskStorage.saveStore(newStore);

      // Gera token de convite criptograficamente seguro (SHA-256) para o lojista definir a sua própria senha
      const rawInviteToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashTokenSha256(rawInviteToken);
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

      diskStorage.saveResetToken({
        tokenHash,
        email: cleanEmail,
        role: 'lojista',
        storeId: newStore.id,
        targetName: newStore.ownerName || newStore.name,
        expiresAt
      });

      // Disparo do e-mail de convite em segundo plano
      const originUrl = req.get('origin') || process.env.APP_URL || 'https://www.3facil.com';
      const inviteUrl = `${originUrl}/?token=${rawInviteToken}&reset=true`;

      setImmediate(async () => {
        try {
          const result = await sendStoreInviteEmail(newStore, inviteUrl, originUrl);
          console.log(`[StoreRoutes] E-mail de convite para ${cleanEmail} despachado. Sucesso: ${result.success}`);
        } catch (err: any) {
          console.error(`[StoreRoutes] Falha no disparo de convite para ${newStore.id}:`, err?.message || 'Erro desconhecido');
        }
      });

      res.status(201).json({
        success: true,
        store: newStore,
        emailQueued: true
      });
    } catch (err) {
      next(err);
    }
  }
);

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
