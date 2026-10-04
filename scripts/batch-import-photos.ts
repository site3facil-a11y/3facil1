import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { diskStorage } from '../server/diskStorage.js';
import { pool, isPostgresAvailable } from '../server/postgres.js';

interface BatchImportStats {
  foldersFound: number;
  itemsMatched: number;
  photosProcessed: number;
  errors: number;
}

async function processImageToJpg(inputPath: string, uploadsDir: string): Promise<{ url: string; thumbUrl: string }> {
  const fileId = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const filename = `upload-${fileId}.jpg`;
  const thumbFilename = `upload-${fileId}-thumb.jpg`;

  const targetPath = path.join(uploadsDir, filename);
  const thumbPath = path.join(uploadsDir, thumbFilename);

  const buffer = fs.readFileSync(inputPath);

  // Recodifica com Sharp: máx 1600px, JPEG q82, strip EXIF, fundo branco para transparência
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
  const isDryRun = args.includes('--dry-run');
  const shouldAppend = args.includes('--append'); // se falso, substitui a lista de fotos do anúncio
  
  const customDirArg = args.find(a => a.startsWith('--dir='));
  const sourceDir = customDirArg 
    ? path.resolve(customDirArg.split('=')[1]) 
    : path.join(process.cwd(), 'batch_photos');

  const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

  console.log('='.repeat(65));
  console.log('3Fácil - Importador de Fotos em Lote para Anúncios (JPEG / .jpg)');
  console.log('='.repeat(65));
  console.log(`Pasta de entrada: ${sourceDir}`);
  console.log(`Pasta de uploads: ${uploadsDir}`);
  console.log(`Modo: ${isDryRun ? 'DRY-RUN (Simulação)' : 'REAL (Gravação ativa no disco e banco)'}`);
  console.log(`Modo de fotos: ${shouldAppend ? 'ADICIONAR às fotos existentes' : 'SUBSTITUIR fotos do anúncio'}\n`);

  if (!fs.existsSync(sourceDir)) {
    console.log(`[BatchPhotos] A pasta de entrada não existe: ${sourceDir}`);
    console.log('Crie a pasta "batch_photos/" e organize subpastas com o ID ou parte do título do anúncio.');
    console.log('Exemplo:');
    console.log('  batch_photos/terreno-rua-fe-em-deus/foto1.jpg');
    console.log('  batch_photos/terreno-rua-fe-em-deus/foto2.jpg\n');
    process.exit(0);
  }

  if (!fs.existsSync(uploadsDir) && !isDryRun) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const stats: BatchImportStats = {
    foldersFound: 0,
    itemsMatched: 0,
    photosProcessed: 0,
    errors: 0
  };

  const allItems = diskStorage.getItems();
  const subdirs = fs.readdirSync(sourceDir, { withFileTypes: true }).filter(d => d.isDirectory());
  stats.foldersFound = subdirs.length;

  console.log(`[BatchPhotos] Subpastas de anúncios encontradas: ${subdirs.length}\n`);

  for (const dir of subdirs) {
    const folderName = dir.name.trim();
    const folderPath = path.join(sourceDir, folderName);

    // Encontrar item por ID exato, ou por slug, ou por busca flexível no título
    const matchedItem = allItems.find(i => 
      i.id.toLowerCase() === folderName.toLowerCase() ||
      i.title.toLowerCase().includes(folderName.toLowerCase().replace(/-/g, ' ')) ||
      folderName.toLowerCase().includes(i.id.toLowerCase())
    );

    if (!matchedItem) {
      console.warn(`[AVISO] Nenhum anúncio encontrado para a pasta "${folderName}". Pulando.`);
      continue;
    }

    stats.itemsMatched++;
    console.log(`\n-------------------------------------------------------------`);
    console.log(`Pasta: "${folderName}" -> Anúncio ID: ${matchedItem.id} ("${matchedItem.title}")`);

    const imageFiles = fs.readdirSync(folderPath).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.heic'].includes(ext);
    }).sort();

    if (imageFiles.length === 0) {
      console.log(`  (Nenhuma imagem compatível encontrada na pasta)`);
      continue;
    }

    console.log(`  Fotos encontradas para importar: ${imageFiles.length}`);

    const newUploadedUrls: string[] = [];

    for (const imgName of imageFiles) {
      const imgPath = path.join(folderPath, imgName);
      try {
        if (!isDryRun) {
          const { url } = await processImageToJpg(imgPath, uploadsDir);
          newUploadedUrls.push(url);
          stats.photosProcessed++;
          console.log(`  ✓ ${imgName} -> ${url}`);
        } else {
          newUploadedUrls.push(`/uploads/upload-simulated-${imgName}.jpg`);
          stats.photosProcessed++;
          console.log(`  [SIMULADO] ${imgName} -> /uploads/upload-simulated-${imgName}.jpg`);
        }
      } catch (err: any) {
        stats.errors++;
        console.error(`  ✗ Erro ao processar ${imgName}:`, err.message);
      }
    }

    if (newUploadedUrls.length > 0 && !isDryRun) {
      const finalImages = shouldAppend 
        ? [...(matchedItem.images || []), ...newUploadedUrls] 
        : newUploadedUrls;

      // 1. Atualizar no disco
      matchedItem.images = finalImages;
      diskStorage.saveItem(matchedItem);
      console.log(`  [Disco] Anúncio atualizado com ${finalImages.length} fotos.`);

      // 2. Atualizar no PostgreSQL se disponível
      try {
        const pgReady = await isPostgresAvailable();
        if (pgReady) {
          const client = await pool.connect();
          try {
            const tableMap: Record<string, string> = {
              veiculo: 'autos.estoque',
              imovel: 'imoveis.catalogo',
              produto: 'loja.produtos',
              servico: 'servicos.catalogo'
            };
            const targetTable = tableMap[matchedItem.itemType] || 'imoveis.catalogo';
            await client.query(
              `UPDATE ${targetTable} SET fotos = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
              [JSON.stringify(finalImages), matchedItem.id]
            );
            console.log(`  [PostgreSQL] Tabela ${targetTable} atualizada.`);
          } finally {
            client.release();
          }
        }
      } catch (pgErr: any) {
        console.warn(`  [PostgreSQL] Aviso ao sincronizar com banco:`, pgErr.message);
      }
    }
  }

  console.log('\n' + '='.repeat(65));
  console.log('Resumo do Processamento em Lote:');
  console.log(`- Pastas de anúncio analisadas: ${stats.foldersFound}`);
  console.log(`- Anúncios correspondentes identificados: ${stats.itemsMatched}`);
  console.log(`- Fotos processadas e convertidas para JPEG: ${stats.photosProcessed}`);
  console.log(`- Erros: ${stats.errors}`);
  console.log('='.repeat(65));
}

main().catch(err => {
  console.error('[BatchPhotos Error]:', err);
  process.exit(1);
});
