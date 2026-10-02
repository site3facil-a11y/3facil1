import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../../middlewares/auth.js';
import { validateBody } from '../validation/validate.js';
import { createItemSchema } from '../validation/schemas.js';
import { itemRepository, SupportedItemType } from '../repositories/itemRepository.js';
import { diskStorage } from '../../../server/diskStorage.js';
import { AppError } from '../errors/AppError.js';
import { StoreItem } from '../../types/store.js';

const router = Router();

/**
 * POST /api/items
 * Criação ou edição de item do catálogo.
 * O item DEVE pertencer a uma loja do usuário autenticado (confere storeId no body).
 */
router.post(
  '/items',
  authenticateToken,
  validateBody(createItemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawItem = req.body as StoreItem;

      // 1. Autorização: lojista só cadastra/edita itens da sua própria loja
      if (req.user?.role !== 'superadmin' && req.user?.storeId !== rawItem.storeId) {
        throw AppError.forbidden('Você não tem permissão para cadastrar ou modificar itens desta loja.');
      }

      const item: StoreItem = {
        ...rawItem,
        id: rawItem.id || `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: rawItem.createdAt || new Date().toISOString()
      };

      // 2. Persistir no PostgreSQL via repositório unificado e fallback em disco
      diskStorage.saveItem(item);
      await itemRepository.upsertItem(item).catch((err) => {
        console.warn('[ItemRepo] Falha ao persistir item no PostgreSQL:', err.message);
      });

      res.status(201).json({ success: true, item });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/items/:id
 * O item DEVE pertencer a uma loja do usuário (confere no registro do banco E disco).
 */
router.delete(
  '/items/:id',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // 1. Localizar o item para checar a loja proprietária
      const diskItem = diskStorage.getItems().find(i => i.id === id);
      const dbItem = await itemRepository.findItemById(id).catch(() => null);

      const targetStoreId = dbItem?.storeId || diskItem?.storeId;
      const targetType = (dbItem?.itemType || diskItem?.itemType || 'produto') as SupportedItemType;

      if (!targetStoreId) {
        throw AppError.notFound('Item não encontrado.');
      }

      // 2. Autorização: superadmin tem acesso total; lojista apenas para a própria loja
      if (req.user?.role !== 'superadmin' && req.user?.storeId !== targetStoreId) {
        throw AppError.forbidden('Acesso negado: este item pertence a outra loja.');
      }

      // 3. Deletar do PostgreSQL especificamente da tabela correta e do disco
      diskStorage.deleteItem(id);
      await itemRepository.deleteItem(id, targetType).catch((err) => {
        console.warn('[ItemRepo] Falha ao deletar item do PostgreSQL:', err.message);
      });

      res.json({ success: true, message: 'Item excluído com sucesso.' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
