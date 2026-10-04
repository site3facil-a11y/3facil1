import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env.js';

export const configureCors = () => {
  return cors({
    origin: (origin, callback) => {
      const isProd = (process.env.NODE_ENV || env.NODE_ENV) === 'production';
      const allowedOriginsRaw = process.env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS || '';
      const allowed = allowedOriginsRaw.split(',').map(s => s.trim()).filter(Boolean);

      // Permitir requisições sem origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      if (!isProd) {
        return callback(null, true);
      }

      if (allowed.includes('*') || allowed.includes(origin)) {
        return callback(null, true);
      }

      // Origem não permitida em produção: bloqueia CORS omitindo Access-Control-Allow-Origin
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
  });
};

export const configureHelmet = () => {
  return helmet({
    contentSecurityPolicy: false, // Vite SPA gerencia scripts e assets dinamicamente
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hidePoweredBy: true,
    hsts: env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false
  });
};

/**
 * Bloqueia estritamente qualquer tentativa de acesso direto a arquivos de banco ou de configuração
 */
export const protectSensitivePaths = (req: Request, res: Response, next: NextFunction): void => {
  const cleanUrl = req.originalUrl.toLowerCase();
  if (
    cleanUrl.startsWith('/database_storage') ||
    cleanUrl.startsWith('/data/') ||
    cleanUrl.includes('/.env') ||
    cleanUrl.includes('credentials') ||
    cleanUrl.includes('credenciais')
  ) {
    res.status(404).end();
    return;
  }
  next();
};

/**
 * Servidor seguro de mídia estática com prevenção total a Path Traversal
 */
export const createSafeMediaServer = (searchDirs: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const decoded = decodeURIComponent(req.path.replace(/^\/+/, ''));
      if (!decoded || decoded.includes('..')) {
        return next();
      }

      const ext = path.extname(decoded).toLowerCase();
      const baseWithoutExt = ext ? decoded.slice(0, -ext.length) : decoded;
      const extensionsToTry = ext ? [ext, '.webp', '.jpg', '.jpeg', '.png', '.avif'] : ['', '.webp', '.jpg', '.jpeg', '.png'];

      for (const dir of searchDirs) {
        const resolvedDir = path.resolve(dir);

        // 1. Arquivo exato
        const candidateExact = path.resolve(dir, decoded);
        if (candidateExact.startsWith(resolvedDir + path.sep) && fs.existsSync(candidateExact) && fs.statSync(candidateExact).isFile()) {
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.sendFile(candidateExact);
        }

        // 2. Variações de extensão
        for (const testExt of extensionsToTry) {
          const candidateAlt = path.resolve(dir, `${baseWithoutExt}${testExt}`);
          if (candidateAlt.startsWith(resolvedDir + path.sep) && fs.existsSync(candidateAlt) && fs.statSync(candidateAlt).isFile()) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.sendFile(candidateAlt);
          }
        }
      }

      next();
    } catch {
      next();
    }
  };
};
