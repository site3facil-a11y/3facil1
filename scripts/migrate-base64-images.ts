import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { diskStorage } from '../server/diskStorage.js';
import { pool, isPostgresAvailable } from '../server/postgres.js';

interface MigrationStats {
  totalItemsScanned: number;
  totalStoresScanned: number;
  base64ImagesFound: number;
  imagesConverted: number;
  errors: number;
}

function parseBase64Image(dataUri: string): { mimeType: string; buffer: Buffer } | null {
  const match = dataUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/s);
  if (!match) return null;
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  return { mimeType, buffer };
}

async function convertBase64ToWebpFile(
  buffer: Buffer,
  uploadsDir: string,
  isDryRun: boolean
): Promise<{ url: string; thumbUrl: string } | null> {
  if (isDryRun) {
    return {
      url: `/uploads/upload-simulated-${Date.now()}.jpg`,
      thumbUrl: `/uploads/upload-simulated-${Date.now()}-thumb.jpg`
    };
  }

  const fileId = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const filename = `upload-migrated-${fileId}.jpg`;
  const thumbFilename = `upload-migrated-${fileId}-thumb.jpg`;

  const targetPath = path.join(uploadsDir, filename);
  const thumbPath = path.join(uploadsDir, thumbFilename);

  // Recodifica com sharp: máx 1600px, JPEG q82, strip EXIF, fundo branco se transparente
  const recodedMain = await sharp(buffer)
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, progressive: true })
    .toBuffer();

  const recodedThumb = await sharp(buffer)
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75, progressive: true })
    .toBuffer();

  fs.writeFileSync(targetPath, recodedMain);
  fs.writeFileSync(thumbPath, recodedThumb);

  return {
    url: `/uploads/${filename}`,
    thumbUrl: `/uploads/${thumbFilename}`
  };
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || !args.includes('--write');
  const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

  console.log('='.repeat(65));
  console.log('3Fácil - Migração de Imagens Base64 para Arquivos WebP em Disco');
  console.log('='.repeat(65));
  console.log(`Modo: ${isDryRun ? 'DRY-RUN (Apenas simulação, use --write para aplicar)' : 'EXECUÇÃO REAL (--write)'}`);
  console.log(`Diretório de destino: ${uploadsDir}\n`);

  if (!fs.existsSync(uploadsDir) && !isDryRun) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Backup prévio
  const dataDir = path.join(process.cwd(), 'database_storage');
  if (!isDryRun && fs.existsSync(dataDir)) {
    const backupDir = path.join(dataDir, `backup-base64-migration-${Date.now()}`);
    fs.mkdirSync(backupDir, { recursive: true });
    for (const f of ['itens.json', 'lojas.json']) {
      const src = path.join(dataDir, f);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(backupDir, f));
      }
    }
    console.log(`[Backup] Cópia de segurança criada em: ${backupDir}\n`);
  }

  const stats: MigrationStats = {
    totalItemsScanned: 0,
    totalStoresScanned: 0,
    base64ImagesFound: 0,
    imagesConverted: 0,
    errors: 0
  };

  // 1. Processar Itens em Disco
  const items = diskStorage.getItems();
  stats.totalItemsScanned = items.length;
  let itemsModified = false;

  for (const item of items) {
    if (Array.isArray(item.images)) {
      const newImages: string[] = [];
      let itemChanged = false;

      for (let i = 0; i < item.images.length; i++) {
        const img = item.images[i];
        if (typeof img === 'string' && img.startsWith('data:image/')) {
          stats.base64ImagesFound++;
          try {
            const parsed = parseBase64Image(img);
            if (parsed) {
              const res = await convertBase64ToWebpFile(parsed.buffer, uploadsDir, isDryRun);
              if (res) {
                newImages.push(res.url);
                itemChanged = true;
                stats.imagesConverted++;
                console.log(`[Item: ${item.id}] Foto ${i + 1} convertida -> ${res.url}`);
              } else {
                newImages.push(img);
              }
            } else {
              newImages.push(img);
            }
          } catch (err: any) {
            stats.errors++;
            console.error(`[Item: ${item.id}] Erro ao converter foto ${i + 1}:`, err.message);
            newImages.push(img);
          }
        } else {
          newImages.push(img);
        }
      }

      if (itemChanged) {
        item.images = newImages;
        itemsModified = true;
      }
    }
  }

  // 2. Processar Lojas em Disco (logoUrl e bannerUrl)
  const stores = diskStorage.getStores();
  stats.totalStoresScanned = stores.length;
  let storesModified = false;

  for (const store of stores) {
    if (typeof store.logoUrl === 'string' && store.logoUrl.startsWith('data:image/')) {
      stats.base64ImagesFound++;
      try {
        const parsed = parseBase64Image(store.logoUrl);
        if (parsed) {
          const res = await convertBase64ToWebpFile(parsed.buffer, uploadsDir, isDryRun);
          if (res) {
            store.logoUrl = res.url;
            storesModified = true;
            stats.imagesConverted++;
            console.log(`[Loja: ${store.id}] Logo convertida -> ${res.url}`);
          }
        }
      } catch (err: any) {
        stats.errors++;
        console.error(`[Loja: ${store.id}] Erro ao converter logo:`, err.message);
      }
    }

    if (typeof store.bannerUrl === 'string' && store.bannerUrl.startsWith('data:image/')) {
      stats.base64ImagesFound++;
      try {
        const parsed = parseBase64Image(store.bannerUrl);
        if (parsed) {
          const res = await convertBase64ToWebpFile(parsed.buffer, uploadsDir, isDryRun);
          if (res) {
            store.bannerUrl = res.url;
            storesModified = true;
            stats.imagesConverted++;
            console.log(`[Loja: ${store.id}] Banner convertido -> ${res.url}`);
          }
        }
      } catch (err: any) {
        stats.errors++;
        console.error(`[Loja: ${store.id}] Erro ao converter banner:`, err.message);
      }
    }
  }

  // Grava alterações no disco se não for dry-run
  if (!isDryRun) {
    if (itemsModified) {
      diskStorage.saveItems(items);
      console.log('[Disk] Itens atualizados no disco com sucesso.');
    }
    if (storesModified) {
      diskStorage.saveStores(stores);
      console.log('[Disk] Lojas atualizadas no disco com sucesso.');
    }
  }

  // 3. Processar Banco PostgreSQL se disponível
  try {
    const pgAvailable = await isPostgresAvailable();
    if (pgAvailable) {
      console.log('\n[PostgreSQL] Verificando tabelas do banco de dados...');
      const client = await pool.connect();
      try {
        const tables = [
          { name: 'autos.estoque', col: 'fotos' },
          { name: 'imoveis.catalogo', col: 'fotos' },
          { name: 'loja.produtos', col: 'fotos' },
          { name: 'servicos.catalogo', col: 'fotos' }
        ];

        for (const t of tables) {
          const res = await client.query(`SELECT id, ${t.col} FROM ${t.name}`);
          for (const row of res.rows) {
            if (row[t.col]) {
              const fotos = typeof row[t.col] === 'string' ? JSON.parse(row[t.col]) : row[t.col];
              if (Array.isArray(fotos)) {
                let updated = false;
                const newFotos: string[] = [];
                for (const f of fotos) {
                  if (typeof f === 'string' && f.startsWith('data:image/')) {
                    stats.base64ImagesFound++;
                    const parsed = parseBase64Image(f);
                    if (parsed) {
                      const converted = await convertBase64ToWebpFile(parsed.buffer, uploadsDir, isDryRun);
                      if (converted) {
                        newFotos.push(converted.url);
                        updated = true;
                        stats.imagesConverted++;
                      } else {
                        newFotos.push(f);
                      }
                    } else {
                      newFotos.push(f);
                    }
                  } else {
                    newFotos.push(f);
                  }
                }
                if (updated && !isDryRun) {
                  await client.query(
                    `UPDATE ${t.name} SET ${t.col} = $1 WHERE id = $2`,
                    [JSON.stringify(newFotos), row.id]
                  );
                }
              }
            }
          }
        }
      } finally {
        client.release();
      }
    }
  } catch (pgErr: any) {
    console.warn('[PostgreSQL] Não foi possível migrar banco relacional:', pgErr.message);
  }

  console.log('\n' + '='.repeat(65));
  console.log('Resumo da Migração:');
  console.log(`- Itens auditados: ${stats.totalItemsScanned}`);
  console.log(`- Lojas auditadas: ${stats.totalStoresScanned}`);
  console.log(`- Imagens base64 encontradas: ${stats.base64ImagesFound}`);
  console.log(`- Imagens recodificadas em WebP: ${stats.imagesConverted}`);
  console.log(`- Erros: ${stats.errors}`);
  console.log('='.repeat(65));

  if (isDryRun && stats.base64ImagesFound > 0) {
    console.log('\nPara executar a conversão real e salvar as alterações, execute:');
    console.log('  npm run images:migrate-base64 -- --write\n');
  }
}

main().catch(err => {
  console.error('[Fatal Error]:', err);
  process.exit(1);
});
