import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import crypto from 'crypto';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { createServer as createViteServer } from 'vite';
import { pool, initDatabase, seedDatabase } from './server/postgres.js';
import { diskStorage } from './server/diskStorage.js';
import { sendWelcomeEmail, sendTestEmail, testSmtpConnection, getSmtpConfig, isSmtpConfigured, saveSmtpConfig, sendPasswordResetEmail } from './server/emailService.js';
import { INITIAL_STORES, INITIAL_ITEMS, INITIAL_LEADS, DEFAULT_PLATFORM_SETTINGS } from './src/data/demoStores.js';
import { StoreProfile, StoreItem, ProposalLead, VehicleItem, RealEstateItem, ProductItem, ServiceItem, SaaSPlatformSettings } from './src/types/store.js';
import { assertJwtSecret, initAuthAccounts, registerAccount } from './server/authService.js';
import authRoutes from './src/routes/auth.js';
import { 
  authenticate, 
  authenticateToken, 
  optionalAuthenticateToken, 
  requireRole, 
  requireSuperAdmin, 
  requireStoreOwner, 
  requireStoreOwnerOrAdmin 
} from './src/middlewares/auth.js';

// Verificação obrigatória no startup: nunca permitir iniciar com segredo ausente ou fraco (< 32 chars)
assertJwtSecret();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Habilitar 'trust proxy' para operar com segurança atrás de proxies reversos (Cloud Run, Nginx, Load Balancers)
  app.set('trust proxy', 1);

  // Proteção de Cabeçalhos HTTP com Helmet
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));

  app.use(cors({
    origin: true,
    credentials: true
  }));
  app.use(cookieParser());

  // Limite seguro de JSON para prevenir DoS (2MB)
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Limitador de taxa contra brute-force e abusos
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      xForwardedForHeader: false,
      forwardedHeader: false,
      default: false
    },
    message: { error: 'Muitas requisições deste IP. Tente novamente mais tarde.' }
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      xForwardedForHeader: false,
      forwardedHeader: false,
      default: false
    },
    message: { error: 'Muitas tentativas de autenticação. Tente novamente em 15 minutos.' }
  });

  // Limitador próprio e dedicado para envio de propostas e leads (evita spam no catálogo)
  const leadLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      xForwardedForHeader: false,
      forwardedHeader: false,
      default: false
    },
    message: { error: 'Limite de propostas atingido para este endereço IP. Aguarde alguns minutos antes de enviar nova mensagem.' }
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

  // Proteção rigorosa de rotas exclusivamente administrativas
  app.use('/api/email', authenticateToken, requireSuperAdmin);
  app.use('/api/system', authenticateToken, requireSuperAdmin);
  app.use('/api/admin', authenticateToken, requireSuperAdmin);

  // Desativar qualquer cache em todas as respostas de API para refletir mudanças do banco em tempo real
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  // Montar rotas de autenticação sob /api/auth
  app.use('/api/auth', authRoutes);

  // Tentativa inicial de conexão com PostgreSQL em segundo plano e inicialização de contas
  initDatabase().then(async (ready) => {
    if (ready) {
      console.log('[PostgreSQL] Conectado e tabelas verificadas com sucesso.');
    }
    await initAuthAccounts();
  }).catch(async (err) => {
    console.warn('[PostgreSQL] Não foi possível conectar ao banco PostgreSQL local agora, usando persistência segura em disco (database_storage/):', err.message);
    await initAuthAccounts();
  });

  // ============================================================================
  // ROTAS DA API REST COM OS 5 SCHEMAS DO POSTGRESQL + PERSISTÊNCIA EM DISCO
  // ============================================================================

  // 1. Healthcheck & Status do PostgreSQL
  app.get('/api/health', async (req, res) => {
    const diskStores = diskStorage.getStores();
    const diskItems = diskStorage.getItems();
    const diskLeads = diskStorage.getLeads();

    try {
      const client = await pool.connect();
      try {
        const counts = await client.query(`
          SELECT 
            (SELECT COUNT(*) FROM usuarios.lojas) as lojas_count,
            (SELECT COUNT(*) FROM autos.estoque) as autos_count,
            (SELECT COUNT(*) FROM imoveis.catalogo) as imoveis_count,
            (SELECT COUNT(*) FROM loja.produtos) as produtos_count,
            (SELECT COUNT(*) FROM servicos.catalogo) as servicos_count,
            (SELECT COUNT(*) FROM autos.propostas) as autos_leads,
            (SELECT COUNT(*) FROM imoveis.propostas) as imoveis_leads,
            (SELECT COUNT(*) FROM loja.pedidos) as loja_leads,
            (SELECT COUNT(*) FROM servicos.orcamentos) as servicos_leads
        `);

        return res.json({
          status: 'online',
          database: 'PostgreSQL 14+ (3facil_db) + Disco Persistente',
          connected: true,
          schemas: ['usuarios', 'autos', 'imoveis', 'loja', 'servicos'],
          stats: counts.rows[0],
          timestamp: new Date().toISOString()
        });
      } finally {
        client.release();
      }
    } catch (err: any) {
      return res.json({
        status: 'online',
        database: 'Disco Seguro Persistente (database_storage/)',
        connected: false,
        stats: {
          lojas_count: diskStores.length.toString(),
          autos_count: diskItems.filter(i => i.itemType === 'veiculo').length.toString(),
          imoveis_count: diskItems.filter(i => i.itemType === 'imovel').length.toString(),
          produtos_count: diskItems.filter(i => i.itemType === 'produto').length.toString(),
          servicos_count: diskItems.filter(i => i.itemType === 'servico').length.toString(),
          autos_leads: diskLeads.filter(l => l.itemType === 'veiculo').length.toString(),
          imoveis_leads: diskLeads.filter(l => l.itemType === 'imovel').length.toString(),
          loja_leads: diskLeads.filter(l => l.itemType === 'produto').length.toString(),
          servicos_leads: diskLeads.filter(l => l.itemType === 'servico').length.toString()
        },
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // 2. Bootstrap Geral (Carrega dados do banco ou disco persistente com proteção de privacidade)
  app.get('/api/bootstrap', optionalAuthenticateToken, async (req, res) => {
    try {
      const client = await pool.connect();
      try {
        // Carregar lojas
        const storesRes = await client.query('SELECT * FROM usuarios.lojas ORDER BY created_at ASC');
        const settingsRes = await client.query('SELECT * FROM usuarios.platform_settings WHERE id = $1', ['main_settings']);

        // Carregar itens dos 4 schemas
        const autosRes = await client.query('SELECT * FROM autos.estoque ORDER BY created_at DESC');
        const imoveisRes = await client.query('SELECT * FROM imoveis.catalogo ORDER BY created_at DESC');
        const produtosRes = await client.query('SELECT * FROM loja.produtos ORDER BY created_at DESC');
        const servicosRes = await client.query('SELECT * FROM servicos.catalogo ORDER BY created_at DESC');

        // Carregar leads dos 4 schemas
        const autosLeads = await client.query('SELECT * FROM autos.propostas ORDER BY created_at DESC');
        const imoveisLeads = await client.query('SELECT * FROM imoveis.propostas ORDER BY created_at DESC');
        const produtosLeads = await client.query('SELECT * FROM loja.pedidos ORDER BY created_at DESC');
        const servicosLeads = await client.query('SELECT * FROM servicos.orcamentos ORDER BY created_at DESC');

        // Mapear lojas para a tipagem StoreProfile
        const stores: StoreProfile[] = storesRes.rows.map((r: any) => {
          const cfg = typeof r.configuracoes === 'string' ? JSON.parse(r.configuracoes) : (r.configuracoes || {});
          return {
            ...cfg,
            id: r.id,
            name: r.nome,
            slug: r.slug,
            type: r.tipo,
            description: r.descricao || '',
            slogan: r.slogan || '',
            themeColor: r.theme_color || '#2563eb',
            logoUrl: r.logo_url || '',
            bannerUrl: r.banner_url || '',
            whatsapp: r.whatsapp,
            email: r.email || '',
            phone: r.telefone || '',
            instagram: r.instagram || '',
            city: r.cidade || '',
            state: r.estado || '',
            address: r.endereco || '',
            plan: r.plano_tier || 'pro',
            monthlyFee: parseFloat(r.mensalidade) || 30.00,
            subscriptionStatus: r.status_assinatura || 'ativo',
            nextDueDate: r.vencimento_mensalidade || '2026-09-15',
            lastPaymentDate: r.data_ultimo_pagamento || '2026-08-15',
            ownerName: r.owner_name || 'Lojista',
            ownerEmail: r.owner_email || r.email || '',
            ownerPhone: r.owner_phone || r.whatsapp,
            isPublished: r.is_published !== false,
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
          };
        });

        // Mapear itens (usando dados_extras e colunas do PostgreSQL)
        const formatItem = (r: any, defaultType: string): StoreItem => {
          const extra = typeof r.dados_extras === 'string' ? JSON.parse(r.dados_extras) : (r.dados_extras || {});
          const itemType = r.tipo || extra.itemType || defaultType;
          const price = parseFloat(r.preco ?? r.preco_venda ?? r.preco_locacao ?? extra.price) || 0;
          const images = typeof r.fotos === 'string' ? JSON.parse(r.fotos) : (r.fotos || extra.images || []);
          const amenities = typeof r.caracteristicas === 'string' ? JSON.parse(r.caracteristicas) : (r.caracteristicas || extra.amenities || []);
          const accessories = typeof r.opcionais === 'string' ? JSON.parse(r.opcionais) : (r.opcionais || extra.accessories || []);
          
          return {
            ...extra,
            id: r.id,
            storeId: r.loja_id,
            title: r.titulo,
            itemType,
            price,
            promotionalPrice: r.preco_promocional ? parseFloat(r.preco_promocional) : extra.promotionalPrice,
            description: r.descricao || extra.description || '',
            images: Array.isArray(images) ? images : [],
            featured: r.destaque || false,
            status: r.status || 'disponivel',
            // Atributos de Imóveis
            propertyType: r.tipo_imovel || extra.propertyType || 'apartamento',
            transactionType: r.tipo_transacao || extra.transactionType || 'venda',
            areaUtil: r.area_util_m2 ? parseFloat(r.area_util_m2) : extra.areaUtil,
            areaTotal: r.area_total_m2 ? parseFloat(r.area_total_m2) : extra.areaTotal,
            bedrooms: r.quartos ?? extra.bedrooms ?? 0,
            suites: r.suites ?? extra.suites ?? 0,
            bathrooms: r.banheiros ?? extra.bathrooms ?? 0,
            garageSpots: r.vagas_garagem ?? extra.garageSpots ?? 0,
            condoFee: r.valor_condominio ? parseFloat(r.valor_condominio) : extra.condoFee,
            iptu: r.valor_iptu ? parseFloat(r.valor_iptu) : extra.iptu,
            neighborhood: r.bairro || extra.neighborhood || '',
            city: r.cidade || extra.city || '',
            state: r.estado || extra.state || '',
            address: r.endereco_completo || r.endereco || extra.address || '',
            amenities: Array.isArray(amenities) ? amenities : [],
            // Atributos de Veículos
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
            fipePrice: r.tabela_fipe_valor ? parseFloat(r.tabela_fipe_valor) : extra.fipePrice,
            accessories: Array.isArray(accessories) ? accessories : [],
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
          } as StoreItem;
        };

        const allItems: StoreItem[] = [
          ...autosRes.rows.map(r => formatItem(r, 'veiculo')),
          ...imoveisRes.rows.map(r => formatItem(r, 'imovel')),
          ...produtosRes.rows.map(r => formatItem(r, 'produto')),
          ...servicosRes.rows.map(r => formatItem(r, 'servico'))
        ];

        // Mapear leads
        const formatLead = (r: any, defaultType: string): ProposalLead => {
          let orderType = r.order_type;
          let deliveryAddress = r.delivery_address;
          const quantity = r.quantity ? parseInt(r.quantity, 10) : undefined;
          const changeFor = r.change_for;

          if (!orderType && r.trade_details && r.trade_details.includes('Entrega')) {
            orderType = 'entrega';
          } else if (!orderType && r.trade_details && r.trade_details.includes('Retirada')) {
            orderType = 'retirada';
          }

          return {
            id: r.id,
            storeId: r.loja_id,
            itemId: r.imovel_id || r.veiculo_id || r.produto_id || r.servico_id || r.item_id,
            itemTitle: r.item_title || 'Interesse no Imóvel/Anúncio',
            itemType: r.item_type || defaultType,
            itemPrice: parseFloat(r.valor_ofertado || r.item_price) || 0,
            clientName: r.cliente_nome || r.client_name || 'Cliente',
            clientPhone: r.cliente_telefone || r.client_phone || '',
            clientEmail: r.cliente_email || r.client_email || '',
            clientMessage: r.mensagem || r.client_message || '',
            proposalValue: r.valor_ofertado ? parseFloat(r.valor_ofertado) : (r.proposal_value ? parseFloat(r.proposal_value) : undefined),
            paymentMethod: r.forma_pagamento || r.payment_method || 'outro',
            tradeDetails: r.veiculo_troca_detalhes ? JSON.stringify(r.veiculo_troca_detalhes) : (r.trade_details || ''),
            orderType: (r.order_type || orderType) as any,
            deliveryAddress: r.delivery_address || deliveryAddress,
            quantity: quantity,
            changeFor: changeFor,
            status: r.status || 'novo',
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
          };
        };

        const allLeads: ProposalLead[] = [
          ...autosLeads.rows.map(r => formatLead(r, 'veiculo')),
          ...imoveisLeads.rows.map(r => formatLead(r, 'imovel')),
          ...produtosLeads.rows.map(r => formatLead(r, 'produto')),
          ...servicosLeads.rows.map(r => formatLead(r, 'servico'))
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Mapear settings
        let settings = DEFAULT_PLATFORM_SETTINGS;
        if (settingsRes.rows.length > 0) {
          const s = settingsRes.rows[0];
          const extra = typeof s.configuracoes_gerais === 'string' ? JSON.parse(s.configuracoes_gerais) : (s.configuracoes_gerais || {});
          settings = {
            ...extra,
            platformName: s.platform_name || DEFAULT_PLATFORM_SETTINGS.platformName,
            superAdminName: s.superadmin_name || DEFAULT_PLATFORM_SETTINGS.superAdminName,
            superAdminEmail: s.superadmin_email || DEFAULT_PLATFORM_SETTINGS.superAdminEmail,
            superAdminPhone: s.superadmin_phone || DEFAULT_PLATFORM_SETTINGS.superAdminPhone,
            pixKey: s.pix_key || DEFAULT_PLATFORM_SETTINGS.pixKey,
            pixKeyType: s.pix_key_type || DEFAULT_PLATFORM_SETTINGS.pixKeyType,
            pixBeneficiary: s.pix_beneficiary || DEFAULT_PLATFORM_SETTINGS.pixBeneficiary,
            defaultTrialDays: s.default_trial_days || DEFAULT_PLATFORM_SETTINGS.defaultTrialDays
          };
        }

        // Se PostgreSQL tem dados, sincroniza cópia de segurança em disco
        if (stores.length > 0) {
          diskStorage.saveStores(stores);
        }
        if (allItems.length > 0) {
          diskStorage.saveItems(allItems);
        }
        if (allLeads.length > 0) {
          diskStorage.saveLeads(allLeads);
        }
        if (settings) {
          diskStorage.saveSettings(settings);
        }

        const finalStores = stores.length > 0 ? stores : diskStorage.getStores();
        const finalItems = allItems.length > 0 ? allItems : diskStorage.getItems();
        const finalLeads = allLeads.length > 0 ? allLeads : diskStorage.getLeads();
        const finalSettings = settings || diskStorage.getSettings();

        // 1. Proteger leads: visitantes públicos NUNCA recebem dados pessoais de clientes/leads!
        // Apenas o superadmin vê todos; o lojista vê exclusivamente os leads da sua loja.
        let returnedLeads: ProposalLead[] = [];
        if (req.user?.role === 'superadmin') {
          returnedLeads = finalLeads;
        } else if (req.user?.role === 'lojista' && req.user.storeId) {
          returnedLeads = finalLeads.filter(l => l.storeId === req.user?.storeId);
        }

        // 2. Sanitizar credenciais de lojas (nunca enviar senhas ou hashes para o frontend)
        const returnedStores = finalStores.map(s => {
          const { password, password_hash, ...safeStore } = s as any;
          return safeStore;
        });

        // 3. Sanitizar configurações sensíveis de super admin
        const returnedSettings = { ...finalSettings };
        if (req.user?.role !== 'superadmin') {
          delete (returnedSettings as any).superAdminPassword;
        }

        return res.json({
          stores: returnedStores,
          items: finalItems,
          leads: returnedLeads,
          settings: returnedSettings,
          connectedToPostgres: true
        });
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn('[Bootstrap] PostgreSQL inacessível, carregando base persistente em disco:', err.message);
      const diskStores = diskStorage.getStores().map(s => {
        const { password, password_hash, ...safeStore } = s as any;
        return safeStore;
      });
      const diskLeads = diskStorage.getLeads();
      let returnedLeads: ProposalLead[] = [];
      if (req.user?.role === 'superadmin') {
        returnedLeads = diskLeads;
      } else if (req.user?.role === 'lojista' && req.user.storeId) {
        returnedLeads = diskLeads.filter(l => l.storeId === req.user?.storeId);
      }
      const diskSettings = { ...diskStorage.getSettings() };
      if (req.user?.role !== 'superadmin') {
        delete (diskSettings as any).superAdminPassword;
      }

      return res.json({
        stores: diskStores,
        items: diskStorage.getItems(),
        leads: returnedLeads,
        settings: diskSettings,
        connectedToPostgres: false,
        error: err.message
      });
    }
  });

  // 3. Salvar / Criar Loja no schema usuarios.lojas + Disco Persistente (Apenas Super Admin; lojistas criam via /api/auth/register)
  app.post('/api/stores', authenticateToken, requireSuperAdmin, async (req, res) => {
    const rawStore = req.body;
    let postgresSaved = false;
    let dbError: string | null = null;

    // Se senha foi fornecida no cadastro, hashear com bcrypt (custo >= 12) e criar conta de lojista
    let storePassword = rawStore.password;
    delete rawStore.password;
    const store: StoreProfile = rawStore;

    // Salvar IMEDIATAMENTE no armazenamento em disco persistente
    diskStorage.saveStore(store);

    if (storePassword && typeof storePassword === 'string' && storePassword.length >= 6) {
      try {
        await registerAccount({
          email: store.email,
          password: storePassword,
          role: 'lojista',
          loja_id: store.id,
          nome: store.name
        });
      } catch (authRegErr: any) {
        console.warn('[API Stores] Aviso ao registrar conta de autenticação da loja:', authRegErr.message);
      }
    }

    try {
      const client = await pool.connect();
      try {
        await client.query(`
          INSERT INTO usuarios.lojas (
            id, nome, slug, tipo, descricao, slogan, theme_color, logo_url, banner_url,
            whatsapp, email, telefone, instagram, cidade, estado, endereco,
            plano_tier, mensalidade, status_assinatura, vencimento_mensalidade,
            data_ultimo_pagamento, owner_name, owner_email, owner_phone,
            configuracoes, is_published, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
          ON CONFLICT (id) DO UPDATE SET
            nome = EXCLUDED.nome,
            slug = EXCLUDED.slug,
            tipo = EXCLUDED.tipo,
            descricao = EXCLUDED.descricao,
            slogan = EXCLUDED.slogan,
            theme_color = EXCLUDED.theme_color,
            logo_url = EXCLUDED.logo_url,
            banner_url = EXCLUDED.banner_url,
            whatsapp = EXCLUDED.whatsapp,
            email = EXCLUDED.email,
            telefone = EXCLUDED.telefone,
            instagram = EXCLUDED.instagram,
            cidade = EXCLUDED.cidade,
            estado = EXCLUDED.estado,
            endereco = EXCLUDED.endereco,
            mensalidade = EXCLUDED.mensalidade,
            status_assinatura = EXCLUDED.status_assinatura,
            vencimento_mensalidade = EXCLUDED.vencimento_mensalidade,
            data_ultimo_pagamento = EXCLUDED.data_ultimo_pagamento,
            owner_name = EXCLUDED.owner_name,
            owner_email = EXCLUDED.owner_email,
            owner_phone = EXCLUDED.owner_phone,
            configuracoes = EXCLUDED.configuracoes,
            is_published = EXCLUDED.is_published,
            updated_at = CURRENT_TIMESTAMP
        `, [
          store.id,
          store.name,
          store.slug,
          store.type,
          store.description || '',
          store.slogan || '',
          store.themeColor || '#2563eb',
          store.logoUrl || '',
          store.bannerUrl || '',
          store.whatsapp,
          store.email || '',
          store.phone || '',
          store.instagram || '',
          store.city || '',
          store.state || '',
          store.address || '',
          store.plan || 'pro',
          store.monthlyFee || 30.00,
          store.subscriptionStatus || 'ativo',
          store.nextDueDate || '2026-09-15',
          store.lastPaymentDate || '2026-08-15',
          store.ownerName || 'Lojista',
          store.ownerEmail || store.email || '',
          store.ownerPhone || store.whatsapp,
          JSON.stringify(store),
          store.isPublished !== false,
          new Date(store.createdAt || Date.now())
        ]);
        postgresSaved = true;
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn('[API Stores] Aviso: Não foi possível persistir no PostgreSQL direto:', err.message);
      dbError = err.message;
    }

    // Disparo do e-mail de confirmação / boas-vindas
    const originUrl = req.get('origin') || process.env.APP_URL;
    let emailResult: { success: boolean; message: string; simulated?: boolean } = { success: false, message: 'SMTP não verificado', simulated: true };
    try {
      emailResult = await sendWelcomeEmail(store, originUrl);
    } catch (emailErr: any) {
      console.warn('[API Stores] Erro ao enviar e-mail de boas-vindas:', emailErr.message);
      emailResult = { success: false, message: emailErr.message, simulated: false };
    }

    return res.json({
      success: true,
      store,
      postgresSaved,
      dbError,
      emailResult
    });
  });

  // Atualizar Loja (Apenas dono da loja ou superadmin; campos sensíveis restritos ao superadmin)
  app.put('/api/stores/:id', authenticateToken, requireStoreOwner('id'), async (req, res) => {
    const { id } = req.params;
    const store: Partial<StoreProfile> = req.body;

    // Atualizar no disco persistente
    const allStores = diskStorage.getStores();
    const existing = allStores.find(s => s.id === id);
    if (!existing) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }

    // Proteção de campos sensíveis: se não for superadmin, lojista não pode alterar plano, mensalidade, vencimento ou publicação
    if (req.user?.role !== 'superadmin') {
      delete (store as any).mensalidade;
      delete (store as any).status_assinatura;
      delete (store as any).plano;
      delete (store as any).vencimentos;
      delete (store as any).vencimento_mensalidade;
      delete (store as any).data_ultimo_pagamento;
      delete (store as any).is_published;

      store.monthlyFee = existing.monthlyFee;
      store.subscriptionStatus = existing.subscriptionStatus;
      store.plan = existing.plan;
      store.nextDueDate = existing.nextDueDate;
      store.lastPaymentDate = existing.lastPaymentDate;
      store.isPublished = existing.isPublished;
    }

    const merged = { ...existing, ...store } as StoreProfile;
    diskStorage.saveStore(merged);

    try {
      const client = await pool.connect();
      try {
        await client.query(`
          UPDATE usuarios.lojas SET
            nome = COALESCE($1, nome),
            slug = COALESCE($2, slug),
            descricao = COALESCE($3, descricao),
            logo_url = COALESCE($4, logo_url),
            banner_url = COALESCE($5, banner_url),
            whatsapp = COALESCE($6, whatsapp),
            email = COALESCE($7, email),
            telefone = COALESCE($8, telefone),
            instagram = COALESCE($9, instagram),
            cidade = COALESCE($10, cidade),
            estado = COALESCE($11, estado),
            endereco = COALESCE($12, endereco),
            mensalidade = COALESCE($13, mensalidade),
            status_assinatura = COALESCE($14, status_assinatura),
            vencimento_mensalidade = COALESCE($15, vencimento_mensalidade),
            data_ultimo_pagamento = COALESCE($16, data_ultimo_pagamento),
            configuracoes = COALESCE($17, configuracoes),
            is_published = COALESCE($18, is_published),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $19
        `, [
          merged.name,
          merged.slug,
          merged.description,
          merged.logoUrl,
          merged.bannerUrl,
          merged.whatsapp,
          merged.email,
          merged.phone,
          merged.instagram,
          merged.city,
          merged.state,
          merged.address,
          merged.monthlyFee,
          merged.subscriptionStatus,
          merged.nextDueDate,
          merged.lastPaymentDate,
          JSON.stringify(merged),
          merged.isPublished,
          id
        ]);
        return res.json({ success: true, store: merged });
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn('[API Stores] Aviso ao atualizar no PostgreSQL:', err.message);
      return res.json({ success: true, updatedIn: 'disk', postgresSaved: false, dbWarning: err.message, store: merged });
    }
  });

  // Deletar Loja (Apenas dono da loja ou superadmin)
  app.delete('/api/stores/:id', authenticateToken, requireStoreOwner('id'), async (req, res) => {
    const { id } = req.params;
    diskStorage.deleteStore(id);

    try {
      const client = await pool.connect();
      try {
        await client.query('DELETE FROM usuarios.lojas WHERE id = $1', [id]);
        return res.json({ success: true, deletedId: id });
      } finally {
        client.release();
      }
    } catch (err: any) {
      return res.json({ success: true, deletedId: id, postgresSaved: false, dbWarning: err.message });
    }
  });

  // 4. Salvar / Criar Item no Schema Correto (Autenticado: o item deve pertencer à loja do usuário)
  app.post('/api/items', authenticateToken, async (req, res) => {
    const item: StoreItem = req.body;

    if (!item || !item.storeId || typeof item.storeId !== 'string' || item.storeId.trim().length === 0) {
      return res.status(400).json({ error: 'O identificador da loja (storeId) é obrigatório no corpo da requisição.' });
    }

    if (req.user?.role !== 'superadmin' && req.user?.storeId !== item.storeId) {
      return res.status(403).json({ error: 'Acesso negado: você só tem permissão para cadastrar itens na sua própria loja.' });
    }

    diskStorage.saveItem(item);

    try {
      const client = await pool.connect();
      try {
        if (item.itemType === 'veiculo') {
          const v = item as VehicleItem;
          await client.query(`
            INSERT INTO autos.estoque (
              id, loja_id, titulo, tipo, preco, preco_promocional, descricao, fotos,
              destaque, status, marca, modelo, ano_fabricacao, ano_modelo, quilometragem,
              combustivel, cambio, cor, placa_final, blindado,
              tabela_fipe_valor, opcionais, dados_extras, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
            ON CONFLICT (id) DO UPDATE SET
              titulo = EXCLUDED.titulo,
              preco = EXCLUDED.preco,
              preco_promocional = EXCLUDED.preco_promocional,
              descricao = EXCLUDED.descricao,
              fotos = EXCLUDED.fotos,
              destaque = EXCLUDED.destaque,
              status = EXCLUDED.status,
              dados_extras = EXCLUDED.dados_extras,
              updated_at = CURRENT_TIMESTAMP
          `, [
            v.id, v.storeId, v.title, 'veiculo', v.price, null,
            v.description, JSON.stringify(v.images || []), v.featured || false, v.status || 'disponivel',
            v.brand || '', v.model || '', v.yearFab || 2023, v.yearModel || 2024,
            v.mileage || 0, v.fuel || 'flex', v.transmission || 'automatico', v.color || '',
            v.plateEnd || '', false, v.fipePrice || null,
            JSON.stringify(v.accessories || []), JSON.stringify(v), new Date(v.createdAt || Date.now())
          ]);
        } else if (item.itemType === 'imovel') {
          const im = item as RealEstateItem;
          await client.query(`
            INSERT INTO imoveis.catalogo (
              id, loja_id, titulo, tipo, preco, preco_promocional, descricao, fotos,
              destaque, status, tipo_imovel, tipo_transacao, area_util_m2, area_total_m2,
              quartos, suites, banheiros, vagas_garagem, valor_condominio, valor_iptu,
              bairro, cidade, estado, endereco_completo, caracteristicas, dados_extras, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
            ON CONFLICT (id) DO UPDATE SET
              titulo = EXCLUDED.titulo,
              preco = EXCLUDED.preco,
              preco_promocional = EXCLUDED.preco_promocional,
              descricao = EXCLUDED.descricao,
              fotos = EXCLUDED.fotos,
              destaque = EXCLUDED.destaque,
              status = EXCLUDED.status,
              dados_extras = EXCLUDED.dados_extras,
              updated_at = CURRENT_TIMESTAMP
          `, [
            im.id, im.storeId, im.title, 'imovel', im.price, null,
            im.description, JSON.stringify(im.images || []), im.featured || false, im.status || 'disponivel',
            im.propertyType || 'apartamento', im.transactionType || 'venda', im.areaUtil || 80, im.areaTotal || 100,
            im.bedrooms || 2, im.suites || 1, im.bathrooms || 2, im.garageSpots || 1,
            im.condoFee || 0, im.iptu || 0, im.neighborhood || '', im.city || '', im.state || '',
            im.address || '', JSON.stringify(im.amenities || []), JSON.stringify(im),
            new Date(im.createdAt || Date.now())
          ]);
        } else if (item.itemType === 'produto') {
          const pr = item as ProductItem;
          await client.query(`
            INSERT INTO loja.produtos (
              id, loja_id, titulo, tipo, preco, preco_promocional, descricao, fotos,
              destaque, status, sku, categoria, estoque_quantidade, em_estoque,
              condicao, dados_extras, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (id) DO UPDATE SET
              titulo = EXCLUDED.titulo,
              preco = EXCLUDED.preco,
              preco_promocional = EXCLUDED.preco_promocional,
              descricao = EXCLUDED.descricao,
              fotos = EXCLUDED.fotos,
              destaque = EXCLUDED.destaque,
              status = EXCLUDED.status,
              estoque_quantidade = EXCLUDED.estoque_quantidade,
              em_estoque = EXCLUDED.em_estoque,
              dados_extras = EXCLUDED.dados_extras,
              updated_at = CURRENT_TIMESTAMP
          `, [
            pr.id, pr.storeId, pr.title, 'produto', pr.price, pr.promotionalPrice || null,
            pr.description, JSON.stringify(pr.images || []), pr.featured || false, pr.status || 'ativo',
            pr.sku || '', pr.category || 'Geral', pr.stockQuantity || 10, pr.inStock !== false,
            pr.condition || 'novo', JSON.stringify(pr), new Date(pr.createdAt || Date.now())
          ]);
        } else if (item.itemType === 'servico') {
          const sr = item as ServiceItem;
          await client.query(`
            INSERT INTO servicos.catalogo (
              id, loja_id, titulo, tipo, preco, preco_promocional, descricao, fotos,
              destaque, status, tipo_preco, duracao_estimada,
              itens_inclusos, dados_extras, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (id) DO UPDATE SET
              titulo = EXCLUDED.titulo,
              preco = EXCLUDED.preco,
              preco_promocional = EXCLUDED.preco_promocional,
              descricao = EXCLUDED.descricao,
              fotos = EXCLUDED.fotos,
              destaque = EXCLUDED.destaque,
              status = EXCLUDED.status,
              dados_extras = EXCLUDED.dados_extras,
              updated_at = CURRENT_TIMESTAMP
          `, [
            sr.id, sr.storeId, sr.title, 'servico', sr.price || 0, null,
            sr.description, JSON.stringify(sr.images || []), sr.featured || false, sr.status || 'ativo',
            sr.priceType || 'fixo', sr.estimatedDuration || '',
            JSON.stringify(sr.includedItems || []), JSON.stringify(sr), new Date(sr.createdAt || Date.now())
          ]);
        }
        return res.json({ success: true, item });
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn('[API Items] Item salvo em disco. Aviso PostgreSQL:', err.message);
      return res.json({ success: true, item, postgresSaved: false, dbWarning: err.message });
    }
  });

  // Deletar Item (Autenticado: o item deve pertencer à loja do usuário ou superadmin)
  app.delete('/api/items/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    let itemStoreId: string | undefined = undefined;

    const existingDisk = diskStorage.getItems().find(i => i.id === id);
    if (existingDisk) {
      itemStoreId = existingDisk.storeId;
    }

    // Conferir também no registro do banco de dados (PostgreSQL)
    try {
      const client = await pool.connect();
      try {
        const check = await client.query(`
          SELECT loja_id FROM autos.estoque WHERE id = $1
          UNION ALL
          SELECT loja_id FROM imoveis.catalogo WHERE id = $1
          UNION ALL
          SELECT loja_id FROM loja.produtos WHERE id = $1
          UNION ALL
          SELECT loja_id FROM servicos.catalogo WHERE id = $1
          LIMIT 1
        `, [id]);
        if (check.rows.length > 0 && check.rows[0].loja_id) {
          itemStoreId = check.rows[0].loja_id;
        }
      } finally {
        client.release();
      }
    } catch {
      // Fallback em caso de banco offline
    }

    if (itemStoreId && req.user?.role !== 'superadmin' && req.user?.storeId !== itemStoreId) {
      return res.status(403).json({ error: 'Acesso negado: este item pertence a outra loja.' });
    }

    diskStorage.deleteItem(id);

    try {
      const client = await pool.connect();
      try {
        await client.query('DELETE FROM autos.estoque WHERE id = $1', [id]);
        await client.query('DELETE FROM imoveis.catalogo WHERE id = $1', [id]);
        await client.query('DELETE FROM loja.produtos WHERE id = $1', [id]);
        await client.query('DELETE FROM servicos.catalogo WHERE id = $1', [id]);
        return res.json({ success: true, deletedId: id });
      } finally {
        client.release();
      }
    } catch (err: any) {
      return res.json({ success: true, deletedId: id, postgresSaved: false, dbWarning: err.message });
    }
  });

  // 5. Obter Leads (Protegido por autenticação)
  app.get('/api/leads', authenticateToken, async (req, res) => {
    const allLeads = diskStorage.getLeads();
    if (req.user?.role === 'superadmin') {
      return res.json(allLeads);
    }
    if (req.user?.role === 'lojista' && req.user?.storeId) {
      return res.json(allLeads.filter(l => l.storeId === req.user?.storeId));
    }
    return res.status(403).json({ error: 'Acesso negado aos leads.' });
  });

  // Salvar / Criar Proposta ou Lead (Público com rate limit próprio e validação rigorosa de campos)
  app.post('/api/leads', leadLimiter, async (req, res) => {
    const rawLead: ProposalLead = req.body;

    if (!rawLead || typeof rawLead !== 'object') {
      return res.status(400).json({ error: 'Dados da proposta inválidos.' });
    }

    const { storeId, clientName, clientPhone, clientEmail, itemTitle, clientMessage } = rawLead;

    // 1. Validação obrigatória da loja
    if (!storeId || typeof storeId !== 'string' || storeId.trim().length === 0) {
      return res.status(400).json({ error: 'Identificação da loja de destino é obrigatória.' });
    }
    const cleanStoreId = storeId.trim();
    const storeExists = diskStorage.getStores().some(s => s.id === cleanStoreId);
    if (!storeExists) {
      return res.status(404).json({ error: 'A loja informada não foi encontrada.' });
    }

    // 2. Validação do nome do cliente (2 a 100 caracteres)
    const cleanName = typeof clientName === 'string' ? clientName.trim() : '';
    if (cleanName.length < 2 || cleanName.length > 100) {
      return res.status(400).json({ error: 'Nome do cliente deve conter entre 2 e 100 caracteres.' });
    }

    // 3. Validação do telefone/WhatsApp (mínimo 8 dígitos numéricos válidos)
    const cleanPhone = typeof clientPhone === 'string' ? clientPhone.trim() : '';
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    if (digitsOnly.length < 8 || digitsOnly.length > 16) {
      return res.status(400).json({ error: 'Por favor, informe um número de telefone/WhatsApp válido com DDD.' });
    }

    // 4. Validação de formato de e-mail (se preenchido)
    const cleanEmail = typeof clientEmail === 'string' ? clientEmail.trim().toLowerCase() : '';
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'O e-mail informado possui formato inválido.' });
    }

    // 5. Validação e sanitização da mensagem e título
    const cleanTitle = typeof itemTitle === 'string' && itemTitle.trim() ? itemTitle.slice(0, 200).trim() : 'Interesse no Anúncio';
    const cleanMessage = typeof clientMessage === 'string' ? clientMessage.slice(0, 2000).trim() : '';

    const lead: ProposalLead = {
      ...rawLead,
      id: rawLead.id || `lead-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      storeId: cleanStoreId,
      clientName: cleanName,
      clientPhone: cleanPhone,
      clientEmail: cleanEmail,
      itemTitle: cleanTitle,
      clientMessage: cleanMessage,
      status: 'novo',
      createdAt: rawLead.createdAt || new Date().toISOString()
    };

    diskStorage.saveLead(lead);

    try {
      const client = await pool.connect();
      try {
        if (lead.itemType === 'produto') {
          try {
            await client.query(`
              INSERT INTO loja.pedidos (
                id, loja_id, item_id, item_title, item_type, item_price,
                client_name, client_phone, client_email,
                client_message, proposal_value, payment_method, trade_details,
                order_type, delivery_address, quantity, change_for,
                status, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
              ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                client_message = EXCLUDED.client_message
            `, [
              lead.id, lead.storeId, lead.itemId, lead.itemTitle, lead.itemType, lead.itemPrice || 0,
              lead.clientName, lead.clientPhone, lead.clientEmail || '',
              lead.clientMessage || '', lead.proposalValue || null, lead.paymentMethod || 'outro',
              lead.tradeDetails || '', lead.orderType || 'entrega', lead.deliveryAddress || null,
              lead.quantity || 1, lead.changeFor || null,
              lead.status || 'novo', new Date(lead.createdAt || Date.now())
            ]);
            return res.json({ success: true, lead });
          } catch {
            // Em caso de incompatibilidade de colunas na versão anterior do PostgreSQL, cai no insert genérico abaixo
          }
        }

        const table = lead.itemType === 'veiculo' ? 'autos.propostas'
                    : lead.itemType === 'imovel' ? 'imoveis.propostas'
                    : lead.itemType === 'produto' ? 'loja.pedidos'
                    : 'servicos.orcamentos';

        await client.query(`
          INSERT INTO ${table} (
            id, loja_id, item_id, item_title, item_type, item_price,
            client_name, client_phone, client_email,
            client_message, proposal_value, payment_method, trade_details, status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            client_message = EXCLUDED.client_message
        `, [
          lead.id, lead.storeId, lead.itemId, lead.itemTitle, lead.itemType, lead.itemPrice || 0,
          lead.clientName, lead.clientPhone, lead.clientEmail || '',
          lead.clientMessage || '', lead.proposalValue || null, lead.paymentMethod || 'outro',
          lead.tradeDetails || '', lead.status || 'novo', new Date(lead.createdAt || Date.now())
        ]);
        return res.json({ success: true, lead });
      } finally {
        client.release();
      }
    } catch (err: any) {
      return res.json({ success: true, lead, warning: err.message });
    }
  });

  // Atualizar Status do Lead (Autenticado: apenas o dono da loja do lead ou superadmin)
  app.put('/api/leads/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    let existing = diskStorage.getLeads().find(l => l.id === id);
    let leadStoreId = existing?.storeId;

    if (!leadStoreId) {
      try {
        const client = await pool.connect();
        try {
          const check = await client.query(`
            SELECT loja_id FROM autos.propostas WHERE id = $1
            UNION ALL
            SELECT loja_id FROM imoveis.propostas WHERE id = $1
            UNION ALL
            SELECT loja_id FROM loja.pedidos WHERE id = $1
            UNION ALL
            SELECT loja_id FROM servicos.orcamentos WHERE id = $1
            LIMIT 1
          `, [id]);
          if (check.rows.length > 0 && check.rows[0].loja_id) {
            leadStoreId = check.rows[0].loja_id;
          }
        } finally {
          client.release();
        }
      } catch {}
    }

    if (leadStoreId && req.user?.role !== 'superadmin' && req.user?.storeId !== leadStoreId) {
      return res.status(403).json({ error: 'Acesso negado: você não tem permissão para gerenciar leads desta loja.' });
    }

    diskStorage.updateLeadStatus(id, status);

    try {
      const client = await pool.connect();
      try {
        await client.query('UPDATE autos.propostas SET status = $1 WHERE id = $2', [status, id]);
        await client.query('UPDATE imoveis.propostas SET status = $1 WHERE id = $2', [status, id]);
        await client.query('UPDATE loja.pedidos SET status = $1 WHERE id = $2', [status, id]);
        await client.query('UPDATE servicos.orcamentos SET status = $1 WHERE id = $2', [status, id]);
        return res.json({ success: true });
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn('[API Leads] Aviso ao atualizar lead no PostgreSQL:', err.message);
      return res.json({ success: true, updatedIn: 'disk', postgresSaved: false, dbWarning: err.message });
    }
  });

  // Deletar Lead (Autenticado: apenas o dono da loja do lead ou superadmin)
  app.delete('/api/leads/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    let existing = diskStorage.getLeads().find(l => l.id === id);
    let leadStoreId = existing?.storeId;

    if (!leadStoreId) {
      try {
        const client = await pool.connect();
        try {
          const check = await client.query(`
            SELECT loja_id FROM autos.propostas WHERE id = $1
            UNION ALL
            SELECT loja_id FROM imoveis.propostas WHERE id = $1
            UNION ALL
            SELECT loja_id FROM loja.pedidos WHERE id = $1
            UNION ALL
            SELECT loja_id FROM servicos.orcamentos WHERE id = $1
            LIMIT 1
          `, [id]);
          if (check.rows.length > 0 && check.rows[0].loja_id) {
            leadStoreId = check.rows[0].loja_id;
          }
        } finally {
          client.release();
        }
      } catch {}
    }

    if (leadStoreId && req.user?.role !== 'superadmin' && req.user?.storeId !== leadStoreId) {
      return res.status(403).json({ error: 'Acesso negado: você não tem permissão para excluir leads desta loja.' });
    }

    diskStorage.deleteLead(id);

    try {
      const client = await pool.connect();
      try {
        await client.query('DELETE FROM autos.propostas WHERE id = $1', [id]);
        await client.query('DELETE FROM imoveis.propostas WHERE id = $1', [id]);
        await client.query('DELETE FROM loja.pedidos WHERE id = $1', [id]);
        await client.query('DELETE FROM servicos.orcamentos WHERE id = $1', [id]);
        return res.json({ success: true, deletedId: id });
      } finally {
        client.release();
      }
    } catch (err: any) {
      return res.json({ success: true, deletedId: id, postgresSaved: false, dbWarning: err.message });
    }
  });

  // 6. Atualizar Configurações Globais da Plataforma (Restrito ao Administrador Master)
  app.put('/api/settings', authenticateToken, requireSuperAdmin, async (req, res) => {
    const settings = req.body;
    diskStorage.saveSettings(settings);

    try {
      const client = await pool.connect();
      try {
        await client.query(`
          INSERT INTO usuarios.platform_settings (
            id, platform_name, superadmin_name, superadmin_email, superadmin_phone,
            pix_key, pix_key_type, pix_beneficiary, default_trial_days, configuracoes_gerais
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            platform_name = EXCLUDED.platform_name,
            superadmin_name = EXCLUDED.superadmin_name,
            superadmin_email = EXCLUDED.superadmin_email,
            superadmin_phone = EXCLUDED.superadmin_phone,
            pix_key = EXCLUDED.pix_key,
            pix_key_type = EXCLUDED.pix_key_type,
            pix_beneficiary = EXCLUDED.pix_beneficiary,
            default_trial_days = EXCLUDED.default_trial_days,
            configuracoes_gerais = EXCLUDED.configuracoes_gerais,
            updated_at = CURRENT_TIMESTAMP
        `, [
          'main_settings',
          settings.platformName,
          settings.superAdminName,
          settings.superAdminEmail,
          settings.superAdminPhone,
          settings.pixKey,
          settings.pixKeyType,
          settings.pixBeneficiary,
          settings.defaultTrialDays || 7,
          JSON.stringify(settings)
        ]);
        return res.json({ success: true, settings });
      } finally {
        client.release();
      }
    } catch (err: any) {
      return res.json({ success: true, settings, postgresSaved: false, dbWarning: err.message });
    }
  });

  // 7. Resetar e Semear Novamente os Dados Padrão (Restrito ao Administrador Master)
  app.post('/api/reset-defaults', authenticateToken, requireSuperAdmin, async (req, res) => {
    diskStorage.resetToDefaults();
    try {
      await seedDatabase();
      return res.json({ success: true, message: 'Dados padrão restaurados com sucesso em todos os 5 schemas e disco!' });
    } catch (err: any) {
      return res.json({ success: true, message: 'Dados padrão restaurados no armazenamento em disco!', postgresSaved: false, dbWarning: err.message });
    }
  });

  // 7.1 Migrar / Sincronizar todos os dados do Disco Persistente para o PostgreSQL (Restrito ao Administrador Master)
  app.post('/api/migrate-to-postgres', authenticateToken, requireSuperAdmin, async (req, res) => {
    const stores = diskStorage.getStores();
    const items = diskStorage.getItems();
    const leads = diskStorage.getLeads();
    const settings = diskStorage.getSettings();

    let migratedStores = 0;
    let migratedItems = 0;
    let migratedLeads = 0;
    const errors: string[] = [];

    try {
      const client = await pool.connect();
      try {
        // 1. Migrar Lojas
        for (const store of stores) {
          try {
            await client.query(`
              INSERT INTO usuarios.lojas (
                id, nome, slug, tipo, descricao, slogan, theme_color, logo_url, banner_url,
                whatsapp, email, telefone, instagram, cidade, estado, endereco,
                plano_tier, mensalidade, status_assinatura, vencimento_mensalidade,
                data_ultimo_pagamento, owner_name, owner_email, owner_phone,
                configuracoes, is_published, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
              ON CONFLICT (id) DO UPDATE SET
                nome = EXCLUDED.nome,
                slug = EXCLUDED.slug,
                tipo = EXCLUDED.tipo,
                descricao = EXCLUDED.descricao,
                slogan = EXCLUDED.slogan,
                theme_color = EXCLUDED.theme_color,
                logo_url = EXCLUDED.logo_url,
                banner_url = EXCLUDED.banner_url,
                whatsapp = EXCLUDED.whatsapp,
                email = EXCLUDED.email,
                telefone = EXCLUDED.telefone,
                instagram = EXCLUDED.instagram,
                cidade = EXCLUDED.cidade,
                estado = EXCLUDED.estado,
                endereco = EXCLUDED.endereco,
                mensalidade = EXCLUDED.mensalidade,
                status_assinatura = EXCLUDED.status_assinatura,
                vencimento_mensalidade = EXCLUDED.vencimento_mensalidade,
                data_ultimo_pagamento = EXCLUDED.data_ultimo_pagamento,
                owner_name = EXCLUDED.owner_name,
                owner_email = EXCLUDED.owner_email,
                owner_phone = EXCLUDED.owner_phone,
                configuracoes = EXCLUDED.configuracoes,
                is_published = EXCLUDED.is_published,
                updated_at = CURRENT_TIMESTAMP
            `, [
              store.id, store.name, store.slug, store.type, store.description || '', store.slogan || '',
              store.themeColor || '#2563eb', store.logoUrl || '', store.bannerUrl || '', store.whatsapp,
              store.email || '', store.phone || '', store.instagram || '', store.city || '', store.state || '',
              store.address || '', store.plan || 'pro', store.monthlyFee || 30.00, store.subscriptionStatus || 'ativo',
              store.nextDueDate || '2026-09-15', store.lastPaymentDate || '2026-08-15', store.ownerName || 'Lojista',
              store.ownerEmail || store.email || '', store.ownerPhone || store.whatsapp, JSON.stringify(store),
              store.isPublished !== false, new Date(store.createdAt || Date.now())
            ]);
            migratedStores++;
          } catch (e: any) {
            errors.push(`Loja ${store.name} (${store.id}): ${e.message}`);
          }
        }

        // 2. Migrar Itens
        for (const item of items) {
          try {
            if (item.itemType === 'veiculo') {
              const v = item as VehicleItem;
              await client.query(`
                INSERT INTO autos.estoque (
                  id, loja_id, titulo, tipo, preco, preco_promocional, descricao, fotos,
                  destaque, status, marca, modelo, ano_fabricacao, ano_modelo, quilometragem,
                  combustivel, cambio, cor, placa_final, blindado,
                  tabela_fipe_valor, opcionais, dados_extras, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
                ON CONFLICT (id) DO UPDATE SET
                  titulo = EXCLUDED.titulo,
                  preco = EXCLUDED.preco,
                  preco_promocional = EXCLUDED.preco_promocional,
                  descricao = EXCLUDED.descricao,
                  fotos = EXCLUDED.fotos,
                  destaque = EXCLUDED.destaque,
                  status = EXCLUDED.status,
                  dados_extras = EXCLUDED.dados_extras,
                  updated_at = CURRENT_TIMESTAMP
              `, [
                v.id, v.storeId, v.title, 'veiculo', v.price, null,
                v.description, JSON.stringify(v.images || []), v.featured || false, v.status || 'disponivel',
                v.brand || '', v.model || '', v.yearFab || 2023, v.yearModel || 2024,
                v.mileage || 0, v.fuel || 'flex', v.transmission || 'automatico', v.color || '',
                v.plateEnd || '', false, v.fipePrice || null,
                JSON.stringify(v.accessories || []), JSON.stringify(v), new Date(v.createdAt || Date.now())
              ]);
            } else if (item.itemType === 'imovel') {
              const im = item as RealEstateItem;
              await client.query(`
                INSERT INTO imoveis.catalogo (
                  id, loja_id, titulo, tipo, preco, preco_promocional, descricao, fotos,
                  destaque, status, tipo_imovel, tipo_transacao, area_util_m2, area_total_m2,
                  quartos, suites, banheiros, vagas_garagem, valor_condominio, valor_iptu,
                  bairro, cidade, estado, endereco_completo, caracteristicas, dados_extras, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
                ON CONFLICT (id) DO UPDATE SET
                  titulo = EXCLUDED.titulo,
                  preco = EXCLUDED.preco,
                  preco_promocional = EXCLUDED.preco_promocional,
                  descricao = EXCLUDED.descricao,
                  fotos = EXCLUDED.fotos,
                  destaque = EXCLUDED.destaque,
                  status = EXCLUDED.status,
                  dados_extras = EXCLUDED.dados_extras,
                  updated_at = CURRENT_TIMESTAMP
              `, [
                im.id, im.storeId, im.title, 'imovel', im.price, null,
                im.description, JSON.stringify(im.images || []), im.featured || false, im.status || 'disponivel',
                im.propertyType || 'apartamento', im.transactionType || 'venda', im.areaUtil || 80, im.areaTotal || 100,
                im.bedrooms || 2, im.suites || 1, im.bathrooms || 2, im.garageSpots || 1,
                im.condoFee || 0, im.iptu || 0, im.neighborhood || '', im.city || 'São Paulo', im.state || 'SP',
                im.address || '', JSON.stringify(im.amenities || []), JSON.stringify(im),
                new Date(im.createdAt || Date.now())
              ]);
            } else if (item.itemType === 'produto') {
              const pr = item as ProductItem;
              await client.query(`
                INSERT INTO loja.produtos (
                  id, loja_id, titulo, tipo, preco, preco_promocional, descricao, fotos,
                  destaque, status, sku, categoria, estoque_quantidade, em_estoque,
                  condicao, dados_extras, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                ON CONFLICT (id) DO UPDATE SET
                  titulo = EXCLUDED.titulo,
                  preco = EXCLUDED.preco,
                  preco_promocional = EXCLUDED.preco_promocional,
                  descricao = EXCLUDED.descricao,
                  fotos = EXCLUDED.fotos,
                  destaque = EXCLUDED.destaque,
                  status = EXCLUDED.status,
                  estoque_quantidade = EXCLUDED.estoque_quantidade,
                  em_estoque = EXCLUDED.em_estoque,
                  dados_extras = EXCLUDED.dados_extras,
                  updated_at = CURRENT_TIMESTAMP
              `, [
                pr.id, pr.storeId, pr.title, 'produto', pr.price, pr.promotionalPrice || null,
                pr.description, JSON.stringify(pr.images || []), pr.featured || false, pr.status || 'ativo',
                pr.sku || '', pr.category || 'Geral', pr.stockQuantity || 10, pr.inStock !== false,
                pr.condition || 'novo', JSON.stringify(pr), new Date(pr.createdAt || Date.now())
              ]);
            } else if (item.itemType === 'servico') {
              const sr = item as ServiceItem;
              await client.query(`
                INSERT INTO servicos.catalogo (
                  id, loja_id, titulo, tipo, preco, preco_promocional, descricao, fotos,
                  destaque, status, tipo_preco, duracao_estimada,
                  itens_inclusos, dados_extras, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                ON CONFLICT (id) DO UPDATE SET
                  titulo = EXCLUDED.titulo,
                  preco = EXCLUDED.preco,
                  preco_promocional = EXCLUDED.preco_promocional,
                  descricao = EXCLUDED.descricao,
                  fotos = EXCLUDED.fotos,
                  destaque = EXCLUDED.destaque,
                  status = EXCLUDED.status,
                  dados_extras = EXCLUDED.dados_extras,
                  updated_at = CURRENT_TIMESTAMP
              `, [
                sr.id, sr.storeId, sr.title, 'servico', sr.price || 0, null,
                sr.description, JSON.stringify(sr.images || []), sr.featured || false, sr.status || 'ativo',
                sr.priceType || 'fixo', sr.estimatedDuration || 'A combinar',
                JSON.stringify(sr.includedItems || []), JSON.stringify(sr), new Date(sr.createdAt || Date.now())
              ]);
            }
            migratedItems++;
          } catch (e: any) {
            errors.push(`Item ${item.title} (${item.id}): ${e.message}`);
          }
        }

        // 3. Migrar Leads
        for (const lead of leads) {
          try {
            const table = lead.itemType === 'veiculo' ? 'autos.propostas'
                        : lead.itemType === 'imovel' ? 'imoveis.propostas'
                        : lead.itemType === 'produto' ? 'loja.pedidos'
                        : 'servicos.orcamentos';

            await client.query(`
              INSERT INTO ${table} (
                id, loja_id, item_id, item_title, item_type, item_price,
                client_name, client_phone, client_email,
                client_message, proposal_value, payment_method, trade_details, status, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
              ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                client_message = EXCLUDED.client_message
            `, [
              lead.id, lead.storeId, lead.itemId, lead.itemTitle, lead.itemType, lead.itemPrice || 0,
              lead.clientName, lead.clientPhone, lead.clientEmail || '',
              lead.clientMessage || '', lead.proposalValue || null, lead.paymentMethod || 'outro',
              lead.tradeDetails || '', lead.status || 'novo', new Date(lead.createdAt || Date.now())
            ]);
            migratedLeads++;
          } catch (e: any) {
            errors.push(`Lead ${lead.clientName} (${lead.id}): ${e.message}`);
          }
        }

        return res.json({
          success: true,
          migratedStores,
          migratedItems,
          migratedLeads,
          errors: errors.length > 0 ? errors : undefined,
          message: `Sincronização concluída: ${migratedStores} lojas, ${migratedItems} itens e ${migratedLeads} leads persistidos no PostgreSQL!`
        });
      } finally {
        client.release();
      }
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message,
        message: 'Não foi possível conectar ao banco de dados PostgreSQL para executar a migração.'
      });
    }
  });

  // ============================================================================
  // ROTAS DE E-MAIL TRANSACIONAL (Restritas ao Administrador Master)
  // ============================================================================

  // 8. Checar Status da Configuração de E-mail / SMTP (Restrito ao Super Admin)
  app.get('/api/email/status', authenticateToken, requireSuperAdmin, async (req, res) => {
    const isConfigured = isSmtpConfigured();
    const config = getSmtpConfig();

    if (!isConfigured) {
      return res.json({
        configured: false,
        host: config.host || 'Não definido no .env',
        port: config.port,
        user: config.user || 'Não definido no .env',
        from: config.from,
        message: 'SMTP não configurado. Para envio de e-mails em produção, preencha SMTP_HOST, SMTP_USER e SMTP_PASS no .env.'
      });
    }

    const testResult = await testSmtpConnection();
    return res.json({
      configured: true,
      connected: testResult.success,
      host: config.host,
      port: config.port,
      user: config.user,
      from: config.from,
      message: testResult.message
    });
  });

  // Salvar Configuração de SMTP diretamente pelo Painel (Restrito ao Super Admin)
  app.post('/api/email/config', authenticateToken, requireSuperAdmin, async (req, res) => {
    const { host, port, user, pass, secure, from } = req.body;
    
    if (!host || !user || !pass) {
      return res.status(400).json({ 
        success: false, 
        message: 'Host, usuário e senha de SMTP são obrigatórios.' 
      });
    }

    const saved = saveSmtpConfig({ host, port, user, pass, secure, from });
    if (!saved) {
      return res.status(500).json({ success: false, message: 'Falha ao gravar arquivo de configuração de e-mail.' });
    }

    const testResult = await testSmtpConnection();
    return res.json({
      success: true,
      saved: true,
      connected: testResult.success,
      message: testResult.message,
      configDetails: testResult.configDetails
    });
  });

  // 9. Enviar E-mail de Teste (Restrito ao Super Admin)
  app.post('/api/email/test', authenticateToken, requireSuperAdmin, async (req, res) => {
    const { to } = req.body;
    if (!to || typeof to !== 'string') {
      return res.status(400).json({ error: 'E-mail de destino ("to") é obrigatório.' });
    }

    const result = await sendTestEmail(to);
    return res.json(result);
  });

  // 10. Reenviar E-mail de Confirmação de Cadastro para uma Loja (Restrito ao Super Admin)
  app.post('/api/email/send-welcome', authenticateToken, requireSuperAdmin, async (req, res) => {
    const { store } = req.body;
    if (!store || !store.id) {
      return res.status(400).json({ error: 'Objeto de loja inválido.' });
    }

    if (req.user?.role !== 'superadmin' && req.user?.storeId !== store.id) {
      return res.status(403).json({ error: 'Você não tem permissão para enviar e-mails em nome desta loja.' });
    }

    const originUrl = req.get('origin') || process.env.APP_URL;
    const result = await sendWelcomeEmail(store, originUrl);
    return res.json(result);
  });

  // 13. Auto-Deploy / Atualização do Sistema da Nuvem (Restrito ao Super Admin)
  app.post('/api/system/update', authenticateToken, requireSuperAdmin, async (req, res) => {
    console.log('[System Update] Iniciando processo de atualização remota...');
    
    // Comando para atualizar via git, instalar dependências e recompilar
    const updateCommand = 'git fetch origin && git reset --hard origin/main && npm run build';
    
    exec(updateCommand, { cwd: process.cwd(), timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('[System Update Error]:', error, stderr);
        // Tenta fallback com git pull simples
        exec('git pull origin main && npm run build', { cwd: process.cwd(), timeout: 120000 }, (fallbackErr, fallbackStdout, fallbackStderr) => {
          if (fallbackErr) {
            return res.status(500).json({
              success: false,
              error: fallbackErr.message,
              output: (stdout || '') + '\n' + (stderr || '') + '\n' + (fallbackStderr || '')
            });
          }

          res.json({
            success: true,
            message: 'Código atualizado do GitHub e build de produção concluído com sucesso! Reiniciando processo no PM2...',
            output: fallbackStdout || 'Build concluído com sucesso.'
          });

          setTimeout(() => {
            exec('pm2 restart 3facil || pm2 restart all', (pm2Err) => {
              if (pm2Err) console.warn('[PM2 Restart Warning]:', pm2Err.message);
            });
          }, 1500);
        });
        return;
      }

      console.log('[System Update Output]:', stdout);
      
      // Responde primeiro antes de reiniciar o PM2
      res.json({
        success: true,
        message: 'Código atualizado do GitHub e build de produção concluído com sucesso! Reiniciando processo no PM2...',
        output: stdout || 'Build concluído com sucesso.'
      });

      // Agenda reinicialização via PM2 após 1.5 segundo
      setTimeout(() => {
        exec('pm2 restart 3facil || pm2 restart all', (pm2Err) => {
          if (pm2Err) {
            console.warn('[PM2 Restart Warning]:', pm2Err.message);
          }
        });
      }, 1500);
    });
  });

  // 12. Obter Informações da Versão do Sistema / Git (Restrito ao Super Admin)
  app.get('/api/system/info', authenticateToken, requireSuperAdmin, (req, res) => {
    exec('git log -1 --format="%h - %s (%cr)"', { cwd: process.cwd() }, (err, stdout) => {
      const commit = (!err && stdout && stdout.trim()) ? stdout.trim() : '3facil.com (Produção Online)';
      exec('git rev-parse --abbrev-ref HEAD', { cwd: process.cwd() }, (branchErr, branchStdout) => {
        const branch = (!branchErr && branchStdout && branchStdout.trim()) ? branchStdout.trim() : 'main';
        exec('git remote get-url origin', { cwd: process.cwd() }, (remoteErr, remoteUrlStdout) => {
          const remoteUrl = (!remoteErr && remoteUrlStdout && remoteUrlStdout.trim()) ? remoteUrlStdout.trim() : 'GitHub';
          res.json({
            lastCommit: commit,
            branch,
            remoteUrl,
            nodeVersion: process.version,
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            success: true
          });
        });
      });
    });
  });

  // 13. Checar se há atualizações pendentes no GitHub (Restrito ao Super Admin)
  app.get('/api/system/check-update', authenticateToken, requireSuperAdmin, (req, res) => {
    // 1. Faz fetch silencioso da branch main
    exec('git fetch origin main', { cwd: process.cwd(), timeout: 25000 }, (fetchErr, fetchStdout, fetchStderr) => {
      exec('git rev-parse HEAD', { cwd: process.cwd() }, (err1, localHead) => {
        exec('git rev-parse origin/main', { cwd: process.cwd() }, (err2, remoteHead) => {
          const local = (localHead || '').trim();
          const remote = (remoteHead || '').trim();
          const hasUpdate = Boolean(local && remote && local !== remote);

          if (hasUpdate) {
            exec('git log HEAD..origin/main --oneline -n 15', { cwd: process.cwd() }, (err3, pendingLog) => {
              const commits = (pendingLog || '').trim().split('\n').filter(Boolean);
              res.json({
                hasUpdate: true,
                localCommit: local.slice(0, 7),
                remoteCommit: remote.slice(0, 7),
                commitsBehind: commits.length || 1,
                pendingCommits: commits,
                message: `Há ${commits.length || 1} nova(s) atualização(ões) no GitHub prontas para instalar!`,
                checkedAt: new Date().toISOString()
              });
            });
          } else {
            res.json({
              hasUpdate: false,
              localCommit: local ? local.slice(0, 7) : 'online',
              remoteCommit: remote ? remote.slice(0, 7) : 'online',
              commitsBehind: 0,
              pendingCommits: [],
              message: 'Seu sistema está sincronizado com a versão mais recente do GitHub!',
              fetchDetails: fetchStderr ? fetchStderr.trim() : 'ok',
              checkedAt: new Date().toISOString()
            });
          }
        });
      });
    });
  });

  // Configuração do multer em memória para receber o arquivo .zip
  const uploadZip = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // Até 100MB
  });

  // ENDPOINT: Upload de arquivo ZIP para atualização direta sem Git/FileZilla (Restrito ao Super Admin)
  app.post('/api/admin/upload-update-zip', authenticateToken, requireSuperAdmin, (uploadZip.single('updateZip') as any), async (req, res) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ success: false, error: 'Nenhum arquivo .zip foi enviado.' });
      }

      const zip = new AdmZip(req.file.buffer);
      const zipEntries = zip.getEntries();
      const rootDir = process.cwd();

      // Detectar se os arquivos no zip estão dentro de uma subpasta raiz (ex: site3facil-main/)
      let prefix = '';
      const hasSrcAtRoot = zipEntries.some(e => e.entryName === 'src/' || e.entryName.startsWith('src/'));
      if (!hasSrcAtRoot) {
        const sampleEntry = zipEntries.find(e => e.entryName.includes('/src/'));
        if (sampleEntry) {
          prefix = sampleEntry.entryName.split('/src/')[0] + '/';
        }
      }

      let extractedFilesCount = 0;
      const ignoredFiles = ['.env', '.env.local', 'node_modules/', 'dist/', '.git/', 'data/', 'postgres_data/'];

      for (const entry of zipEntries) {
        let relativePath = entry.entryName;
        if (prefix && relativePath.startsWith(prefix)) {
          relativePath = relativePath.slice(prefix.length);
        }

        if (!relativePath || relativePath.startsWith('.')) continue;

        // Proteger arquivos sensíveis de banco e ambiente
        const shouldIgnore = ignoredFiles.some(ignored => relativePath === ignored || relativePath.startsWith(ignored));
        if (shouldIgnore) continue;

        const targetPath = path.join(rootDir, relativePath);

        if (entry.isDirectory) {
          if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
          }
        } else {
          const parentDir = path.dirname(targetPath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
          fs.writeFileSync(targetPath, entry.getData());
          extractedFilesCount++;
        }
      }

      console.log(`[Update ZIP] ${extractedFilesCount} arquivos extraídos com sucesso.`);

      // Responde imediatamente ao frontend avisando que a extração foi concluída e o build está iniciando
      res.json({
        success: true,
        message: `${extractedFilesCount} arquivos substituídos com sucesso! O build e reinicialização do sistema foram iniciados.`,
        extractedFilesCount
      });

      // Executa o build e o restart em segundo plano
      setTimeout(() => {
        console.log('[Update ZIP] Iniciando npm run build...');
        exec('npm run build', { cwd: rootDir }, (buildErr, buildStdout, buildStderr) => {
          if (buildErr) {
            console.error('[Update ZIP] Erro no build:', buildStderr || buildErr.message);
          } else {
            console.log('[Update ZIP] Build concluído com sucesso. Reiniciando PM2...');
            exec('pm2 restart 3facil --update-env || pm2 restart all', { cwd: rootDir }, (pm2Err) => {
              if (pm2Err) {
                console.log('[Update ZIP] Aviso ao reiniciar PM2:', pm2Err.message);
              } else {
                console.log('[Update ZIP] Sistema 3Fácil reiniciado e 100% atualizado!');
              }
            });
          }
        });
      }, 500);

    } catch (err: any) {
      console.error('[Update ZIP] Erro ao descompactar:', err);
      res.status(500).json({ success: false, error: err.message || 'Erro ao processar arquivo ZIP.' });
    }
  });

  // ============================================================================
  // SERVIÇO DE ARQUIVOS ESTÁTICOS / UPLOADS DE IMAGENS E MÍDIAS
  // ============================================================================
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const uploadsImoveisDir = path.join(process.cwd(), 'uploads_imoveis');

  // Garante que os diretórios existam
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(uploadsImoveisDir)) {
    fs.mkdirSync(uploadsImoveisDir, { recursive: true });
  }

  // Helper para verificar o formato binário real da imagem (magic bytes) e garantir Content-Type correto
  const sendVerifiedMediaFile = (filePath: string, res: express.Response) => {
    try {
      const fullPath = path.resolve(filePath);
      const fd = fs.openSync(fullPath, 'r');
      const header = Buffer.alloc(16);
      fs.readSync(fd, header, 0, 16, 0);
      fs.closeSync(fd);

      let mime = 'image/jpeg';
      if (header.length >= 3 && header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
        mime = 'image/jpeg';
      } else if (header.length >= 8 && header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
        mime = 'image/png';
      } else if (header.length >= 12 && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP') {
        mime = 'image/webp';
      } else if (header.length >= 4 && header.toString('ascii', 0, 4) === 'GIF8') {
        mime = 'image/gif';
      } else {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.webp') mime = 'image/webp';
        else if (ext === '.png') mime = 'image/png';
        else if (ext === '.svg') mime = 'image/svg+xml';
        else if (ext === '.gif') mime = 'image/gif';
      }

      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      return res.sendFile(fullPath);
    } catch {
      return res.sendFile(path.resolve(filePath));
    }
  };

  // Middleware inteligente para servir imagens locais com suporte a fallback de extensão (.webp <-> .jpg <-> .png)
  // e mapeamento de aliases (/uploads/imoveis, /uploads_imoveis, /uploads/demo, etc.)
  const serveMediaFile = (searchDirs: string[]) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const decodedPath = decodeURIComponent(req.path.replace(/^\/+/, ''));
        if (!decodedPath || decodedPath.includes('..')) {
          return next();
        }

        const ext = path.extname(decodedPath).toLowerCase();
        const baseWithoutExt = ext ? decodedPath.slice(0, -ext.length) : decodedPath;
        const extensionsToTry = ext ? [ext, '.webp', '.jpg', '.jpeg', '.png', '.avif'] : ['', '.webp', '.jpg', '.jpeg', '.png'];

        for (const dir of searchDirs) {
          // 1. Tentar arquivo exato
          const exactPath = path.join(dir, decodedPath);
          if (fs.existsSync(exactPath) && fs.statSync(exactPath).isFile()) {
            return sendVerifiedMediaFile(exactPath, res);
          }

          // 2. Tentar variações de extensão (.webp <-> .jpg <-> .png)
          for (const testExt of extensionsToTry) {
            const testPath = path.join(dir, `${baseWithoutExt}${testExt}`);
            if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
              return sendVerifiedMediaFile(testPath, res);
            }
          }
        }

        // Se não encontrou nestes diretórios, passa para o próximo middleware
        next();
      } catch (err) {
        next();
      }
    };
  };

  // 1. /uploads_imoveis -> fotos de imóveis
  app.use('/uploads_imoveis', serveMediaFile([uploadsImoveisDir, path.join(uploadsDir, 'imoveis'), uploadsDir]));

  // 2. /uploads/imoveis -> alias para fotos de imóveis
  app.use('/uploads/imoveis', serveMediaFile([uploadsImoveisDir, path.join(uploadsDir, 'imoveis')]));

  // 3. /uploads/fotos -> alias legado
  app.use('/uploads/fotos', serveMediaFile([uploadsImoveisDir, path.join(uploadsDir, 'fotos'), uploadsDir]));

  // 4. /uploads -> pasta geral de uploads (incluindo /uploads/demo, fotos de veículos, produtos, etc.)
  app.use('/uploads', serveMediaFile([uploadsDir, uploadsImoveisDir]));

  // Helper para buscar e entregar imagem com status 200 (sem 302 redirect que navegadores em modo privado bloqueiam)
  const proxyAndCacheImage = async (targetUrl: string, savePath: string, res: express.Response) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const upstream = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
        }
      });
      clearTimeout(timeout);

      if (upstream.ok) {
        const arrayBuf = await upstream.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const contentType = upstream.headers.get('content-type') || 'image/jpeg';

        // Salvar em disco para as próximas requisições serem instantâneas e locais
        try {
          fs.mkdirSync(path.dirname(savePath), { recursive: true });
          fs.writeFileSync(savePath, buffer);
          // Se for imóvel, salva também com extensão alternativa (.webp <-> .jpg)
          const ext = path.extname(savePath).toLowerCase();
          const baseNoExt = savePath.slice(0, -ext.length);
          const altExt = ext === '.webp' ? '.jpg' : '.webp';
          fs.writeFileSync(`${baseNoExt}${altExt}`, buffer);
        } catch {}

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        return res.status(200).send(buffer);
      }
    } catch (e: any) {
      // Se falhar o download remoto, renderiza SVG com status 200
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#g)"/>
      <g transform="translate(400, 260)" text-anchor="middle">
        <path d="M-40 20 L0 -20 L40 20 Z" fill="none" stroke="#059669" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="-24" y="20" width="48" height="40" fill="none" stroke="#059669" stroke-width="6" stroke-linecap="round"/>
        <text y="100" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="22" font-weight="600">3fácil Anúncio</text>
        <text y="130" fill="#64748b" font-family="system-ui, sans-serif" font-size="14">3facil.com • Vitrine Inteligente</text>
      </g>
    </svg>`);
  };

  // 5. Fallback resiliente para imagens não encontradas:
  // Em vez de retornar 302 (que navegadores bloqueiam por cross-origin em tags <img>)
  // ou texto 404, faz proxy da imagem e responde com 200 OK + cache em disco!
  app.use(['/uploads', '/uploads_imoveis'], async (req, res) => {
    try {
      const rawPath = decodeURIComponent(req.path.replace(/^\/+/, ''));
      const baseName = path.parse(rawPath).name;
      const isImovel = baseName.startsWith('foto_') || rawPath.includes('imoveis');
      const targetDir = isImovel ? uploadsImoveisDir : path.join(uploadsDir, 'demo');
      const savePath = path.join(targetDir, `${baseName}.jpg`);

      // Se é foto do Unsplash (/uploads/demo/photo-xxx.jpg)
      const matchPhoto = baseName.match(/photo-([0-9a-f-]+)/i);
      if (matchPhoto) {
        const url = `https://images.unsplash.com/photo-${matchPhoto[1]}?w=1200&auto=format&fit=crop&q=80`;
        return await proxyAndCacheImage(url, savePath, res);
      }

      // Se é foto de imóvel real (foto_6a...)
      if (baseName.startsWith('foto_')) {
        const fallbackPhotos = [
          'photo-1600585154340-be6161a56a0c',
          'photo-1600585154526-990dced4db0d',
          'photo-1600596542815-ffad4c1539a9',
          'photo-1600607687939-ce8a6c25118c',
          'photo-1600566753376-12c8ab7fb75b',
          'photo-1512917774080-9991f1c4c750',
          'photo-1580587771525-78b9dba3b914',
          'photo-1613490493576-7fde63acd811',
          'photo-1618221195710-dd6b41faaea6'
        ];
        let hash = 0;
        for (let i = 0; i < baseName.length; i++) {
          hash = (hash << 5) - hash + baseName.charCodeAt(i);
          hash |= 0;
        }
        const chosen = fallbackPhotos[Math.abs(hash) % fallbackPhotos.length];
        const url = `https://images.unsplash.com/${chosen}?w=1200&auto=format&fit=crop&q=80`;
        return await proxyAndCacheImage(url, savePath, res);
      }

      // Fallback padrão para outros arquivos
      const url = `https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80`;
      return await proxyAndCacheImage(url, savePath, res);
    } catch {
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.status(200).send('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="#1e293b"/></svg>');
    }
  });

  // Verificação automática e auto-restauração das imagens do catálogo no boot
  setTimeout(() => {
    try {
      const demoDir = path.join(uploadsDir, 'demo');
      const demoCount = fs.existsSync(demoDir) ? fs.readdirSync(demoDir).length : 0;
      const imovCount = fs.existsSync(uploadsImoveisDir) ? fs.readdirSync(uploadsImoveisDir).length : 0;
      if (demoCount < 10 || imovCount < 10) {
        console.log('[Imagens] Pastas de imagens incompletas. Executando auto-restauração em segundo plano...');
        exec('bash scripts/download-demo-images.sh && bash scripts/download-imoveis-images.sh', (err) => {
          if (err) console.warn('[Imagens] Aviso na restauração automática:', err.message);
          else console.log('[Imagens] Restauração automática de imagens concluída!');
        });
      }
    } catch (e: any) {
      console.warn('[Imagens] Erro na verificação:', e.message);
    }
  }, 1000);

  // ============================================================================
  // SEO & INDEXAÇÃO: ROBOTS.TXT E SITEMAP.XML DINÂMICO
  // ============================================================================
  app.get('/robots.txt', (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const robotsTxt = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /master',
      'Disallow: /api/',
      '',
      '# Sitemap Oficial do 3facil.com',
      'Sitemap: https://www.3facil.com/sitemap.xml',
      ''
    ].join('\n');
    return res.send(robotsTxt);
  });

  app.get('/sitemap.xml', async (req, res) => {
    try {
      let stores: Array<{ id: string; slug: string; updatedAt?: string; isPublished?: boolean }> = [];
      try {
        const client = await pool.connect();
        try {
          const result = await client.query('SELECT id, slug, updated_at, created_at, status, is_published FROM usuarios.lojas WHERE is_published = true');
          stores = result.rows.map(r => ({
            id: r.id,
            slug: r.slug,
            updatedAt: r.updated_at || r.created_at || new Date().toISOString(),
            isPublished: r.is_published !== false
          }));
        } finally {
          client.release();
        }
      } catch (dbErr) {
        stores = diskStorage.getStores().map(s => ({
          id: s.id,
          slug: s.slug,
          updatedAt: s.createdAt || new Date().toISOString(),
          isPublished: s.isPublished !== false
        }));
      }

      if (!stores || stores.length === 0) {
        stores = diskStorage.getStores().map(s => ({
          id: s.id,
          slug: s.slug,
          updatedAt: s.createdAt || new Date().toISOString(),
          isPublished: s.isPublished !== false
        }));
      }

      // Buscar anúncios/itens ativos para incluir no sitemap
      let items: Array<{ id: string; storeId: string; title: string; updatedAt?: string }> = [];
      try {
        const client = await pool.connect();
        try {
          const itemRes = await client.query(`
            SELECT id, loja_id as "storeId", titulo as title, updated_at, created_at FROM autos.estoque WHERE status = 'ativo'
            UNION ALL
            SELECT id, loja_id as "storeId", titulo as title, updated_at, created_at FROM imoveis.catalogo WHERE status = 'ativo'
            UNION ALL
            SELECT id, loja_id as "storeId", titulo as title, updated_at, created_at FROM loja.produtos WHERE status = 'ativo'
            UNION ALL
            SELECT id, loja_id as "storeId", titulo as title, updated_at, created_at FROM servicos.catalogo WHERE status = 'ativo'
          `);
          items = itemRes.rows.map(r => ({
            id: r.id,
            storeId: r.storeId,
            title: r.title || '',
            updatedAt: r.updated_at || r.created_at
          }));
        } finally {
          client.release();
        }
      } catch (e) {
        items = diskStorage.getItems().map(i => ({
          id: i.id,
          storeId: i.storeId,
          title: i.title,
          updatedAt: (i as any).updatedAt || i.createdAt
        }));
      }

      if (!items || items.length === 0) {
        items = diskStorage.getItems().map(i => ({
          id: i.id,
          storeId: i.storeId,
          title: i.title,
          updatedAt: (i as any).updatedAt || i.createdAt
        }));
      }

      const today = new Date().toISOString().split('T')[0];

      // Rotas estáticas essenciais
      const staticUrls = [
        { loc: 'https://www.3facil.com/', priority: '1.0', changefreq: 'daily', lastmod: today },
        { loc: 'https://www.3facil.com/imoveis', priority: '0.9', changefreq: 'daily', lastmod: today },
        { loc: 'https://www.3facil.com/veiculos', priority: '0.9', changefreq: 'daily', lastmod: today },
        { loc: 'https://www.3facil.com/lojas', priority: '0.8', changefreq: 'daily', lastmod: today },
        { loc: 'https://www.3facil.com/servicos', priority: '0.8', changefreq: 'daily', lastmod: today },
      ];

      // Mapear lojas ativas por ID
      const activeStoresMap = new Map<string, string>();
      const storeUrls: Array<{ loc: string; priority: string; changefreq: string; lastmod: string }> = [];

      stores
        .filter(s => s.isPublished !== false && s.slug && !['admin', 'master', 'landing', 'login', 'api', 'assets', 'uploads'].includes(s.slug.toLowerCase()))
        .forEach(s => {
          activeStoresMap.set(s.id, s.slug);
          let lastmod = today;
          if (s.updatedAt) {
            try {
              lastmod = new Date(s.updatedAt).toISOString().split('T')[0];
            } catch {
              lastmod = today;
            }
          }
          storeUrls.push({
            loc: `https://www.3facil.com/${encodeURIComponent(s.slug.toLowerCase())}`,
            priority: '0.8',
            changefreq: 'daily',
            lastmod
          });
        });

      // URLs individuais de anúncios / produtos / imóveis / veículos
      const itemUrls: Array<{ loc: string; priority: string; changefreq: string; lastmod: string }> = [];
      items.forEach(item => {
        const storeSlug = activeStoresMap.get(item.storeId);
        if (storeSlug) {
          let lastmod = today;
          if (item.updatedAt) {
            try {
              lastmod = new Date(item.updatedAt).toISOString().split('T')[0];
            } catch {
              lastmod = today;
            }
          }
          itemUrls.push({
            loc: `https://www.3facil.com/${encodeURIComponent(storeSlug.toLowerCase())}?item=${encodeURIComponent(item.id)}`,
            priority: '0.7',
            changefreq: 'weekly',
            lastmod
          });
        }
      });

      // Deduplicar URLs
      const allUrlsMap = new Map<string, { loc: string; priority: string; changefreq: string; lastmod: string }>();
      [...staticUrls, ...storeUrls, ...itemUrls].forEach(item => {
        allUrlsMap.set(item.loc, item);
      });

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${Array.from(allUrlsMap.values()).map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=1800');
      return res.send(xml);
    } catch (err: any) {
      console.error('[Sitemap] Erro ao gerar sitemap.xml:', err);
      res.status(500).type('text/plain').send('Erro ao gerar sitemap.');
    }
  });

  // ============================================================================
  // MIDDLEWARE DO VITE / SERVIÇO DE ARQUIVOS ESTÁTICOS
  // ============================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
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
          const matched = stores.find((s) => s.slug?.toLowerCase() === requestedSlug);
          if (matched) {
            let html = fs.readFileSync(indexPath, 'utf-8');
            let title = `${matched.name} | Catálogo Online no 3fácil.com`;
            let desc = matched.description || matched.slogan || `Confira as ofertas e catálogo de ${matched.name} no 3fácil.com.`;
            let image = matched.bannerUrl || matched.logoUrl || 'https://www.3facil.com/uploads/demo/photo-1560518883-ce09059eeffa.jpg';

            // Se a URL estiver abrindo um item/anúncio específico (?item=ID)
            if (itemIdParam) {
              const items = diskStorage.getItems();
              const matchedItem = items.find((i) => i.id === itemIdParam);
              if (matchedItem) {
                title = `${matchedItem.title} - ${matched.name} | 3facil.com`;
                desc = matchedItem.description || `Confira detalhes, fotos e proposta direta para ${matchedItem.title} na vitrine de ${matched.name}.`;
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Servidor 3Fácil] Rodando em http://localhost:${PORT}`);
  });
}

startServer();
