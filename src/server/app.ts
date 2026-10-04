import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';

// Middlewares de Segurança
import { configureCors, configureHelmet, protectSensitivePaths, createSafeMediaServer } from './middlewares/security.js';
import { globalLimiter, authLimiter } from './middlewares/rateLimiters.js';
import { errorHandler } from './middlewares/errorHandler.js';

// Rotas Modulares
import authRoutes from '../routes/auth.js';
import publicRoutes from './routes/publicRoutes.js';
import bootstrapRoutes from './routes/bootstrapRoutes.js';
import storeRoutes from './routes/storeRoutes.js';
import itemRoutes from './routes/itemRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';

export function createApp(): Express {
  const app = express();

  // 1. Configurações fundamentais de infraestrutura
  app.set('trust proxy', 1);

  // 2. Proteção de Cabeçalhos HTTP com Helmet
  app.use(configureHelmet());

  // 3. CORS parametrizado
  app.use(configureCors());

  // 4. Parser de Cookies (para autenticação httpOnly + SameSite)
  app.use(cookieParser());

  // 5. Limite seguro de JSON (1MB máximo para mitigar ataques DoS)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 6. Bloqueio rigoroso de caminhos sensíveis (/database_storage, /.env, etc.)
  app.use(protectSensitivePaths);

  // 7. Rate Limiter Global para a API
  app.use('/api', globalLimiter);

  // 8. Montagem das Rotas da API
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api', publicRoutes); // /api/health
  app.use('/api', bootstrapRoutes); // /api/bootstrap
  app.use('/api', storeRoutes);
  app.use('/api', itemRoutes);
  app.use('/api', leadRoutes);
  app.use('/api', settingsRoutes);
  app.use('/api', uploadRoutes);
  app.use('/api/email', emailRoutes);
  app.use('/api/system', systemRoutes);

  // 9. Servidor seguro de mídia estática com prevenção de Directory Traversal
  const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
  const uploadsImoveisDir = path.join(process.cwd(), 'uploads_imoveis');

  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(uploadsImoveisDir)) fs.mkdirSync(uploadsImoveisDir, { recursive: true });

  const safeMediaServer = createSafeMediaServer([uploadsImoveisDir, uploadsDir]);
  app.use('/uploads_imoveis', safeMediaServer);
  app.use('/uploads/imoveis', safeMediaServer);
  app.use('/uploads/fotos', safeMediaServer);
  app.use('/uploads', safeMediaServer);

  // Retorno estrito de 404 para arquivos inexistentes em /uploads (nunca 200 de SPA)
  app.use(['/uploads', '/uploads_imoveis'], (req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Arquivo não encontrado.' } });
  });

  // 10. Middleware Global de Tratamento de Erros
  app.use(errorHandler);

  return app;
}
