import {
  diskStorage,
  hashTokenSha256,
  EmailVerificationToken,
  PasswordResetToken
} from '../../../server/diskStorage.js';
import { pool, isPostgresAvailable } from '../../../server/postgres.js';

export const tokenRepository = {
  async saveEmailVerificationToken(tokenData: EmailVerificationToken): Promise<void> {
    diskStorage.saveEmailVerificationToken(tokenData);

    if (isPostgresAvailable()) {
      try {
        const cleanEmail = tokenData.email.toLowerCase().trim();
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            'DELETE FROM usuarios.email_verification_tokens WHERE LOWER(TRIM(email)) = $1',
            [cleanEmail]
          );
          await client.query(
            `INSERT INTO usuarios.email_verification_tokens (token_hash, email, store_id, expires_at, used)
             VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), $5)
             ON CONFLICT (token_hash) DO UPDATE SET
               email = EXCLUDED.email,
               store_id = EXCLUDED.store_id,
               expires_at = EXCLUDED.expires_at,
               used = EXCLUDED.used`,
            [
              tokenData.tokenHash,
              cleanEmail,
              tokenData.storeId || null,
              tokenData.expiresAt,
              Boolean(tokenData.used)
            ]
          );
          await client.query('COMMIT');
        } catch (txErr) {
          await client.query('ROLLBACK').catch(() => {});
          throw txErr;
        } finally {
          client.release();
        }
      } catch (err: any) {
        console.warn('[TokenRepository] Aviso ao gravar token de verificação no PostgreSQL:', err?.message);
      }
    }
  },

  async consumeEmailVerificationToken(tokenOrHash: string): Promise<EmailVerificationToken | null> {
    const hash = hashTokenSha256(tokenOrHash);

    if (isPostgresAvailable()) {
      try {
        const client = await pool.connect();
        try {
          // Verifica primeiro se já existe no PG (inclusive se expirado ou já usado) para evitar replay em disco
          const existingRes = await client.query(
            `SELECT token_hash, email, store_id, EXTRACT(EPOCH FROM expires_at) * 1000 AS expires_at_ms, used
             FROM usuarios.email_verification_tokens
             WHERE token_hash = $1 OR token_hash = $2
             LIMIT 1`,
            [hash, tokenOrHash]
          );

          if (existingRes.rows.length > 0) {
            const consumeRes = await client.query(
              `UPDATE usuarios.email_verification_tokens
               SET used = TRUE
               WHERE (token_hash = $1 OR token_hash = $2)
                 AND used = FALSE
                 AND expires_at > NOW()
               RETURNING token_hash, email, store_id, EXTRACT(EPOCH FROM expires_at) * 1000 AS expires_at_ms, used`,
              [hash, tokenOrHash]
            );

            if (consumeRes.rows.length === 0) {
              // Token encontrado no PG porém já utilizado ou expirado
              diskStorage.consumeEmailVerificationToken(tokenOrHash);
              return null;
            }

            const row = consumeRes.rows[0];
            diskStorage.consumeEmailVerificationToken(tokenOrHash);
            return {
              tokenHash: row.token_hash,
              email: row.email,
              storeId: row.store_id || '',
              expiresAt: Number(row.expires_at_ms),
              used: true
            };
          }
        } finally {
          client.release();
        }
      } catch (err: any) {
        console.warn('[TokenRepository] Aviso ao consumir token de verificação no PostgreSQL:', err?.message);
      }
    }

    return diskStorage.consumeEmailVerificationToken(tokenOrHash);
  },

  async saveResetToken(tokenData: PasswordResetToken): Promise<void> {
    diskStorage.saveResetToken(tokenData);

    if (isPostgresAvailable()) {
      try {
        const cleanEmail = tokenData.email.toLowerCase().trim();
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            'DELETE FROM usuarios.password_reset_tokens WHERE LOWER(TRIM(email)) = $1',
            [cleanEmail]
          );
          await client.query(
            `INSERT INTO usuarios.password_reset_tokens (token_hash, email, role, store_id, target_name, expires_at)
             VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0))
             ON CONFLICT (token_hash) DO UPDATE SET
               email = EXCLUDED.email,
               role = EXCLUDED.role,
               store_id = EXCLUDED.store_id,
               target_name = EXCLUDED.target_name,
               expires_at = EXCLUDED.expires_at`,
            [
              tokenData.tokenHash,
              cleanEmail,
              tokenData.role || 'lojista',
              tokenData.storeId || null,
              tokenData.targetName || null,
              tokenData.expiresAt
            ]
          );
          await client.query('COMMIT');
        } catch (txErr) {
          await client.query('ROLLBACK').catch(() => {});
          throw txErr;
        } finally {
          client.release();
        }
      } catch (err: any) {
        console.warn('[TokenRepository] Aviso ao gravar reset token no PostgreSQL:', err?.message);
      }
    }
  },

  async getResetToken(tokenOrHash: string): Promise<PasswordResetToken | null> {
    const hash = hashTokenSha256(tokenOrHash);

    if (isPostgresAvailable()) {
      try {
        const client = await pool.connect();
        try {
          const res = await client.query(
            `SELECT token_hash, email, role, store_id, target_name, EXTRACT(EPOCH FROM expires_at) * 1000 AS expires_at_ms
             FROM usuarios.password_reset_tokens
             WHERE (token_hash = $1 OR token_hash = $2)
               AND expires_at > NOW()
             LIMIT 1`,
            [hash, tokenOrHash]
          );
          if (res.rows.length > 0) {
            const row = res.rows[0];
            return {
              tokenHash: row.token_hash,
              email: row.email,
              role: row.role === 'superadmin' ? 'superadmin' : (row.role === 'lojista' ? 'lojista' : 'store'),
              storeId: row.store_id || undefined,
              targetName: row.target_name || undefined,
              expiresAt: Number(row.expires_at_ms)
            };
          }
        } finally {
          client.release();
        }
      } catch (err: any) {
        console.warn('[TokenRepository] Aviso ao consultar reset token no PostgreSQL:', err?.message);
      }
    }

    return diskStorage.getResetToken(tokenOrHash);
  },

  async invalidateUserTokens(email: string): Promise<void> {
    const cleanEmail = email.toLowerCase().trim();
    diskStorage.invalidateUserResetTokens(cleanEmail);
    const remainingVerifications = diskStorage.getEmailVerificationTokens()
      .filter(t => t.email.toLowerCase().trim() !== cleanEmail);
    diskStorage.saveEmailVerificationTokens(remainingVerifications);

    if (isPostgresAvailable()) {
      try {
        const client = await pool.connect();
        try {
          await client.query(
            'DELETE FROM usuarios.password_reset_tokens WHERE LOWER(TRIM(email)) = $1',
            [cleanEmail]
          );
          await client.query(
            'DELETE FROM usuarios.email_verification_tokens WHERE LOWER(TRIM(email)) = $1',
            [cleanEmail]
          );
        } finally {
          client.release();
        }
      } catch (err: any) {
        console.warn('[TokenRepository] Aviso ao invalidar tokens no PostgreSQL:', err?.message);
      }
    }
  },

  async invalidateUserResetTokens(email: string): Promise<void> {
    const cleanEmail = email.toLowerCase().trim();
    diskStorage.invalidateUserResetTokens(cleanEmail);

    if (isPostgresAvailable()) {
      try {
        const client = await pool.connect();
        try {
          await client.query(
            'DELETE FROM usuarios.password_reset_tokens WHERE LOWER(TRIM(email)) = $1',
            [cleanEmail]
          );
        } finally {
          client.release();
        }
      } catch (err: any) {
        console.warn('[TokenRepository] Aviso ao invalidar reset tokens no PostgreSQL:', err?.message);
      }
    }
  }
};
