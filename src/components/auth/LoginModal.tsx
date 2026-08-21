import React, { useState } from 'react';
import { 
  X, 
  LogIn, 
  Store, 
  ShieldCheck, 
  ArrowRight, 
  Car, 
  Home, 
  ShoppingBag, 
  Briefcase,
  KeyRound,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useStoreContext } from '../../context/StoreContext';
import { StoreType } from '../../types/store';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStoreAndGoToAdmin: (storeId: string) => void;
  onGoToMasterAdmin: () => void;
  onOpenRegister: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSelectStoreAndGoToAdmin,
  onGoToMasterAdmin,
  onOpenRegister,
}) => {
  const { stores, theme, loginAsSuperAdmin, loginAsStoreOwner } = useStoreContext();
  const isDark = theme === 'dark';

  const [selectedStoreId, setSelectedStoreId] = useState<string>(stores[0]?.id || '');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [activeTab, setActiveTab] = useState<'quick' | 'credentials'>('quick');

  if (!isOpen) return null;

  const getStoreIcon = (type: StoreType) => {
    switch (type) {
      case 'veiculo':
        return <Car className="h-4 w-4 text-red-400" />;
      case 'imovel':
        return <Home className="h-4 w-4 text-emerald-400" />;
      case 'produto':
        return <ShoppingBag className="h-4 w-4 text-blue-400" />;
      case 'servico':
        return <Briefcase className="h-4 w-4 text-purple-400" />;
    }
  };

  const handleQuickLogin = (storeId: string) => {
    loginAsStoreOwner(storeId);
    onSelectStoreAndGoToAdmin(storeId);
    onClose();
  };

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Verifica se é o admin master
    const isMaster = 
      emailInput.toLowerCase().includes('admin') || 
      emailInput.toLowerCase().includes('master') ||
      emailInput.trim() === 'admin@3facil.com' ||
      passwordInput.trim() === 'admin123' ||
      passwordInput.trim() === 'master123';

    if (isMaster) {
      loginAsSuperAdmin('Wilson Lima (Admin)', emailInput || 'wilsonlimamn@gmail.com');
      onGoToMasterAdmin();
      onClose();
      return;
    }

    // Procura a loja correspondente pelo email ou selecionada
    const matchedStore = stores.find((s) => s.email.toLowerCase().trim() === emailInput.toLowerCase().trim()) || 
                         stores.find((s) => s.name.toLowerCase().includes(emailInput.toLowerCase().trim())) ||
                         stores.find((s) => s.id === selectedStoreId) || 
                         stores[0];
                         
    if (matchedStore) {
      loginAsStoreOwner(matchedStore.id, matchedStore.ownerName, matchedStore.email);
      onSelectStoreAndGoToAdmin(matchedStore.id);
    } else {
      loginAsSuperAdmin();
      onGoToMasterAdmin();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* Header */}
        <div className={`px-6 py-5 border-b flex items-center justify-between ${
          isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50/70'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-blue-600/10 text-blue-500 border border-blue-500/20">
              <LogIn className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                Acessar Painel do Usuário
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Entre para gerenciar sua loja ou a plataforma master
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition ${
              isDark ? 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs de Seleção */}
        <div className={`flex border-b px-6 pt-3 gap-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <button
            onClick={() => setActiveTab('quick')}
            className={`pb-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'quick'
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Lojas Cadastradas ({stores.length})
          </button>
          <button
            onClick={() => setActiveTab('credentials')}
            className={`pb-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'credentials'
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Entrar com E-mail / Senha
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'quick' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Selecione sua loja para entrar diretamente:
                </span>
                <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Sessão Pronta
                </span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {stores.map((store) => (
                  <button
                    key={store.id}
                    onClick={() => handleQuickLogin(store.id)}
                    className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition group ${
                      isDark
                        ? 'bg-slate-950/60 border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/50'
                        : 'bg-slate-50 border-slate-200 hover:border-blue-500/50 hover:bg-blue-50/50'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`p-2 rounded-xl border shrink-0 ${
                        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                      }`}>
                        {getStoreIcon(store.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs sm:text-sm truncate flex items-center gap-1.5">
                          <span>{store.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {store.type}
                          </span>
                        </div>
                        <p className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {store.ownerName ? `Resp: ${store.ownerName} • ` : ''}{store.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 text-xs font-semibold text-blue-500 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition shrink-0 pl-2">
                      <span className="hidden sm:inline">Entrar</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Botão para Acessar o Master */}
              <div className={`pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
                isDark ? 'border-slate-800' : 'border-slate-100'
              }`}>
                <button
                  onClick={() => {
                    loginAsSuperAdmin();
                    onGoToMasterAdmin();
                    onClose();
                  }}
                  className={`w-full sm:w-auto py-2.5 px-4 rounded-xl text-xs font-medium border flex items-center justify-center space-x-2 transition ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4 text-blue-400" />
                  <span>Painel Master SaaS (Gestor)</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onOpenRegister();
                  }}
                  className="text-xs text-blue-500 hover:underline font-semibold"
                >
                  Não tem loja? Cadastre-se
                </button>
              </div>

            </div>
          ) : (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  E-mail de Acesso ou Nome da Loja
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: contato@suaempresa.com.br ou admin"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-blue-500 transition ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Senha / PIN de Acesso
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-blue-500 transition ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition flex items-center justify-center space-x-2"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Acessar Meu Painel Administrativo</span>
                </button>
              </div>

              <div className="text-center pt-2">
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Dica de demonstração: Você pode digitar <strong className="text-blue-400">admin</strong> para entrar no Painel Master ou qualquer e-mail cadastrado.
                </p>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
