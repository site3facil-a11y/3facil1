import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import { authenticateToken } from '../../middlewares/auth.js';
import { diskStorage } from '../../../server/diskStorage.js';
import { itemRepository } from '../repositories/itemRepository.js';
import { AppError } from '../errors/AppError.js';

const router = Router();

export const getUploadsDir = (): string => {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
};

// Multer configurado em memória com limite estrito de 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

/**
 * POST /api/uploads
 * Upload seguro de imagens com recodificação completa via Sharp:
 * - Redimensiona para no máx 1600px no maior lado
 * - Converte obrigatoriamente para WebP (qualidade 80)
 * - Remove integralmente metadados EXIF e GPS
 * - Gera thumbnail de 400px
 * - Valida se a imagem decodifica de forma íntegra
 * - Exige storeId para superadmin; para lojista usa sempre o do token
 * - Impede ultrapassar o limite de 20 fotos por item
 */
router.post(
  '/uploads',
  authenticateToken,
  (upload.single('image') as any),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isSuper = req.user?.role === 'superadmin';
      let targetStoreId: string;

      // 1. Autorização e vínculo da Loja
      if (isSuper) {
        if (!req.body?.storeId || typeof req.body.storeId !== 'string' || !req.body.storeId.trim()) {
          throw AppError.badRequest('O campo "storeId" é obrigatório para administradores ao enviar arquivos.');
        }
        targetStoreId = req.body.storeId.trim();
      } else {
        if (!req.user?.storeId) {
          throw AppError.forbidden('Usuário sem loja vinculada para realização de uploads.');
        }
        // Para lojista, usa SEMPRE o storeId do token e ignora o do corpo
        targetStoreId = req.user.storeId;
      }

      // 2. Validação da presença do arquivo
      if (!req.file || !req.file.buffer) {
        throw AppError.badRequest('Nenhum arquivo de imagem foi enviado no campo "image".');
      }

      // 3. Limite de quantidade por item (máximo 20 fotos)
      const itemId = req.body?.itemId ? String(req.body.itemId).trim() : null;
      if (itemId) {
        const diskItem = diskStorage.getItems().find(i => i.id === itemId);
        const dbItem = await itemRepository.findItemById(itemId).catch(() => null);
        const existingImages = (dbItem?.data?.fotos || diskItem?.images || []) as string[];

        if (Array.isArray(existingImages) && existingImages.length >= 20) {
          throw AppError.badRequest('Limite máximo de 20 fotos por item atingido.');
        }
      }

      // 4. Recodificação com Sharp (previne poliglota PHP, sanitiza e remove EXIF)
      let recodedMainBuffer: Buffer;
      let recodedThumbBuffer: Buffer;
      let imageMetadata: any;

      try {
        const imageInstance = sharp(req.file.buffer);
        imageMetadata = await imageInstance.metadata();

        if (!imageMetadata.format) {
          throw new Error('Formato desconhecido');
        }

        // Recodifica imagem principal (máx 1600px, JPEG q82 progressivo, fundo branco se transparente, sem EXIF)
        recodedMainBuffer = await sharp(req.file.buffer)
          .rotate() // Auto-orienta com base no EXIF antes de descartá-lo
          .flatten({ background: '#ffffff' }) // Garante fundo branco para PNGs/WebPs transparentes em JPG
          .resize(1600, 1600, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 82, progressive: true })
          .toBuffer();

        // Recodifica thumbnail de 400px
        recodedThumbBuffer = await sharp(req.file.buffer)
          .rotate()
          .flatten({ background: '#ffffff' })
          .resize(400, 400, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 75, progressive: true })
          .toBuffer();
      } catch (sharpErr: any) {
        throw new AppError(400, 'INVALID_IMAGE', 'Arquivo inválido ou corrompido. A imagem não pôde ser decodificada.');
      }

      // 5. Salvar no diretório de uploads do servidor
      const uploadsDir = getUploadsDir();
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const fileId = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      const safeFilename = `upload-${fileId}.jpg`;
      const thumbFilename = `upload-${fileId}-thumb.jpg`;

      const targetPath = path.join(uploadsDir, safeFilename);
      const thumbPath = path.join(uploadsDir, thumbFilename);

      // Prevenção extra de Path Traversal
      if (
        !path.resolve(targetPath).startsWith(path.resolve(uploadsDir) + path.sep) ||
        !path.resolve(thumbPath).startsWith(path.resolve(uploadsDir) + path.sep)
      ) {
        throw AppError.badRequest('Caminho de arquivo inválido.');
      }

      fs.writeFileSync(targetPath, recodedMainBuffer);
      fs.writeFileSync(thumbPath, recodedThumbBuffer);

      const publicUrl = `/uploads/${safeFilename}`;
      const publicThumbUrl = `/uploads/${thumbFilename}`;

      res.status(201).json({
        success: true,
        url: publicUrl,
        thumbnailUrl: publicThumbUrl,
        filename: safeFilename,
        thumbnailFilename: thumbFilename,
        storeId: targetStoreId,
        size: recodedMainBuffer.length,
        format: 'jpg'
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/uploads/:filename
 * Exclusão segura de fotos do disco com verificação de autorização e prevenção de path traversal
 */
router.delete(
  '/uploads/:filename',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawFilename = req.params.filename;
      if (!rawFilename || typeof rawFilename !== 'string') {
        throw AppError.badRequest('Nome de arquivo inválido.');
      }

      const filename = path.basename(rawFilename);
      const uploadsDir = getUploadsDir();
      const filePath = path.join(uploadsDir, filename);

      const baseWithoutExt = filename.replace(/\.(webp|jpg|jpeg|png)$/i, '');
      const thumbJpgPath = path.join(uploadsDir, `${baseWithoutExt}-thumb.jpg`);
      const thumbWebpPath = path.join(uploadsDir, `${baseWithoutExt}-thumb.webp`);

      // Prevenção estrita de Path Traversal
      if (!path.resolve(filePath).startsWith(path.resolve(uploadsDir) + path.sep)) {
        throw AppError.badRequest('Caminho de arquivo inválido.');
      }

      if (!fs.existsSync(filePath)) {
        throw AppError.notFound('Arquivo não encontrado no servidor.');
      }

      // Se não for superadmin, verificar se o arquivo pertence a algum item da loja do lojista
      if (req.user?.role !== 'superadmin') {
        const userStoreId = req.user?.storeId;
        const diskItems = diskStorage.getItems();
        const storeOwnsFile = diskItems.some(i => 
          i.storeId === userStoreId && 
          Array.isArray(i.images) && 
          i.images.some(img => typeof img === 'string' && img.includes(filename))
        );
        const store = diskStorage.getStores().find(s => s.id === userStoreId);
        const storeOwnsInProfile = store && (
          (store.logoUrl && store.logoUrl.includes(filename)) ||
          (store.bannerUrl && store.bannerUrl.includes(filename))
        );

        // Se o arquivo foi recém-enviado ou pertence à loja
        if (!storeOwnsFile && !storeOwnsInProfile) {
          // Permite se o arquivo não estiver associado a outra loja
          const belongsToOther = diskItems.some(i => 
            i.storeId !== userStoreId && 
            Array.isArray(i.images) && 
            i.images.some(img => typeof img === 'string' && img.includes(filename))
          );
          if (belongsToOther) {
            throw AppError.forbidden('Acesso negado: este arquivo pertence a outra loja.');
          }
        }
      }

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (fs.existsSync(thumbJpgPath)) {
        try { fs.unlinkSync(thumbJpgPath); } catch {}
      }
      if (fs.existsSync(thumbWebpPath)) {
        try { fs.unlinkSync(thumbWebpPath); } catch {}
      }

      res.json({ success: true, message: 'Foto excluída com sucesso do disco.' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
