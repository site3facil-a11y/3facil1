-- ============================================================================
-- SCRIPT DE INICIALIZAÇÃO COMPLETO - 3FACIL_DB (POSTGRESQL 14+)
-- SISTEMA SAAS MULTI-TENANT COM 5 SCHEMAS:
-- 1. usuarios
-- 2. autos
-- 3. imoveis
-- 4. loja
-- 5. servicos
-- ============================================================================

-- PASSO 1: CRIAÇÃO DO BANCO (Execute conectado como superusuário postgres)
-- CREATE DATABASE "3facil_db" WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template1;
-- \c 3facil_db;

-- PASSO 2: ATIVAÇÃO DE EXTENSÕES CRÍTICAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- PASSO 3: CRIAÇÃO DOS 5 SCHEMAS SEGREGADOS
CREATE SCHEMA IF NOT EXISTS usuarios;
CREATE SCHEMA IF NOT EXISTS autos;
CREATE SCHEMA IF NOT EXISTS imoveis;
CREATE SCHEMA IF NOT EXISTS loja;
CREATE SCHEMA IF NOT EXISTS servicos;

-- PASSO 4: FUNÇÃO TRIGGER PARA ATUALIZAR TIMESTAMP DE MODIFICAÇÃO (updated_at)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. SCHEMA: usuarios (Contas de Acesso, Lojas/Tenants, Assinaturas e Configs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS usuarios.contas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    documento VARCHAR(20), -- CPF / CNPJ
    role VARCHAR(20) NOT NULL DEFAULT 'lojista' CHECK (role IN ('superadmin', 'lojista', 'colaborador')),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios.lojas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conta_id UUID NOT NULL REFERENCES usuarios.contas(id) ON DELETE RESTRICT,
    nome VARCHAR(150) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('veiculo', 'imovel', 'produto', 'servico')),
    descricao TEXT,
    logo_url TEXT,
    banner_url TEXT,
    whatsapp VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(20),
    instagram VARCHAR(50),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    endereco TEXT,
    
    -- Gestão SaaS & Mensalidade
    plano_tier VARCHAR(20) NOT NULL DEFAULT 'pro',
    mensalidade NUMERIC(10, 2) NOT NULL DEFAULT 30.00,
    status_assinatura VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status_assinatura IN ('ativo', 'pendente', 'trial', 'suspenso')),
    vencimento_mensalidade TIMESTAMPTZ,
    data_ultimo_pagamento TIMESTAMPTZ,
    
    -- Customizações adicionais da vitrine
    configuracoes JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios.cobrancas_pix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES usuarios.lojas(id) ON DELETE CASCADE,
    valor NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado', 'estornado')),
    txid VARCHAR(100),
    payload_pix TEXT,
    comprovante_url TEXT,
    data_vencimento TIMESTAMPTZ NOT NULL,
    data_pagamento TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios.platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_name VARCHAR(100) NOT NULL DEFAULT '3facil.com',
    superadmin_name VARCHAR(150),
    superadmin_email VARCHAR(255),
    superadmin_phone VARCHAR(20),
    pix_key VARCHAR(255),
    pix_key_type VARCHAR(20) DEFAULT 'email',
    pix_beneficiary VARCHAR(255),
    default_monthly_fee NUMERIC(10, 2) NOT NULL DEFAULT 30.00,
    configuracoes_gerais JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. SCHEMA: autos (Veículos, Carros, Motos, Seminovos & FIPE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS autos.estoque (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES usuarios.lojas(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL,
    marca VARCHAR(100) NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    versao VARCHAR(100),
    ano_fabricacao INT NOT NULL,
    ano_modelo INT NOT NULL,
    preco NUMERIC(12, 2) NOT NULL,
    preco_promocional NUMERIC(12, 2),
    tabela_fipe_codigo VARCHAR(20),
    tabela_fipe_valor NUMERIC(12, 2),
    quilometragem INT NOT NULL DEFAULT 0,
    combustivel VARCHAR(30) NOT NULL,
    cambio VARCHAR(30) NOT NULL,
    cor VARCHAR(50),
    placa_final VARCHAR(4),
    blindado BOOLEAN NOT NULL DEFAULT FALSE,
    opcionais JSONB NOT NULL DEFAULT '[]'::jsonb,
    descricao TEXT,
    fotos JSONB NOT NULL DEFAULT '[]'::jsonb,
    destaque BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'reservado', 'vendido')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS autos.propostas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES usuarios.lojas(id) ON DELETE CASCADE,
    veiculo_id UUID REFERENCES autos.estoque(id) ON DELETE SET NULL,
    cliente_nome VARCHAR(150) NOT NULL,
    cliente_telefone VARCHAR(20) NOT NULL,
    cliente_email VARCHAR(255),
    cliente_cidade VARCHAR(100),
    tipo_proposta VARCHAR(30) NOT NULL,
    possui_troca BOOLEAN NOT NULL DEFAULT FALSE,
    veiculo_troca_detalhes JSONB,
    valor_entrada NUMERIC(12, 2),
    mensagem TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'em_atendimento', 'fechado', 'perdido')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. SCHEMA: imoveis (Casas, Apartamentos, Terrenos, Venda & Locação)
-- ============================================================================

CREATE TABLE IF NOT EXISTS imoveis.catalogo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES usuarios.lojas(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL,
    tipo_imovel VARCHAR(50) NOT NULL,
    tipo_transacao VARCHAR(20) NOT NULL CHECK (tipo_transacao IN ('venda', 'aluguel', 'ambos')),
    preco_venda NUMERIC(12, 2),
    preco_locacao NUMERIC(12, 2),
    valor_condominio NUMERIC(10, 2),
    valor_iptu NUMERIC(10, 2),
    area_util_m2 NUMERIC(10, 2) NOT NULL,
    area_total_m2 NUMERIC(10, 2),
    quartos INT NOT NULL DEFAULT 0,
    suites INT NOT NULL DEFAULT 0,
    banheiros INT NOT NULL DEFAULT 0,
    vagas_garagem INT NOT NULL DEFAULT 0,
    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    estado VARCHAR(2) NOT NULL,
    cep VARCHAR(10),
    endereco_completo TEXT,
    caracteristicas JSONB NOT NULL DEFAULT '[]'::jsonb,
    descricao TEXT,
    fotos JSONB NOT NULL DEFAULT '[]'::jsonb,
    destaque BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'em_negociacao', 'vendido', 'alugado')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS imoveis.propostas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES usuarios.lojas(id) ON DELETE CASCADE,
    imovel_id UUID REFERENCES imoveis.catalogo(id) ON DELETE SET NULL,
    cliente_nome VARCHAR(150) NOT NULL,
    cliente_telefone VARCHAR(20) NOT NULL,
    cliente_email VARCHAR(255),
    tipo_negocio VARCHAR(20) NOT NULL CHECK (tipo_negocio IN ('compra', 'locacao')),
    valor_ofertado NUMERIC(12, 2),
    forma_pagamento VARCHAR(50),
    mensagem TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'em_analise', 'fechado', 'recusado')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. SCHEMA: loja (Produtos Físicos, SKU, Grade & Pedidos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS loja.categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES usuarios.lojas(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loja.produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES usuarios.lojas(id) ON DELETE CASCADE,
    categoria_id UUID REFERENCES loja.categorias(id) ON DELETE SET NULL,
    titulo VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL,
    sku VARCHAR(60),
    preco NUMERIC(10, 2) NOT NULL,
    preco_promocional NUMERIC(10, 2),
    estoque_quantidade INT NOT NULL DEFAULT 0,
    gerenciar_estoque BOOLEAN NOT NULL DEFAULT TRUE,
    variacoes JSONB NOT NULL DEFAULT '[]'::jsonb,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    descricao TEXT,
    fotos JSONB NOT NULL DEFAULT '[]'::jsonb,
    destaque BOOLEAN NOT NULL DEFAULT FALSE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loja.pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES usuarios.lojas(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES loja.produtos(id) ON DELETE SET NULL,
    cliente_nome VARCHAR(150) NOT NULL,
    cliente_telefone VARCHAR(20) NOT NULL,
    cliente_email VARCHAR(255),
    cliente_endereco JSONB,
    quantidade INT NOT NULL DEFAULT 1,
    variacao_selecionada JSONB,
    valor_unitario NUMERIC(10, 2) NOT NULL,
    valor_total NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'aguardando_vendedor' CHECK (status IN ('aguardando_vendedor', 'em_separacao', 'enviado', 'entregue', 'cancelado')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. SCHEMA: servicos (Prestadores de Serviços, Escopos & Orçamentos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS servicos.catalogo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES usuarios.lojas(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL,
    tipo_preco VARCHAR(20) NOT NULL DEFAULT 'fixo' CHECK (tipo_preco IN ('fixo', 'a_partir_de', 'sob_consulta')),
    preco NUMERIC(10, 2),
    prazo_estimado VARCHAR(100),
    unidade_cobranca VARCHAR(50),
    entregaveis JSONB NOT NULL DEFAULT '[]'::jsonb,
    descricao TEXT,
    fotos JSONB NOT NULL DEFAULT '[]'::jsonb,
    destaque BOOLEAN NOT NULL DEFAULT FALSE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS servicos.orcamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loja_id UUID NOT NULL REFERENCES usuarios.lojas(id) ON DELETE CASCADE,
    servico_id UUID REFERENCES servicos.catalogo(id) ON DELETE SET NULL,
    cliente_nome VARCHAR(150) NOT NULL,
    cliente_telefone VARCHAR(20) NOT NULL,
    cliente_email VARCHAR(255),
    descricao_demanda TEXT NOT NULL,
    prazo_desejado VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'orcamento_enviado', 'aprovado', 'recusado')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. ÍNDICES DE ALTA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_usuarios_lojas_slug ON usuarios.lojas(slug);
CREATE INDEX IF NOT EXISTS idx_usuarios_lojas_tipo ON usuarios.lojas(tipo);
CREATE INDEX IF NOT EXISTS idx_usuarios_lojas_status ON usuarios.lojas(status_assinatura);

CREATE INDEX IF NOT EXISTS idx_autos_estoque_loja ON autos.estoque(loja_id);
CREATE INDEX IF NOT EXISTS idx_autos_estoque_preco ON autos.estoque(preco);
CREATE INDEX IF NOT EXISTS idx_autos_propostas_loja ON autos.propostas(loja_id);

CREATE INDEX IF NOT EXISTS idx_imoveis_catalogo_loja ON imoveis.catalogo(loja_id);
CREATE INDEX IF NOT EXISTS idx_imoveis_catalogo_cidade ON imoveis.catalogo(cidade, estado);
CREATE INDEX IF NOT EXISTS idx_imoveis_propostas_loja ON imoveis.propostas(loja_id);

CREATE INDEX IF NOT EXISTS idx_loja_produtos_loja ON loja.produtos(loja_id);
CREATE INDEX IF NOT EXISTS idx_loja_pedidos_loja ON loja.pedidos(loja_id);

CREATE INDEX IF NOT EXISTS idx_servicos_catalogo_loja ON servicos.catalogo(loja_id);
CREATE INDEX IF NOT EXISTS idx_servicos_orcamentos_loja ON servicos.orcamentos(loja_id);

CREATE INDEX IF NOT EXISTS idx_autos_opcionais_gin ON autos.estoque USING gin (opcionais);
CREATE INDEX IF NOT EXISTS idx_imoveis_caracteristicas_gin ON imoveis.catalogo USING gin (caracteristicas);
CREATE INDEX IF NOT EXISTS idx_usuarios_config_gin ON usuarios.lojas USING gin (configuracoes);

-- ============================================================================
-- 7. TRIGGERS DE ATUALIZAÇÃO AUTOMÁTICA
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_usuarios_contas_updated') THEN
        CREATE TRIGGER trg_usuarios_contas_updated BEFORE UPDATE ON usuarios.contas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_usuarios_lojas_updated') THEN
        CREATE TRIGGER trg_usuarios_lojas_updated BEFORE UPDATE ON usuarios.lojas FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_autos_estoque_updated') THEN
        CREATE TRIGGER trg_autos_estoque_updated BEFORE UPDATE ON autos.estoque FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_imoveis_catalogo_updated') THEN
        CREATE TRIGGER trg_imoveis_catalogo_updated BEFORE UPDATE ON imoveis.catalogo FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_loja_produtos_updated') THEN
        CREATE TRIGGER trg_loja_produtos_updated BEFORE UPDATE ON loja.produtos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_servicos_catalogo_updated') THEN
        CREATE TRIGGER trg_servicos_catalogo_updated BEFORE UPDATE ON servicos.catalogo FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END $$;

-- ============================================================================
-- 8. CRIAÇÃO DE USUÁRIO DE APLICAÇÃO (ROLE COM MENOR PRIVILÉGIO)
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tresfacil_app_user') THEN
        CREATE USER tresfacil_app_user WITH PASSWORD 'SuaSenhaSeguraAqui123!';
    END IF;
END $$;

GRANT USAGE ON SCHEMA usuarios, autos, imoveis, loja, servicos TO tresfacil_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA usuarios, autos, imoveis, loja, servicos TO tresfacil_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA usuarios, autos, imoveis, loja, servicos GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tresfacil_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA usuarios, autos, imoveis, loja, servicos TO tresfacil_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA usuarios, autos, imoveis, loja, servicos GRANT USAGE, SELECT ON SEQUENCES TO tresfacil_app_user;
