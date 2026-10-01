import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, isPostgresAvailable } from './postgres.js';
import { diskStorage, UserAccount } from './diskStorage.js';
import { INITIAL_STORES } from '../src/data/demoStores.js';

const BCRYPT_ROUNDS = 12;

// Dummy hash pré-computado com custo 12 para comparação em tempo constante quando a conta não existir
const DUMMY_HASH = '$2a$12$K12L6U3zPj9w7Qv2N.Hh2.64dF1N2z4M8zG5yT0b4V7k9L3m1O5.u';

export function assertJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    console.error('================================================================================');
    console.error('FATAL: A variável de ambiente JWT_SECRET não foi configurada ou possui menos de 32 caracteres.');
    console.error('Por razões estritas de segurança, o servidor recusa iniciar com segredos fracos ou ausentes.');
    console.error('Configure JWT_SECRET com no mínimo 32 caracteres no seu arquivo .env ou nas variáveis do sistema.');
    console.error('================================================================================');
    process.exit(1);
  }
  return secret.trim();
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function generateToken(payload: { sub: string; role: string; storeId?: string | null }): string {
  const secret = assertJwtSecret();
  return jwt.sign(
    {
      sub: payload.sub,
      userId: payload.sub,
      role: payload.role,
      storeId: payload.storeId || null
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: '8h'
    }
  );
}

// Inicializar e sincronizar super admin e contas demo conforme as regras de auditoria
export async function initAuthAccounts() {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  // 1. Criar/atualizar Super Admin
  if (adminEmail && adminPassword) {
    try {
      const passwordHash = await hashPassword(adminPassword);
      const adminAccount: UserAccount = {
        id: 'superadmin-01',
        email: adminEmail,
        password_hash: passwordHash,
        role: 'superadmin',
        loja_id: null,
        created_at: new Date().toISOString(),
        failed_attempts: 0,
        locked_until: null
      };

      // Salvar em disco
      diskStorage.saveAccount(adminAccount);

      // Salvar em PostgreSQL se disponível
      if (isPostgresAvailable()) {
        try {
          const client = await pool.connect();
          try {
            await client.query(`
              INSERT INTO usuarios.contas (
                id, email, password_hash, role, loja_id, failed_attempts, locked_until
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (email) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                role = EXCLUDED.role,
                failed_attempts = 0,
                locked_until = NULL,
                updated_at = CURRENT_TIMESTAMP
            `, [
              '00000000-0000-0000-0000-000000000001',
              adminEmail,
              passwordHash,
              'superadmin',
              null,
              0,
              null
            ]);
          } finally {
            client.release();
          }
        } catch (dbErr: any) {
          console.warn('[Auth] Aviso ao persistir superadmin no PostgreSQL:', dbErr.message);
        }
      }

      console.log(`[Auth] Super Admin sincronizado com sucesso para: ${adminEmail}`);
    } catch (err: any) {
      console.error('[Auth] Erro ao sincronizar conta super admin:', err.message);
    }
  } else {
    console.warn('[Auth] AVISO: ADMIN_EMAIL e/ou ADMIN_PASSWORD não configurados no ambiente. O super admin não foi criado/atualizado.');
  }

  // 2. Contas demo (apenas quando NODE_ENV !== 'production' e SEED_DEMO=true)
  const isProduction = process.env.NODE_ENV === 'production';
  const shouldSeedDemo = process.env.SEED_DEMO === 'true' || process.env.SEED_DEMO === '1';

  if (!isProduction && shouldSeedDemo) {
    try {
      const demoHash = await hashPassword('admin123');
      const demoAccountsList = [
        { email: 'contato@automotors.com.br', storeId: 'store-veiculos', id: '00000000-0000-0000-0000-000000000010' },
        { email: 'contato@primeimoveis.com.br', storeId: 'store-imoveis', id: '00000000-0000-0000-0000-000000000011' },
        { email: 'contato@techstore.com.br', storeId: 'store-produtos', id: '00000000-0000-0000-0000-000000000012' },
        { email: 'contato@studiodesign.com.br', storeId: 'store-servicos', id: '00000000-0000-0000-0000-000000000013' }
      ];

      for (const item of demoAccountsList) {
        const demoAcc: UserAccount = {
          id: item.id,
          email: item.email,
          password_hash: demoHash,
          role: 'lojista',
          loja_id: item.storeId,
          created_at: new Date().toISOString(),
          failed_attempts: 0,
          locked_until: null
        };
        diskStorage.saveAccount(demoAcc);

        if (isPostgresAvailable()) {
          try {
            const client = await pool.connect();
            try {
              await client.query(`
                INSERT INTO usuarios.contas (
                  id, email, password_hash, role, loja_id, failed_attempts, locked_until
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (email) DO UPDATE SET
                  password_hash = EXCLUDED.password_hash,
                  role = EXCLUDED.role,
                  loja_id = EXCLUDED.loja_id,
                  failed_attempts = 0,
                  locked_until = NULL,
                  updated_at = CURRENT_TIMESTAMP
              `, [
                item.id,
                item.email,
                demoHash,
                'lojista',
                item.storeId,
                0,
                null
              ]);

              // Também atualizar password_hash na tabela de lojas se existir
              await client.query(`
                UPDATE usuarios.lojas SET password_hash = $1 WHERE id = $2
              `, [demoHash, item.storeId]);
            } finally {
              client.release();
            }
          } catch (dbErr: any) {
            // Continua em disco
          }
        }
      }
      console.log('[Auth] Contas demo semeadas com sucesso (NODE_ENV !== production && SEED_DEMO=true).');
    } catch (err: any) {
      console.error('[Auth] Erro ao semear contas demo:', err.message);
    }
  } else {
    console.log('[Auth] Semente de contas demo desativada (Ambiente de produção ou SEED_DEMO desligado).');
  }
}

