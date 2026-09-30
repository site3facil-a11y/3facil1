import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Diretórios principais de upload
const cwd = process.cwd();
export const UPLOADS_DIR = path.join(cwd, 'uploads');
export const UPLOADS_IMOVEIS_DIR = path.join(cwd, 'uploads_imoveis');
export const UPLOADS_DEMO_DIR = path.join(UPLOADS_DIR, 'demo');
export const UPLOADS_SUB_IMOVEIS_DIR = path.join(UPLOADS_DIR, 'imoveis');
export const UPLOADS_FOTOS_DIR = path.join(UPLOADS_DIR, 'fotos');

// Garante que todas as pastas de mídia existam
export function ensureMediaDirectories() {
  [
    UPLOADS_DIR,
    UPLOADS_IMOVEIS_DIR,
    UPLOADS_DEMO_DIR,
    UPLOADS_SUB_IMOVEIS_DIR,
    UPLOADS_FOTOS_DIR
  ].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Acervo curado de fotos reais em alta definição (Unsplash) por categoria
export const CURATED_PROPERTY_PHOTOS = [
  'photo-1600596542815-ffad4c1539a9', // Casa moderna condomínio
  'photo-1600585154340-be6161a56a0c', // Casa alto padrão com piscina
  'photo-1600585154526-990dced4db0d', // Fachada contemporânea
  'photo-1600607687939-ce8a6c25118c', // Sala de estar luxo
  'photo-1600566753376-12c8ab7fb75b', // Cozinha planejada
  'photo-1512917774080-9991f1c4c750', // Mansão arquitetura moderna
  'photo-1580587771525-78b9dba3b914', // Casa residencial
  'photo-1613490493576-7fde63acd811', // Varanda e piscina
  'photo-1618221195710-dd6b41faaea6', // Quarto suíte master
  'photo-1502672260266-1c1ef2d93688', // Apartamento moderno
  'photo-1545324418-cc1a3fa10c00', // Prédio residencial
  'photo-1513694203232-719a280e022f', // Interior sala
  'photo-1555215695-3004980ad54e', // Varanda gourmet
  'photo-1507525428034-b723cf961d3e', // Casa praia / Salinas
  'photo-1582719478250-c89cae4dc85b', // Resort lazer
  'photo-1500382017468-9049fed747ef', // Lote / Terreno rural
  'photo-1500076656116-558758c991c1', // Terreno plano
  'photo-1586528116311-ad8dd3c8310d', // Galpão industrial
  'photo-1560518883-ce09059eeffa', // Imobiliária fachada
  'photo-1573496359142-b8d87734a5a2', // Corretor perfil
  'photo-1507003211169-0a1dd7228f2d', // Foto perfil profissional
  'photo-1500648767791-00dcc994a43e', // Foto perfil corretor
  'photo-1486406146926-c627a92ad1ab', // Edifício comercial
  'photo-1549399542-7e3f8b79c341', // Veículos / Lojas
  'photo-1621007947382-bb3c3994e3fb', // Carro sedan Corolla
  'photo-1503376780353-7e6692767b70', // Carro esportivo
  'photo-1533473359331-0135ef1b58bf', // Carro SUV
  'photo-1505740420928-5e560c06d30e', // Produto e-commerce
  'photo-1526738549149-8e07eca6c147', // Eletrônico
  'photo-1527443224154-c4a3942d3acf', // Suporte / Acessório
  'photo-1550745165-9bc0b252726f', // Loja vitrine
  'photo-1587829741301-dc798b83add3', // Informática
  'photo-1484704849700-f032a568e944', // Equipamento
  'photo-1590362891988-f778047020a6', // Serviços
  'photo-1454165804606-c3d57bc86b40', // Planejamento
  'photo-1460925895917-afdab827c52f'  // Consultoria
];

// Mapeamento especial de fotos específicas do catálogo Luiz Tavares e imobiliárias
export const SPECIFIC_PHOTO_MAPPINGS: Record<string, string> = {
  // Casa PA-444 Salinas (imv-95)
  'foto_6a6fc665cc35d': 'photo-1600585154340-be6161a56a0c', // Fachada com piscina
  'foto_6a6fc665cde46': 'photo-1600607687939-ce8a6c25118c', // Sala estar mobiliada
  'foto_6a6fc665cf18f': 'photo-1618221195710-dd6b41faaea6', // Suíte master climatizada
  'foto_6a6fc665d0bc6': 'photo-1600566753376-12c8ab7fb75b', // Cozinha e churrasqueira
  'foto_6a6fc665d22ed': 'photo-1555215695-3004980ad54e', // Varanda
  'foto_6a6fc665d3b6c': 'photo-1507525428034-b723cf961d3e', // Proximidade Atalaia / Salinas

  // Casa Amazon Garden (imv-92)
  'foto_6a5e0a4801242': 'photo-1512917774080-9991f1c4c750',
  'foto_6a5e0a4802cec': 'photo-1600596542815-ffad4c1539a9',
  'foto_6a5e0a4804270': 'photo-1613490493576-7fde63acd811',
  'foto_6a5e0a4805c1c': 'photo-1618221195710-dd6b41faaea6',
  'foto_6a5e0a4807678': 'photo-1600566753376-12c8ab7fb75b',
  'foto_6a5e0a4808f52': 'photo-1600607687939-ce8a6c25118c',

  // Condomínio Esperanza Park (imv-90)
  'foto_6a5924a083c4c': 'photo-1580587771525-78b9dba3b914',
  'foto_6a5924a085a7d': 'photo-1600585154526-990dced4db0d',
  'foto_6a5924a087289': 'photo-1502672260266-1c1ef2d93688',
  'foto_6a5924a089247': 'photo-1513694203232-719a280e022f',
  'foto_6a5924a08a8a1': 'photo-1500382017468-9049fed747ef',

  // Armazém Industrial BR-316 (imv-91)
  'foto_6a59292325154': 'photo-1586528116311-ad8dd3c8310d',
  'foto_6a59292326a05': 'photo-1504307651554-6691fc9d7b32',
  'foto_6a59292327f0a': 'photo-1587293852726-70cdb56c2866',
  'foto_6a592923292c1': 'photo-1486406146926-c627a92ad1ab',

  // Lotes Salinópolis e Parada Miriti (imv-84, imv-85, imv-86, imv-89)
  'foto_6a591dc696ef3': 'photo-1500382017468-9049fed747ef',
  'foto_6a591dc6986ab': 'photo-1500076656116-558758c991c1',
  'foto_6a591dc699dbb': 'photo-1507525428034-b723cf961d3e',
  'foto_6a591dc69b585': 'photo-1464822759023-fed622ff2c3b',
  'foto_6a591dc69cb23': 'photo-1506744038136-46273834b3fb',
  'foto_6a591dc69e0b4': 'photo-1582719478250-c89cae4dc85b',

  // Eliani Costa - Residencial Brisas do Rio (imv-32, imv-33)
  'foto_6a271f05a26e8': 'photo-1600585154526-990dced4db0d',
  'foto_6a271f05a5105': 'photo-1600607687939-ce8a6c25118c',
  'foto_6a271f05a6906': 'photo-1618221195710-dd6b41faaea6',
  'foto_6a271f05a7e71': 'photo-1600566753376-12c8ab7fb75b',
  'foto_6a271f05a9225': 'photo-1555215695-3004980ad54e',
  'foto_6a271f05aa5e1': 'photo-1580587771525-78b9dba3b914',
  'foto_6a271f256d650': 'photo-1600585154340-be6161a56a0c',
  'foto_6a271f256f446': 'photo-1618221195710-dd6b41faaea6',
  'foto_6a271f257085d': 'photo-1600566753376-12c8ab7fb75b',
  'foto_6a271f25723e9': 'photo-1502672260266-1c1ef2d93688',
  'foto_6a271f2573d9d': 'photo-1513694203232-719a280e022f',
  'foto_6a271f2575dbc': 'photo-1545324418-cc1a3fa10c00'
};

// Determina a foto Unsplash correspondente a qualquer nome de arquivo
export function resolveUnsplashIdForFile(filename: string): string {
  const baseName = path.parse(filename).name;

  // 1. Caso o próprio nome já seja photo-xxxx
  const matchPhoto = baseName.match(/photo-([0-9a-f-]+)/i);
  if (matchPhoto) {
    return `photo-${matchPhoto[1]}`;
  }

  // 2. Mapeamento explícito para fotos de imóveis reais
  if (SPECIFIC_PHOTO_MAPPINGS[baseName]) {
    return SPECIFIC_PHOTO_MAPPINGS[baseName];
  }

  // 3. Mapeamento determinístico por hash do nome (garante que foto_abc sempre receba a mesma foto de alta resolução)
  let hash = 0;
  for (let i = 0; i < baseName.length; i++) {
    hash = (hash << 5) - hash + baseName.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CURATED_PROPERTY_PHOTOS.length;
  return CURATED_PROPERTY_PHOTOS[index];
}

// Gera um SVG elegante de fallback caso tudo falhe (evita qualquer 404 em <img>)
export function generateSvgPlaceholder(title: string = '3fácil Anúncio'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#grad)"/>
    <g transform="translate(400, 260)" text-anchor="middle">
      <path d="M-40 20 L0 -20 L40 20 Z" fill="none" stroke="#059669" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="-24" y="20" width="48" height="40" fill="none" stroke="#059669" stroke-width="6" stroke-linecap="round"/>
      <line x1="-8" y1="60" x2="-8" y2="40" stroke="#059669" stroke-width="6" stroke-linecap="round"/>
      <text y="100" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="600">${title}</text>
      <text y="130" fill="#64748b" font-family="system-ui, -apple-system, sans-serif" font-size="14">3facil.com • Vitrine Inteligente</text>
    </g>
  </svg>`;
}

// Procura o arquivo local em várias pastas e extensões (.jpg, .webp, .png)
export function findLocalFile(requestedName: string): string | null {
  ensureMediaDirectories();
  const searchDirs = [
    UPLOADS_IMOVEIS_DIR,
    UPLOADS_SUB_IMOVEIS_DIR,
    UPLOADS_DEMO_DIR,
    UPLOADS_FOTOS_DIR,
    UPLOADS_DIR
  ];

  const ext = path.extname(requestedName).toLowerCase();
  const baseWithoutExt = ext ? requestedName.slice(0, -ext.length) : requestedName;
  const extensionsToTry = ext ? [ext, '.webp', '.jpg', '.jpeg', '.png'] : ['', '.webp', '.jpg', '.jpeg', '.png'];

  for (const dir of searchDirs) {
    // 1. Arquivo exato
    const exact = path.join(dir, requestedName);
    if (fs.existsSync(exact) && fs.statSync(exact).isFile() && fs.statSync(exact).size > 0) {
      return exact;
    }

    // 2. Variações de extensão
    for (const testExt of extensionsToTry) {
      const testPath = path.join(dir, `${baseWithoutExt}${testExt}`);
      if (fs.existsSync(testPath) && fs.statSync(testPath).isFile() && fs.statSync(testPath).size > 0) {
        return testPath;
      }
    }
  }

  return null;
}

// Baixa e salva uma foto de alta resolução do Unsplash no disco local
export async function downloadAndSavePhoto(unsplashId: string, targetFilename: string): Promise<string | null> {
  ensureMediaDirectories();
  try {
    const unsplashUrl = `https://images.unsplash.com/${unsplashId}?w=1200&auto=format&fit=crop&q=80`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(unsplashUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
      }
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 500) {
      return null;
    }

    const baseName = path.parse(targetFilename).name;
    const isImovel = targetFilename.startsWith('foto_') || targetFilename.includes('imovel');
    const primaryDir = isImovel ? UPLOADS_IMOVEIS_DIR : UPLOADS_DEMO_DIR;

    // Salva na pasta principal e também espelha como .webp e .jpg para compatibilidade total
    const primaryPath = path.join(primaryDir, targetFilename);
    fs.writeFileSync(primaryPath, buffer);

    const ext = path.extname(targetFilename).toLowerCase();
    const altExt = ext === '.webp' ? '.jpg' : '.webp';
    const altPath = path.join(primaryDir, `${baseName}${altExt}`);
    fs.writeFileSync(altPath, buffer);

    // Também garante cópia em uploads/imoveis se for imóvel
    if (isImovel) {
      const subImoveisPath = path.join(UPLOADS_SUB_IMOVEIS_DIR, targetFilename);
      fs.writeFileSync(subImoveisPath, buffer);
      fs.writeFileSync(path.join(UPLOADS_SUB_IMOVEIS_DIR, `${baseName}${altExt}`), buffer);
    }

    return primaryPath;
  } catch (err: any) {
    console.warn(`[ImageManager] Não foi possível baixar ${unsplashId}:`, err.message);
    return null;
  }
}

// Roteador / Middleware para Express
export async function handleImageRequest(req: any, res: any, next: any) {
  try {
    const rawPath = decodeURIComponent(req.path.replace(/^\/+/, ''));
    if (!rawPath || rawPath.includes('..')) {
      return next();
    }

    const filename = path.basename(rawPath);
    if (!filename) {
      return next();
    }

    // 1. Tentar encontrar localmente
    const local = findLocalFile(filename);
    if (local) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      return res.sendFile(local);
    }

    // 2. Se não encontrou, baixar e salvar instantaneamente
    const unsplashId = resolveUnsplashIdForFile(filename);
    const downloadedPath = await downloadAndSavePhoto(unsplashId, filename);
    if (downloadedPath && fs.existsSync(downloadedPath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      return res.sendFile(downloadedPath);
    }

    // 3. Se o download falhou (ex: sem internet), redirecionar 302 direto para o Unsplash
    res.redirect(302, `https://images.unsplash.com/${unsplashId}?w=1200&auto=format&fit=crop&q=80`);
  } catch (err) {
    // 4. Último recurso absoluto: renderizar SVG garantindo status 200
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(generateSvgPlaceholder());
  }
}
