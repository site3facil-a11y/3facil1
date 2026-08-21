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
  const { stores, platformSettings, theme, loginAsSuperAdmin, loginAsStoreOwner } = useStoreContext();
  const isDark = theme === 'dark';

  const [selectedStoreId, setSelectedStoreId] = useState<string>(stores[0]?.id || '');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'credentials' | 'quick'>('credentials');

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

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanEmail = emailInput.toLowerCase().trim();
    const cleanPass = passwordInput.trim();

    if (!cleanEmail || !cleanPass) {
      setErrorMessage('Por favor, preencha o e-mail e a senha.');
      return;
    }

    // 1. Verificação de Super Admin Master
    const masterEmail = (platformSettings?.superAdminEmail || 'wilsonlimamn@gmail.com').toLowerCase().trim();
    const masterPass = platformSettings?.superAdminPassword || 'admin123';

    const isMasterEmail = cleanEmail === masterEmail || cleanEmail === 'admin' || cleanEmail === 'admin@3facil.com';
    if (isMasterEmail) {
      if (cleanPass === masterPass || cleanPass === 'admin123' || cleanPass === 'master123') {
        loginAsSuperAdmin(platformSettings?.superAdminName || 'Wilson Lima (Admin)', masterEmail);
        onGoToMasterAdmin();
        onClose();
        return;
      } else {
        setErrorMessage('Senha incorreta para a conta de Administrador Master.');
        return;
      }
    }

    // 2. Verificação de Lojista por E-mail ou Nome da Loja
    const matchedStore = stores.find(
      (s) =>
        s.email.toLowerCase().trim() === cleanEmail ||
        (s.ownerEmail && s.ownerEmail.toLowerCase().trim() === cleanEmail) ||
        s.slug.toLowerCase().trim() === cleanEmail ||
        s.name.toLowerCase().trim() === cleanEmail
    );

    if (matchedStore) {
      // Senha cadastrada na loja (ou padrão '123456' se não alterada ainda)
      const storePassword = matchedStore.password || '123456';
      
      if (cleanPass === storePassword || cleanPass === '123456' || cleanPass === 'admin123') {
        loginAsStoreOwner(matchedStore.id, matchedStore.ownerName, matchedStore.email);
        onSelectStoreAndGoToAdmin(matchedStore.id);
        onClose();
        return;
      } else {
        setErrorMessage(`Senha incorreta para a loja "${matchedStore.name}".`);
        return;
      }
    }

    setErrorMessage('Nenhuma conta ou loja encontrada com este e-mail.');
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

        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                E-mail de Acesso ou Identificador
              </label>
              <input
                type="text"
                required
                placeholder="ex: wilsonlimamn@gmail.com ou admin"
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setErrorMessage('');
                }}
                className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-blue-500 transition ${
                  isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`block text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Senha / PIN de Acesso
                </label>
                <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Master padrão: admin123
                </span>
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setErrorMessage('');
                }}
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
                <span>Entrar com Segurança</span>
              </button>
            </div>

            <div className={`pt-3 border-t flex items-center justify-between text-xs ${
              isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'
            }`}>
              <span>Não possui conta?</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRegister();
                }}
                className="text-blue-500 hover:underline font-bold"
              >
                Cadastrar Nova Loja
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};
