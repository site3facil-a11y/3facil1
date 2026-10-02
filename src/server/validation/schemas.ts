import { z } from 'zod';

// ==========================================
// 1. SCHEMAS DE AUTENTICAÇÃO
// ==========================================

export const loginSchema = z.object({
  email: z.string().trim().email({ message: 'E-mail inválido.' }).max(255),
  password: z.string().min(1, { message: 'Senha é obrigatória.' }).max(128)
}).strict();

export const registerSchema = z.object({
  name: z.string().trim().min(2, { message: 'Nome da loja deve ter no mínimo 2 caracteres.' }).max(120),
  email: z.string().trim().email({ message: 'E-mail inválido.' }).max(255),
  password: z.string().min(6, { message: 'Senha deve ter no mínimo 6 caracteres.' }).max(128),
  type: z.enum(['veiculos', 'imoveis', 'produtos', 'servicos'], {
    message: 'Tipo de catálogo inválido.'
  }),
  whatsapp: z.string().trim().min(8, { message: 'WhatsApp inválido.' }).max(30),
  phone: z.string().trim().max(30).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(50).optional()
}).strict();

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email({ message: 'E-mail inválido.' }).max(255)
}).strict();

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(10, { message: 'Token de recuperação inválido.' }).max(256),
  newPassword: z.string().min(6, { message: 'A nova senha deve ter no mínimo 6 caracteres.' }).max(128)
}).strict();

// ==========================================
// 2. SCHEMAS DE LOJAS
// ==========================================

export const updateStoreSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9-]+$/, {
    message: 'Slug deve conter apenas letras minúsculas, números e hífens.'
  }).optional(),
  type: z.enum(['veiculos', 'imoveis', 'produtos', 'servicos']).optional(),
  description: z.string().trim().max(2000).optional(),
  slogan: z.string().trim().max(255).optional(),
  themeColor: z.string().trim().max(50).optional(),
  logoUrl: z.string().trim().max(1000).optional().nullable(),
  bannerUrl: z.string().trim().max(1000).optional().nullable(),
  whatsapp: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().max(255).optional(),
  instagram: z.string().trim().max(100).optional(),
  address: z.string().trim().max(255).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(50).optional(),
  zipCode: z.string().trim().max(20).optional(),
  ownerName: z.string().trim().max(120).optional(),
  ownerEmail: z.string().trim().email().max(255).optional(),
  ownerPhone: z.string().trim().max(30).optional(),
  // Campos sensíveis (somente aceitos se superadmin, filtrados caso contrário)
  plan: z.string().trim().max(50).optional(),
  subscriptionStatus: z.string().trim().max(50).optional(),
  monthlyFee: z.number().nonnegative().finite().optional(),
  nextDueDate: z.string().trim().max(50).optional(),
  lastPaymentDate: z.string().trim().max(50).optional(),
  isPublished: z.boolean().optional(),
  customDomain: z.string().trim().max(255).optional(),
  features: z.array(z.string()).optional(),
  // Permitir objeto de configurações extras com chaves genéricas
  configuracoes: z.record(z.string(), z.any()).optional()
}).strict();

// ==========================================
// 3. SCHEMAS DE ITENS DO CATÁLOGO
// ==========================================

export const createItemSchema = z.object({
  id: z.string().trim().max(100).optional(),
  storeId: z.string().trim().min(1, { message: 'storeId é obrigatório.' }).max(100),
  title: z.string().trim().min(2, { message: 'Título é obrigatório.' }).max(200),
  itemType: z.enum(['veiculo', 'imovel', 'produto', 'servico'], {
    message: 'Tipo de item inválido (deve ser veiculo, imovel, produto ou servico).'
  }),
  price: z.number().nonnegative().finite({ message: 'Preço deve ser um número não negativo.' }),
  promotionalPrice: z.number().nonnegative().finite().optional().nullable(),
  description: z.string().trim().max(5000).optional().default(''),
  images: z.array(z.string().trim()).max(50).optional().default([]),
  featured: z.boolean().optional().default(false),
  status: z.enum(['disponivel', 'vendido', 'reservado', 'ativo', 'inativo']).optional().default('disponivel'),
  
  // Atributos de Veículos
  brand: z.string().trim().max(100).optional(),
  model: z.string().trim().max(100).optional(),
  version: z.string().trim().max(100).optional(),
  yearFab: z.number().int().min(1900).max(2100).optional(),
  yearModel: z.number().int().min(1900).max(2100).optional(),
  mileage: z.number().nonnegative().finite().optional(),
  fuel: z.string().trim().max(50).optional(),
  transmission: z.string().trim().max(50).optional(),
  color: z.string().trim().max(50).optional(),
  plateEnd: z.string().trim().max(10).optional(),
  fipePrice: z.number().nonnegative().finite().optional().nullable(),
  accessories: z.array(z.string().trim()).optional(),

  // Atributos de Imóveis
  propertyType: z.string().trim().max(50).optional(),
  transactionType: z.enum(['venda', 'locacao', 'temporada']).optional(),
  areaUtil: z.number().nonnegative().finite().optional(),
  areaTotal: z.number().nonnegative().finite().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  suites: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  garageSpots: z.number().int().nonnegative().optional(),
  condoFee: z.number().nonnegative().finite().optional().nullable(),
  iptu: z.number().nonnegative().finite().optional().nullable(),
  neighborhood: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(50).optional(),
  address: z.string().trim().max(255).optional(),
  amenities: z.array(z.string().trim()).optional(),

  // Atributos de Produtos
  sku: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  stockQuantity: z.number().int().nonnegative().optional(),
  inStock: z.boolean().optional(),
  condition: z.enum(['novo', 'usado', 'recondicionado']).optional(),

  // Atributos de Serviços
  priceType: z.enum(['fixo', 'a_partir', 'sob_consulta', 'hora']).optional(),
  estimatedDuration: z.string().trim().max(100).optional(),
  includedItems: z.array(z.string().trim()).optional()
}).passthrough(); // passthrough permite dados extras de templates sem quebrar

