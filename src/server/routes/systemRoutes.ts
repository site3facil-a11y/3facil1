import { Router, Request, Response, NextFunction } from 'express';
import { execFile } from 'child_process';
import { authenticateToken, requireSuperAdmin } from '../../middlewares/auth.js';
import { pool, isPostgresAvailable } from '../../../server/postgres.js';
import { diskStorage } from '../../../server/diskStorage.js';
import crypto from 'crypto';
import { AppError } from '../errors/AppError.js';
import { env, getTrustedAppUrl } from '../config/env.js';
import { storeRepository } from '../repositories/storeRepository.js';
import { tokenRepository } from '../repositories/tokenRepository.js';
import { findUserById } from '../../../server/authService.js';
import { sendWelcomeEmail } from '../../../server/emailService.js';

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

    if (id.startsWith('store-account-')) {
      const storeId = id.slice('store-account-'.length);

      if (dbAvailable) {
        const client = await pool.connect();
        try {
          const updateRes = await client.query(`
            UPDATE usuarios.lojas
            SET is_published = NOT COALESCE(is_published, TRUE), updated_at = NOW()
            WHERE id = $1
            RETURNING id, COALESCE(owner_email, email) as email, is_published
          `, [storeId]);

          if (updateRes.rows.length === 0) {
            throw AppError.notFound('Loja da conta não encontrada.');
          }

          const row = updateRes.rows[0];
          const diskStores = diskStorage.getStores();
          const diskIdx = diskStores.findIndex(s => s.id === storeId);
          if (diskIdx >= 0) {
            diskStores[diskIdx].isPublished = row.is_published;
            diskStorage.saveStores(diskStores);
          }

          return res.json({
            success: true,
            message: `E-mail ${row.is_published ? 'marcado como verificado' : 'marcado como pendente'}.`,
            account: {
              id,
              email: row.email,
              email_verified: row.is_published,
              loja_id: storeId
            }
          });
        } finally {
          client.release();
        }
      }

      const stores = diskStorage.getStores();
      const store = stores.find(s => s.id === storeId);
      if (!store) {
        throw AppError.notFound('Loja da conta não encontrada.');
      }
      store.isPublished = store.isPublished === false ? true : false;
      diskStorage.saveStores(stores);

      return res.json({
        success: true,
        message: `E-mail ${store.isPublished ? 'marcado como verificado' : 'marcado como pendente'}.`,
        account: {
          id,
          email: store.ownerEmail || store.email,
          email_verified: store.isPublished,
          loja_id: storeId
        }
      });
    }

    if (dbAvailable) {
      const client = await pool.connect();
      try {
        const updateRes = await client.query(`
          UPDATE usuarios.contas
          SET email_verified = NOT COALESCE(email_verified, FALSE), updated_at = NOW()
          WHERE id::text = $1
          RETURNING id::text as id, email, email_verified, loja_id
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

        // Sincronizar com disco se existir
        const diskAcc = diskStorage.findAccountById(id) || diskStorage.findAccountByEmail(account.email);
        if (diskAcc) {
          diskStorage.updateAccount(diskAcc.id, { email_verified: account.email_verified });
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

    if (acc.loja_id && acc.email_verified) {
      const stores = diskStorage.getStores();
      const sIdx = stores.findIndex(s => s.id === acc.loja_id);
      if (sIdx >= 0) {
        stores[sIdx].isPublished = true;
        diskStorage.saveStores(stores);
      }
    }

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
 * Helper reutilizável para exclusão de conta (normal ou store-account-*) em PostgreSQL e Disco
 */
async function deleteSystemAccountById(
  id: string,
  options: { deleteStoreToo: boolean; currentUserId?: string; currentAdminEmail?: string }
): Promise<{ deletedStore: boolean; message: string }> {
  const { deleteStoreToo, currentUserId, currentAdminEmail } = options;

  if (id === currentUserId) {
    throw AppError.badRequest('Você não pode excluir sua própria conta de Super Administrador em uso.');
  }

  const dbAvailable = await isPostgresAvailable();
  let removedAny = false;

  // Caso 1: Conta derivada apenas da loja (store-account-<storeId>)
  if (id.startsWith('store-account-')) {
    const storeId = id.slice('store-account-'.length);
    let storeEmail = '';

    const diskStores = diskStorage.getStores();
    const diskStore = diskStores.find(s => s.id === storeId);
    if (diskStore) {
      storeEmail = (diskStore.ownerEmail || diskStore.email || '').toLowerCase().trim();
    }

    if (dbAvailable) {
      const pgStoreRes = await pool.query(
        'SELECT id, email, owner_email FROM usuarios.lojas WHERE id = $1 LIMIT 1',
        [storeId]
      );
      if (pgStoreRes.rows.length > 0) {
        const r = pgStoreRes.rows[0];
        storeEmail = (r.owner_email || r.email || storeEmail || '').toLowerCase().trim();
        removedAny = true;

        if (deleteStoreToo) {
          await storeRepository.deleteStore(storeId);
        } else {
          const client = await pool.connect();
          try {
            await client.query(`
              UPDATE usuarios.lojas
              SET email = NULL,
                  owner_email = NULL,
                  password_hash = NULL,
                  configuracoes = COALESCE(configuracoes, '{}'::jsonb) || '{"email":"","ownerEmail":""}'::jsonb,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
            `, [storeId]);
            if (storeEmail) {
              await client.query(
                'DELETE FROM usuarios.contas WHERE LOWER(TRIM(email)) = $1 AND id::text != $2',
                [storeEmail, currentUserId || '']
              );
            }
          } finally {
            client.release();
          }
        }
      }
    }

    // Sincroniza disco
    if (diskStore) {
      removedAny = true;
      if (deleteStoreToo) {
        diskStorage.deleteStore(storeId);
      } else {
        diskStorage.saveStore({
          ...diskStore,
          email: '',
          ownerEmail: ''
        });
      }
    }

    const filteredDiskAccounts = diskStorage.getAccounts().filter(a => {
      const matchStore = a.loja_id === storeId;
      const matchEmail = storeEmail && a.email.toLowerCase().trim() === storeEmail;
      if (matchStore || matchEmail) {
        removedAny = true;
        return false;
      }
      return true;
    });
    diskStorage.saveAccounts(filteredDiskAccounts);

    if (storeEmail) {
      await tokenRepository.invalidateUserTokens(storeEmail);
    }

    if (!removedAny) {
      throw AppError.notFound('Conta ou loja vinculada não encontrada.');
    }

    return {
      deletedStore: Boolean(deleteStoreToo),
      message: deleteStoreToo
        ? 'Conta, e-mail e loja vinculada removidos com sucesso.'
        : 'E-mail e acesso da loja removidos da listagem com sucesso.'
    };
  }

  // Caso 2: Conta registrada em usuarios.contas / contas.json
  const diskAccount = diskStorage.findAccountById(id);
  let targetEmail = diskAccount?.email?.toLowerCase().trim() || '';
  let targetStoreId = diskAccount?.loja_id || null;
  let targetRole = diskAccount?.role || null;

  if (dbAvailable) {
    const lookupRes = await pool.query(
      'SELECT id::text as id, email, role, loja_id FROM usuarios.contas WHERE id::text = $1 LIMIT 1',
      [id]
    );

    let pgAcc = lookupRes.rows[0];
    if (!pgAcc && targetEmail) {
      const byEmailRes = await pool.query(
        'SELECT id::text as id, email, role, loja_id FROM usuarios.contas WHERE LOWER(TRIM(email)) = $1 LIMIT 1',
        [targetEmail]
      );
      pgAcc = byEmailRes.rows[0];
    }

    if (pgAcc) {
      targetEmail = (pgAcc.email || targetEmail).toLowerCase().trim();
      targetStoreId = pgAcc.loja_id || targetStoreId;
      targetRole = pgAcc.role || targetRole;
    }

    if (
      (pgAcc && pgAcc.id === currentUserId) ||
      (targetEmail && currentAdminEmail && targetEmail === currentAdminEmail) ||
      (targetRole === 'superadmin' && currentAdminEmail && targetEmail === currentAdminEmail)
    ) {
      throw AppError.badRequest('Você não pode excluir sua própria conta de Super Administrador em uso.');
    }

    const client = await pool.connect();
    try {
      const contaIdColRes = await client.query(`
        SELECT is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'usuarios'
          AND table_name = 'lojas'
          AND column_name = 'conta_id'
        LIMIT 1
      `);

      if (contaIdColRes.rows.length > 0) {
        if (contaIdColRes.rows[0].is_nullable === 'NO') {
          await client.query('ALTER TABLE usuarios.lojas ALTER COLUMN conta_id DROP NOT NULL');
        }
        await client.query(
          'UPDATE usuarios.lojas SET conta_id = NULL WHERE conta_id::text = $1',
          [pgAcc?.id || id]
        );
      }

      if (targetStoreId && !deleteStoreToo) {
        await client.query(`
          UPDATE usuarios.lojas
          SET email = NULL,
              owner_email = NULL,
              password_hash = NULL,
              configuracoes = COALESCE(configuracoes, '{}'::jsonb) || '{"email":"","ownerEmail":""}'::jsonb,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [targetStoreId]);
      }

      const delRes = await client.query(
        'DELETE FROM usuarios.contas WHERE id::text = $1',
        [pgAcc?.id || id]
      );
      if ((delRes.rowCount || 0) > 0) {
        removedAny = true;
      }
    } finally {
      client.release();
    }

    if (targetStoreId && deleteStoreToo) {
      await storeRepository.deleteStore(targetStoreId);
      removedAny = true;
    }
  } else {
    if (
      (targetEmail && currentAdminEmail && targetEmail === currentAdminEmail) ||
      (targetRole === 'superadmin' && currentAdminEmail && targetEmail === currentAdminEmail)
    ) {
      throw AppError.badRequest('Você não pode excluir sua própria conta de Super Administrador em uso.');
    }
  }

  // Sincronizar sempre com o armazenamento em disco
  const beforeCount = diskStorage.getAccounts().length;
  const remainingDiskAccounts = diskStorage.getAccounts().filter(a => {
    const matchId = a.id === id;
    const matchEmail = targetEmail && a.email.toLowerCase().trim() === targetEmail;
    return !matchId && !matchEmail;
  });
  if (remainingDiskAccounts.length !== beforeCount) {
    removedAny = true;
  }
  diskStorage.saveAccounts(remainingDiskAccounts);

  if (targetEmail) {
    await tokenRepository.invalidateUserTokens(targetEmail);
  }

  if (targetStoreId) {
    const diskStore = diskStorage.findStoreById(targetStoreId);
    if (diskStore) {
      removedAny = true;
      if (deleteStoreToo) {
        diskStorage.deleteStore(targetStoreId);
      } else {
        diskStorage.saveStore({
          ...diskStore,
          email: '',
          ownerEmail: ''
        });
      }
    }
  }

  if (!removedAny) {
    throw AppError.notFound('Conta de usuário não encontrada.');
  }

  return {
    deletedStore: Boolean(deleteStoreToo),
    message: deleteStoreToo
      ? 'Conta de acesso e loja vinculada removidas com sucesso.'
      : 'Conta de acesso removida com sucesso.'
  };
}

