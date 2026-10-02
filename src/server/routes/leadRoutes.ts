import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../../middlewares/auth.js';
import { leadLimiter } from '../middlewares/rateLimiters.js';
import { validateBody } from '../validation/validate.js';
import { createLeadSchema, updateLeadStatusSchema } from '../validation/schemas.js';
import { leadRepository, SupportedLeadType } from '../repositories/leadRepository.js';
import { diskStorage } from '../../../server/diskStorage.js';
import { AppError } from '../errors/AppError.js';
import { ProposalLead } from '../../types/store.js';

const router = Router();

/**
 * POST /api/leads
 * Público com rate limit próprio e validação rigorosa (cliente enviando proposta do catálogo).
 */
router.post(
  '/leads',
  leadLimiter,
  validateBody(createLeadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawLead = req.body as ProposalLead;

      // 1. Validar se a loja existe
      const cleanStoreId = rawLead.storeId.trim();
      const storeExists = diskStorage.getStores().some(s => s.id === cleanStoreId);
      if (!storeExists) {
        throw AppError.notFound('A loja destinatária informada não foi encontrada.');
      }

      // 2. Sanitizar campos
      const lead: ProposalLead = {
        ...rawLead,
        id: rawLead.id || `lead-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        storeId: cleanStoreId,
        clientName: rawLead.clientName.trim(),
        clientPhone: rawLead.clientPhone.trim(),
        clientEmail: rawLead.clientEmail ? rawLead.clientEmail.trim().toLowerCase() : '',
        itemTitle: rawLead.itemTitle ? rawLead.itemTitle.trim().slice(0, 200) : 'Interesse no Anúncio',
        clientMessage: rawLead.clientMessage ? rawLead.clientMessage.trim().slice(0, 2000) : '',
        status: 'novo',
        createdAt: rawLead.createdAt || new Date().toISOString()
      };

      // 3. Persistir
      diskStorage.saveLead(lead);
      await leadRepository.createLead(lead).catch((err) => {
        console.warn('[LeadRepo] Falha ao persistir lead no PostgreSQL:', err.message);
      });

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

      // 1. Identificar a loja do lead
      const diskLead = diskStorage.getLeads().find(l => l.id === id);
      const dbLead = await leadRepository.findLeadById(id).catch(() => null);

      const targetStoreId = dbLead?.storeId || diskLead?.storeId;
      const targetType = (dbLead?.itemType || diskLead?.itemType) as SupportedLeadType | undefined;

      if (!targetStoreId) {
        throw AppError.notFound('Lead não encontrado.');
      }

      // 2. Autorização
      if (req.user?.role !== 'superadmin' && req.user?.storeId !== targetStoreId) {
        throw AppError.forbidden('Acesso negado: este lead pertence a outra loja.');
      }

      // 3. Atualizar status
      diskStorage.updateLeadStatus(id, status);
      await leadRepository.updateLeadStatus(id, status, targetType).catch((err) => {
        console.warn('[LeadRepo] Falha ao atualizar lead no PostgreSQL:', err.message);
      });

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

      diskStorage.deleteLead(id);
      await leadRepository.deleteLead(id, targetType).catch((err) => {
        console.warn('[LeadRepo] Falha ao deletar lead do PostgreSQL:', err.message);
      });

      res.json({ success: true, message: 'Lead excluído com sucesso.' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
