import { StoreItem, StoreProfile, ProposalLead } from '../types/store';

export const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
};

export const formatCurrencyExtended = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value) || value <= 0) return '';
  if (value >= 1_000_000_000) {
    const b = (value / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    return `${b} ${value >= 2_000_000_000 ? 'Bilhões' : 'Bilhão'} de Reais`;
  }
  if (value >= 1_000_000) {
    const m = (value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    return `${m} ${value >= 2_000_000 ? 'Milhões' : 'Milhão'} de Reais`;
  }
  if (value >= 1_000) {
    const k = (value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    return `${k} Mil Reais`;
  }
  return '';
};

/**
 * Converte qualquer entrada do usuário (com ou sem formatação de moeda BRL/US,
 * com pontos de milhar ou vírgula decimal, ex: "1.200.000", "1.200.000,00",
 * "1200000", "100.000", "2.750.000,00", "1.5M") para número real float em JavaScript.
 */
export const parseCurrencyInput = (raw: string | number | undefined | null): number => {
  if (raw === undefined || raw === null || raw === '') return 0;
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  
  let str = String(raw).trim();
  if (!str) return 0;

  // Tratar sufixos comuns como "M" (milhões) ou "k" (milhares)
  const lower = str.toLowerCase();
  if (lower.endsWith('m') || lower.includes('milh')) {
    const numPart = parseFloat(lower.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(numPart)) return numPart * 1_000_000;
  }
  if (lower.endsWith('k') || lower.includes('mil')) {
    const numPart = parseFloat(lower.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(numPart)) return numPart * 1_000;
  }

  // Remove "R$", espaços
  str = str.replace(/R\$\s?/gi, '').trim();

  // Caso contenha vírgula E ponto (ex: 1.500.000,00 ou 1,500,000.00)
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf('.') < str.lastIndexOf(',')) {
      // Padrão brasileiro: 1.500.000,00 -> remove pontos e troca vírgula por ponto
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Padrão internacional: 1,500,000.00 -> remove vírgulas
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Apenas vírgula: ex: 1500000,00 ou 100,50 ou 1,500,000
    const commaCount = (str.match(/,/g) || []).length;
    if (commaCount > 1) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  } else if (str.includes('.')) {
    // Apenas pontos:
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Ex: 1.000.000 ou 2.750.000 -> múltiplos pontos são sempre separadores de milhar!
      str = str.replace(/\./g, '');
    } else {
      // Exatamente um ponto. Ex: "100.000" (cem mil sem centavos) vs "100.50" (cem reais e 50 centavos)
      const parts = str.split('.');
      if (parts[1] && parts[1].length === 3) {
        // Se após o ponto tem 3 dígitos (ex: 100.000, 250.000, 800.000) -> é separador de milhar!
        str = str.replace(/\./g, '');
      }
    }
  }

  // Remove qualquer caracter não numérico exceto dígito e ponto
  str = str.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

export const formatNumber = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return '0';
  return new Intl.NumberFormat('pt-BR').format(value);
};