export async function findUserByEmail(email: string): Promise<UserAccount | null> {
  const cleanEmail = email.toLowerCase().trim();

  // 1. Tentar no PostgreSQL
  if (isPostgresAvailable()) {
    try {
      const client = await pool.connect();
      try {
        const res = await client.query(`
          SELECT id, email, password_hash, role, loja_id, failed_attempts, locked_until, created_at
          FROM usuarios.contas
          WHERE LOWER(TRIM(email)) = $1
          LIMIT 1
        `, [cleanEmail]);

        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            id: row.id,
            email: row.email,
            password_hash: row.password_hash,
            role: row.role,
            loja_id: row.loja_id,
            failed_attempts: row.failed_attempts || 0,
            locked_until: row.locked_until ? new Date(row.locked_until).toISOString() : null,
            created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
          };
        }
      } finally {
        client.release();
      }
    } catch (err: any) {
      // Falha transparente para disco
    }
  }

  // 2. Fallback para disco
  return diskStorage.findAccountByEmail(cleanEmail);
}

export async function findUserById(id: string): Promise<UserAccount | null> {
  if (isPostgresAvailable()) {
    try {
      const client = await pool.connect();
      try {
        const res = await client.query(`
          SELECT id, email, password_hash, role, loja_id, failed_attempts, locked_until, created_at
          FROM usuarios.contas
          WHERE id::text = $1
          LIMIT 1
        `, [id]);

        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            id: row.id,
            email: row.email,
            password_hash: row.password_hash,
            role: row.role,
            loja_id: row.loja_id,
            failed_attempts: row.failed_attempts || 0,
            locked_until: row.locked_until ? new Date(row.locked_until).toISOString() : null,
            created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
          };
        }
      } finally {
        client.release();
      }
    } catch {
      // Fallback
    }
  }
  return diskStorage.findAccountById(id);
}

export async function registerAccount(accountData: {
  email: string;
  password: string;
  role: 'superadmin' | 'lojista';
  loja_id?: string | null;
  nome?: string;
}): Promise<UserAccount> {
  const cleanEmail = accountData.email.toLowerCase().trim();
  const passwordHash = await hashPassword(accountData.password);
  const accountId = crypto.randomUUID();

  const newAccount: UserAccount = {
    id: accountId,
    email: cleanEmail,
    password_hash: passwordHash,
    role: accountData.role,
    loja_id: accountData.loja_id || null,
    created_at: new Date().toISOString(),
    failed_attempts: 0,
    locked_until: null
  };

  diskStorage.saveAccount(newAccount);

  if (isPostgresAvailable()) {
    try {
      const client = await pool.connect();
      try {
        await client.query(`
          INSERT INTO usuarios.contas (
            id, email, password_hash, role, loja_id, failed_attempts, locked_until, nome
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          accountId,
          cleanEmail,
          passwordHash,
          accountData.role,
          accountData.loja_id || null,
          0,
          null,
          accountData.nome || ''
        ]);
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn('[Auth] Aviso ao persistir registro em PostgreSQL:', err.message);
    }
  }

  return newAccount;
}

export async function updateLoginAttempts(userId: string, failedAttempts: number, lockedUntil: Date | null) {
  const lockedUntilStr = lockedUntil ? lockedUntil.toISOString() : null;
  diskStorage.updateAccount(userId, {
    failed_attempts: failedAttempts,
    locked_until: lockedUntilStr
  });

  if (isPostgresAvailable()) {
    try {
      const client = await pool.connect();
      try {
        await client.query(`
          UPDATE usuarios.contas
          SET failed_attempts = $1, locked_until = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id::text = $3
        `, [failedAttempts, lockedUntil, userId]);
      } finally {
        client.release();
      }
    } catch {
      // Ignora erro em PostgreSQL
    }
  }
}

export { DUMMY_HASH };
