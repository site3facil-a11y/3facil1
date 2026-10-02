import { Router, Request, Response } from 'express';
import { pool, isPostgresAvailable } from '../../../server/postgres.js';
import { diskStorage } from '../../../server/diskStorage.js';
import { authenticateToken } from '../../middlewares/auth.js';
import { DEFAULT_PLATFORM_SETTINGS } from '../../data/demoStores.js';
import { StoreProfile, StoreItem, ProposalLead } from '../../types/store.js';

const router = Router();

/**
 * GET /api/bootstrap (Autenticado)
 * - Lojista: recebe exclusivamente a sua própria loja, seus itens e seus leads.
 *   Settings: campos públicos e operacionais apenas.
 * - Super Admin: recebe todas as lojas, todos os itens, todos os leads e settings completas.
 */
router.get('/bootstrap', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userStoreId = req.user?.storeId;

    let allStores: StoreProfile[] = [];
    let allItems: StoreItem[] = [];
    let allLeads: ProposalLead[] = [];
    let rawSettings: any = null;

    const dbAvailable = await isPostgresAvailable();

    if (dbAvailable) {
      const client = await pool.connect();
      try {
        const [storesRes, autosRes, imoveisRes, produtosRes, servicosRes, autosL, imoveisL, produtosL, servicosL, settingsRes] = await Promise.all([
          client.query('SELECT * FROM usuarios.lojas'),
          client.query('SELECT * FROM autos.estoque'),
          client.query('SELECT * FROM imoveis.catalogo'),
          client.query('SELECT * FROM loja.produtos'),
          client.query('SELECT * FROM servicos.catalogo'),
          client.query('SELECT * FROM autos.propostas'),
          client.query('SELECT * FROM imoveis.propostas'),
          client.query('SELECT * FROM loja.pedidos'),
          client.query('SELECT * FROM servicos.orcamentos'),
          client.query('SELECT * FROM usuarios.configuracoes_gerais WHERE chave = $1', ['platform_settings'])
        ]);

        allStores = storesRes.rows.map(r => {
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
            email: r.email,
            phone: r.telefone,
            city: r.cidade,
            state: r.estado,
            address: r.endereco,
            plan: r.plano || r.plano_tier,
            monthlyFee: parseFloat(r.mensalidade) || 30,
            subscriptionStatus: r.status_assinatura,
            nextDueDate: r.vencimento_mensalidade ? new Date(r.vencimento_mensalidade).toISOString() : undefined,
            lastPaymentDate: r.data_ultimo_pagamento ? new Date(r.data_ultimo_pagamento).toISOString() : undefined,
            ownerName: r.owner_name,
            ownerEmail: r.owner_email,
            ownerPhone: r.owner_phone,
            isPublished: r.is_published !== false,
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
          } as StoreProfile;
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
            version: r.versao || extra.version,
            yearFab: r.ano_fabricacao || extra.yearFab,
            yearModel: r.ano_modelo || extra.yearModel,
            mileage: r.quilometragem ?? extra.mileage,
            fuel: r.combustivel || extra.fuel,
            transmission: r.cambio || extra.transmission,
            color: r.cor || extra.color,
            plateEnd: r.placa_final || extra.plateEnd,
            propertyType: r.tipo_imovel || extra.propertyType,
            transactionType: r.tipo_transacao || extra.transactionType,
            areaUtil: r.area_util_m2 ? parseFloat(r.area_util_m2) : extra.areaUtil,
            areaTotal: r.area_total_m2 ? parseFloat(r.area_total_m2) : extra.areaTotal,
            bedrooms: r.quartos ?? extra.bedrooms,
            suites: r.suites ?? extra.suites,
            bathrooms: r.banheiros ?? extra.bathrooms,
            garageSpots: r.vagas_garagem ?? extra.garageSpots,
            condoFee: r.valor_condominio ? parseFloat(r.valor_condominio) : extra.condoFee,
            iptu: r.valor_iptu ? parseFloat(r.valor_iptu) : extra.iptu,
            neighborhood: r.bairro || extra.neighborhood,
            city: r.cidade || extra.city,
            state: r.estado || extra.state,
            address: r.endereco_completo || extra.address,
            sku: r.sku || extra.sku,
            category: r.categoria || extra.category,
            stockQuantity: r.estoque_quantidade ?? extra.stockQuantity,
            inStock: r.em_estoque !== false,
            condition: r.condicao || extra.condition,
            priceType: r.tipo_preco || extra.priceType,
            estimatedDuration: r.duracao_estimada || extra.estimatedDuration,
            includedItems: typeof r.itens_inclusos === 'string' ? JSON.parse(r.itens_inclusos) : (r.itens_inclusos || extra.includedItems || []),
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
          } as StoreItem;
        };

        allItems = [
          ...autosRes.rows.map(r => formatItem(r, 'veiculo')),
          ...imoveisRes.rows.map(r => formatItem(r, 'imovel')),
          ...produtosRes.rows.map(r => formatItem(r, 'produto')),
          ...servicosRes.rows.map(r => formatItem(r, 'servico'))
        ];

        const formatLead = (r: any, defaultType: string): ProposalLead => ({
          id: r.id,
          storeId: r.loja_id,
          itemId: r.item_id || r.imovel_id || r.veiculo_id,
          itemTitle: r.item_title || 'Interesse',
          itemType: r.item_type || defaultType,
          itemPrice: parseFloat(r.item_price || r.valor_ofertado) || 0,
          clientName: r.client_name || r.cliente_nome || 'Cliente',
          clientPhone: r.client_phone || r.cliente_telefone || '',
          clientEmail: r.client_email || r.cliente_email || '',
          clientMessage: r.client_message || r.mensagem || '',
          proposalValue: r.proposal_value ? parseFloat(r.proposal_value) : undefined,
          paymentMethod: r.payment_method || 'outro',
          tradeDetails: r.trade_details || '',
          orderType: r.order_type,
          deliveryAddress: r.delivery_address,
          quantity: r.quantity ? parseInt(r.quantity, 10) : 1,
          changeFor: r.change_for ? String(r.change_for) : undefined,
          status: r.status || 'novo',
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
        });

        allLeads = [
          ...autosL.rows.map(r => formatLead(r, 'veiculo')),
          ...imoveisL.rows.map(r => formatLead(r, 'imovel')),
          ...produtosL.rows.map(r => formatLead(r, 'produto')),
          ...servicosL.rows.map(r => formatLead(r, 'servico'))
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
      allStores = diskStorage.getStores();
      allItems = diskStorage.getItems();
      allLeads = diskStorage.getLeads();
      rawSettings = diskStorage.getSettings();
    }

    // Filtros de RBAC
    let filteredStores: StoreProfile[] = [];
    let filteredItems: StoreItem[] = [];
    let filteredLeads: ProposalLead[] = [];

    if (userRole === 'superadmin') {
      filteredStores = allStores;
      filteredItems = allItems;
      filteredLeads = allLeads;
    } else if (userRole === 'lojista' && userStoreId) {
      filteredStores = allStores.filter(s => s.id === userStoreId);
      filteredItems = allItems.filter(i => i.storeId === userStoreId);
      filteredLeads = allLeads.filter(l => l.storeId === userStoreId);
    } else {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Acesso negado.' } });
    }

    // Sanitizar credenciais
    const sanitizedStores = filteredStores.map(s => {
      const { password, password_hash, ...safeStore } = s as any;
      return safeStore;
    });

    const s = rawSettings || DEFAULT_PLATFORM_SETTINGS;
    let returnedSettings = { ...s };

    // Lojista não pode ver chave Pix e e-mails do superadmin
    if (userRole !== 'superadmin') {
      delete (returnedSettings as any).pixKey;
      delete (returnedSettings as any).pixBeneficiary;
      delete (returnedSettings as any).superAdminEmail;
      delete (returnedSettings as any).superAdminPassword;
    }

    res.json({
      stores: sanitizedStores,
      items: filteredItems,
      leads: filteredLeads,
      settings: returnedSettings,
      connectedToPostgres: dbAvailable
    });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'BOOTSTRAP_ERROR',
        message: 'Erro interno ao processar carregamento de dados autenticados.'
      }
    });
  }
});

export default router;