// ==========================================
// 4. SCHEMAS DE LEADS / PROPOSTAS
// ==========================================

export const createLeadSchema = z.object({
  id: z.string().trim().max(100).optional(),
  storeId: z.string().trim().min(1, { message: 'Identificação da loja é obrigatória.' }).max(100),
  itemId: z.string().trim().max(100).optional(),
  itemTitle: z.string().trim().min(1).max(200).optional().default('Interesse no Anúncio'),
  itemType: z.enum(['veiculo', 'imovel', 'produto', 'servico']).optional().default('produto'),
  itemPrice: z.number().nonnegative().finite().optional(),
  clientName: z.string().trim().min(2, { message: 'Nome deve ter no mínimo 2 caracteres.' }).max(100),
  clientPhone: z.string().trim().min(8, { message: 'Telefone/WhatsApp deve ter no mínimo 8 dígitos.' }).max(30),
  clientEmail: z.string().trim().email({ message: 'E-mail inválido.' }).max(255).optional().or(z.literal('')),
  clientMessage: z.string().trim().max(2000).optional().default(''),
  proposalValue: z.number().nonnegative().finite().optional().nullable(),
  paymentMethod: z.enum(['pix', 'cartao', 'financiamento', 'dinheiro', 'troca', 'outro']).optional().default('outro'),
  tradeDetails: z.string().trim().max(2000).optional(),
  orderType: z.enum(['entrega', 'retirada']).optional(),
  deliveryAddress: z.string().trim().max(300).optional().nullable(),
  quantity: z.number().int().positive().optional().default(1),
  changeFor: z.number().nonnegative().finite().optional().nullable()
}).passthrough();

export const updateLeadStatusSchema = z.object({
  status: z.enum(['novo', 'em_atendimento', 'fechado', 'perdido', 'aprovado', 'cancelado'], {
    message: 'Status de lead inválido.'
  })
}).strict();

// ==========================================
// 5. SCHEMAS DE CONFIGURAÇÃO (SETTINGS)
// ==========================================

export const updateSettingsSchema = z.object({
  platformName: z.string().trim().min(2).max(100).optional(),
  superAdminName: z.string().trim().min(2).max(100).optional(),
  superAdminEmail: z.string().trim().email().max(255).optional(),
  superAdminPhone: z.string().trim().max(30).optional(),
  pixKey: z.string().trim().max(100).optional(),
  pixKeyType: z.string().trim().max(30).optional(),
  pixBeneficiary: z.string().trim().max(100).optional(),
  defaultTrialDays: z.number().int().nonnegative().max(365).optional(),
  contactEmail: z.string().trim().email().max(255).optional(),
  contactPhone: z.string().trim().max(30).optional(),
  whatsappSupport: z.string().trim().max(30).optional()
}).passthrough();

// ==========================================
// 6. SCHEMAS DE E-MAIL
// ==========================================

export const testEmailSchema = z.object({
  to: z.string().trim().email({ message: 'E-mail de destino inválido.' }).max(255)
}).strict();

export const smtpConfigSchema = z.object({
  host: z.string().trim().min(1, { message: 'Host SMTP é obrigatório.' }).max(255),
  port: z.number().int().positive().max(65535),
  user: z.string().trim().min(1, { message: 'Usuário SMTP é obrigatório.' }).max(255),
  pass: z.string().min(1, { message: 'Senha SMTP é obrigatória.' }).max(255),
  secure: z.boolean().optional(),
  from: z.string().trim().email().optional()
}).strict();
