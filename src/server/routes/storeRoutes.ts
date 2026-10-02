import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireSuperAdmin, requireStoreOwner } from '../../middlewares/auth.js';
import { validateBody } from '../validation/validate.js';
import { updateStoreSchema } from '../validation/schemas.js';
import { storeRepository } from '../repositories/storeRepository.js';
import { isPostgresAvailable } from '../../../server/postgres.js';
import { diskStorage } from '../../../server/diskStorage.js';
import { AppError } from '../errors/AppError.js';
import { StoreProfile } from '../../types/store.js';

const router = Router();

/**
 * POST /api/stores
 * Restrito ao Super Admin.
 */
router.post('/stores', authenticateToken, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawStore: StoreProfile = req.body;
    if (!rawStore || !rawStore.name || !rawStore.slug) {
      throw AppError.badRequest('Nome e slug da loja são obrigatórios.');
    }

    const newStore: StoreProfile = {
      ...rawStore,
      id: rawStore.id || `store-${Date.now().toString(36)}`,
      createdAt: rawStore.createdAt || new Date().toISOString(),
      isPublished: rawStore.isPublished !== false
    };

    const pgReady = await isPostgresAvailable();
    if (pgReady) {
      await storeRepository.updateStore(newStore.id, newStore);
    } else if (process.env.NODE_ENV === 'production') {
      throw new AppError(503, 'DB_UNAVAILABLE', 'Banco de dados PostgreSQL indisponível para gravação de loja.');
    }

    diskStorage.saveStore(newStore);

    res.status(201).json({ success: true, store: newStore });
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
