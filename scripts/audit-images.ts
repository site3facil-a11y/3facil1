import fs from 'fs';
import path from 'path';
import { diskStorage } from '../server/diskStorage.js';
import { pool, isPostgresAvailable } from '../server/postgres.js';

interface BrokenImageReport {
  source: 'disk' | 'postgres';
  entityType: 'item' | 'store';
  entityId: string;
  storeId?: string;
  titleOrName?: string;
  field: string;
  url: string;
  expectedFilePath: string;
}

async function main() {
  const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
  const isStrict = process.argv.includes('--strict');

  console.log('='.repeat(65));
  console.log('3Fácil - Auditoria de Imagens e Referências Inexistentes');
  console.log('='.repeat(65));
  console.log(`Diretório de uploads base: ${uploadsDir}\n`);

  const brokenImages: BrokenImageReport[] = [];
  const base64Images: { entityId: string; field: string }[] = [];
  let totalChecked = 0;
  let totalValid = 0;

  const checkUrl = (
    url: string,
    source: 'disk' | 'postgres',
    entityType: 'item' | 'store',
    entityId: string,
    field: string,
    storeId?: string,
    titleOrName?: string
  ) => {
    if (!url || typeof url !== 'string') return;
    totalChecked++;

    if (url.startsWith('data:image/')) {
      base64Images.push({ entityId, field });
      return;
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      // URL externa / CDN
      totalValid++;
      return;
    }

    // URL local (/uploads/...)
    const cleanUrl = url.replace(/^\//, ''); // remove leading slash
    const pathInRoot = path.join(process.cwd(), cleanUrl);
    const pathInUploads = path.join(uploadsDir, path.basename(cleanUrl));

    if (!fs.existsSync(pathInRoot) && !fs.existsSync(pathInUploads)) {
      brokenImages.push({
        source,
        entityType,
        entityId,
        storeId,
        titleOrName,
        field,
        url,
        expectedFilePath: pathInRoot
      });
    } else {
      totalValid++;
    }
  };

  // 1. Auditar itens do disco
  const diskItems = diskStorage.getItems();
  console.log(`[Audit] Verificando ${diskItems.length} itens do disco...`);
  for (const item of diskItems) {
    if (Array.isArray(item.images)) {
      for (const img of item.images) {
        checkUrl(img, 'disk', 'item', item.id, 'images', item.storeId, item.title);
      }
    }
  }

  // 2. Auditar lojas do disco
  const diskStores = diskStorage.getStores();
  console.log(`[Audit] Verificando ${diskStores.length} lojas do disco...`);
  for (const store of diskStores) {
    if (store.logoUrl) {
      checkUrl(store.logoUrl, 'disk', 'store', store.id, 'logoUrl', store.id, store.name);
    }
    if (store.bannerUrl) {
      checkUrl(store.bannerUrl, 'disk', 'store', store.id, 'bannerUrl', store.id, store.name);
    }
  }

  // 3. Auditar PostgreSQL se disponível
  try {
    const pgReady = await isPostgresAvailable();
    if (pgReady) {
      console.log('[Audit] Verificando catálogo do PostgreSQL...');
      const client = await pool.connect();
      try {
        const queries = [
          { q: 'SELECT id, loja_id, titulo, fotos FROM autos.estoque', type: 'veiculo' },
          { q: 'SELECT id, loja_id, titulo, fotos FROM imoveis.catalogo', type: 'imovel' },
          { q: 'SELECT id, loja_id, titulo, fotos FROM loja.produtos', type: 'produto' },
          { q: 'SELECT id, loja_id, titulo, fotos FROM servicos.catalogo', type: 'servico' }
        ];

        for (const itemQuery of queries) {
          const res = await client.query(itemQuery.q);
          for (const row of res.rows) {
            if (row.fotos) {
              const fotos = typeof row.fotos === 'string' ? JSON.parse(row.fotos) : row.fotos;
              if (Array.isArray(fotos)) {
                for (const f of fotos) {
                  checkUrl(f, 'postgres', 'item', row.id, 'fotos', row.loja_id, row.titulo);
                }
              }
            }
          }
        }

        const storesRes = await client.query('SELECT id, nome, logo_url, banner_url FROM usuarios.lojas');
        for (const row of storesRes.rows) {
          if (row.logo_url) checkUrl(row.logo_url, 'postgres', 'store', row.id, 'logo_url', row.id, row.nome);
          if (row.banner_url) checkUrl(row.banner_url, 'postgres', 'store', row.id, 'banner_url', row.id, row.nome);
        }
      } finally {
        client.release();
      }
    }
  } catch (pgErr: any) {
    console.warn('[Audit] PostgreSQL não acessível para auditoria:', pgErr.message);
  }

  console.log('\n' + '='.repeat(65));
  console.log('Resultado da Auditoria:');
  console.log(`- Total de URLs de imagens analisadas: ${totalChecked}`);
  console.log(`- URLs válidas (arquivo existe ou externa): ${totalValid}`);
  console.log(`- Imagens em Base64 pendentes de migração: ${base64Images.length}`);
  console.log(`- URLs apontando para arquivos INEXISTENTES (404): ${brokenImages.length}`);
  console.log('='.repeat(65));

  if (brokenImages.length > 0) {
    console.log('\n[ATENÇÃO] As seguintes imagens cadastradas não foram encontradas no disco:\n');
    for (const b of brokenImages) {
      console.log(`- [${b.source.toUpperCase()} ${b.entityType.toUpperCase()}] ID: ${b.entityId} (${b.titleOrName || 'Sem título'})`);
      console.log(`  Loja ID: ${b.storeId || 'N/A'}`);
      console.log(`  Campo: ${b.field}`);
      console.log(`  URL no cadastro: ${b.url}`);
      console.log(`  Caminho esperado no disco: ${b.expectedFilePath}`);
      console.log('');
    }

    if (isStrict) {
      process.exit(1);
    }
  } else {
    console.log('\n[SUCESSO] Nenhuma URL quebrada ou apontando para arquivo inexistente foi detectada.');
  }

  if (base64Images.length > 0) {
    console.log(`\n[DICA] Foram encontradas ${base64Images.length} imagens em base64.`);
    console.log('Execute "npm run images:migrate-base64 -- --write" para migrá-las para WebP.');
  }
}

main().catch(err => {
  console.error('[Audit Error]:', err);
  process.exit(1);
});
