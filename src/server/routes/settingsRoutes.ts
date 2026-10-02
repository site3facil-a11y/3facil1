import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, optionalAuthenticateToken, requireSuperAdmin } from '../../middlewares/auth.js';
import { validateBody } from '../validation/validate.js';
import { updateSettingsSchema } from '../validation/schemas.js';
import { pool, isPostgresAvailable } from '../../../server/postgres.js';
import { diskStorage } from '../../../server/diskStorage.js';
import { DEFAULT_PLATFORM_SETTINGS } from '../../data/demoStores.js';
import { SaaSPlatformSettings } from '../../types/store.js';
import { AppError } from '../errors/AppError.js';

const router = Router();

/**
 * GET /api/settings
 * Retorna configurações gerais da plataforma.
 * Dados financeiros e credenciais são omitidos para não-superadmins.
 */
router.get('/settings', optionalAuthenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let settings = diskStorage.getSettings();

    const dbAvailable = await isPostgresAvailable();
    if (dbAvailable) {
      const client = await pool.connect();
      try {
        const resDb = await client.query('SELECT valor FROM usuarios.configuracoes_gerais WHERE chave = $1', ['platform_settings']);
        if (resDb.rows.length > 0) {
          const val = resDb.rows[0].valor;
          settings = typeof val === 'string' ? JSON.parse(val) : val;
        }
      } finally {
        client.release();
      }
    }

    const safeSettings = { ...(settings || DEFAULT_PLATFORM_SETTINGS) };

    if (req.user?.role !== 'superadmin') {
      delete (safeSettings as any).pixKey;
      delete (safeSettings as any).pixBeneficiary;
      delete (safeSettings as any).superAdminEmail;
      delete (safeSettings as any).superAdminPassword;
    }

    res.json(safeSettings);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/settings
 * Apenas Super Admin pode alterar configurações da plataforma e chave Pix.
 */
router.put(
  '/settings',
  authenticateToken,
  requireSuperAdmin,
  validateBody(updateSettingsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const current = diskStorage.getSettings() || DEFAULT_PLATFORM_SETTINGS;
      const updated: SaaSPlatformSettings = {
        ...current,
        ...req.body
      };

      const dbAvailable = await isPostgresAvailable();
      if (dbAvailable) {
        const client = await pool.connect();
        try {
          await client.query(`
            INSERT INTO usuarios.configuracoes_gerais (id, chave, valor)
            VALUES ('saas_config', 'platform_settings', $1)
            ON CONFLICT (chave) DO UPDATE SET
              valor = EXCLUDED.valor,
              updated_at = CURRENT_TIMESTAMP
          `, [JSON.stringify(updated)]);
        } catch (dbErr: any) {
          throw new AppError(503, 'DB_UNAVAILABLE', 'Falha ao gravar configurações no PostgreSQL.');
        } finally {
          client.release();
        }
      } else if (process.env.NODE_ENV === 'production') {
        throw new AppError(503, 'DB_UNAVAILABLE', 'Banco de dados PostgreSQL indisponível.');
      }

      diskStorage.saveSettings(updated);

      res.json({ success: true, settings: updated });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
