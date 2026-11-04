/**
 * scripts/strip-passwords.ts
 * Remove chaves 'password' em texto de database_storage e de usuarios.lojas no PostgreSQL
 * Suporta --dry-run e backup automático antes da execução
 */

import fs from 'fs';
import path from 'path';

const isDryRun = process.argv.includes('--dry-run');
const storageDir = path.resolve(process.cwd(), 'database_storage');

console.log(`[strip-passwords] Modo: ${isDryRun ? 'DRY-RUN (Nenhuma alteração será persistida)' : 'EXECUÇÃO REAL'}`);

function stripPasswordFromObject(obj: any): { modified: boolean; cleaned: any } {
  if (obj === null || typeof obj !== 'object') {
    return { modified: false, cleaned: obj };
  }

  if (Array.isArray(obj)) {
    let arrayModified = false;
    const cleanedArray = obj.map(item => {
      const res = stripPasswordFromObject(item);
      if (res.modified) arrayModified = true;
      return res.cleaned;
    });
    return { modified: arrayModified, cleaned: cleanedArray };
  }

  let modified = false;
  const cleaned: Record<string, any> = {};

  for (const [key, val] of Object.entries(obj)) {
    if (key.toLowerCase() === 'password') {
      modified = true;
      console.log(`  [Encontrado campo sensível] 'password' removido de registro.`);
      continue; // Remove a chave sensível
    }
    const nestedRes = stripPasswordFromObject(val);
    if (nestedRes.modified) modified = true;
    cleaned[key] = nestedRes.cleaned;
  }

  return { modified, cleaned };
}

async function run() {
  let totalFilesModified = 0;

  // 1. Processar database_storage
  if (fs.existsSync(storageDir)) {
    if (!isDryRun) {
      const backupDir = path.resolve(process.cwd(), `database_storage_backup_${Date.now()}`);
      fs.cpSync(storageDir, backupDir, { recursive: true });
      console.log(`[strip-passwords] Backup criado em: ${backupDir}`);
    }

    const files = fs.readdirSync(storageDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(storageDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(content);
        const { modified, cleaned } = stripPasswordFromObject(json);

        if (modified) {
          totalFilesModified++;
          console.log(`[strip-passwords] Arquivo ${file}: chaves 'password' detectadas.`);
          if (!isDryRun) {
            fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf-8');
            console.log(`[strip-passwords] Arquivo ${file}: atualizado com sucesso.`);
          } else {
            console.log(`[strip-passwords] [DRY-RUN] Arquivo ${file} seria atualizado.`);
          }
        }
      } catch (err: any) {
        console.warn(`[strip-passwords] Aviso ao ler ${file}: ${err.message}`);
      }
    }
  } else {
    console.log('[strip-passwords] Diretório database_storage não encontrado.');
  }

  // 2. Processar PostgreSQL se disponível
  try {
    const { pool, isPostgresAvailable } = await import('../server/postgres.js');
    if (isPostgresAvailable()) {
      const client = await pool.connect();
      try {
        console.log('[strip-passwords] Conectado ao PostgreSQL para sanitização de configuracoes...');
        const res = await client.query('SELECT id, configuracoes FROM usuarios.lojas');
        let pgModified = 0;

        for (const row of res.rows) {
          const config = typeof row.configuracoes === 'string' 
            ? JSON.parse(row.configuracoes) 
            : (row.configuracoes || {});

          if (config && 'password' in config) {
            delete config.password;
            pgModified++;
            if (!isDryRun) {
              await client.query(
                'UPDATE usuarios.lojas SET configuracoes = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [JSON.stringify(config), row.id]
              );
            }
          }
        }
        console.log(`[strip-passwords] PostgreSQL: ${pgModified} lojas com 'password' em configuracoes ${isDryRun ? 'detectadas (dry-run)' : 'sanitizadas'}.`);
      } finally {
        client.release();
      }
    } else {
      console.log('[strip-passwords] PostgreSQL não disponível no momento para sanitização.');
    }
  } catch (pgErr: any) {
    console.log(`[strip-passwords] PostgreSQL ignorado ou indisponível: ${pgErr.message}`);
  }

  console.log(`[strip-passwords] Sanitização concluída. Total de arquivos JSON modificados: ${totalFilesModified}`);
}

run().catch((err) => {
  console.error('[strip-passwords] Erro fatal:', err);
  process.exit(1);
});
