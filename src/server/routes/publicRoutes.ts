import { Router, Request, Response } from 'express';
import { pool, isPostgresAvailable } from '../../../server/postgres.js';
import { diskStorage } from '../../../server/diskStorage.js';
import { DEFAULT_PLATFORM_SETTINGS } from '../../data/demoStores.js';
import { StoreProfile, StoreItem } from '../../types/store.js';

const router = Router();

/**
 * GET /api/public/bootstrap
 * Endpoint público estritamente seguro:
 * - Apenas lojas publicadas (isPublished = true)
 * - Campos exclusivamente públicos de loja
 * - Apenas itens disponíveis dessas lojas
 * - ZERO leads (dados pessoais protegidos)
 * - Settings sem chaves Pix ou e-mails administrativos confidenciais
 */
router.get('/bootstrap', async (req: Request, res: Response) => {
  try {
    let rawStores: any[] = [];
    let rawItems: any[] = [];
    let rawSettings: any = null;

    const dbAvailable = await isPostgresAvailable();

    if (dbAvailable) {
      const client = await pool.connect();
      try {
        const [storesRes, autosRes, imoveisRes, produtosRes, servicosRes, settingsRes] = await Promise.all([
          client.query('SELECT * FROM usuarios.lojas WHERE is_published IS TRUE OR is_published IS NULL'),
          client.query("SELECT * FROM autos.estoque WHERE status != 'inativo'"),
          client.query("SELECT * FROM imoveis.catalogo WHERE status != 'inativo'"),
          client.query("SELECT * FROM loja.produtos WHERE status != 'inativo'"),
          client.query("SELECT * FROM servicos.catalogo WHERE status != 'inativo'"),
          client.query('SELECT * FROM usuarios.configuracoes_gerais WHERE chave = $1', ['platform_settings'])
        ]);

        rawStores = storesRes.rows.map(r => {
          const config = typeof r.configuracoes === 'string' ? JSON.parse(r.configuracoes) : (r.configuracoes || {});
          return {
            ...config,
            id: r.id,
            name: r.nome,
            slug: r.slug,
            type: r.tipo,
            description: r.descricao,
            slogan: r.slogan,
            themeColor: r.theme_color,
            logoUrl: r.logo_url,
            bannerUrl: r.banner_url,
            whatsapp: r.whatsapp,
            phone: r.telefone,
            city: r.cidade,
            state: r.estado,
            address: r.endereco,
            isPublished: r.is_published !== false
          };
        });

        const formatItem = (r: any, defaultType: string): StoreItem => {
          const extra = typeof r.dados_extras === 'string' ? JSON.parse(r.dados_extras) : (r.dados_extras || {});
          return {
            ...extra,
            id: r.id,
            storeId: r.loja_id,
            title: r.titulo,
            itemType: r.tipo || defaultType,
            price: parseFloat(r.preco ?? r.preco_venda ?? extra.price) || 0,
            promotionalPrice: r.preco_promocional ? parseFloat(r.preco_promocional) : extra.promotionalPrice,
            description: r.descricao || extra.description || '',
            images: typeof r.fotos === 'string' ? JSON.parse(r.fotos) : (r.fotos || extra.images || []),
            featured: r.destaque || false,
            status: r.status || 'disponivel',
            brand: r.marca || extra.brand,
            model: r.modelo || extra.model,
            yearFab: r.ano_fabricacao || extra.yearFab,
            yearModel: r.ano_modelo || extra.yearModel,
            propertyType: r.tipo_imovel || extra.propertyType,
            transactionType: r.tipo_transacao || extra.transactionType,
            areaUtil: r.area_util_m2 ? parseFloat(r.area_util_m2) : extra.areaUtil,
            city: r.cidade || extra.city,
            state: r.estado || extra.state,
            category: r.categoria || extra.category,
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
          } as StoreItem;
        };

        rawItems = [
          ...autosRes.rows.map(r => formatItem(r, 'veiculo')),
          ...imoveisRes.rows.map(r => formatItem(r, 'imovel')),
          ...produtosRes.rows.map(r => formatItem(r, 'produto')),
          ...servicosRes.rows.map(r => formatItem(r, 'servico'))
        ];

        if (settingsRes.rows.length > 0) {
          rawSettings = typeof settingsRes.rows[0].valor === 'string'
            ? JSON.parse(settingsRes.rows[0].valor)
            : settingsRes.rows[0].valor;
        }
      } finally {
        client.release();
      }
    } else {
      // Fallback em disco
      rawStores = diskStorage.getStores().filter(s => s.isPublished !== false);
      rawItems = diskStorage.getItems().filter(i => i.status !== 'inativo');
      rawSettings = diskStorage.getSettings();
    }

    // Filtrar apenas lojas publicadas
    const publishedStores = rawStores.filter(s => s.isPublished !== false);
    const publishedStoreIds = new Set(publishedStores.map(s => s.id));

    // Sanitizar rigorosamente campos públicos de lojas (removendo financeiro e contatos do dono)
    const publicStores = publishedStores.map(s => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      type: s.type,
      description: s.description || '',
      slogan: s.slogan || '',
      themeColor: s.themeColor || '#2563eb',
      logoUrl: s.logoUrl || null,
      bannerUrl: s.bannerUrl || null,
      whatsapp: s.whatsapp || '',
      phone: s.phone || '',
      city: s.city || '',
      state: s.state || '',
      address: s.address || '',
      isPublished: true,
      features: s.features || []
    }));

    // Itens pertencentes exclusivamente a lojas publicadas
    const publicItems = rawItems.filter(i => publishedStoreIds.has(i.storeId));

    // Settings públicas (sem Pix e sem e-mails confidenciais)
    const s = rawSettings || DEFAULT_PLATFORM_SETTINGS;
    const publicSettings = {
      platformName: s.platformName || DEFAULT_PLATFORM_SETTINGS.platformName,
      superAdminName: s.superAdminName || DEFAULT_PLATFORM_SETTINGS.superAdminName,
      defaultTrialDays: s.defaultTrialDays || 7,
      contactEmail: s.contactEmail || 'contato@3facil.com',
      contactPhone: s.contactPhone || s.superAdminPhone || '',
      whatsappSupport: s.whatsappSupport || ''
    };

    res.json({
      stores: publicStores,
      items: publicItems,
      leads: [], // NUNCA inclui leads publicamente
      settings: publicSettings,
      connectedToPostgres: dbAvailable
    });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'PUBLIC_BOOTSTRAP_ERROR',
        message: 'Falha ao carregar catálogo público.'
      }
    });
  }
});

/**
 * GET /api/health
 * Healthcheck público mínimo
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

export default router;
