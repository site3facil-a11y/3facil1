import { Express } from 'express';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { diskStorage } from '../../../server/diskStorage.js';
import { env } from '../config/env.js';

export async function setupSpaAndSeo(app: Express): Promise<void> {
  // Rota de Sitemap XML dinâmico
  app.get('/sitemap.xml', (req, res) => {
    try {
      const stores = diskStorage.getStores();
      const items = diskStorage.getItems();

      const staticUrls = [
        { loc: 'https://www.3facil.com/', priority: '1.0', changefreq: 'daily' },
        { loc: 'https://www.3facil.com/login', priority: '0.5', changefreq: 'monthly' }
      ];

      const storeUrls = stores
        .filter(s => s.isPublished !== false && s.slug)
        .map(s => ({
          loc: `https://www.3facil.com/${s.slug}`,
          priority: '0.8',
          changefreq: 'daily',
          lastmod: s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        }));

      const itemUrls = items.map(item => {
        const store = stores.find(s => s.id === item.storeId);
        const slug = store?.slug || 'loja';
        return {
          loc: `https://www.3facil.com/${slug}?item=${item.id}`,
          priority: '0.6',
          changefreq: 'weekly',
          lastmod: item.createdAt ? new Date(item.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        };
      });

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

      [...staticUrls, ...storeUrls, ...itemUrls].forEach(item => {
        xml += '  <url>\n';
        xml += `    <loc>${item.loc}</loc>\n`;
        if ((item as any).lastmod) xml += `    <lastmod>${(item as any).lastmod}</lastmod>\n`;
        xml += `    <changefreq>${item.changefreq}</changefreq>\n`;
        xml += `    <priority>${item.priority}</priority>\n`;
        xml += '  </url>\n';
      });

      xml += '</urlset>';
      res.setHeader('Content-Type', 'application/xml');
      res.send(xml);
    } catch (e: any) {
      res.status(500).send('Erro ao gerar sitemap: ' + e.message);
    }
  });

  // Middleware do Vite (Dev) ou Arquivos Estáticos (Prod)
  if (env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));

    app.get('*', (req, res) => {
      const requestedSlug = req.path.replace(/^\/+/, '').split('/')[0]?.toLowerCase();
      const itemIdParam = typeof req.query.item === 'string' ? req.query.item : null;
      const indexPath = path.join(distPath, 'index.html');

      if (!fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }

      if (requestedSlug && !['admin', 'master', 'landing', 'login', 'api', 'assets', 'uploads'].includes(requestedSlug)) {
        try {
          const stores = diskStorage.getStores();
          const matched = stores.find(s => s.slug?.toLowerCase() === requestedSlug);
          if (matched) {
            let html = fs.readFileSync(indexPath, 'utf-8');
            let title = `${matched.name} | Catálogo Online no 3fácil.com`;
            let desc = matched.description || matched.slogan || `Confira as ofertas e catálogo de ${matched.name} no 3fácil.com.`;
            let image = matched.bannerUrl || matched.logoUrl || 'https://www.3facil.com/uploads/demo/photo-1560518883-ce09059eeffa.jpg';

            if (itemIdParam) {
              const items = diskStorage.getItems();
              const matchedItem = items.find(i => i.id === itemIdParam);
              if (matchedItem) {
                title = `${matchedItem.title} - ${matched.name} | 3facil.com`;
                desc = matchedItem.description || `Confira detalhes, fotos e proposta para ${matchedItem.title} na vitrine de ${matched.name}.`;
                if (matchedItem.images && matchedItem.images.length > 0 && matchedItem.images[0]) {
                  image = matchedItem.images[0].startsWith('http')
                    ? matchedItem.images[0]
                    : `https://www.3facil.com${matchedItem.images[0].startsWith('/') ? '' : '/'}${matchedItem.images[0]}`;
                }
              }
            }

            html = html.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
            html = html.replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${title}" />`);
            html = html.replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${desc}" />`);
            html = html.replace(/<meta name="description" content=".*?" \/>/i, `<meta name="description" content="${desc}" />`);
            html = html.replace(/<meta property="og:image" content=".*?" \/>/i, `<meta property="og:image" content="${image}" />`);

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.send(html);
          }
        } catch (e) {
          console.error('[SEO/OG Injection] Erro ao injetar tags:', e);
        }
      }

      res.sendFile(indexPath);
    });
  }
}
