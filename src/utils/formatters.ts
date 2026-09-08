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

// Faz o parsing de valores em reais digitados pelo usuário (ex: "1.500,00", "50000")
export const parseCurrencyInput = (input: string | number): number => {
  if (typeof input === 'number') return isNaN(input) ? 0 : input;
  if (!input || typeof input !== 'string') return 0;
  
  let clean = input.replace(/[^\d.,]/g, '').trim();
  if (!clean) return 0;

  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

// Formata valores por extenso / abreviados (ex: "1.5 milhão de reais", "250 mil reais")
export const formatCurrencyExtended = (value: number | undefined | null): string => {
  if (!value || isNaN(value) || value === 0) return '';
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} milhão(ões) de reais`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `${thousands.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil reais`;
  }
  return formatCurrency(value);
};

// Imagem padrão fallback para itens cadastrados sem imagem
export const getDefaultImageForItem = (type?: string): string => {
  switch (type) {
    case 'veiculo':
      return '/uploads/demo/photo-1549399542-7e3f8b79c341.jpg';
    case 'produto':
      return '/uploads/demo/photo-1526738549149-8e07eca6c147.jpg';
    case 'servico':
      return '/uploads/demo/photo-1507003211169-0a1dd7228f2d.jpg';
    case 'locadora':
      return '/uploads/demo/photo-1549399542-7e3f8b79c341.jpg';
    case 'imovel':
    default:
      return '/uploads/demo/photo-1560518883-ce09059eeffa.jpg';
  }
};

// Higieniza e garante URLs válidas para imagens e banners
export const sanitizeImageUrl = (url?: string, _type?: string): string => {
  if (!url || typeof url !== 'string') return '';
  return url.trim();
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

// Gera o texto formatado para a proposta formal de compra/orçamento/reserva/pedido
export const generateProposalPlainText = (
  store: StoreProfile,
  proposal: ProposalLead
): string => {
  const paymentLabels: Record<string, string> = {
    pix: 'PIX (Chave da Loja / QR Code)',
    cartao_entrega: 'Cartão na Entrega / Retirada (Maquininha)',
    dinheiro_entrega: 'Dinheiro na Entrega / Retirada',
    a_vista: 'À Vista (PIX / Transferência / TED)',
    financiamento: 'Financiamento Bancário / Carta de Crédito',
    parcelado: 'Parcelamento Direto / Cartão de Crédito',
    cartao_credito: 'Cartão de Crédito',
    faturamento_pj: 'Faturamento para Empresa (PJ)',
    troca_veiculo: 'Veículo Usado na Troca + Diferença',
    troca_imovel: 'Imóvel na Troca (Permuta)',
    outro: 'Outras Condições',
  };

  const formattedPayment = paymentLabels[proposal.paymentMethod] || proposal.paymentMethod;
  const proposalValText = proposal.proposalValue ? formatCurrency(proposal.proposalValue) : formatCurrency(proposal.itemPrice);

  const isProduct = proposal.itemType === 'produto';
  const isService = proposal.itemType === 'servico';
  const isVehicle = proposal.itemType === 'veiculo';
  const isRealEstate = proposal.itemType === 'imovel';
  const isRental = (proposal.itemType as string) === 'locadora';

  const docTitle = isProduct
    ? 'PEDIDO DE COMPRA / VAREJO & DELIVERY'
    : isService
    ? 'SOLICITAÇÃO DE ORÇAMENTO / SERVIÇO'
    : isRental
    ? 'SOLICITAÇÃO DE RESERVA / LOCAÇÃO'
    : isVehicle
    ? 'PROPOSTA DE COMPRA DE VEÍCULO'
    : isRealEstate
    ? 'PROPOSTA DE AQUISIÇÃO / AGENDAMENTO IMOBILIÁRIO'
    : 'PROPOSTA FORMAL DE COMPRA';

  let orderSpecificSection = '';
  if (isProduct) {
    const deliveryLabel = proposal.orderType === 'retirada' ? 'Retirada no Local / Balcão da Loja' : 'Entrega no Endereço (Delivery)';
    orderSpecificSection = `
MODALIDADE DE ENTREGA:
-----------------------------------------------------
Tipo de Atendimento: ${deliveryLabel}
${proposal.orderType === 'entrega' ? `Endereço para Entrega: ${proposal.deliveryAddress || 'A combinar'}\n` : ''}${proposal.changeFor ? `Necessidade de Troco: Troco para ${proposal.changeFor}\n` : ''}Quantidade Solicitada: ${proposal.quantity || 1} un.
Valor Unitário: ${formatCurrency(proposal.itemPrice)}
`;
  } else if (isVehicle) {
    orderSpecificSection = `
DADOS ESPECÍFICOS DO VEÍCULO:
-----------------------------------------------------
${proposal.downPayment ? `Valor de Entrada Pretendido: ${formatCurrency(proposal.downPayment)}\n` : ''}${proposal.testDriveRequested ? `Test Drive Agendado: Sim (${proposal.preferredDate ? `Data: ${proposal.preferredDate}` : 'A definir'} - Período: ${proposal.preferredPeriod ? proposal.preferredPeriod.toUpperCase() : 'A combinar'})\n` : ''}${proposal.tradeDetails ? `Veículo Usado na Troca: ${proposal.tradeDetails}\n` : ''}`;
  } else if (isRealEstate) {
    const objLabel = proposal.visitType === 'agendar_visita' ? 'Agendamento de Visita Presencial' : proposal.visitType === 'alugar' ? 'Proposta de Locação' : 'Proposta de Aquisição';
    orderSpecificSection = `
DADOS DO ATENDIMENTO IMOBILIÁRIO:
-----------------------------------------------------
Objetivo Principal: ${objLabel}
${proposal.preferredDate ? `Data Sugerida para Visita: ${proposal.preferredDate} (${proposal.preferredPeriod ? proposal.preferredPeriod.toUpperCase() : 'A combinar'})\n` : ''}${proposal.useFgts ? `Uso de Recursos do FGTS: Sim, pretendo utilizar FGTS\n` : ''}`;
  } else if (isService) {
    const locLabel = proposal.serviceLocationType === 'domicilio' ? 'No Endereço do Cliente (Domicílio / Empresa)' : 'No Estabelecimento / Oficina';
    const urgLabel = proposal.urgency === 'urgente' ? 'Urgente (O mais rápido possível)' : proposal.urgency === 'esta_semana' ? 'Nesta Semana' : 'Planejado (Sem pressa)';
    orderSpecificSection = `
ESPECIFICAÇÕES DO SERVIÇO:
-----------------------------------------------------
Local de Execução: ${locLabel}
Previsão / Urgência: ${urgLabel}
`;
  } else if (isRental) {
    orderSpecificSection = `
PERÍODO DA LOCAÇÃO / RESERVA:
-----------------------------------------------------
Diárias Solicitadas: ${proposal.rentalDays || 1} diária(s)
${proposal.pickupDate ? `Data de Retirada: ${proposal.pickupDate}\n` : ''}${proposal.returnDate ? `Data de Devolução: ${proposal.returnDate}\n` : ''}`;
  }

  return `=====================================================
${docTitle}
=====================================================
Loja Destinatária: ${store.name}
Data: ${new Date(proposal.createdAt).toLocaleDateString('pt-BR')} às ${new Date(proposal.createdAt).toLocaleTimeString('pt-BR')}

DADOS DO CLIENTE / SOLICITANTE:
-----------------------------------------------------
Nome: ${proposal.clientName}
E-mail: ${proposal.clientEmail}
Telefone / WhatsApp: ${proposal.clientPhone}

ITEM SELECIONADO:
-----------------------------------------------------
Item: ${proposal.itemTitle}
Tipo de Negócio: ${proposal.itemType.toUpperCase()}
Valor Anunciado: ${formatCurrency(proposal.itemPrice)}
${orderSpecificSection}
CONDIÇÕES DE PAGAMENTO:
-----------------------------------------------------
Valor Total ${isProduct ? 'do Pedido' : 'Estimado / Ofertado'}: ${proposalValText}
Forma de Pagamento: ${formattedPayment}
${proposal.tradeDetails ? `Detalhes do bem na troca: ${proposal.tradeDetails}\n` : ''}
${isProduct ? 'Instruções / Observações do Pedido:' : 'Mensagem / Observações do Cliente:'}
"${proposal.clientMessage || (isProduct ? 'Pedido gerado via vitrine online.' : 'Interesse no item anunciado.')}"

=====================================================
Registro gerado via vitrine online ${store.name}.
=====================================================`;
};

// Gera link mailto para abrir direto no aplicativo de e-mail do cliente
export const generateMailtoLink = (
  store: StoreProfile,
  proposal: ProposalLead
): string => {
  const isProduct = proposal.itemType === 'produto';
  const isService = proposal.itemType === 'servico';
  const prefix = isProduct
    ? '[NOVO PEDIDO]'
    : isService
    ? '[SOLICITAÇÃO DE ORÇAMENTO]'
    : '[PROPOSTA DE COMPRA]';

  const subject = `${prefix} ${proposal.itemTitle} - ${proposal.clientName}`;
  const body = generateProposalPlainText(store, proposal);
  return `mailto:${store.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

// Link do WhatsApp com a proposta ou pedido completo já formatado
export const generateProposalWhatsAppLink = (
  proposal: ProposalLead,
  store: StoreProfile
): string => {
  const cleanPhone = store.whatsapp.replace(/\D/g, '');
  const finalPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

  const paymentLabels: Record<string, string> = {
    pix: 'PIX (Chave da Loja)',
    cartao_entrega: 'Cartão na Entrega / Retirada (Maquininha)',
    dinheiro_entrega: 'Dinheiro na Entrega / Retirada',
    a_vista: 'À Vista (PIX / Transferência)',
    financiamento: 'Financiamento Bancário',
    parcelado: 'Parcelado / Cartão',
    cartao_credito: 'Cartão de Crédito',
    faturamento_pj: 'Faturamento PJ',
    troca_veiculo: 'Veículo na Troca',
    troca_imovel: 'Imóvel na Troca',
    outro: 'Outro',
  };

  const formattedPayment = paymentLabels[proposal.paymentMethod] || proposal.paymentMethod;
  const isProduct = proposal.itemType === 'produto';
  const isService = proposal.itemType === 'servico';

  if (isProduct) {
    const deliveryLabel = proposal.orderType === 'retirada' ? '🏬 *Retirada no Local / Balcão*' : '🚚 *Entrega no Endereço (Delivery)*';
    const totalVal = proposal.proposalValue ? formatCurrency(proposal.proposalValue) : formatCurrency(proposal.itemPrice);

    let msg = `🛍️ *NOVO PEDIDO DE COMPRA* 🛍️\n\n` +
      `*Loja:* ${store.name}\n` +
      `*Cliente:* ${proposal.clientName}\n` +
      `*WhatsApp:* ${proposal.clientPhone}\n` +
      `*E-mail:* ${proposal.clientEmail}\n\n` +
      `*Produto:* ${proposal.itemTitle}\n` +
      `*Quantidade:* ${proposal.quantity || 1} un.\n` +
      `*Valor Total:* *${totalVal}*\n\n` +
      `*Modalidade:* ${deliveryLabel}\n`;

    if (proposal.orderType === 'entrega' && proposal.deliveryAddress) {
      msg += `*Endereço de Entrega:* ${proposal.deliveryAddress}\n`;
    }

    msg += `*Forma de Pagamento:* ${formattedPayment}\n`;

    if (proposal.changeFor) {
      msg += `*Troco para:* ${proposal.changeFor}\n`;
    }

    if (proposal.clientMessage) {
      msg += `\n*Observações:* ${proposal.clientMessage}`;
    }

    return `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`;
  }

  const isVehicle = proposal.itemType === 'veiculo';
  const isRealEstate = proposal.itemType === 'imovel';
  const isRental = (proposal.itemType as string) === 'locadora';

  if (isVehicle) {
    let msg = `🚗 *PROPOSTA DE VEÍCULO* 🚗\n\n` +
      `*Concessionária:* ${store.name}\n` +
      `*Cliente:* ${proposal.clientName} (${proposal.clientPhone})\n` +
      `*E-mail:* ${proposal.clientEmail}\n\n` +
      `*Veículo de Interesse:* ${proposal.itemTitle}\n` +
      `*Valor Anunciado:* ${formatCurrency(proposal.itemPrice)}\n`;

    if (proposal.proposalValue && proposal.proposalValue !== proposal.itemPrice) {
      msg += `*Proposta / Valor Ofertado:* *${formatCurrency(proposal.proposalValue)}*\n`;
    }

    msg += `*Forma de Pagamento:* ${formattedPayment}\n`;

    if (proposal.downPayment && proposal.downPayment > 0) {
      msg += `*Entrada Pretendida:* ${formatCurrency(proposal.downPayment)}\n`;
    }

    if (proposal.tradeDetails) {
      msg += `*Veículo na Troca:* ${proposal.tradeDetails}\n`;
    }

    if (proposal.testDriveRequested) {
      msg += `*Desejo Agendar Test Drive:* Sim (${proposal.preferredDate || 'Data a combinar'} - ${proposal.preferredPeriod ? proposal.preferredPeriod.toUpperCase() : 'Manhã/Tarde'})\n`;
    }

    if (proposal.clientMessage) {
      msg += `\n*Mensagem / Dúvida:* ${proposal.clientMessage}`;
    }

    return `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`;
  }

  if (isRealEstate) {
    const isVisit = proposal.visitType === 'agendar_visita';
    const headerTitle = isVisit ? '🏡 *AGENDAMENTO DE VISITA IMOBILIÁRIA* 🏡' : '🏠 *PROPOSTA DE AQUISIÇÃO / LOCAÇÃO* 🏠';

    let msg = `${headerTitle}\n\n` +
      `*Imobiliária/Corretor:* ${store.name}\n` +
      `*Cliente:* ${proposal.clientName} (${proposal.clientPhone})\n` +
      `*E-mail:* ${proposal.clientEmail}\n\n` +
      `*Imóvel:* ${proposal.itemTitle}\n` +
      `*Valor de Referência:* ${formatCurrency(proposal.itemPrice)}\n`;

    if (isVisit) {
      msg += `*Agendamento de Visita Presencial:* Sim\n` +
        `*Data Desejada:* ${proposal.preferredDate || 'A combinar'} (${proposal.preferredPeriod ? proposal.preferredPeriod.toUpperCase() : 'Período flexível'})\n`;
    } else {
      if (proposal.proposalValue) {
        msg += `*Proposta Apresentada:* *${formatCurrency(proposal.proposalValue)}*\n`;
      }
      msg += `*Forma de Pagamento:* ${formattedPayment}\n`;
      if (proposal.useFgts) {
        msg += `*Utilização do FGTS:* Sim, pretendo usar FGTS na entrada\n`;
      }
    }

    if (proposal.tradeDetails) {
      msg += `*Imóvel na Permuta:* ${proposal.tradeDetails}\n`;
    }

    if (proposal.clientMessage) {
      msg += `\n*Observações do Cliente:* ${proposal.clientMessage}`;
    }

    return `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`;
  }

  if (isService) {
    const locLabel = proposal.serviceLocationType === 'domicilio' ? 'No meu endereço (Domicílio / Empresa)' : 'No estabelecimento do profissional';
    const urgLabel = proposal.urgency === 'urgente' ? '⚡ Urgente (o quanto antes)' : proposal.urgency === 'esta_semana' ? 'Nesta semana' : 'Planejado';

    let msg = `🛠️ *SOLICITAÇÃO DE ORÇAMENTO DE SERVIÇO* 🛠️\n\n` +
      `*Prestador / Empresa:* ${store.name}\n` +
      `*Cliente:* ${proposal.clientName} (${proposal.clientPhone})\n` +
      `*E-mail:* ${proposal.clientEmail}\n\n` +
      `*Serviço:* ${proposal.itemTitle}\n` +
      `*Valor Médio/Base:* ${formatCurrency(proposal.itemPrice)}\n` +
      `*Local de Atendimento:* ${locLabel}\n` +
      `*Urgência Desejada:* ${urgLabel}\n` +
      `*Forma de Pagamento:* ${formattedPayment}\n`;

    if (proposal.clientMessage) {
      msg += `\n*Descrição do Serviço / Necessidade:*\n"${proposal.clientMessage}"`;
    }

    return `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`;
  }

  if (isRental) {
    let msg = `📅 *SOLICITAÇÃO DE RESERVA / LOCAÇÃO* 📅\n\n` +
      `*Locadora:* ${store.name}\n` +
      `*Cliente:* ${proposal.clientName} (${proposal.clientPhone})\n` +
      `*E-mail:* ${proposal.clientEmail}\n\n` +
      `*Item / Veículo:* ${proposal.itemTitle}\n` +
      `*Diárias:* ${proposal.rentalDays || 1} diária(s)\n` +
      (proposal.pickupDate ? `*Data Retirada:* ${proposal.pickupDate}\n` : '') +
      (proposal.returnDate ? `*Data Devolução:* ${proposal.returnDate}\n` : '') +
      (proposal.proposalValue ? `*Valor Total Estimado:* *${formatCurrency(proposal.proposalValue)}*\n` : '') +
      `*Forma de Pagamento:* ${formattedPayment}\n`;

    if (proposal.clientMessage) {
      msg += `\n*Observações:* ${proposal.clientMessage}`;
    }

    return `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`;
  }

  const header = '*PROPOSTA FORMAL DE COMPRA*';

  const message = `${header}\n\n` +
    `*Loja:* ${store.name}\n` +
    `*Cliente:* ${proposal.clientName} (${proposal.clientPhone})\n` +
    `*E-mail:* ${proposal.clientEmail}\n\n` +
    `*Item:* ${proposal.itemTitle}\n` +
    `*Valor Anunciado:* ${formatCurrency(proposal.itemPrice)}\n` +
    (proposal.proposalValue ? `*Valor Ofertado/Total:* ${formatCurrency(proposal.proposalValue)}\n` : '') +
    `*Forma de Pagto:* ${formattedPayment}\n` +
    (proposal.tradeDetails ? `*Troca:* ${proposal.tradeDetails}\n` : '') +
    `\n*Mensagem:* ${proposal.clientMessage || 'Olá, tenho interesse neste item e gostaria de mais informações.'}`;

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
