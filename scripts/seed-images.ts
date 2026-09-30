import fs from 'fs';
import path from 'path';
import { 
  ensureMediaDirectories, 
  downloadAndSavePhoto, 
  resolveUnsplashIdForFile, 
  UPLOADS_IMOVEIS_DIR, 
  UPLOADS_DEMO_DIR,
  CURATED_PROPERTY_PHOTOS,
  SPECIFIC_PHOTO_MAPPINGS
} from '../server/imageManager.js';

async function seedAll() {
  console.log('[SeedImages] Iniciando restauração e download de imagens do catálogo...');
  ensureMediaDirectories();

  // 1. Baixar fotos de demonstração (Unsplash IDs)
  console.log(`[SeedImages] Baixando acervo principal de demonstração (${CURATED_PROPERTY_PHOTOS.length} fotos)...`);
  for (const photoId of CURATED_PROPERTY_PHOTOS) {
    const filename = `${photoId}.jpg`;
    const targetPath = path.join(UPLOADS_DEMO_DIR, filename);
    if (!fs.existsSync(targetPath) || fs.statSync(targetPath).size < 1000) {
      process.stdout.write(`Baixando demo ${filename}... `);
      const saved = await downloadAndSavePhoto(photoId, filename);
      console.log(saved ? 'OK' : 'FALHA');
    }
  }

  // 2. Baixar todas as fotos mapeadas de imóveis reais (Luiz Tavares, Eliani Costa, etc.)
  const realPhotos = Object.keys(SPECIFIC_PHOTO_MAPPINGS);
  console.log(`[SeedImages] Baixando fotos de imóveis reais mapeadas (${realPhotos.length} fotos)...`);
  for (const baseName of realPhotos) {
    const filenameWebp = `${baseName}.webp`;
    const unsplashId = SPECIFIC_PHOTO_MAPPINGS[baseName];
    const targetWebp = path.join(UPLOADS_IMOVEIS_DIR, filenameWebp);

    if (!fs.existsSync(targetWebp) || fs.statSync(targetWebp).size < 1000) {
      process.stdout.write(`Baixando imóvel ${filenameWebp}... `);
      const saved = await downloadAndSavePhoto(unsplashId, filenameWebp);
      console.log(saved ? 'OK' : 'FALHA');
    }
  }

  console.log('[SeedImages] Concluído com sucesso! Diretórios verificados:');
  console.log('- uploads_imoveis:', fs.readdirSync(UPLOADS_IMOVEIS_DIR).length, 'arquivos');
  console.log('- uploads/demo:', fs.readdirSync(UPLOADS_DEMO_DIR).length, 'arquivos');
}

seedAll().catch(err => {
  console.error('[SeedImages] Erro na execução:', err);
  process.exit(1);
});
