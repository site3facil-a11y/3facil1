import React, { useState, useEffect } from 'react';
import { StoreItem, StoreProfile } from '../../types/store';
import { formatCurrency, formatNumber, getDefaultImageForItem } from '../../utils/formatters';
import { MessageCircle, X, ShieldCheck, ArrowRight, User, Phone } from 'lucide-react';

interface WhatsAppLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: StoreItem | null;
  store: StoreProfile;
  onConfirmLead: (clientName: string, clientPhone: string, item: StoreItem | null) => void;
}

export const WhatsAppLeadModal: React.FC<WhatsAppLeadModalProps> = ({
  isOpen,
  onClose,
  item,
  store,
  onConfirmLead,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Carrega dados salvos anteriormente no navegador para evitar retrabalho do cliente
  useEffect(() => {
    if (isOpen) {
      const savedName = localStorage.getItem('realsaas_client_name') || '';
      const savedPhone = localStorage.getItem('realsaas_client_phone') || '';
      setName(savedName);
      setPhone(savedPhone);
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Formata máscara de telefone BR (99) 99999-9999
  const handlePhoneChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 11);
    let formatted = raw;
    if (raw.length > 2) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    }
    if (raw.length > 7) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
    }
    setPhone(formatted);
    if (errorMsg) setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.replace(/\D/g, '');

    if (!cleanName || cleanName.length < 2) {
      setErrorMsg('Por favor, informe seu nome.');
      return;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMsg('Por favor, informe seu WhatsApp com DDD (mínimo 10 dígitos).');
      return;
    }

    // Salva para futuros cliques do mesmo usuário
    localStorage.setItem('realsaas_client_name', cleanName);
    localStorage.setItem('realsaas_client_phone', phone);

    onConfirmLead(cleanName, phone, item);
  };

  const itemImage = item?.images?.[0] || (item ? getDefaultImageForItem(item.itemType) : '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Bar */}
        <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500 w-full" />

        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 sm:p-7">
          {/* Header */}
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <MessageCircle className="h-6 w-6 fill-current" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Falar com a Loja no WhatsApp
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {store.name}
              </p>
            </div>
          </div>

          {/* Card do Item de Interesse (se houver) */}
          {item && (
            <div className="mb-5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center space-x-3">
              <img
                src={itemImage}
                alt={item.title}
                className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                  Item de Interesse
                </span>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {item.title}
                </p>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {item.itemType === 'servico' && item.priceType === 'sob_consulta'
                    ? 'Sob Consulta'
                    : formatCurrency(item.price)}
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
            Identifique-se rapidamente para que nosso time localize seu interesse e inicie sua conversa no WhatsApp com atendimento exclusivo:
          </p>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Seu Nome ou Como prefere ser chamado *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Ex: João da Silva"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Seu WhatsApp de Contato (com DDD) *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="h-4 w-4" />
                </div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="(99) 99999-9999"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-xs shadow-lg shadow-emerald-600/25 transition flex items-center justify-center space-x-2"
            >
              <span>Continuar para o WhatsApp</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-4 flex items-center justify-center space-x-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>Seus dados são enviados diretamente para o WhatsApp da loja.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
