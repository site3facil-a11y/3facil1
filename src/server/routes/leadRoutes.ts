import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authenticateToken } from '../../middlewares/auth.js';
import { leadLimiter } from '../middlewares/rateLimiters.js';
import { validateBody } from '../validation/validate.js';
import { createLeadSchema, updateLeadStatusSchema } from '../validation/schemas.js';
import { leadRepository, SupportedLeadType } from '../repositories/leadRepository.js';
import { itemRepository } from '../repositories/itemRepository.js';
import { storeRepository } from '../repositories/storeRepository.js';
import { isPostgresAvailable } from '../../../server/postgres.js';
import { diskStorage } from '../../../server/diskStorage.js';
import { AppError } from '../errors/AppError.js';
import { ProposalLead } from '../../types/store.js';

const router = Router();

/**
 * POST /api/leads
 * Público com rate limit próprio e validação rigorosa (cliente enviando proposta do catálogo).
 * - O cliente NUNCA escolhe o ID (sempre gerado no servidor)
 * - Valida se a loja existe
 * - Se itemId for enviado, valida se o item pertence de fato à loja informada
 */
router.post(
  '/leads',
  leadLimiter,
  validateBody(createLeadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawLead = req.body as ProposalLead;
      const cleanStoreId = rawLead.storeId.trim();

      // 1. Validar se a loja existe
      const pgReady = await isPostgresAvailable();
      let storeExists = false;

      if (pgReady) {
        const dbStore = await storeRepository.findById(cleanStoreId).catch(() => null);
        storeExists = Boolean(dbStore);
      } else {
        storeExists = diskStorage.getStores().some(s => s.id === cleanStoreId);
      }

      if (!storeExists) {
        throw AppError.notFound('A loja destinatária informada não foi encontrada.');
      }

      // 2. Se itemId foi enviado, validar se o item pertence a esta loja
      if (rawLead.itemId) {
        const cleanItemId = rawLead.itemId.trim();
        let itemStoreId: string | undefined;

        if (pgReady) {
          const dbItem = await itemRepository.findItemById(cleanItemId).catch(() => null);
          itemStoreId = dbItem?.storeId;
        } else {
          const diskItem = diskStorage.getItems().find(i => i.id === cleanItemId);
          itemStoreId = diskItem?.storeId;
        }

        if (!itemStoreId || itemStoreId !== cleanStoreId) {
          throw AppError.badRequest('O item informado não pertence à loja indicada.');
        }
      }

      // 3. Gerar SEMPRE ID novo no servidor (impede overwrite de leads existentes)
      const leadId = `lead-${crypto.randomUUID()}`;

      const lead: ProposalLead = {
        ...rawLead,
        id: leadId,
        storeId: cleanStoreId,
        clientName: rawLead.clientName.trim(),
        clientPhone: rawLead.clientPhone.trim(),
        clientEmail: rawLead.clientEmail ? rawLead.clientEmail.trim().toLowerCase() : '',
        itemTitle: rawLead.itemTitle ? rawLead.itemTitle.trim().slice(0, 200) : 'Interesse no Anúncio',
        clientMessage: rawLead.clientMessage ? rawLead.clientMessage.trim().slice(0, 2000) : '',
        status: 'novo',
        createdAt: new Date().toISOString()
      };

      // 4. PostgreSQL é a fonte da verdade
      if (pgReady) {
        await leadRepository.createLead(lead);
      } else if (process.env.NODE_ENV === 'production') {
        throw new AppError(503, 'DB_UNAVAILABLE', 'Banco de dados PostgreSQL indisponível para registro de propostas.');
      }

      // Salva no disco apenas após confirmação
      diskStorage.saveLead(lead);

      res.status(201).json({ success: true, lead });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/leads
 * Autenticado: Lojista vê apenas da sua loja, superadmin vê todos.
 */
router.get('/leads', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allLeads = diskStorage.getLeads();
    if (req.user?.role === 'superadmin') {
      return res.json(allLeads);
    }
    if (req.user?.role === 'lojista' && req.user?.storeId) {
      return res.json(allLeads.filter(l => l.storeId === req.user?.storeId));
    }
    throw AppError.forbidden('Acesso negado aos leads.');
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/leads/:id
 * Autenticado: apenas o dono da loja do lead ou superadmin.
 */
router.put(
  '/leads/:id',
  authenticateToken,
  validateBody(updateLeadStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const diskLead = diskStorage.getLeads().find(l => l.id === id);
      const dbLead = await leadRepository.findLeadById(id).catch(() => null);

      const targetStoreId = dbLead?.storeId || diskLead?.storeId;
      const targetType = (dbLead?.itemType || diskLead?.itemType) as SupportedLeadType | undefined;

      if (!targetStoreId) {
        throw AppError.notFound('Lead não encontrado.');
      }

      if (req.user?.role !== 'superadmin' && req.user?.storeId !== targetStoreId) {
        throw AppError.forbidden('Acesso negado: este lead pertence a outra loja.');
      }

      const pgReady = await isPostgresAvailable();
      if (pgReady) {
        await leadRepository.updateLeadStatus(id, status, targetType);
      } else if (process.env.NODE_ENV === 'production') {
        throw new AppError(503, 'DB_UNAVAILABLE', 'Banco de dados PostgreSQL indisponível para atualização de lead.');
      }

      diskStorage.updateLeadStatus(id, status);

      res.json({ success: true, message: 'Status do lead atualizado com sucesso.' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/leads/:id
 * Autenticado: apenas o dono da loja do lead ou superadmin.
 */
router.delete(
  '/leads/:id',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const diskLead = diskStorage.getLeads().find(l => l.id === id);
      const dbLead = await leadRepository.findLeadById(id).catch(() => null);

      const targetStoreId = dbLead?.storeId || diskLead?.storeId;
      const targetType = (dbLead?.itemType || diskLead?.itemType) as SupportedLeadType | undefined;

      if (!targetStoreId) {
        throw AppError.notFound('Lead não encontrado.');
      }

      if (req.user?.role !== 'superadmin' && req.user?.storeId !== targetStoreId) {
        throw AppError.forbidden('Acesso negado: este lead pertence a outra loja.');
      }

      const pgReady = await isPostgresAvailable();
      if (pgReady) {
        await leadRepository.deleteLead(id, targetType);
      } else if (process.env.NODE_ENV === 'production') {
        throw new AppError(503, 'DB_UNAVAILABLE', 'Banco de dados PostgreSQL indisponível para exclusão de lead.');
      }

      diskStorage.deleteLead(id);

      res.json({ success: true, message: 'Lead excluído com sucesso.' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