// Gera o link do WhatsApp para o cliente iniciar uma conversa direta
export const generateWhatsAppLink = (
  rawPhone: string,
  item: StoreItem,
  store: StoreProfile
): string => {
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const finalPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

  let itemDetails = '';
  if (item.itemType === 'veiculo') {
    itemDetails = `🚗 Veículo: *${item.title}*\n📅 Ano: ${item.yearFab}/${item.yearModel} | 🛣️ KM: ${formatNumber(item.mileage)} km\n💰 Valor: *${formatCurrency(item.price)}*`;
  } else if (item.itemType === 'imovel') {
    itemDetails = `🏡 Imóvel: *${item.title}*\n📍 Localização: ${item.neighborhood}, ${item.city}\n📐 Área: ${item.areaUtil} m² | 🛏️ ${item.bedrooms} quartos\n💰 Valor: *${formatCurrency(item.price)}* (${item.transactionType === 'venda' ? 'Venda' : 'Locação'})`;
  } else if (item.itemType === 'produto') {
    const promo = item.promotionalPrice ? ` (Promoção: ${formatCurrency(item.promotionalPrice)})` : '';
    itemDetails = `🛍️ Produto: *${item.title}*\n💰 Valor: *${formatCurrency(item.price)}*${promo}\n📦 Ref/SKU: ${item.sku || 'N/A'}`;
  } else if (item.itemType === 'servico') {
    const priceText = item.priceType === 'sob_consulta' ? 'Sob Consulta' : formatCurrency(item.price);
    itemDetails = `💼 Serviço: *${item.title}*\n⏱️ Prazo estimado: ${item.estimatedDuration || 'A combinar'}\n💰 Investimento: *${priceText}*`;
  }

  const message = `Olá, *${store.name}*!\n\nVi o catálogo e tenho grande interesse no seguinte item:\n\n${itemDetails}\n\nPodemos conversar sobre disponibilidade e condições?`;

  return `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
};

// Gera o texto formatado para a proposta formal de compra/orçamento/reserva
export const generateProposalPlainText = (
  store: StoreProfile,
  proposal: ProposalLead
): string => {
  const paymentLabels: Record<string, string> = {
    a_vista: 'À Vista (PIX / Transferência / TED)',
    financiamento: 'Financiamento Bancário / Carta de Crédito',
    parcelado: 'Parcelamento Direto / Boleto',
    cartao_credito: 'Cartão de Crédito',
    faturamento_pj: 'Faturamento para Empresa (PJ)',
    troca_veiculo: 'Veículo Usado na Troca + Diferença',
    troca_imovel: 'Imóvel na Troca (Permuta)',
    outro: 'Outras Condições',
  };

  const formattedPayment = paymentLabels[proposal.paymentMethod] || proposal.paymentMethod;
  const proposalValText = proposal.proposalValue ? formatCurrency(proposal.proposalValue) : 'Conforme valor anunciado';

  const docTitle = 'PROPOSTA FORMAL DE COMPRA / ORÇAMENTO';

  return `=====================================================
${docTitle}
=====================================================
Loja Destinatária: ${store.name}
Data: ${new Date(proposal.createdAt).toLocaleDateString('pt-BR')} às ${new Date(proposal.createdAt).toLocaleTimeString('pt-BR')}

DADOS DO CLIENTE / PROPONENTE:
-----------------------------------------------------
Nome: ${proposal.clientName}
E-mail: ${proposal.clientEmail}
Telefone / WhatsApp: ${proposal.clientPhone}

ITEM DE INTERESSE:
-----------------------------------------------------
Item: ${proposal.itemTitle}
Tipo de Negócio: ${proposal.itemType.toUpperCase()}
Valor Base Anunciado: ${formatCurrency(proposal.itemPrice)}

CONDICIONAIS DA PROPOSTA:
-----------------------------------------------------
Valor Total Estimado / Ofertado: ${proposalValText}
Forma de Pagamento: ${formattedPayment}
${proposal.tradeDetails ? `Detalhes do bem na troca: ${proposal.tradeDetails}\n` : ''}
Mensagem / Observações do Cliente:
"${proposal.clientMessage}"

=====================================================
Esta proposta foi gerada via catálogo online ${store.name}.
=====================================================`;
};

// Gera link mailto para abrir direto no aplicativo de e-mail do cliente
export const generateMailtoLink = (
  store: StoreProfile,
  proposal: ProposalLead
): string => {
  const prefix = '[PROPOSTA DE COMPRA]';
  const subject = `${prefix} ${proposal.itemTitle} - ${proposal.clientName}`;
  const body = generateProposalPlainText(store, proposal);
  return `mailto:${store.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

// Link do WhatsApp com a proposta completa já transcrita
export const generateProposalWhatsAppLink = (
  proposal: ProposalLead,
  store: StoreProfile
): string => {
  const cleanPhone = store.whatsapp.replace(/\D/g, '');
  const finalPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

  const header = '*PROPOSTA FORMAL DE COMPRA / ORÇAMENTO*';

  const message = `${header}\n\n` +
    `*Loja:* ${store.name}\n` +
    `*Cliente:* ${proposal.clientName} (${proposal.clientPhone})\n` +
    `*E-mail:* ${proposal.clientEmail}\n\n` +
    `*Item:* ${proposal.itemTitle}\n` +
    `*Valor Anunciado:* ${formatCurrency(proposal.itemPrice)}\n` +
    (proposal.proposalValue ? `*Valor Ofertado/Total:* ${formatCurrency(proposal.proposalValue)}\n` : '') +
    `*Forma de Pagto:* ${proposal.paymentMethod}\n` +
    (proposal.tradeDetails ? `*Troca:* ${proposal.tradeDetails}\n` : '') +
    `\n*Mensagem:* ${proposal.clientMessage}`;

  return `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
};

// Gera link do WhatsApp para dúvidas gerais na loja
export const generateGeneralWhatsAppLink = (
  store: StoreProfile
): string => {
  const cleanPhone = (store.whatsapp || store.phone || '').replace(/\D/g, '');
  const finalPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  const message = `Olá, *${store.name}*!\n\nAcesse sua vitrine virtual e gostaria de tirar algumas dúvidas sobre seus produtos/serviços/locações. Poderia me atender?`;
  return `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
};

export const getDefaultImageForItem = (itemType?: string): string => {
  switch (itemType) {
    case 'veiculo':
      return '/uploads/demo/photo-1549399542-7e3f8b79c341.jpg';
    case 'imovel':
      return '/uploads/demo/photo-1560518883-ce09059eeffa.jpg';
    case 'produto':
      return '/uploads/demo/photo-1505740420928-5e560c06d30e.jpg';
    case 'servico':
      return '/uploads/demo/photo-1454165804606-c3d57bc86b40.jpg';
    default:
      return '/uploads/demo/photo-1560518883-ce09059eeffa.jpg';
  }
};

/**
 * Sanitiza URLs de imagens para evitar problemas de Mixed Content (HTTP em HTTPS),
 * corrige prefixos com IP fixo de VPS antiga e restaura fotos Unsplash que foram concatenadas com paths locais.
 */
export const sanitizeImageUrl = (rawUrl?: string, itemType?: string): string => {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return getDefaultImageForItem(itemType);
  }

  let url = rawUrl.trim();

  // 1. Se for uma referência de foto Unsplash "solta" (sem domínio nem pasta local),
  // aponta para a cópia local já baixada em /uploads/demo/ — nunca mais para o Unsplash.
  if (url.includes('photo-') && !url.includes('images.unsplash.com') && !url.includes('/uploads/demo/')) {
    const photoMatch = url.match(/photo-[0-9]+-[a-f0-9]+/);
    if (photoMatch) {
      return `/uploads/demo/${photoMatch[0]}.jpg`;
    }
  }

  // 2. Corrige links de fotos de imóveis vindos de uma migração antiga, que gravou o
  // caminho errado (/uploads/imoveis/*.webp) — o arquivo real está em /uploads_imoveis/*.jpg.
  const legacyImovelMatch = url.match(/\/uploads\/imoveis\/(foto_[a-f0-9]+)\.webp$/i);
  if (legacyImovelMatch) {
    return `/uploads_imoveis/${legacyImovelMatch[1]}.jpg`;
  }

  // 3. Se for uma URL completa da web apontando para o 3facil.com oficial antigo (ex: https://www.3facil.com/uploads/...)
  // Manter como URL completa válida https://www.3facil.com/... para carregar do servidor principal
  if (url.startsWith('https://www.3facil.com/') || url.startsWith('http://www.3facil.com/') || url.startsWith('https://3facil.com/') || url.startsWith('http://3facil.com/')) {
    return url.replace('http://', 'https://');
  }

  // 4. Se for URL absoluta com IP/porta do servidor local (ex: http://163.170.205.169:3000/uploads_imoveis/foto_xyz.jpg)
  // Converter para caminho relativo local da aplicação
  if (url.includes('/uploads_imoveis/')) {
    const parts = url.split('/uploads_imoveis/');
    return `/uploads_imoveis/${parts[1]}`;
  }
  if (url.includes('/uploads/')) {
    const parts = url.split('/uploads/');
    return `/uploads/${parts[1]}`;
  }

  // 5. Se for URL HTTP externa de outro site, converter para HTTPS
  if (url.startsWith('http://') && !url.includes('localhost') && !url.match(/^http:\/\/\d+\.\d+\.\d+\.\d+/)) {
    return url.replace('http://', 'https://');
  }

  return url;
};
