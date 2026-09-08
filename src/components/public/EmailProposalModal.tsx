import React, { useState } from 'react';
import { 
  X, 
  Send, 
  CheckCircle2, 
  Mail, 
  MessageCircle, 
  Copy, 
  Check, 
  Printer, 
  FileText, 
  DollarSign, 
  User, 
  Phone, 
  Calendar,
  Sparkles,
  ArrowRight,
  Clock,
  ShoppingBag,
  Truck,
  Store,
  MapPin,
  Plus,
  Minus,
  Car,
  Home,
  Briefcase,
  Wrench,
  CheckSquare,
  Shield
} from 'lucide-react';
import { StoreItem, StoreProfile, ProposalLead } from '../../types/store';
import { useStoreContext } from '../../context/StoreContext';
import { 
  formatCurrency, 
  generateMailtoLink, 
  generateProposalPlainText, 
  generateProposalWhatsAppLink 
} from '../../utils/formatters';

interface EmailProposalModalProps {
  item: StoreItem | null;
  store: StoreProfile;
  isOpen: boolean;
  onClose: () => void;
}

export const EmailProposalModal: React.FC<EmailProposalModalProps> = ({
  item,
  store,
  isOpen,
  onClose,
}) => {
  const { submitProposal, theme } = useStoreContext();
  const isDark = theme === 'dark';

  const [step, setStep] = useState<'form' | 'success'>('form');
  const [createdProposal, setCreatedProposal] = useState<ProposalLead | null>(null);
  const [copied, setCopied] = useState(false);

  // Tipos de Negócio
  const isProduct = item?.itemType === 'produto';
  const isRental = (item?.itemType as string) === 'locadora';
  const isService = item?.itemType === 'servico';
  const isVehicle = item?.itemType === 'veiculo';
  const isRealEstate = item?.itemType === 'imovel';

  // Preço unitário base considerando se tem preço promocional ativo
  const unitPrice = item ? (item.promotionalPrice && item.promotionalPrice > 0 ? item.promotionalPrice : item.price) : 0;

  // Estados gerais
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientMessage, setClientMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Estados específicos para Loja / Varejo
  const [quantity, setQuantity] = useState<number>(1);
  const [orderType, setOrderType] = useState<'entrega' | 'retirada'>('entrega');
  const [deliveryStreet, setDeliveryStreet] = useState('');
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState('');
  const [deliveryComplement, setDeliveryComplement] = useState('');
  const [needChange, setNeedChange] = useState(false);
  const [changeFor, setChangeFor] = useState('');

  // Estados específicos para Locadora
  const [rentalDays, setRentalDays] = useState<number>(isRental ? 3 : 1);
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');

  // Estados específicos para Veículos / Imóveis / Serviços
  const [offerValue, setOfferValue] = useState<string>(
    item ? String(isRental ? unitPrice * 3 : unitPrice) : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<ProposalLead['paymentMethod']>(
    isProduct ? 'pix' : isRental ? 'cartao_credito' : 'a_vista'
  );
  const [tradeDetails, setTradeDetails] = useState('');

  // Estados específicos para Veículos
  const [testDriveRequested, setTestDriveRequested] = useState(false);
  const [downPayment, setDownPayment] = useState<string>('');
  const [hasTradeIn, setHasTradeIn] = useState(false);
  const [tradeVehicleModel, setTradeVehicleModel] = useState('');
  const [tradeVehicleYear, setTradeVehicleYear] = useState('');
  const [tradeVehicleKm, setTradeVehicleKm] = useState('');
  const [tradeVehicleValue, setTradeVehicleValue] = useState('');

  // Estados específicos para Imóveis
  const [visitType, setVisitType] = useState<'comprar' | 'alugar' | 'agendar_visita'>(
    item?.transactionType === 'locacao' ? 'alugar' : 'agendar_visita'
  );
  const [useFgts, setUseFgts] = useState(false);
  const [hasRealEstateTrade, setHasRealEstateTrade] = useState(false);
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredPeriod, setPreferredPeriod] = useState<'manha' | 'tarde' | 'noite' | 'sabado'>('manha');

  // Estados específicos para Serviços
  const [serviceLocationType, setServiceLocationType] = useState<'domicilio' | 'estabelecimento'>('estabelecimento');

  if (!isOpen || !item) return null;

  // Total Calculado
  const calculatedTotal = isProduct 
    ? unitPrice * quantity 
    : isRental 
    ? unitPrice * rentalDays 
    : isService
    ? unitPrice
    : Number(offerValue) > 0 
    ? Number(offerValue) 
    : unitPrice;

  const handleRentalDaysChange = (days: number) => {
    setRentalDays(days);
    if (item && isRental) {
      setOfferValue(String(unitPrice * days));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim()) {
      setErrorMsg('Por favor, preencha pelo menos seu Nome e WhatsApp de contato.');
      return;
    }

    if (isProduct && orderType === 'entrega' && (!deliveryStreet.trim() || !deliveryNeighborhood.trim())) {
      setErrorMsg('Por favor, informe a Rua/Número e o Bairro para a entrega do produto.');
      return;
    }

    setErrorMsg('');

    // Montar endereço formatado
    let fullDeliveryAddress: string | undefined = undefined;
    if (isProduct && orderType === 'entrega') {
      fullDeliveryAddress = `${deliveryStreet.trim()}, Bairro ${deliveryNeighborhood.trim()}${deliveryComplement.trim() ? ` (${deliveryComplement.trim()})` : ''} - ${store.city || ''}`;
    }

    // Montar detalhes adicionais / mensagens
    let finalMessage = clientMessage.trim();
    if (isProduct) {
      if (!finalMessage) {
        finalMessage = orderType === 'entrega' 
          ? `Gostaria de receber este pedido no meu endereço (${fullDeliveryAddress}).` 
          : 'Gostaria de retirar este pedido diretamente no balcão da loja.';
      }
    }

    let tradeOrOrderNote: string | undefined = undefined;
    if (isProduct) {
      tradeOrOrderNote = `[Modalidade: ${orderType === 'entrega' ? 'Entrega em Domicílio' : 'Retirada no Balcão'} | Qtd: ${quantity}x${changeFor ? ` | Troco para: ${changeFor}` : ''}]`;
    } else if (isVehicle) {
      const parts: string[] = [];
      if (hasTradeIn && tradeVehicleModel.trim()) {
        parts.push(`Veículo na Troca: ${tradeVehicleModel.trim()}${tradeVehicleYear ? ` (${tradeVehicleYear})` : ''}${tradeVehicleKm ? ` ${tradeVehicleKm}km` : ''}${tradeVehicleValue ? ` Pretendido: ${formatCurrency(Number(tradeVehicleValue))}` : ''}`);
      }
      if (testDriveRequested) {
        parts.push(`Test Drive: Sim (${preferredDate || 'A combinar'} - ${preferredPeriod.toUpperCase()})`);
      }
      if (downPayment && Number(downPayment) > 0) {
        parts.push(`Entrada: ${formatCurrency(Number(downPayment))}`);
      }
      tradeOrOrderNote = parts.join(' | ') || tradeDetails.trim() || undefined;
    } else if (isRealEstate) {
      const parts: string[] = [];
      parts.push(`Objetivo: ${visitType === 'agendar_visita' ? 'Visita Presencial' : visitType === 'alugar' ? 'Locação' : 'Compra'}`);
      if (preferredDate) {
        parts.push(`Data Visita: ${preferredDate} (${preferredPeriod.toUpperCase()})`);
      }
      if (useFgts) {
        parts.push(`FGTS: Sim`);
      }
      if (hasRealEstateTrade && tradeDetails.trim()) {
        parts.push(`Permuta: ${tradeDetails.trim()}`);
      }
      tradeOrOrderNote = parts.join(' | ') || undefined;
    } else if (isService) {
      const parts: string[] = [];
      parts.push(`Local: ${serviceLocationType === 'domicilio' ? 'No Endereço do Cliente' : 'No Estabelecimento'}`);
      tradeOrOrderNote = parts.join(' | ') || undefined;
    } else {
      tradeOrOrderNote = tradeDetails.trim() || undefined;
    }

    const newLead = submitProposal({
      itemId: item.id,
      itemTitle: item.title,
      itemType: item.itemType,
      itemPrice: unitPrice,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim() || `${clientPhone.replace(/\D/g, '')}@cliente.3facil.com`,
      clientPhone: clientPhone.trim(),
      clientMessage: finalMessage,
      proposalValue: calculatedTotal,
      paymentMethod,
      tradeDetails: tradeOrOrderNote,
      orderType: isProduct ? orderType : undefined,
      deliveryAddress: fullDeliveryAddress,
      quantity: isProduct ? quantity : undefined,
      changeFor: (isProduct && paymentMethod === 'dinheiro_entrega' && changeFor) ? changeFor : undefined,
      rentalDays: isRental ? rentalDays : undefined,
      pickupDate: isRental && pickupDate ? pickupDate : undefined,
      returnDate: isRental && returnDate ? returnDate : undefined,
      testDriveRequested: isVehicle ? testDriveRequested : undefined,
      downPayment: isVehicle && Number(downPayment) > 0 ? Number(downPayment) : undefined,
      hasTradeIn: isVehicle ? hasTradeIn : undefined,
      visitType: isRealEstate ? visitType : undefined,
      useFgts: isRealEstate ? useFgts : undefined,
      preferredDate: (isRealEstate || (isVehicle && testDriveRequested)) && preferredDate ? preferredDate : undefined,
      preferredPeriod: (isRealEstate || (isVehicle && testDriveRequested)) ? preferredPeriod : undefined,
      serviceLocationType: isService ? serviceLocationType : undefined,
    });

    setCreatedProposal(newLead);
    setStep('success');
  };

  const handleCopyProposal = () => {
    if (!createdProposal) return;
    const text = generateProposalPlainText(store, createdProposal);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleResetAndClose = () => {
    setStep('form');
    setCreatedProposal(null);
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setClientMessage('');
    setTradeDetails('');
    setDeliveryStreet('');
    setDeliveryNeighborhood('');
    setDeliveryComplement('');
    setNeedChange(false);
    setChangeFor('');
    setQuantity(1);
    setPickupDate('');
    setReturnDate('');
    setTestDriveRequested(false);
    setDownPayment('');
    setHasTradeIn(false);
    setTradeVehicleModel('');
    setTradeVehicleYear('');
    setTradeVehicleKm('');
    setTradeVehicleValue('');
    setUseFgts(false);
    setHasRealEstateTrade(false);
    setPreferredDate('');
    onClose();
  };

  const inputClass = `w-full text-xs sm:text-sm px-3 py-2.5 rounded-xl border transition focus:outline-none focus:border-blue-500 ${
    isDark 
      ? 'bg-slate-950 text-slate-200 border-slate-800' 
      : 'bg-slate-50 text-slate-900 border-slate-200 focus:bg-white'
  }`;

  const labelClass = `block text-xs mb-1 font-medium ${
    isDark ? 'text-slate-300' : 'text-slate-700'
  }`;

  // Título e Ícone Dinâmicos por Segmento
  const modalHeaderIcon = isProduct || isService
    ? <ShoppingBag className="h-5 w-5 text-emerald-500" />
    : isRental
    ? <Calendar className="h-5 w-5 text-indigo-500" />
    : isVehicle
    ? <Car className="h-5 w-5 text-amber-500" />
    : isRealEstate
    ? <Home className="h-5 w-5 text-purple-500" />
    : <FileText className="h-5 w-5 text-blue-500" />;

  const modalTitle = step === 'success'
    ? (isProduct || isService ? 'Compra Registrada com Sucesso!' : 'Documento Gerado com Sucesso')
    : isProduct
    ? 'Realizar Pedido / Comprar'
    : isRental
    ? 'Solicitação de Reserva / Locação'
    : isService
    ? 'Comprar'
    : isVehicle
    ? 'Proposta de Compra de Veículo'
    : isRealEstate
    ? 'Proposta de Compra / Agendar Visita'
    : 'Proposta Formal de Compra';

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200 ${
      isDark ? 'bg-slate-950/85' : 'bg-slate-900/60'
    }`}>
      
      <div className={`border rounded-3xl w-full max-w-2xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        
        {/* Header do Modal */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50/80'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-2xl border ${
              isProduct || isService
                ? 'bg-emerald-500/10 border-emerald-500/20' 
                : 'bg-blue-500/10 border-blue-500/20'
            }`}>
              {modalHeaderIcon}
            </div>
            <div>
              <h3 className={`text-sm sm:text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {modalTitle}
              </h3>
              <p className={`text-xs truncate max-w-xs sm:max-w-md ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Loja: <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{store.name}</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleResetAndClose}
            className={`p-2 rounded-xl transition ${
              isDark ? 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          
          {step === 'form' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Card Resumo do Item Selecionado */}
              <div className={`flex items-center space-x-3.5 p-3.5 rounded-2xl border ${
                isDark ? 'bg-slate-950 border-slate-800/80' : 'bg-slate-50 border-slate-200'
              }`}>
                {item.images && item.images[0] && (
                  <img
                    src={item.images[0]}
                    alt={item.title}
                    className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-700/40"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${
                    isProduct ? 'text-emerald-500' : 'text-blue-500'
                  }`}>
                    {isProduct ? 'Produto Selecionado' : isRental ? 'Veículo para Locação' : 'Item de Interesse'}
                  </span>
                  <h4 className={`text-xs sm:text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                      {isRental ? `Diária: ${formatCurrency(unitPrice)}/dia` : `Unitário: ${formatCurrency(unitPrice)}`}
                    </span>
                    {isProduct && quantity > 1 && (
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        • Total ({quantity}x): <strong className="text-emerald-500">{formatCurrency(calculatedTotal)}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Seletor de Quantidade para Produtos de Varejo */}
                {isProduct && (
                  <div className="flex items-center space-x-1.5 bg-slate-200/60 dark:bg-slate-800 p-1.5 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                      title="Diminuir quantidade"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs font-bold w-6 text-center text-slate-800 dark:text-slate-100">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(quantity + 1)}
                      className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                      title="Aumentar quantidade"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-300 text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              {/* ------------------------------------------------------------------ */}
              {/* BLOCO EXCLUSIVO PARA LOJA / VAREJO: ENTREGA (DELIVERY) OU RETIRADA */}
              {/* ------------------------------------------------------------------ */}
              {isProduct && (
                <div className="space-y-3 pt-1">
                  <div className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Como você prefere receber o produto?
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Opção 1: Entrega no Endereço */}
                    <button
                      type="button"
                      onClick={() => setOrderType('entrega')}
                      className={`p-3.5 rounded-2xl border text-left flex items-center space-x-3 transition ${
                        orderType === 'entrega'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm'
                          : isDark
                          ? 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className={`p-2 rounded-xl ${orderType === 'entrega' ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                        <Truck className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">Entregar no Endereço</div>
                        <div className="text-[11px] opacity-80">Delivery / Motoentregador</div>
                      </div>
                    </button>

                    {/* Opção 2: Buscar na Loja */}
                    <button
                      type="button"
                      onClick={() => setOrderType('retirada')}
                      className={`p-3.5 rounded-2xl border text-left flex items-center space-x-3 transition ${
                        orderType === 'retirada'
                          ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm'
                          : isDark
                          ? 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className={`p-2 rounded-xl ${orderType === 'retirada' ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                        <Store className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">Retirar no Local</div>
                        <div className="text-[11px] opacity-80">Buscar no balcão da loja</div>
                      </div>
                    </button>
                  </div>

                  {/* Formulário de Endereço de Entrega */}
                  {orderType === 'entrega' ? (
                    <div className={`p-3.5 rounded-2xl border space-y-3 ${
                      isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-emerald-50/40 border-emerald-100'
                    }`}>
                      <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>Endereço de Entrega</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <label className={labelClass}>Rua e Número *</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Av. Paulista, 1500"
                            value={deliveryStreet}
                            onChange={(e) => setDeliveryStreet(e.target.value)}
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Bairro *</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Bela Vista"
                            value={deliveryNeighborhood}
                            onChange={(e) => setDeliveryNeighborhood(e.target.value)}
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Complemento / Ponto de Ref.</label>
                          <input
                            type="text"
                            placeholder="Ex: Apto 42, próx. ao mercado"
                            value={deliveryComplement}
                            onChange={(e) => setDeliveryComplement(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Informações para Retirada no Balcão */
                    <div className={`p-3.5 rounded-2xl border text-xs flex items-start space-x-2.5 ${
                      isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-900'
                    }`}>
                      <MapPin className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <strong>Endereço para Retirada:</strong>
                        <p className="mt-0.5 opacity-90">
                          {store.address ? `${store.address} - ` : ''}{store.city || 'Na sede da loja'}/{store.state || ''}
                        </p>
                        <p className="mt-1 text-[11px] opacity-75">
                          Assim que o pedido for confirmado, a loja avisará no WhatsApp quando estiver pronto para retirada.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ------------------------------------------------------------------ */}
              {/* BLOCO PARA LOCADORA: DIÁRIAS E DATAS */}
              {/* ------------------------------------------------------------------ */}
              {isRental && (
                <div className={`p-4 rounded-2xl border space-y-3 ${
                  isDark ? 'bg-slate-950/90 border-amber-500/20' : 'bg-amber-50/50 border-amber-200'
                }`}>
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Período Desejado da Locação</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>Nº de Diárias</label>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={rentalDays}
                        onChange={(e) => handleRentalDaysChange(Math.max(1, Number(e.target.value)))}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Data Retirada</label>
                      <input
                        type="date"
                        value={pickupDate}
                        onChange={(e) => setPickupDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Data Devolução</label>
                      <input
                        type="date"
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------------ */}
              {/* BLOCO EXCLUSIVO PARA VEÍCULOS / CONCESSIONÁRIA */}
              {/* ------------------------------------------------------------------ */}
              {isVehicle && (
                <div className="space-y-3 pt-1">
                  <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                    <Car className="h-4 w-4" />
                    <span>Condições Específicas do Veículo</span>
                  </div>

                  {/* Simulação de Entrada e Saldo */}
                  <div className={`p-3.5 rounded-2xl border space-y-3 ${
                    isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Simulação de Pagamento
                      </span>
                      <span className="text-xs font-bold text-blue-500">
                        Valor Anunciado: {formatCurrency(unitPrice)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Valor de Entrada Pretendido (R$)</label>
                        <input
                          type="number"
                          placeholder="Ex: 20000"
                          value={downPayment}
                          onChange={(e) => setDownPayment(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Saldo Restante a Financiar</label>
                        <div className={`text-xs sm:text-sm px-3 py-2.5 rounded-xl border font-bold flex items-center justify-between ${
                          isDark ? 'bg-slate-900 border-slate-800 text-emerald-400' : 'bg-white border-slate-200 text-emerald-600'
                        }`}>
                          <span>Estimado:</span>
                          <span>
                            {Number(downPayment) > 0 && Number(downPayment) < unitPrice
                              ? formatCurrency(unitPrice - Number(downPayment))
                              : formatCurrency(unitPrice)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Veículo na Troca */}
                  <div className={`p-3.5 rounded-2xl border space-y-3 ${
                    isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hasTradeIn}
                        onChange={(e) => setHasTradeIn(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        Possuo um veículo usado para dar na troca
                      </span>
                    </label>

                    {hasTradeIn && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className={labelClass}>Marca, Modelo e Versão *</label>
                          <input
                            type="text"
                            placeholder="Ex: Chevrolet Onix 1.0 LT"
                            value={tradeVehicleModel}
                            onChange={(e) => setTradeVehicleModel(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Ano Fab. / Modelo</label>
                          <input
                            type="text"
                            placeholder="Ex: 2019/2020"
                            value={tradeVehicleYear}
                            onChange={(e) => setTradeVehicleYear(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Quilometragem (KM)</label>
                          <input
                            type="text"
                            placeholder="Ex: 58.000 km"
                            value={tradeVehicleKm}
                            onChange={(e) => setTradeVehicleKm(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Valor pretendido no usado (R$)</label>
                          <input
                            type="number"
                            placeholder="Ex: 48000"
                            value={tradeVehicleValue}
                            onChange={(e) => setTradeVehicleValue(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Agendamento de Test Drive */}
                  <div className={`p-3.5 rounded-2xl border space-y-3 ${
                    isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={testDriveRequested}
                        onChange={(e) => setTestDriveRequested(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                      />
                      <span className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        Desejo agendar um Test Drive no showroom
                      </span>
                    </label>

                    {testDriveRequested && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className={labelClass}>Data Preferida para o Test Drive</label>
                          <input
                            type="date"
                            value={preferredDate}
                            onChange={(e) => setPreferredDate(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Melhor Período</label>
                          <select
                            value={preferredPeriod}
                            onChange={(e) => setPreferredPeriod(e.target.value as any)}
                            className={inputClass}
                          >
                            <option value="manha">Manhã (09:00 às 12:00)</option>
                            <option value="tarde">Tarde (13:30 às 17:30)</option>
                            <option value="sabado">Sábado de Manhã</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------------ */}
              {/* BLOCO EXCLUSIVO PARA IMÓVEIS / CORRETOR */}
              {/* ------------------------------------------------------------------ */}
              {isRealEstate && (
                <div className="space-y-3 pt-1">
                  <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
                    <Home className="h-4 w-4" />
                    <span>Objetivo do Atendimento Imobiliário</span>
                  </div>

                  {/* Seletor de Modalidade */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setVisitType('agendar_visita')}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col justify-center ${
                        visitType === 'agendar_visita'
                          ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold shadow-sm'
                          : isDark
                          ? 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-xs">🏡 Agendar Visita</span>
                      <span className="text-[10px] opacity-75 font-normal">Conhecer o imóvel</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVisitType('comprar')}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col justify-center ${
                        visitType === 'comprar'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm'
                          : isDark
                          ? 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-xs">💰 Fazer Proposta</span>
                      <span className="text-[10px] opacity-75 font-normal">Oferta de aquisição</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVisitType('alugar')}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col justify-center col-span-2 sm:col-span-1 ${
                        visitType === 'alugar'
                          ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shadow-sm'
                          : isDark
                          ? 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-xs">📝 Alugar Imóvel</span>
                      <span className="text-[10px] opacity-75 font-normal">Proposta de locação</span>
                    </button>
                  </div>

                  {/* Campos de Visita */}
                  {visitType === 'agendar_visita' && (
                    <div className={`p-3.5 rounded-2xl border space-y-3 ${
                      isDark ? 'bg-purple-950/20 border-purple-800/40' : 'bg-purple-50/50 border-purple-200'
                    }`}>
                      <div className="flex items-center space-x-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Data e Horário Pretendidos para Visita</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Data Sugerida para Visita</label>
                          <input
                            type="date"
                            value={preferredDate}
                            onChange={(e) => setPreferredDate(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Melhor Turno</label>
                          <select
                            value={preferredPeriod}
                            onChange={(e) => setPreferredPeriod(e.target.value as any)}
                            className={inputClass}
                          >
                            <option value="manha">Manhã (09:00 às 12:00)</option>
                            <option value="tarde">Tarde (13:30 às 17:30)</option>
                            <option value="noite">Fim de Tarde (17:30 às 19:00)</option>
                            <option value="sabado">Sábado pela Manhã</option>
                          </select>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        O corretor responsável entrará em contato para alinhar os detalhes e confirmar o acesso à portaria/condomínio.
                      </p>
                    </div>
                  )}

                  {/* Opções de Compra: FGTS e Permuta */}
                  {visitType === 'comprar' && (
                    <div className={`p-3.5 rounded-2xl border space-y-3 ${
                      isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <label className="flex items-center space-x-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={useFgts}
                          onChange={(e) => setUseFgts(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                        />
                        <span className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                          Pretendo utilizar recursos do FGTS na composição da entrada
                        </span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={hasRealEstateTrade}
                          onChange={(e) => setHasRealEstateTrade(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <span className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                          Tenho imóvel ou veículo para permuta / composição de pagamento
                        </span>
                      </label>

                      {hasRealEstateTrade && (
                        <div className="pt-1">
                          <label className={labelClass}>Descreva o bem oferecido em permuta</label>
                          <input
                            type="text"
                            placeholder="Ex: Apto 2 qtos no Centro avaliado em R$ 250.000"
                            value={tradeDetails}
                            onChange={(e) => setTradeDetails(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ------------------------------------------------------------------ */}
              {/* BLOCO EXCLUSIVO PARA PRESTAÇÃO DE SERVIÇOS */}
              {/* ------------------------------------------------------------------ */}
              {isService && (
                <div className="space-y-3 pt-1">
                  <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    <Wrench className="h-4 w-4" />
                    <span>Detalhes do Atendimento</span>
                  </div>

                  <div>
                    <label className={labelClass}>Local Desejado de Atendimento *</label>
                    <select
                      value={serviceLocationType}
                      onChange={(e) => setServiceLocationType(e.target.value as any)}
                      className={inputClass}
                    >
                      <option value="estabelecimento">No Estabelecimento / Loja</option>
                      <option value="domicilio">No Meu Endereço (Entrega / Domicílio)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------------ */}
              {/* DADOS DO CLIENTE */}
              {/* ------------------------------------------------------------------ */}
              <div className="space-y-3 pt-1">
                <div className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Seus Dados para Contato
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Seu Nome Completo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Carlos Eduardo Silveira"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>WhatsApp com DDD *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: (11) 98765-4321"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className={isProduct || isService ? 'sm:col-span-2' : ''}>
                    <label className={labelClass}>Seu E-mail (Opcional)</label>
                    <input
                      type="email"
                      placeholder="Ex: carlos@gmail.com"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  {!isProduct && !isRental && !isService && (
                    <div>
                      <label className={labelClass}>
                        Valor da sua Proposta (R$)
                      </label>
                      <input
                        type="number"
                        placeholder="Valor em R$"
                        value={offerValue}
                        onChange={(e) => setOfferValue(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* ------------------------------------------------------------------ */}
              {/* FORMA DE PAGAMENTO */}
              {/* ------------------------------------------------------------------ */}
              <div className="space-y-3 pt-1">
                <div className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Forma de Pagamento Pretendida
                </div>

                <div>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className={inputClass}
                  >
                    {isProduct ? (
                      <>
                        <option value="pix">⚡ PIX (Chave da Loja / QR Code)</option>
                        <option value="cartao_entrega">💳 Cartão na Entrega / Retirada (Débito ou Crédito na Maquininha)</option>
                        <option value="dinheiro_entrega">💵 Dinheiro na Entrega / Retirada</option>
                        <option value="cartao_credito">💳 Cartão de Crédito Online / Link de Pagamento</option>
                        <option value="a_vista">Transferência Bancária</option>
                        <option value="outro">A Combinar no WhatsApp</option>
                      </>
                    ) : isRental ? (
                      <>
                        <option value="cartao_credito">Cartão de Crédito (com pré-autorização)</option>
                        <option value="faturamento_pj">Faturamento Direto PJ (Empresas)</option>
                        <option value="a_vista">À Vista (PIX / Transferência)</option>
                        <option value="parcelado">Cartão Parcelado</option>
                        <option value="outro">Outras Condições</option>
                      </>
                    ) : isService ? (
                      <>
                        <option value="pix">PIX / À Vista</option>
                        <option value="parcelado">Parcelado no Cartão de Crédito</option>
                        <option value="faturamento_pj">Faturamento Empresa (Boleto PJ)</option>
                        <option value="outro">A Combinar com o Profissional</option>
                      </>
                    ) : (
                      <>
                        <option value="a_vista">À Vista (PIX / TED / Transferência)</option>
                        <option value="financiamento">Financiamento Bancário / Consórcio</option>
                        <option value="parcelado">Parcelado Direto / Cartão de Crédito</option>
                        <option value="troca_veiculo">Veículo Usado na Troca + Diferença</option>
                        <option value="troca_imovel">Imóvel na Troca (Permuta)</option>
                        <option value="outro">Outras Condições Especiais</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Campo de Troco caso o cliente escolha dinheiro na entrega */}
                {isProduct && paymentMethod === 'dinheiro_entrega' && (
                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-amber-50/50 border-amber-200'}`}>
                    <label className={labelClass}>Precisa de troco para quanto?</label>
                    <input
                      type="text"
                      placeholder="Ex: Troco para R$ 50,00 (ou 'não preciso de troco')"
                      value={changeFor}
                      onChange={(e) => setChangeFor(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}

                {/* Campo para veículo ou imóvel na troca */}
                {(paymentMethod === 'troca_veiculo' || paymentMethod === 'troca_imovel') && (
                  <div>
                    <label className={labelClass}>
                      Descreva o bem oferecido na troca (Modelo, Ano, KM, Valor estimado):
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Honda Civic 2018 EXL, 75.000km, prata, avaliado em R$ 90.000"
                      value={tradeDetails}
                      onChange={(e) => setTradeDetails(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className={labelClass}>
                    {isProduct ? 'Instruções ou Observações do Pedido' : 'Mensagem ou Detalhes da Solicitação'}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={
                      isProduct
                        ? 'Escreva detalhes adicionais, ponto de referência, sabor, observações de embalagem...'
                        : 'Escreva dúvidas adicionais, horários preferidos de contato ou visita...'
                    }
                    value={clientMessage}
                    onChange={(e) => setClientMessage(e.target.value)}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>

              {/* Botão de Envio */}
              <div className="pt-2">
                <button
                  type="submit"
                  className={`w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-2xl text-white font-bold text-xs sm:text-sm shadow-md transition active:scale-[0.99] ${
                    isProduct || isService
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/20'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/20'
                  }`}
                >
                  {isProduct ? (
                    <>
                      <ShoppingBag className="h-4 w-4" />
                      <span>Confirmar Pedido ({formatCurrency(calculatedTotal)})</span>
                    </>
                  ) : isService ? (
                    <>
                      <ShoppingBag className="h-4 w-4" />
                      <span>Comprar ({formatCurrency(calculatedTotal)})</span>
                    </>
                  ) : isRental ? (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Gerar e Enviar Pedido de Reserva</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Gerar e Enviar Proposta Formal</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          ) : (
            /* ------------------------------------------------------------------ */
            /* TELA DE SUCESSO: PEDIDO / PROPOSTA CRIADA COM ENVIO VIA WHATSAPP */
            /* ------------------------------------------------------------------ */
            createdProposal && (
              <div className="space-y-5">
                
                <div className={`p-4 rounded-2xl border flex items-start space-x-3.5 ${
                  isProduct || isService
                    ? isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : isVehicle
                    ? isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-900'
                    : isRealEstate
                    ? isDark ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-900'
                    : isDark ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}>
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold">
                      {isProduct || isService
                        ? '🎉 Seu Pedido de Compra foi Registrado com Sucesso!' 
                        : isRental 
                        ? '📅 Solicitação de Reserva Gerada com Sucesso!' 
                        : isVehicle
                        ? '🚗 Proposta do Veículo Gerada com Sucesso!'
                        : isRealEstate
                        ? '🏡 Atendimento Imobiliário Registrado com Sucesso!'
                        : 'Sua proposta foi formulada com sucesso!'}
                    </h4>
                    <p className="text-xs mt-1 opacity-90 leading-relaxed">
                      {isProduct || isService
                        ? 'Os detalhes da sua compra foram gravados no painel da loja. Para agilizar o atendimento, confirme agora com a equipe pelo WhatsApp:'
                        : 'Os dados foram salvos no painel da empresa e você pode enviar a mensagem direta formatada no WhatsApp abaixo:'}
                    </p>
                  </div>
                </div>

                {/* Destaque: Botão Direto para o WhatsApp da Loja */}
                {store.whatsapp && (
                  <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 text-center space-y-2.5">
                    <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Envio Imediato para o WhatsApp da Empresa:
                    </div>
                    <a
                      href={generateProposalWhatsAppLink(createdProposal, store)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center space-x-2.5 w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/30 transition active:scale-[0.99]"
                    >
                      <MessageCircle className="h-5 w-5" />
                      <span>
                        {isProduct || isService
                          ? 'Confirmar Compra no WhatsApp da Loja' 
                          : isVehicle 
                          ? 'Enviar Proposta / Test Drive no WhatsApp' 
                          : isRealEstate
                          ? 'Enviar Visita / Proposta no WhatsApp'
                          : 'Enviar Proposta no WhatsApp'}
                      </span>
                    </a>
                  </div>
                )}

                {/* Prévia do Pedido / Documento Formatado */}
                <div className="space-y-2">
                  <div className={`flex items-center justify-between text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <span>{isProduct || isService ? 'Comprovante da Compra:' : 'Documento da Proposta:'}</span>
                    <button
                      onClick={handleCopyProposal}
                      className={`flex items-center gap-1 font-semibold transition ${
                        isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                      }`}
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
                    </button>
                  </div>

                  <pre className={`p-4 rounded-2xl border text-[11px] sm:text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-52 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    {generateProposalPlainText(store, createdProposal)}
                  </pre>
                </div>

                {/* Ações Secundárias */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <a
                    href={generateMailtoLink(store, createdProposal)}
                    className={`flex items-center justify-center space-x-2 p-2.5 rounded-xl border text-xs font-semibold transition text-center ${
                      isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                    }`}
                  >
                    <Mail className="h-3.5 w-3.5 text-blue-500" />
                    <span>Enviar cópia por E-mail</span>
                  </a>

                  <button
                    onClick={handlePrint}
                    className={`flex items-center justify-center space-x-2 p-2.5 rounded-xl border text-xs font-semibold transition text-center ${
                      isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                    }`}
                  >
                    <Printer className="h-3.5 w-3.5 text-slate-400" />
                    <span>Imprimir Comprovante</span>
                  </button>
                </div>

                <div className={`pt-3 flex items-center justify-end border-t ${
                  isDark ? 'border-slate-800' : 'border-slate-200'
                }`}>
                  <button
                    onClick={handleResetAndClose}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline transition"
                  >
                    Concluir e Voltar à Loja
                  </button>
                </div>

              </div>
            )
          )}

        </div>

      </div>

    </div>
  );
};
