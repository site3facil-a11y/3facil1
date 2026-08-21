import pg from 'pg';
import { INITIAL_STORES, INITIAL_ITEMS, INITIAL_LEADS, DEFAULT_PLATFORM_SETTINGS } from '../src/data/demoStores.js';
import { StoreProfile, StoreItem, ProposalLead, VehicleItem, RealEstateItem, ProductItem, ServiceItem } from '../src/types/store.js';

const { Pool } = pg;

// Configuração do Pool PostgreSQL
const getPoolConfig = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1')
        ? { rejectUnauthorized: false }
        : false,
    };
  }

  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'tresfacil_app_user',
    password: process.env.DB_PASSWORD || 'SuaSenhaSeguraAqui123!',
    database: process.env.DB_NAME || '3facil_db',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 4000,
  };
};

export const pool = new Pool(getPoolConfig());

let isDbInitialized = false;

// Função para inicializar schemas e tabelas automaticamente caso não existam
export async function initDatabase() {
  if (isDbInitialized) return true;

  try {
    const client = await pool.connect();
    try {
      // 1. Criar Schemas
      await client.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";

        CREATE SCHEMA IF NOT EXISTS usuarios;
        CREATE SCHEMA IF NOT EXISTS autos;
        CREATE SCHEMA IF NOT EXISTS imoveis;
        CREATE SCHEMA IF NOT EXISTS loja;
        CREATE SCHEMA IF NOT EXISTS servicos;
      `);

      // 2. Criar tabelas no schema usuarios
      await client.query(`
        CREATE TABLE IF NOT EXISTS usuarios.contas (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nome VARCHAR(150) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          senha_hash VARCHAR(255) NOT NULL,
          telefone VARCHAR(20),
          documento VARCHAR(20),
          role VARCHAR(20) NOT NULL DEFAULT 'lojista',
          ativo BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS usuarios.lojas (
          id VARCHAR(100) PRIMARY KEY,
          nome VARCHAR(150) NOT NULL,
          slug VARCHAR(100) UNIQUE NOT NULL,
          tipo VARCHAR(20) NOT NULL,
          descricao TEXT,
          slogan TEXT,
          theme_color VARCHAR(20) DEFAULT '#2563eb',
          logo_url TEXT,
          banner_url TEXT,
          whatsapp VARCHAR(20) NOT NULL,
          email VARCHAR(255),
          telefone VARCHAR(20),
          instagram VARCHAR(50),
          cidade VARCHAR(100),
          estado VARCHAR(2),
          endereco TEXT,
          plano_tier VARCHAR(20) NOT NULL DEFAULT 'pro',
          mensalidade NUMERIC(10, 2) NOT NULL DEFAULT 30.00,
          status_assinatura VARCHAR(20) NOT NULL DEFAULT 'ativo',
          vencimento_mensalidade VARCHAR(30),
          data_ultimo_pagamento VARCHAR(30),
          owner_name VARCHAR(150),
          owner_email VARCHAR(255),
          owner_phone VARCHAR(50),
          configuracoes JSONB NOT NULL DEFAULT '{}'::jsonb,
          is_published BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS usuarios.platform_settings (
          id VARCHAR(50) PRIMARY KEY DEFAULT 'main_settings',
          platform_name VARCHAR(100) NOT NULL DEFAULT '3facil.com',
          superadmin_name VARCHAR(150),
          superadmin_email VARCHAR(255),
          superadmin_phone VARCHAR(20),
          pix_key VARCHAR(255),
          pix_key_type VARCHAR(20) DEFAULT 'email',
          pix_beneficiary VARCHAR(255),
          default_trial_days INT NOT NULL DEFAULT 7,
          configuracoes_gerais JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. Criar tabelas no schema autos
      await client.query(`
        CREATE TABLE IF NOT EXISTS autos.estoque (
          id VARCHAR(100) PRIMARY KEY,
          loja_id VARCHAR(100) NOT NULL REFERENCES usuarios.lojas(id) ON DELETE CASCADE,
          titulo VARCHAR(200) NOT NULL,
          tipo VARCHAR(20) NOT NULL DEFAULT 'veiculo',
          preco NUMERIC(12, 2) NOT NULL,
          preco_promocional NUMERIC(12, 2),
          descricao TEXT,
          fotos JSONB NOT NULL DEFAULT '[]'::jsonb,
          destaque BOOLEAN NOT NULL DEFAULT FALSE,
          status VARCHAR(20) NOT NULL DEFAULT 'disponivel',
          marca VARCHAR(100),
          modelo VARCHAR(100),
          ano_fabricacao INT,
          ano_modelo INT,
          quilometragem INT DEFAULT 0,
          combustivel VARCHAR(30),
          cambio VARCHAR(30),
          cor VARCHAR(50),
          placa_final VARCHAR(10),
          blindado BOOLEAN DEFAULT FALSE,
          tabela_fipe_valor NUMERIC(12, 2),
          opcionais JSONB DEFAULT '[]'::jsonb,
          dados_extras JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS autos.propostas (
          id VARCHAR(100) PRIMARY KEY,
          loja_id VARCHAR(100) NOT NULL REFERENCES usuarios.lojas(id) ON DELETE CASCADE,
          item_id VARCHAR(100),
          item_title VARCHAR(200),
          item_type VARCHAR(20) NOT NULL DEFAULT 'veiculo',
          item_price NUMERIC(12, 2) DEFAULT 0,
          client_name VARCHAR(150) NOT NULL,
          client_phone VARCHAR(20) NOT NULL,
          client_email VARCHAR(255),
          client_message TEXT,
          proposal_value NUMERIC(12, 2),
          payment_method VARCHAR(50) DEFAULT 'outro',
          trade_details TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'novo',
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 4. Criar tabelas no schema imoveis
      await client.query(`
        CREATE TABLE IF NOT EXISTS imoveis.catalogo (
          id VARCHAR(100) PRIMARY KEY,
          loja_id VARCHAR(100) NOT NULL REFERENCES usuarios.lojas(id) ON DELETE CASCADE,
          titulo VARCHAR(200) NOT NULL,
          tipo VARCHAR(20) NOT NULL DEFAULT 'imovel',
          preco NUMERIC(12, 2) NOT NULL,
          preco_promocional NUMERIC(12, 2),
          descricao TEXT,
          fotos JSONB NOT NULL DEFAULT '[]'::jsonb,
          destaque BOOLEAN NOT NULL DEFAULT FALSE,
          status VARCHAR(20) NOT NULL DEFAULT 'disponivel',
          tipo_imovel VARCHAR(50),
          tipo_transacao VARCHAR(20),
          area_util_m2 NUMERIC(10, 2),
          area_total_m2 NUMERIC(10, 2),
          quartos INT DEFAULT 0,
          suites INT DEFAULT 0,
          banheiros INT DEFAULT 0,
          vagas_garagem INT DEFAULT 0,
          valor_condominio NUMERIC(10, 2),
          valor_iptu NUMERIC(10, 2),
          bairro VARCHAR(100),
          cidade VARCHAR(100),
          estado VARCHAR(2),
          endereco_completo TEXT,
          caracteristicas JSONB DEFAULT '[]'::jsonb,
          dados_extras JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS imoveis.propostas (
          id VARCHAR(100) PRIMARY KEY,
          loja_id VARCHAR(100) NOT NULL REFERENCES usuarios.lojas(id) ON DELETE CASCADE,
          item_id VARCHAR(100),
          item_title VARCHAR(200),
          item_type VARCHAR(20) NOT NULL DEFAULT 'imovel',
          item_price NUMERIC(12, 2) DEFAULT 0,
          client_name VARCHAR(150) NOT NULL,
          client_phone VARCHAR(20) NOT NULL,
          client_email VARCHAR(255),
          client_message TEXT,
          proposal_value NUMERIC(12, 2),
          payment_method VARCHAR(50) DEFAULT 'outro',
          trade_details TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'novo',
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 5. Criar tabelas no schema loja (Produtos)
      await client.query(`
        CREATE TABLE IF NOT EXISTS loja.produtos (
          id VARCHAR(100) PRIMARY KEY,
          loja_id VARCHAR(100) NOT NULL REFERENCES usuarios.lojas(id) ON DELETE CASCADE,
          titulo VARCHAR(200) NOT NULL,
          tipo VARCHAR(20) NOT NULL DEFAULT 'produto',
          preco NUMERIC(10, 2) NOT NULL,
          preco_promocional NUMERIC(10, 2),
          descricao TEXT,
          fotos JSONB NOT NULL DEFAULT '[]'::jsonb,
          destaque BOOLEAN NOT NULL DEFAULT FALSE,
          status VARCHAR(20) NOT NULL DEFAULT 'disponivel',
          sku VARCHAR(60),
          categoria VARCHAR(100),
          estoque_quantidade INT DEFAULT 0,
          em_estoque BOOLEAN DEFAULT TRUE,
          condicao VARCHAR(30) DEFAULT 'novo',
          dados_extras JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS loja.pedidos (
          id VARCHAR(100) PRIMARY KEY,
          loja_id VARCHAR(100) NOT NULL REFERENCES usuarios.lojas(id) ON DELETE CASCADE,
          item_id VARCHAR(100),
          item_title VARCHAR(200),
          item_type VARCHAR(20) NOT NULL DEFAULT 'produto',
          item_price NUMERIC(12, 2) DEFAULT 0,
          client_name VARCHAR(150) NOT NULL,
          client_phone VARCHAR(20) NOT NULL,
          client_email VARCHAR(255),
          client_message TEXT,
          proposal_value NUMERIC(12, 2),
          payment_method VARCHAR(50) DEFAULT 'outro',
          trade_details TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'novo',
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 6. Criar tabelas no schema servicos
      await client.query(`
        CREATE TABLE IF NOT EXISTS servicos.catalogo (
          id VARCHAR(100) PRIMARY KEY,
          loja_id VARCHAR(100) NOT NULL REFERENCES usuarios.lojas(id) ON DELETE CASCADE,
          titulo VARCHAR(200) NOT NULL,
          tipo VARCHAR(20) NOT NULL DEFAULT 'servico',
          preco NUMERIC(10, 2),
          preco_promocional NUMERIC(10, 2),
          descricao TEXT,
          fotos JSONB NOT NULL DEFAULT '[]'::jsonb,
          destaque BOOLEAN NOT NULL DEFAULT FALSE,
          status VARCHAR(20) NOT NULL DEFAULT 'disponivel',
          tipo_preco VARCHAR(30) DEFAULT 'fixo',
          duracao_estimada VARCHAR(100),
          itens_inclusos JSONB DEFAULT '[]'::jsonb,
          dados_extras JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS servicos.orcamentos (
          id VARCHAR(100) PRIMARY KEY,
          loja_id VARCHAR(100) NOT NULL REFERENCES usuarios.lojas(id) ON DELETE CASCADE,
          item_id VARCHAR(100),
          item_title VARCHAR(200),
          item_type VARCHAR(20) NOT NULL DEFAULT 'servico',
          item_price NUMERIC(12, 2) DEFAULT 0,
          client_name VARCHAR(150) NOT NULL,
          client_phone VARCHAR(20) NOT NULL,
          client_email VARCHAR(255),
          client_message TEXT,
          proposal_value NUMERIC(12, 2),
          payment_method VARCHAR(50) DEFAULT 'outro',
          trade_details TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'novo',
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 7. Verificar se já existem dados; se vazio, semear dados iniciais
      const storesCount = await client.query('SELECT COUNT(*) FROM usuarios.lojas');
      if (parseInt(storesCount.rows[0].count, 10) === 0) {
        console.log('[PostgreSQL] Semeando dados iniciais das lojas e produtos...');
        await seedDatabase(client);
      }

      isDbInitialized = true;
      console.log('[PostgreSQL] Banco de dados 3facil_db conectado e inicializado com sucesso em todos os 5 schemas.');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[PostgreSQL] Erro ao conectar/inicializar banco de dados:', error);
    return false;
  }
}

// Semeador de dados iniciais
export async function seedDatabase(clientParam?: any) {
  const client = clientParam || (await pool.connect());
  const shouldRelease = !clientParam;

  try {
    // Inserir Configurações Globais
    await client.query(`
      INSERT INTO usuarios.platform_settings (
        id, platform_name, superadmin_name, superadmin_email, superadmin_phone,
        pix_key, pix_key_type, pix_beneficiary, default_trial_days, configuracoes_gerais
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        platform_name = EXCLUDED.platform_name,
        pix_key = EXCLUDED.pix_key,
        updated_at = CURRENT_TIMESTAMP
    `, [
      'main_settings',
      DEFAULT_PLATFORM_SETTINGS.platformName,
      DEFAULT_PLATFORM_SETTINGS.superAdminName,
      DEFAULT_PLATFORM_SETTINGS.superAdminEmail,
      DEFAULT_PLATFORM_SETTINGS.superAdminPhone,
      DEFAULT_PLATFORM_SETTINGS.pixKey,
      DEFAULT_PLATFORM_SETTINGS.pixKeyType,
      DEFAULT_PLATFORM_SETTINGS.pixBeneficiary,
      DEFAULT_PLATFORM_SETTINGS.defaultTrialDays || 7,
      JSON.stringify(DEFAULT_PLATFORM_SETTINGS)
    ]);

    // Inserir Lojas
    for (const store of INITIAL_STORES) {
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
          whatsapp = EXCLUDED.whatsapp,
          mensalidade = EXCLUDED.mensalidade,
          status_assinatura = EXCLUDED.status_assinatura,
          is_published = EXCLUDED.is_published
      `, [
        store.id,
        store.name,
        store.slug,
        store.type,
        store.description,
        store.slogan || '',
        store.themeColor || '#2563eb',
        store.logoUrl || '',
        store.bannerUrl || '',
        store.whatsapp,
        store.email,
        store.phone,
        store.instagram || '',
        store.city,
        store.state,
        store.address || '',
        store.plan || 'pro',
        store.monthlyFee || 30.00,
        store.subscriptionStatus || 'ativo',
        store.nextDueDate || '2026-09-15',
        store.lastPaymentDate || '2026-08-15',
        store.ownerName || 'Lojista',
        store.ownerEmail || store.email,
        store.ownerPhone || store.whatsapp,
        JSON.stringify(store),
        store.isPublished !== false,
        new Date(store.createdAt || Date.now())
      ]);
    }

    // Inserir Itens distribuídos por schema
    for (const item of INITIAL_ITEMS) {
      if (item.itemType === 'veiculo') {
        const v = item as VehicleItem;
        await client.query(`
          INSERT INTO autos.estoque (
            id, loja_id, titulo, tipo, preco, preco_promocional, descricao, fotos,
            destaque, status, marca, modelo, ano_fabricacao, ano_modelo, quilometragem,
            combustivel, cambio, cor, placa_final, blindado,
            tabela_fipe_valor, opcionais, dados_extras, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
          ON CONFLICT (id) DO NOTHING
        `, [
          v.id,
          v.storeId,
          v.title,
          'veiculo',
          v.price,
          null,
          v.description,
          JSON.stringify(v.images || []),
          v.featured || false,
          v.status || 'disponivel',
          v.brand || '',
          v.model || '',
          v.yearFab || 2023,
          v.yearModel || 2024,
          v.mileage || 0,
          v.fuel || 'flex',
          v.transmission || 'automatico',
          v.color || '',
          v.plateEnd || '',
          false,
          v.fipePrice || null,
          JSON.stringify(v.accessories || []),
          JSON.stringify(v),
          new Date(v.createdAt || Date.now())
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
          ON CONFLICT (id) DO NOTHING
        `, [
          im.id,
          im.storeId,
          im.title,
          'imovel',
          im.price,
          null,
          im.description,
          JSON.stringify(im.images || []),
          im.featured || false,
          im.status || 'disponivel',
          im.propertyType || 'apartamento',
          im.transactionType || 'venda',
          im.areaUtil || 80,
          im.areaTotal || 100,
          im.bedrooms || 2,
          im.suites || 1,
          im.bathrooms || 2,
          im.garageSpots || 1,
          im.condoFee || 0,
          im.iptu || 0,
          im.neighborhood || '',
          im.city || 'São Paulo',
          im.state || 'SP',
          im.address || '',
          JSON.stringify(im.amenities || []),
          JSON.stringify(im),
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
          ON CONFLICT (id) DO NOTHING
        `, [
          pr.id,
          pr.storeId,
          pr.title,
          'produto',
          pr.price,
          pr.promotionalPrice || null,
          pr.description,
          JSON.stringify(pr.images || []),
          pr.featured || false,
          pr.status || 'ativo',
          pr.sku || '',
          pr.category || 'Geral',
          pr.stockQuantity || 10,
          pr.inStock !== false,
          pr.condition || 'novo',
          JSON.stringify(pr),
          new Date(pr.createdAt || Date.now())
        ]);
      } else if (item.itemType === 'servico') {
        const sr = item as ServiceItem;
        await client.query(`
          INSERT INTO servicos.catalogo (
            id, loja_id, titulo, tipo, preco, preco_promocional, descricao, fotos,
            destaque, status, tipo_preco, duracao_estimada,
            itens_inclusos, dados_extras, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO NOTHING
        `, [
          sr.id,
          sr.storeId,
          sr.title,
          'servico',
          sr.price || 0,
          null,
          sr.description,
          JSON.stringify(sr.images || []),
          sr.featured || false,
          sr.status || 'ativo',
          sr.priceType || 'fixo',
          sr.estimatedDuration || 'A combinar',
          JSON.stringify(sr.includedItems || []),
          JSON.stringify(sr),
          new Date(sr.createdAt || Date.now())
        ]);
      }
    }

    // Inserir Leads distribuídos
    for (const lead of INITIAL_LEADS) {
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
        ON CONFLICT (id) DO NOTHING
      `, [
        lead.id,
        lead.storeId,
        lead.itemId,
        lead.itemTitle,
        lead.itemType,
        lead.itemPrice || 0,
        lead.clientName,
        lead.clientPhone,
        lead.clientEmail || '',
        lead.clientMessage || '',
        lead.proposalValue || null,
        lead.paymentMethod || 'outro',
        lead.tradeDetails || '',
        lead.status || 'novo',
        new Date(lead.createdAt || Date.now())
      ]);
    }
  } finally {
    if (shouldRelease) client.release();
  }
}