/**
 * POST /api/system/accounts/:id/resend-verification
 * Reenvia link de confirmação de cadastro para uma conta/loja pendente (Super Admin apenas)
 */
router.post('/accounts/:id/resend-verification', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const dbAvailable = await isPostgresAvailable();

    let cleanEmail = '';
    let storeId: string | null = null;
    let storeObj: any = null;

    if (id.startsWith('store-account-')) {
      storeId = id.slice('store-account-'.length);
    } else if (dbAvailable) {
      const accRes = await pool.query(
        'SELECT email, loja_id FROM usuarios.contas WHERE id::text = $1 LIMIT 1',
        [id]
      );
      if (accRes.rows.length > 0) {
        cleanEmail = (accRes.rows[0].email || '').toLowerCase().trim();
        storeId = accRes.rows[0].loja_id || null;
      }
    }

    if (!cleanEmail && !id.startsWith('store-account-')) {
      const diskAcc = diskStorage.findAccountById(id);
      if (diskAcc) {
        cleanEmail = (diskAcc.email || '').toLowerCase().trim();
        storeId = diskAcc.loja_id || storeId;
      }
    }

    if (storeId) {
      if (dbAvailable) {
        storeObj = await storeRepository.findById(storeId).catch(() => null);
      }
      if (!storeObj) {
        storeObj = diskStorage.findStoreById(storeId);
      }
      if (storeObj && !cleanEmail) {
        cleanEmail = (storeObj.ownerEmail || storeObj.email || '').toLowerCase().trim();
      }
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw AppError.badRequest('Esta conta não possui um endereço de e-mail válido cadastrado.');
    }

    if (!storeObj) {
      throw AppError.badRequest('Não há loja vinculada a esta conta para gerar link de confirmação.');
    }

    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
    const verificationExpiresAt = Date.now() + 24 * 60 * 60 * 1000;

    await tokenRepository.saveEmailVerificationToken({
      tokenHash: verificationTokenHash,
      email: cleanEmail,
      storeId: storeObj.id,
      expiresAt: verificationExpiresAt,
      used: false
    });

    const appUrl = getTrustedAppUrl();
    const verificationUrl = `${appUrl}/api/auth/verify-email?token=${rawVerificationToken}`;
    const emailResult = await sendWelcomeEmail({ ...storeObj, email: cleanEmail, ownerEmail: cleanEmail }, verificationUrl, appUrl);

    if (emailResult?.success && !emailResult?.simulated) {
      return res.json({
        success: true,
        sent: true,
        simulated: false,
        message: `Link de confirmação reenviado com sucesso para ${cleanEmail}.`
      });
    }

    if (emailResult?.simulated) {
      return res.json({
        success: false,
        sent: false,
        simulated: true,
        message: `Envio simulado (SMTP/Resend não configurado): ${emailResult.message}`
      });
    }

    return res.status(502).json({
      success: false,
      sent: false,
      simulated: false,
      error: emailResult?.message || 'Falha ao disparar e-mail de confirmação.'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/system/accounts/bulk-delete
 * Remove múltiplas contas selecionadas em lote (Super Admin apenas)
 */
router.post('/accounts/bulk-delete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids, deleteStore } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      throw AppError.badRequest('Selecione pelo menos uma conta para excluir.');
    }
    if (ids.length > 100) {
      throw AppError.badRequest('Limite máximo de 100 contas por exclusão em lote.');
    }

    const deleteStoreToo = Boolean(deleteStore);
    const currentUserId = (req as any).user?.sub || (req as any).user?.userId;
    const currentAdmin = currentUserId ? await findUserById(currentUserId).catch(() => null) : null;
    const currentAdminEmail = currentAdmin?.email?.toLowerCase().trim();

    const deletedIds: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    for (const rawId of ids) {
      const id = String(rawId || '').trim();
      if (!id) continue;
      try {
        await deleteSystemAccountById(id, {
          deleteStoreToo,
          currentUserId,
          currentAdminEmail
        });
        deletedIds.push(id);
      } catch (err: any) {
        failed.push({ id, reason: err?.message || 'Falha ao excluir conta.' });
      }
    }

    if (deletedIds.length === 0 && failed.length > 0) {
      throw AppError.badRequest(failed[0].reason);
    }

    res.json({
      success: true,
      deletedCount: deletedIds.length,
      deletedIds,
      deletedStore: deleteStoreToo,
      failed,
      message: `${deletedIds.length} conta(s) removida(s) com sucesso${failed.length > 0 ? ` (${failed.length} não removida(s))` : ''}.`
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/system/accounts/:id
 * Remove uma conta de acesso do sistema (PostgreSQL + Disco) e opcionalmente a loja vinculada.
 * Query/Body: deleteStore=true para remover também a loja e anúncios vinculados.
 */
router.delete('/accounts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deleteStoreToo = req.query.deleteStore === 'true' || req.body?.deleteStore === true;
    const currentUserId = (req as any).user?.sub || (req as any).user?.userId;
    const currentAdmin = currentUserId ? await findUserById(currentUserId).catch(() => null) : null;
    const currentAdminEmail = currentAdmin?.email?.toLowerCase().trim();

    const result = await deleteSystemAccountById(id, {
      deleteStoreToo,
      currentUserId,
      currentAdminEmail
    });

    res.json({
      success: true,
      deletedStore: result.deletedStore,
      message: result.message
    });
  } catch (err) {
    next(err);
  }
});

export default router;
