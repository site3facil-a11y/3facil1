import crypto from 'crypto';
import { diskStorage } from '../server/diskStorage.js';
import { pool, isPostgresAvailable } from '../server/postgres.js';
import { sendPasswordResetEmail } from '../server/emailService.js';

interface InviteStats {
  totalStores: number;
  storesWithAccounts: number;
  invitesNeeded: number;
  invitesSent: number;
  skippedNoEmail: number;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const appUrl = process.env.APP_URL || 'https://www.3facil.com';

  console.log('='.repeat(65));
  console.log('3Fácil - Convite e Definição de Senha para Lojistas Sem Conta');
  console.log('='.repeat(65));
  console.log(`Modo: ${isDryRun ? 'DRY-RUN (Apenas listagem)' : 'EXECUÇÃO REAL (Envio ativo de convites)'}`);
  console.log(`URL Base da Plataforma: ${appUrl}\n`);

  const stats: InviteStats = {
    totalStores: 0,
    storesWithAccounts: 0,
    invitesNeeded: 0,
    invitesSent: 0,
    skippedNoEmail: 0
  };

  // 1. Coletar contas existentes (em disco e PostgreSQL)
  const existingAccounts = diskStorage.getAccounts();
  const accountsByStoreId = new Map<string, string>();
  const accountsByEmail = new Set<string>();

  for (const acc of existingAccounts) {
    if (acc.loja_id) accountsByStoreId.set(acc.loja_id, acc.email);
    if (acc.email) accountsByEmail.add(acc.email.toLowerCase().trim());
  }

  try {
    const pgReady = await isPostgresAvailable();
    if (pgReady) {
      const client = await pool.connect();
      try {
        const res = await client.query('SELECT email, loja_id FROM usuarios.contas');
        for (const row of res.rows) {
          if (row.loja_id) accountsByStoreId.set(row.loja_id, row.email);
          if (row.email) accountsByEmail.add(row.email.toLowerCase().trim());
        }
      } finally {
        client.release();
      }
    }
  } catch (err: any) {
    console.warn('[PostgreSQL] Não foi possível carregar contas do banco:', err.message);
  }

  // 2. Coletar todas as lojas
  const stores = diskStorage.getStores();
  stats.totalStores = stores.length;

  console.log(`[Invites] Total de lojas cadastradas no sistema: ${stores.length}`);
  console.log(`[Invites] Lojas que já possuem conta registrada: ${accountsByStoreId.size}\n`);

  // 3. Processar lojas sem conta
  for (const store of stores) {
    const hasAccountByStoreId = accountsByStoreId.has(store.id);
    const storeEmail = (store.email || store.ownerEmail || '').toLowerCase().trim();
    const hasAccountByEmail = storeEmail ? accountsByEmail.has(storeEmail) : false;

    if (hasAccountByStoreId || hasAccountByEmail) {
      stats.storesWithAccounts++;
      continue;
    }

    stats.invitesNeeded++;

    if (!storeEmail || !storeEmail.includes('@')) {
      console.warn(`[PULADA] Loja "${store.name}" (ID: ${store.id}) não possui e-mail cadastrado.`);
      stats.skippedNoEmail++;
      continue;
    }

    // Gerar token criptográfico único (32 bytes = 64 hex chars)
    const rawToken = crypto.randomBytes(32).toString('hex');
    // Salvar apenas o hash SHA-256 do token
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    // Validade de 24 horas
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    const resetLink = `${appUrl}/?reset-token=${rawToken}`;

    console.log(`-----------------------------------------------------------------`);
    console.log(`Loja: "${store.name}" (ID: ${store.id})`);
    console.log(`E-mail de destino: ${storeEmail}`);
    console.log(`Validade do token: 24 horas`);
    console.log(`Link de definição de senha: ${resetLink}`);

    if (!isDryRun) {
      // Salva no armazenamento de reset de tokens com uso único
      diskStorage.saveResetToken({
        tokenHash,
        email: storeEmail,
        role: 'lojista',
        storeId: store.id,
        expiresAt
      });

      // Dispara o e-mail de convite
      const emailRes = await sendPasswordResetEmail(
        storeEmail,
        resetLink,
        store.name,
        'store'
      );

      console.log(`Status do Envio: ${emailRes.success ? 'ENVIADO' : emailRes.simulated ? 'SIMULADO (SMTP desativado)' : 'FALHA: ' + emailRes.message}`);
      stats.invitesSent++;
    } else {
      console.log(`Status: [DRY-RUN] Simulado (não enviado)`);
    }
  }

  console.log('\n' + '='.repeat(65));
  console.log('Resumo dos Convites:');
  console.log(`- Total de lojas analisadas: ${stats.totalStores}`);
  console.log(`- Lojas com conta existente: ${stats.storesWithAccounts}`);
  console.log(`- Lojas sem conta (convite necessário): ${stats.invitesNeeded}`);
  console.log(`- Convites processados/enviados: ${stats.invitesSent}`);
  console.log(`- Lojas ignoradas (sem e-mail): ${stats.skippedNoEmail}`);
  console.log('='.repeat(65));
}

main().catch(err => {
  console.error('[Fatal Error]:', err);
  process.exit(1);
});
