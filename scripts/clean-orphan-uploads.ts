import fs from 'fs';
import path from 'path';
import { diskStorage } from '../server/diskStorage.js';
import { pool, isPostgresAvailable } from '../server/postgres.js';

async function getAllReferencedImages(): Promise<Set<string>> {
  const referenced = new Set<string>();

  // 1. Coletar do disco
  const diskItems = diskStorage.getItems();
  for (const item of diskItems) {
    if (Array.isArray(item.images)) {
      for (const img of item.images) {
        if (typeof img === 'string') {
          referenced.add(path.basename(img));
        }
      }
    }
  }

  const diskStores = diskStorage.getStores();
  for (const store of diskStores) {
    if (store.logoUrl) referenced.add(path.basename(store.logoUrl));
    if (store.bannerUrl) referenced.add(path.basename(store.bannerUrl));
  }

  // 2. Coletar do PostgreSQL se disponível
  try {
    const pgReady = await isPostgresAvailable();
    if (pgReady) {
      const client = await pool.connect();
      try {
        const queries = [
          'SELECT fotos FROM autos.estoque',
          'SELECT fotos FROM imoveis.catalogo',
          'SELECT fotos FROM loja.produtos',
          'SELECT fotos FROM servicos.catalogo',
          'SELECT logo_url, banner_url FROM usuarios.lojas'
        ];
        for (const q of queries) {
          const res = await client.query(q);
          for (const row of res.rows) {
            if (row.fotos) {
              const fotos = typeof row.fotos === 'string' ? JSON.parse(row.fotos) : row.fotos;
              if (Array.isArray(fotos)) {
                for (const f of fotos) {
                  if (typeof f === 'string') referenced.add(path.basename(f));
                }
              }
            }
            if (row.logo_url) referenced.add(path.basename(row.logo_url));
            if (row.banner_url) referenced.add(path.basename(row.banner_url));
          }
        }
      } finally {
        client.release();
      }
    }
  } catch (err: any) {
    console.warn('[OrphanClean] Aviso: Não foi possível ler imagens do PostgreSQL, usando apenas dados em disco:', err.message);
  }

  return referenced;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--delete');
  const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

  console.log(`[CleanOrphans] Iniciando varredura em: ${uploadsDir}`);
  console.log(`[CleanOrphans] Modo: ${isDryRun ? 'DRY-RUN (Apenas listagem)' : 'EXECUÇÃO REAL (--delete ativo)'}\n`);

  if (!fs.existsSync(uploadsDir)) {
    console.log('[CleanOrphans] Diretório de uploads não existe.');
    process.exit(0);
  }

  const referenced = await getAllReferencedImages();
  console.log(`[CleanOrphans] Total de imagens ativas referenciadas no catálogo/lojas: ${referenced.size}`);

  const allFiles = fs.readdirSync(uploadsDir);
  const orphanFiles: { filename: string; size: number }[] = [];

  for (const filename of allFiles) {
    if (filename.startsWith('.') || filename === '.gitkeep') continue;

    // Se for thumbnail, verifica a imagem base correspondente
    const baseFilename = filename.replace(/-thumb\.webp$/, '.webp');

    if (!referenced.has(filename) && !referenced.has(baseFilename)) {
      const filePath = path.join(uploadsDir, filename);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        orphanFiles.push({ filename, size: stat.size });
      }
    }
  }

  console.log(`[CleanOrphans] Arquivos órfãos encontrados: ${orphanFiles.length}\n`);

  let totalBytes = 0;
  for (const file of orphanFiles) {
    totalBytes += file.size;
    const sizeKb = (file.size / 1024).toFixed(1);
    console.log(` - ${file.filename} (${sizeKb} KB)`);

    if (!isDryRun) {
      fs.unlinkSync(path.join(uploadsDir, file.filename));
    }
  }

  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
  console.log(`\n[CleanOrphans] Espaço total ocupado por órfãos: ${totalMb} MB`);

  if (isDryRun) {
    console.log('[CleanOrphans] Para apagar estes arquivos fisicamente, execute com: npm run clean:orphan-uploads -- --delete');
  } else {
    console.log(`[CleanOrphans] ${orphanFiles.length} arquivos órfãos foram excluídos com sucesso.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[CleanOrphans] Erro ao executar varredura:', err);
  process.exit(1);
});
