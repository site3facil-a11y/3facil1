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

/**
 * GET /api/system/accounts
 * Lista todas as contas de usuários e e-mails cadastrados no banco (PostgreSQL / Disco)
 */
router.get('/accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbAvailable = await isPostgresAvailable();

    if (dbAvailable) {
      const client = await pool.connect();
      try {
        const queryRes = await client.query(`
          SELECT 
            c.id,
            c.email,
            COALESCE(c.role, 'lojista') as role,
            COALESCE(c.email_verified, FALSE) as email_verified,
            COALESCE(c.nome, l.owner_name, l.nome, 'Lojista') as nome,
            c.loja_id,
            COALESCE(c.failed_attempts, 0) as failed_attempts,
            c.locked_until,
            c.created_at,
            l.nome as loja_nome,
            l.slug as loja_slug,
            l.tipo as loja_tipo,
            l.whatsapp,
            l.owner_email,
            l.is_published
          FROM usuarios.contas c
          LEFT JOIN usuarios.lojas l ON c.loja_id = l.id
          ORDER BY c.created_at DESC
        `);

        // Busca também lojas que possam ter e-mail mas ainda não têm conta em usuarios.contas
        const existingEmails = new Set(queryRes.rows.map(r => r.email.toLowerCase().trim()));
        const lojasRes = await client.query(`
          SELECT id, nome, slug, tipo, owner_name, owner_email, email, whatsapp, is_published, created_at
          FROM usuarios.lojas
          WHERE (owner_email IS NOT NULL AND owner_email != '') OR (email IS NOT NULL AND email != '')
        `);

        const extraAccounts: any[] = [];
        for (const l of lojasRes.rows) {
          const lEmail = (l.owner_email || l.email || '').toLowerCase().trim();
          if (lEmail && !existingEmails.has(lEmail)) {
            existingEmails.add(lEmail);
            extraAccounts.push({
              id: `store-account-${l.id}`,
              email: lEmail,
              role: 'lojista',
              email_verified: l.is_published !== false,
              nome: l.owner_name || l.nome,
              loja_id: l.id,
              failed_attempts: 0,
              locked_until: null,
              created_at: l.created_at || new Date().toISOString(),
              loja_nome: l.nome,
              loja_slug: l.slug,
              loja_tipo: l.tipo,
              whatsapp: l.whatsapp,
              owner_email: lEmail,
              is_published: l.is_published
            });
          }
        }

        return res.json({
          success: true,
          source: 'PostgreSQL (3facil_db)',
          accounts: [...queryRes.rows, ...extraAccounts]
        });
      } finally {
        client.release();
      }
    }

    // Fallback: Disco Seguro Persistente (database_storage/)
    const diskAccounts = diskStorage.getAccounts();
    const diskStores = diskStorage.getStores();
    const existingEmails = new Set(diskAccounts.map(a => a.email.toLowerCase().trim()));

    const enriched = diskAccounts.map(acc => {
      const store = acc.loja_id ? diskStores.find(s => s.id === acc.loja_id) : undefined;
      return {
        id: acc.id,
        email: acc.email,
        role: acc.role,
        email_verified: acc.email_verified ?? true,
        nome: store?.ownerName || store?.name || (acc.role === 'superadmin' ? 'Administrador Master' : 'Lojista'),
        loja_id: acc.loja_id,
        failed_attempts: acc.failed_attempts || 0,
        locked_until: acc.locked_until,
        created_at: acc.created_at,
        loja_nome: store?.name,
        loja_slug: store?.slug,
        loja_tipo: store?.type,
        whatsapp: store?.whatsapp || store?.ownerPhone,
        owner_email: store?.ownerEmail || store?.email,
        is_published: store?.isPublished
      };
    });

    // Lojas do disco que possam ter e-mail mas não estarem em contas.json
    for (const s of diskStores) {
      const sEmail = (s.ownerEmail || s.email || '').toLowerCase().trim();
      if (sEmail && !existingEmails.has(sEmail)) {
        existingEmails.add(sEmail);
        enriched.push({
          id: `store-account-${s.id}`,
          email: sEmail,
          role: 'lojista',
          email_verified: s.isPublished !== false,
          nome: s.ownerName || s.name,
          loja_id: s.id,
          failed_attempts: 0,
          locked_until: null,
          created_at: s.createdAt || new Date().toISOString(),
          loja_nome: s.name,
          loja_slug: s.slug,
          loja_tipo: s.type,
          whatsapp: s.whatsapp || s.ownerPhone,
          owner_email: sEmail,
          is_published: s.isPublished
        });
      }
    }

    res.json({
      success: true,
      source: 'Disco Persistente (database_storage/)',
      accounts: enriched
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/system/accounts/:id/toggle-verified
 * Alterna manualmente o status de e-mail verificado de uma conta
 */
router.post('/accounts/:id/toggle-verified', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const dbAvailable = await isPostgresAvailable();

    if (dbAvailable) {
      const client = await pool.connect();
      try {
        const updateRes = await client.query(`
          UPDATE usuarios.contas
          SET email_verified = NOT COALESCE(email_verified, FALSE), updated_at = NOW()
          WHERE id = $1
          RETURNING id, email, email_verified, loja_id
        `, [id]);

        if (updateRes.rows.length === 0) {
          throw AppError.notFound('Conta de usuário não encontrada.');
        }

        const account = updateRes.rows[0];

        // Se a conta possui loja e foi verificada, ativa a publicação da loja
        if (account.loja_id && account.email_verified) {
          await client.query(`
            UPDATE usuarios.lojas SET is_published = TRUE WHERE id = $1
          `, [account.loja_id]).catch(() => {});
        }

        return res.json({
          success: true,
          message: `E-mail ${account.email_verified ? 'marcado como verificado' : 'marcado como pendente'}.`,
          account
        });
      } finally {
        client.release();
      }
    }

    // Modo Disco
    const accounts = diskStorage.getAccounts();
    const acc = accounts.find(a => a.id === id);
    if (!acc) {
      throw AppError.notFound('Conta de usuário não encontrada.');
    }

    acc.email_verified = !acc.email_verified;
    diskStorage.saveAccounts(accounts);

    res.json({
      success: true,
      message: `E-mail ${acc.email_verified ? 'marcado como verificado' : 'marcado como pendente'}.`,
      account: acc
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/system/accounts/:id
 * Remove uma conta de acesso do sistema (Super Admin apenas)
 */
router.delete('/accounts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const currentUserId = (req as any).user?.sub;

    if (id === currentUserId) {
      throw AppError.badRequest('Você não pode excluir sua própria conta de Super Administrador em uso.');
    }

    const dbAvailable = await isPostgresAvailable();

    if (dbAvailable) {
      const client = await pool.connect();
      try {
        await client.query('DELETE FROM usuarios.contas WHERE id = $1', [id]);
        return res.json({ success: true, message: 'Conta de acesso removida com sucesso.' });
      } finally {
        client.release();
      }
    }

    // Modo Disco
    const accounts = diskStorage.getAccounts().filter(a => a.id !== id);
    diskStorage.saveAccounts(accounts);

    res.json({ success: true, message: 'Conta de acesso removida com sucesso.' });
  } catch (err) {
    next(err);
  }
});

export default router;
