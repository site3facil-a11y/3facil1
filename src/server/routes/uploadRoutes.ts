import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authenticateToken } from '../../middlewares/auth.js';
import { AppError } from '../errors/AppError.js';

const router = Router();

// Multer configurado em memória com limite de 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Validador de assinaturas binárias (Magic Bytes)
function detectImageExtension(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'png';
  }

  // WebP: RIFF .... WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }

  return null;
}

/**
 * POST /api/uploads
 * Upload seguro de imagens com verificação de magic bytes e autorização por loja
 */
router.post(
  '/uploads',
  authenticateToken,
  (upload.single('image') as any),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isSuper = req.user?.role === 'superadmin';
      const userStoreId = req.user?.storeId;
      const targetStoreId = req.body?.storeId;

      // 1. Autorização: lojista só faz upload na sua própria loja
      if (!isSuper) {
        if (!userStoreId) {
          throw AppError.forbidden('Usuário sem loja vinculada.');
        }
        if (targetStoreId && targetStoreId !== userStoreId) {
          throw AppError.forbidden('Acesso negado: você não tem permissão para enviar arquivos para outra loja.');
        }
      }

      // 2. Validação da presença do arquivo
      if (!req.file || !req.file.buffer) {
        throw AppError.badRequest('Nenhum arquivo de imagem foi enviado no campo "image".');
      }

      // 3. Validação estrita de Magic Bytes (impede uploads de scripts disfarçados)
      const detectedExt = detectImageExtension(req.file.buffer);
      if (!detectedExt) {
        throw AppError.badRequest('Arquivo inválido. Apenas imagens JPEG, PNG ou WebP válidas são aceitas.');
      }

      // 4. Salvar no diretório de uploads do servidor
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const safeFilename = `upload-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${detectedExt}`;
      const targetPath = path.join(uploadsDir, safeFilename);

      // Prevenção extra de Path Traversal
      if (!path.resolve(targetPath).startsWith(path.resolve(uploadsDir) + path.sep)) {
        throw AppError.badRequest('Caminho de arquivo inválido.');
      }

      fs.writeFileSync(targetPath, req.file.buffer);

      const publicUrl = `/uploads/${safeFilename}`;
      res.status(201).json({
        success: true,
        url: publicUrl,
        filename: safeFilename,
        size: req.file.size,
        format: detectedExt
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
