export type StoreType = 'veiculo' | 'imovel' | 'produto' | 'servico';
export type SaaSPlanTier = 'starter' | 'pro' | 'enterprise' | 'personalizado';
export type SubscriptionStatus = 'ativo' | 'pendente' | 'trial' | 'suspenso';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'lojista';
  storeId?: string;
  storeName?: string;
}

export interface StoreProfile {
  id: string;
  slug: string;
  type: StoreType;
  name: string;
  slogan: string;
  description: string;
  logoUrl?: string;
  bannerUrl?: string;
  themeColor: string; // Hex color code e.g. '#2563eb'
  phone: string;
  whatsapp: string; // Apenas números com DDD, ex: 11999998888
  email: string;
  address?: string;
  neighborhood?: string;
  city: string;
  state: string;
  instagram?: string;
  enableWhatsApp: boolean;
  enableEmailProposal: boolean;
  currency: string; // Ex: 'BRL'
  createdAt: string;

  // Gestão do Cliente & Assinatura SaaS (Painel Master)
  ownerName?: string; // Nome do Cliente / Lojista
  ownerEmail?: string; // E-mail do Cliente
  ownerPhone?: string; // WhatsApp / Telefone direto do Cliente
  ownerDocument?: string; // CPF ou CNPJ
  plan: SaaSPlanTier; // Plano contratado
  planName?: string; // Nome exibido do plano, ex: 'Plano Profissional'
  monthlyFee: number; // Valor da Mensalidade em R$, ex: 99.00
  subscriptionStatus: SubscriptionStatus; // Status da assinatura
  nextDueDate: string; // Próximo Vencimento (YYYY-MM-DD ou formato amigável)
  lastPaymentDate?: string; // Data do último pagamento confirmado
  isPublished: boolean; // Se a vitrine está ativa online ou suspensa pelo Super Admin
  internalNotes?: string; // Anotações internas do Administrador da Plataforma
}

export interface SaaSPlatformSettings {
  platformName: string;
  superAdminName: string;
  superAdminEmail: string;
  superAdminPhone: string; // WhatsApp para suporte e envio de cobranças
  pixKey: string; // Chave Pix para recebimento das mensalidades
  pixKeyType: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';
  pixBeneficiary: string;
  defaultTrialDays: number;
}

export interface SaaSPlanConfig {
  id: SaaSPlanTier;
  name: string;
  badge?: string;
  price: number;
  description: string;
  features: string[];
  maxItems: number;
  highlighted?: boolean;
}

export interface BaseItem {
  id: string;
  storeId: string;
  title: string;
  description: string;
  images: string[];
  featured: boolean;
  createdAt: string;
}

// 1. Modelo Loja de Produtos Físicos
export interface ProductItem extends BaseItem {
  itemType: 'produto';
  category: string;
  price: number;
  promotionalPrice?: number;
  sku?: string;
  brand?: string;
  inStock: boolean;
  stockQuantity?: number;
  condition: 'novo' | 'usado' | 'reembalado';
  sizes?: string[]; // Ex: ['P', 'M', 'G', 'GG']
  colors?: string[]; // Ex: ['Preto', 'Branco', 'Azul']
  status: 'ativo' | 'esgotado' | 'pausado';
}

// 2. Modelo Prestador de Serviços
export interface ServiceItem extends BaseItem {
  itemType: 'servico';
  category: string;
  price: number;
  priceType: 'fixo' | 'a_partir_de' | 'sob_consulta';
  estimatedDuration?: string; // Ex: '2 a 4 horas'
  includedItems?: string[]; // O que está incluso no pacote
  prerequisites?: string;
  status: 'ativo' | 'pausado';
}

// 3. Modelo Imobiliária
export interface RealEstateItem extends BaseItem {
  itemType: 'imovel';
  propertyType: 'casa' | 'apartamento' | 'cobertura' | 'terreno' | 'comercial' | 'chacara' | 'loft';
  transactionType: 'venda' | 'aluguel';
  price: number;
  condoFee?: number; // Valor do condomínio
  iptu?: number;
  areaUtil: number; // m²
  areaTotal?: number; // m²
  bedrooms: number;
  suites: number;
  bathrooms: number;
  garageSpots: number;
  neighborhood: string;
  city: string;
  state: string;
  address?: string;
  amenities: string[]; // Ex: ['Piscina', 'Churrasqueira', 'Varanda Gourmet', 'Elevador', 'Portaria 24h', 'Academia', 'Ar Condicionado', 'Pet Friendly']
  status: 'disponivel' | 'reservado' | 'vendido' | 'alugado';
}

// 4. Modelo Venda de Veículos
export interface VehicleItem extends BaseItem {
  itemType: 'veiculo';
  brand: string; // Marca: Toyota, Honda, etc.
  model: string; // Corolla, Civic, etc.
  version?: string; // XEi 2.0 Flex
  yearFab: number; // 2022
  yearModel: number; // 2023
  mileage: number; // KM
  transmission: 'automatico' | 'manual' | 'automatizado' | 'cvt';
  fuel: 'flex' | 'gasolina' | 'etanol' | 'diesel' | 'hibrido' | 'eletrico';
  color: string;
  doors?: number;
  plateEnd?: string; // Ex: 'Final 8'
  price: number;
  fipePrice?: number;
  uniqueOwner?: boolean;
  inspectionsDone?: boolean;
  warranty?: boolean;
  accessories: string[];
  status: 'disponivel' | 'reservado' | 'vendido';
}

export type StoreItem = ProductItem | ServiceItem | RealEstateItem | VehicleItem;

export interface ProposalLead {
  id: string;
  storeId: string;
  itemId: string;
  itemTitle: string;
  itemType: StoreType;
  itemPrice: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientMessage: string;
  proposalValue?: number;
  paymentMethod: 'a_vista' | 'financiamento' | 'parcelado' | 'troca_veiculo' | 'troca_imovel' | 'cartao_credito' | 'faturamento_pj' | 'outro';
  tradeDetails?: string;
  createdAt: string;
  status: 'novo' | 'em_contato' | 'proposta_enviada' | 'fechado' | 'arquivado';
}
