import { Router, Request, Response, NextFunction } from 'express';
import { execFile } from 'child_process';
import { authenticateToken, requireSuperAdmin } from '../../middlewares/auth.js';
import { pool, isPostgresAvailable } from '../../../server/postgres.js';
import { diskStorage } from '../../../server/diskStorage.js';
import { AppError } from '../errors/AppError.js';
import { env } from '../config/env.js';

const router = Router();

// Todas as rotas de sistema são exclusivas do Super Admin
router.use(authenticateToken, requireSuperAdmin);

/**
 * GET /api/system/info
 */
router.get('/info', (req: Request, res: Response) => {
  res.json({
    nodeVersion: process.version,
    uptime: Math.floor(process.uptime()),
    platform: process.platform,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    success: true
  });
});

/**
 * GET /api/system/health
 * Retorna contagens detalhadas de todas as tabelas (restrito a superadmin)
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const diskStores = diskStorage.getStores();
    const diskItems = diskStorage.getItems();
    const diskLeads = diskStorage.getLeads();

    const dbAvailable = await isPostgresAvailable();
    if (!dbAvailable) {
      return res.json({
        status: 'warning',
        database: 'Disco Seguro Persistente (database_storage/)',
        connected: false,
        stats: {
          lojas_count: diskStores.length,
          autos_count: diskItems.filter(i => i.itemType === 'veiculo').length,
          imoveis_count: diskItems.filter(i => i.itemType === 'imovel').length,
          produtos_count: diskItems.filter(i => i.itemType === 'produto').length,
          servicos_count: diskItems.filter(i => i.itemType === 'servico').length,
          leads_count: diskLeads.length
        },
        timestamp: new Date().toISOString()
      });
    }

    const client = await pool.connect();
    try {
      const counts = await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM usuarios.lojas) as lojas_count,
          (SELECT COUNT(*) FROM autos.estoque) as autos_count,
          (SELECT COUNT(*) FROM imoveis.catalogo) as imoveis_count,
          (SELECT COUNT(*) FROM loja.produtos) as produtos_count,
          (SELECT COUNT(*) FROM servicos.catalogo) as servicos_count,
          (SELECT COUNT(*) FROM autos.propostas) as autos_leads,
          (SELECT COUNT(*) FROM imoveis.propostas) as imoveis_leads,
          (SELECT COUNT(*) FROM loja.pedidos) as loja_leads,
          (SELECT COUNT(*) FROM servicos.orcamentos) as servicos_leads
      `);

      res.json({
        status: 'online',
        database: 'PostgreSQL 14+ (3facil_db)',
        connected: true,
        schemas: ['usuarios', 'autos', 'imoveis', 'loja', 'servicos'],
        stats: counts.rows[0],
        timestamp: new Date().toISOString()
      });
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/system/update
 * Desabilitado por padrão (exige ENABLE_SELF_UPDATE=true no .env)
 * Usa execFile com argumentos fixos (sem interpolação de shell)
 */
router.post('/update', (req: Request, res: Response, next: NextFunction) => {
  if (env.ENABLE_SELF_UPDATE !== 'true') {
    throw AppError.forbidden('Atualização automática via API desabilitada. Para atualizar, utilize o pipeline de CI/CD ou execute manualmente no servidor.');
  }

  console.log('[System Update] Executando git pull via execFile...');
  execFile('git', ['pull', 'origin', 'main'], { cwd: process.cwd(), timeout: 60000 }, (err, stdout, stderr) => {
    if (err) {
      return next(AppError.internal(`Falha na atualização: ${stderr || err.message}`));
    }

    res.json({
      success: true,
      message: 'Código atualizado com sucesso via Git.',
      output: stdout
    });
  });
});

export default router;
