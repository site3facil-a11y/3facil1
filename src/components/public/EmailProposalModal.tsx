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
  KeyRound
} from 'lucide-react';
import { StoreItem, StoreProfile, ProposalLead } from '../../types/store';
import { useStoreContext } from '../../context/StoreContext';
import { 
  formatCurrency, 
  formatCurrencyExtended,
  parseCurrencyInput,
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

  // Form State
  const isRental = item?.itemType === 'locadora';
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [rentalDays, setRentalDays] = useState<number>(isRental ? 3 : 1);
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [offerValue, setOfferValue] = useState<string>(
    item ? String(isRental ? item.price * 3 : item.price) : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<ProposalLead['paymentMethod']>(
    isRental ? 'cartao_credito' : 'a_vista'
  );
  const [tradeDetails, setTradeDetails] = useState('');
  const [clientMessage, setClientMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !item) return null;

  const handleRentalDaysChange = (days: number) => {
    setRentalDays(days);
    if (item && isRental) {
      setOfferValue(String(item.price * days));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientEmail.trim() || !clientPhone.trim()) {
      setErrorMsg('Por favor, preencha nome, e-mail e telefone para contato.');
      return;
    }

    setErrorMsg('');

    const newLead = submitProposal({
      itemId: item.id,
      itemTitle: item.title,
      itemType: item.itemType,
      itemPrice: item.price,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      clientPhone: clientPhone.trim(),
      clientMessage: clientMessage.trim() || (isRental ? 'Gostaria de confirmar a reserva e disponibilidade para o período informado.' : 'Tenho interesse na aquisição deste item conforme condições detalhadas.'),
      proposalValue: Number(offerValue) > 0 ? Number(offerValue) : item.price,
      rentalDays: isRental ? rentalDays : undefined,
      pickupDate: isRental && pickupDate ? pickupDate : undefined,
      returnDate: isRental && returnDate ? returnDate : undefined,
      paymentMethod,
      tradeDetails: tradeDetails.trim() || undefined,
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
    setPickupDate('');
    setReturnDate('');
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

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200 ${
      isDark ? 'bg-slate-950/85' : 'bg-slate-900/60'
    }`}>
      
      <div className={`border rounded-3xl w-full max-w-2xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50/80'
        }`}>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h3 className={`text-sm sm:text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {step === 'form' 
                  ? (isRental ? 'Solicitação de Reserva / Cotação de Locação' : 'Proposta de Compra / Orçamento Formal')
                  : 'Documento Gerado com Sucesso'}
              </h3>
              <p className={`text-xs truncate max-w-sm sm:max-w-md ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Destinatário: <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{store.name}</span>
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

        {/* Formulário ou Confirmação */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {step === 'form' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Card Resumo do Item */}
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
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-500 dark:text-blue-400">
                    {isRental ? 'Veículo / Item Selecionado' : 'Item Selecionado'}
                  </span>
                  <h4 className={`text-xs sm:text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {item.title}
                  </h4>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                    {isRental ? `Diária Base: ${formatCurrency(item.price)}/dia` : `Valor Anunciado: ${formatCurrency(item.price)}`}
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-300 text-xs">
                  {errorMsg}
                </div>
              )}

              {/* Período de Locação (Específico para Locadora) */}
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

              {/* Dados do Proponente */}
              <div className="space-y-3 pt-1">
                <div className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
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
                    <label className={labelClass}>Seu E-mail *</label>
                    <input
                      type="email"
                      required
                      placeholder="Ex: carlos@gmail.com"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>WhatsApp / Telefone com DDD *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: (11) 98765-4321"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      {isRental ? 'Valor Estimado do Período (R$)' : 'Valor da sua Proposta (R$)'}
                    </label>
                    <input
                      type="number"
                      placeholder="Valor em R$"
                      value={offerValue}
                      onChange={(e) => setOfferValue(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Condições de Pagamento */}
              <div className="space-y-3 pt-2">
                <div className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Condições de Pagamento
                </div>

                <div>
                  <label className={labelClass}>Forma Pretendida</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className={inputClass}
                  >
                    {isRental ? (
                      <>
                        <option value="cartao_credito">Cartão de Crédito (com pré-autorização de caução)</option>
                        <option value="faturamento_pj">Faturamento Direto PJ (Empresas e Frotas)</option>
                        <option value="a_vista">À Vista (PIX / Transferência)</option>
                        <option value="parcelado">Cartão Parcelado</option>
                        <option value="outro">Outras Condições Corporativas</option>
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
                    Mensagem ou Detalhes da Solicitação
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Escreva dúvidas adicionais, horários preferidos de retirada ou solicitações de adicionais..."
                    value={clientMessage}
                    onChange={(e) => setClientMessage(e.target.value)}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-md transition active:scale-[0.99]"
                >
                  <Send className="h-4 w-4" />
                  <span>{isRental ? 'Gerar e Enviar Pedido de Reserva' : 'Gerar e Enviar Proposta Formal'}</span>
                </button>
              </div>

            </form>
          ) : (
            /* Tela de Confirmação & Visualização da Proposta */
            createdProposal && (
              <div className="space-y-5">
                
                <div className={`p-4 rounded-2xl border flex items-start space-x-3 ${
                  isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'
                }`}>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className={`text-sm font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-900'}`}>
                      {isRental ? 'Seu pedido de reserva foi formulado com sucesso!' : 'Sua proposta foi formulada com sucesso!'}
                    </h4>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-emerald-400/90' : 'text-emerald-800'}`}>
                      Os dados foram salvos no painel da loja e o documento formal está pronto abaixo.
                    </p>
                  </div>
                </div>

                {/* Prévia da Carta de Proposta Formatada */}
                <div className="space-y-2">
                  <div className={`flex items-center justify-between text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <span>Documento da Proposta:</span>
                    <button
                      onClick={handleCopyProposal}
                      className={`flex items-center gap-1 transition ${
                        isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                      }`}
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
                    </button>
                  </div>

                  <pre className={`p-4 rounded-2xl border text-[11px] sm:text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-56 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    {generateProposalPlainText(store, createdProposal)}
                  </pre>
                </div>

                {/* Ações para Disparo */}
                <div className="space-y-2.5 pt-2">
                  <div className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Selecione como deseja enviar ao lojista:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Botão Mailto Direto */}
                    <a
                      href={generateMailtoLink(store, createdProposal)}
                      className="flex items-center justify-center space-x-2 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition text-center"
                    >
                      <Mail className="h-4 w-4" />
                      <span>Abrir no meu E-mail (Enviar)</span>
                    </a>

                    {/* Botão Enviar Cópia no WhatsApp */}
                    {store.whatsapp && (
                      <a
                        href={generateProposalWhatsAppLink(createdProposal, store)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center space-x-2 p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition text-center"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>Enviar pelo WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className={`pt-2 flex items-center justify-between border-t ${
                  isDark ? 'border-slate-800' : 'border-slate-200'
                }`}>
                  <button
                    onClick={handlePrint}
                    className={`flex items-center gap-1.5 text-xs transition ${
                      isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Printer className="h-4 w-4" />
                    <span>Imprimir Documento</span>
                  </button>

                  <button
                    onClick={handleResetAndClose}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline transition"
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
