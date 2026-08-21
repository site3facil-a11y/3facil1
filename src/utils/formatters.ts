import { StoreItem, StoreProfile, ProposalLead } from '../types/store';

export const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value);
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
