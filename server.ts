import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { createServer as createViteServer } from 'vite';
import { pool, initDatabase, seedDatabase } from './server/postgres.js';
import { diskStorage } from './server/diskStorage.js';
import { sendWelcomeEmail, sendTestEmail, testSmtpConnection, getSmtpConfig, isSmtpConfigured, saveSmtpConfig } from './server/emailService.js';
import { INITIAL_STORES, INITIAL_ITEMS, INITIAL_LEADS, DEFAULT_PLATFORM_SETTINGS } from './src/data/demoStores.js';
import { StoreProfile, StoreItem, ProposalLead, VehicleItem, RealEstateItem, ProductItem, ServiceItem, SaaSPlatformSettings } from './src/types/store.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '15mb' }));

  // Desativar qualquer cache em todas as respostas de API para refletir mudanças do banco em tempo real
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  // Tentativa inicial de conexão com PostgreSQL em segundo plano
  initDatabase().then((ready) => {
    if (ready) {
      console.log('[PostgreSQL] Conectado e tabelas verificadas com sucesso.');
    }
  }).catch((err) => {
    console.warn('[PostgreSQL] Não foi possível conectar ao banco PostgreSQL local agora, usando persistência segura em disco (database_storage/):', err.message);
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

  // 2. Bootstrap Geral (Carrega todos os dados do banco ou disco persistente)
  app.get('/api/bootstrap', async (req, res) => {
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
        const formatLead = (r: any, defaultType: string): ProposalLead => ({
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
          status: r.status || 'novo',
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
        });

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

        return res.json({
          stores: finalStores,
          items: finalItems,
          leads: finalLeads,
          settings: finalSettings,
          connectedToPostgres: true
        });
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn('[Bootstrap] PostgreSQL inacessível, carregando base persistente em disco:', err.message);
      return res.json({
        stores: diskStorage.getStores(),
        items: diskStorage.getItems(),
        leads: diskStorage.getLeads(),
        settings: diskStorage.getSettings(),
        connectedToPostgres: false,
        error: err.message
      });
    }
  });

  // 3. Salvar / Criar Loja no schema usuarios.lojas + Disco Persistente
  app.post('/api/stores', async (req, res) => {
    const store: StoreProfile = req.body;
    let postgresSaved = false;
    let dbError: string | null = null;

    // Salvar IMEDIATAMENTE no armazenamento em disco persistente
    diskStorage.saveStore(store);

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
      console.log('[API Stores] Status de envio de e-mail de boas-vindas:', emailResult);
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

  // Atualizar Loja
  app.put('/api/stores/:id', async (req, res) => {
    const { id } = req.params;
    const store: Partial<StoreProfile> = req.body;

    // Atualizar no disco persistente
    const allStores = diskStorage.getStores();
    const existing = allStores.find(s => s.id === id);
    if (existing) {
      const merged = { ...existing, ...store } as StoreProfile;
      diskStorage.saveStore(merged);
    }

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
          store.name,
          store.slug,
          store.description,
          store.logoUrl,
          store.bannerUrl,
          store.whatsapp,
          store.email,
          store.phone,
          store.instagram,
          store.city,
          store.state,
          store.address,
          store.monthlyFee,
          store.subscriptionStatus,
          store.nextDueDate,
          store.lastPaymentDate,
          JSON.stringify(store),
          store.isPublished,
          id
        ]);
        return res.json({ success: true });
      } finally {
        client.release();
      }
    } catch (err: any) {
      // Retorna sucesso pois já foi persistido com segurança no disco
      return res.json({ success: true, warning: err.message });
    }
  });

  // Deletar Loja (CASCADE deleta automaticamente todos os itens e propostas)
  app.delete('/api/stores/:id', async (req, res) => {
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
      return res.json({ success: true, deletedId: id, warning: err.message });
    }
  });

  // 4. Salvar / Criar Item no Schema Correto (autos, imoveis, loja, servicos)
  app.post('/api/items', async (req, res) => {
    const item: StoreItem = req.body;
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
      return res.json({ success: true, item, warning: err.message });
    }
  });

  // Deletar Item
  app.delete('/api/items/:id', async (req, res) => {
    const { id } = req.params;
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
      return res.json({ success: true, deletedId: id, warning: err.message });
    }
  });

  // 5. Salvar / Criar Proposta ou Lead
  app.post('/api/leads', async (req, res) => {
    const lead: ProposalLead = req.body;
    diskStorage.saveLead(lead);

    try {
      const client = await pool.connect();
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
        return res.json({ success: true, lead });
      } finally {
        client.release();
      }
    } catch (err: any) {
      return res.json({ success: true, lead, warning: err.message });
    }
  });

  // Atualizar Status do Lead
  app.put('/api/leads/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
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
      return res.json({ success: true, warning: err.message });
    }
  });

  // Deletar Lead
  app.delete('/api/leads/:id', async (req, res) => {
    const { id } = req.params;
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
      return res.json({ success: true, deletedId: id, warning: err.message });
    }
  });

  // 6. Atualizar Configurações Globais da Plataforma
  app.put('/api/settings', async (req, res) => {
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
      return res.json({ success: true, settings, warning: err.message });
    }
  });

  // 7. Resetar e Semear Novamente os Dados Padrão no PostgreSQL e Disco
  app.post('/api/reset-defaults', async (req, res) => {
    diskStorage.resetToDefaults();
    try {
      await seedDatabase();
      return res.json({ success: true, message: 'Dados padrão restaurados com sucesso em todos os 5 schemas e disco!' });
    } catch (err: any) {
      return res.json({ success: true, message: 'Dados padrão restaurados no armazenamento em disco!', warning: err.message });
    }
  });

  // 7.1 Migrar / Sincronizar todos os dados do Disco Persistente para o PostgreSQL
  app.post('/api/migrate-to-postgres', async (req, res) => {
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
  // ROTAS DE E-MAIL TRANSACIONAL (SMTP & CONFIRMAÇÃO DE CADASTRO)
  // ============================================================================

  // 8. Checar Status da Configuração de E-mail / SMTP
  app.get('/api/email/status', async (req, res) => {
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

  // Salvar Configuração de SMTP diretamente pelo Painel
  app.post('/api/email/config', async (req, res) => {
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

  // 9. Enviar E-mail de Teste
  app.post('/api/email/test', async (req, res) => {
    const { to } = req.body;
    if (!to || typeof to !== 'string') {
      return res.status(400).json({ error: 'E-mail de destino ("to") é obrigatório.' });
    }

    const result = await sendTestEmail(to);
    return res.json(result);
  });

  // 10. Reenviar E-mail de Confirmação de Cadastro para uma Loja
  app.post('/api/email/send-welcome', async (req, res) => {
    const { store } = req.body;
    if (!store || !store.id) {
      return res.status(400).json({ error: 'Objeto de loja inválido.' });
    }

    const originUrl = req.get('origin') || process.env.APP_URL;
    const result = await sendWelcomeEmail(store, originUrl);
    return res.json(result);
  });

  // 11. Auto-Deploy / Atualização do Sistema da Nuvem
  app.post('/api/system/update', async (req, res) => {
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

  // 12. Obter Informações da Versão do Sistema / Git
  app.get('/api/system/info', (req, res) => {
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

  // 13. Checar se há atualizações pendentes no GitHub (Remote Fetch & Diff)
  app.get('/api/system/check-update', (req, res) => {
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

  // ENDPOINT: Upload de arquivo ZIP para atualização direta sem Git/FileZilla
  app.post('/api/admin/upload-update-zip', uploadZip.single('updateZip'), async (req, res) => {
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
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Servidor 3Fácil] Rodando em http://localhost:${PORT}`);
  });
}

startServer();
