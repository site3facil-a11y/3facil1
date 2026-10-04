import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../../middlewares/auth.js';
import { validateBody } from '../validation/validate.js';
import { createItemSchema } from '../validation/schemas.js';
import { itemRepository, SupportedItemType } from '../repositories/itemRepository.js';
import { pool, isPostgresAvailable } from '../../../server/postgres.js';
import { diskStorage } from '../../../server/diskStorage.js';
import { AppError } from '../errors/AppError.js';
import { StoreItem } from '../../types/store.js';

const router = Router();

/**
 * POST /api/items
 * Criação ou edição de item do catálogo.
 * O item DEVE pertencer à loja do usuário autenticado.
 * Se o ID já existir, impede apropriação por outra loja.
 */
router.post(
  '/items',
  authenticateToken,
  validateBody(createItemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawItem = req.body as StoreItem;
      const isSuper = req.user?.role === 'superadmin';
      const userStoreId = req.user?.storeId;

      // 1. Se o id foi fornecido, verificar se já existe em outra loja
      if (rawItem.id) {
        const diskItem = diskStorage.getItems().find(i => i.id === rawItem.id);
        const dbItem = await itemRepository.findItemById(rawItem.id).catch(() => null);
        const existingStoreId = dbItem?.storeId || diskItem?.storeId;

        if (existingStoreId) {
          if (!isSuper && existingStoreId !== userStoreId) {
            throw AppError.forbidden('Acesso negado: este item pertence a outra loja.');
          }
          // Nunca permite alterar o storeId de um item existente
          rawItem.storeId = existingStoreId;
        }
      }

      // 2. Se for novo item e o usuário for lojista, valida correspondência exata do storeId
      if (!isSuper) {
        if (!userStoreId) {
          throw AppError.forbidden('Usuário sem loja vinculada.');
        }
        if (rawItem.storeId && rawItem.storeId !== userStoreId) {
          throw AppError.forbidden('Acesso negado: o storeId informado não corresponde à loja do usuário autenticado.');
        }
        rawItem.storeId = userStoreId;
      }

      const item: StoreItem = {
        ...rawItem,
        id: rawItem.id || `item-${crypto.randomUUID()}`,
        createdAt: rawItem.createdAt || new Date().toISOString()
      };

      // 3. PostgreSQL é a fonte da verdade para escritas
      const pgReady = await isPostgresAvailable();
      if (pgReady) {
        try {
          await itemRepository.upsertItem(item);
        } catch (dbErr: any) {
          if (dbErr instanceof AppError) throw dbErr;
          throw new AppError(503, 'DB_UNAVAILABLE', 'Banco de dados PostgreSQL indisponível para gravação de itens.');
        }
      } else if (process.env.NODE_ENV === 'production') {
        throw new AppError(503, 'DB_UNAVAILABLE', 'Banco de dados PostgreSQL indisponível para gravação de itens.');
      }

      // Grava no disco somente após a confirmação da integridade
      diskStorage.saveItem(item);

      res.status(201).json({ success: true, item });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/items/:id
 * Edição explícita de item
 */
router.put(
  '/items/:id',
  authenticateToken,
  validateBody(createItemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const rawItem = req.body as StoreItem;
      const isSuper = req.user?.role === 'superadmin';
      const userStoreId = req.user?.storeId;

      const diskItem = diskStorage.getItems().find(i => i.id === id);
      const dbItem = await itemRepository.findItemById(id).catch(() => null);
      const existingStoreId = dbItem?.storeId || diskItem?.storeId;

      if (!existingStoreId) {
        throw AppError.notFound('Item não encontrado para atualização.');
      }

      if (!isSuper && existingStoreId !== userStoreId) {
        throw AppError.forbidden('Acesso negado: este item pertence a outra loja.');
      }

      const item: StoreItem = {
        ...rawItem,
        id,
        storeId: existingStoreId
      };

      const pgReady = await isPostgresAvailable();
      if (pgReady) {
        await itemRepository.upsertItem(item);
      } else if (process.env.NODE_ENV === 'production') {
        throw new AppError(503, 'DB_UNAVAILABLE', 'Banco de dados PostgreSQL indisponível para atualização de itens.');
      }

      diskStorage.saveItem(item);

      // Apagar arquivos de imagens removidas na edição
      const oldPhotos = ((diskItem as any)?.images || (dbItem?.data as any)?.fotos || []) as string[];
      const newPhotos = (item.images || []) as string[];
      if (Array.isArray(oldPhotos) && Array.isArray(newPhotos)) {
        const removedPhotos = oldPhotos.filter(p => !newPhotos.includes(p));
        const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
        for (const photoUrl of removedPhotos) {
          if (typeof photoUrl === 'string' && photoUrl.startsWith('/uploads/')) {
            const filename = path.basename(photoUrl);
            const filePath = path.join(uploadsDir, filename);
            const thumbPath = path.join(uploadsDir, filename.replace(/\.webp$/, '-thumb.webp'));
            try {
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
              if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
            } catch {}
          }
        }
      }

      res.json({ success: true, item });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/items/:id
 * O item DEVE pertencer a uma loja do usuário autenticado.
 */
router.delete(
  '/items/:id',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const diskItem = diskStorage.getItems().find(i => i.id === id);
      const dbItem = await itemRepository.findItemById(id).catch(() => null);

      const targetStoreId = dbItem?.storeId || diskItem?.storeId;
      const targetType = (dbItem?.itemType || diskItem?.itemType || 'produto') as SupportedItemType;

      if (!targetStoreId) {
        throw AppError.notFound('Item não encontrado.');
      }

      if (req.user?.role !== 'superadmin' && req.user?.storeId !== targetStoreId) {
        throw AppError.forbidden('Acesso negado: este item pertence a outra loja.');
      }

      const pgReady = await isPostgresAvailable();
      if (pgReady) {
        await itemRepository.deleteItem(id, targetType);
      } else if (process.env.NODE_ENV === 'production') {
        throw new AppError(503, 'DB_UNAVAILABLE', 'Banco de dados PostgreSQL indisponível para exclusão de itens.');
      }

      diskStorage.deleteItem(id);

      // Apagar arquivos de imagem associados ao item do disco
      const photosToDelete: string[] = ((diskItem as any)?.images || (dbItem?.data as any)?.fotos || []) as string[];
      if (Array.isArray(photosToDelete)) {
        const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
        for (const photoUrl of photosToDelete) {
          if (typeof photoUrl === 'string' && photoUrl.startsWith('/uploads/')) {
            const filename = path.basename(photoUrl);
            const filePath = path.join(uploadsDir, filename);
            const thumbPath = path.join(uploadsDir, filename.replace(/\.webp$/, '-thumb.webp'));
            try {
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
              if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
            } catch {}
          }
        }
      }

      res.json({ success: true, message: 'Item excluído com sucesso.' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
