import React, { useState } from 'react';
import { 
  X, 
  LogIn, 
  Store, 
  ShieldCheck, 
  Car, 
  Home, 
  ShoppingBag, 
  Briefcase,
  KeyRound,
  Eye,
  EyeOff,
  User,
  Shield,
  CheckCircle2,
  AlertTriangle
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

  const [loginRole, setLoginRole] = useState<'lojista' | 'admin'>('lojista');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanEmail = emailInput.toLowerCase().trim();
    const cleanPass = passwordInput.trim();

    if (!cleanEmail || !cleanPass) {
      setErrorMessage('Por favor, informe seu e-mail e senha de acesso.');
      return;
    }

    // 1. Fluxo de Administrador Master (SaaS)
    if (loginRole === 'admin') {
      const masterEmail = (platformSettings?.superAdminEmail || 'wilsonlimamn@gmail.com').toLowerCase().trim();
      const masterPass = platformSettings?.superAdminPassword || 'admin';

      const isValidMasterEmail = 
        cleanEmail === masterEmail || 
        cleanEmail === 'admin' || 
        cleanEmail === 'admin@3facil.com' ||
        cleanEmail === 'wilsonlimamn@gmail.com';

      if (!isValidMasterEmail) {
        setErrorMessage('E-mail de Administrador Master não reconhecido.');
        return;
      }

      if (cleanPass !== masterPass) {
        setErrorMessage('Senha incorreta para a conta de Administrador Master.');
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        loginAsSuperAdmin(platformSettings?.superAdminName || 'Wilson Lima', masterEmail);
        onGoToMasterAdmin();
        onClose();
        setIsSuccess(false);
        setPasswordInput('');
      }, 300);
      return;
    }

    // 2. Fluxo de Lojista / Cliente
    const cleanPhone = cleanEmail.replace(/\D/g, '');
    const matchedStore = stores.find(
      (s) =>
        s.email.toLowerCase().trim() === cleanEmail ||
        (s.ownerEmail && s.ownerEmail.toLowerCase().trim() === cleanEmail) ||
        (s.whatsapp && cleanPhone.length >= 8 && s.whatsapp.replace(/\D/g, '') === cleanPhone) ||
        s.slug.toLowerCase().trim() === cleanEmail ||
        s.name.toLowerCase().trim() === cleanEmail
    );

    if (!matchedStore) {
      setErrorMessage('Nenhuma loja encontrada com o e-mail ou WhatsApp informado.');
      return;
    }

    // A senha cadastrada na loja (ou padrão de demonstração '123456' se não alterada)
    const expectedPassword = matchedStore.password || '123456';

    if (cleanPass !== expectedPassword) {
      setErrorMessage(`Senha incorreta para a loja "${matchedStore.name}". Verifique sua senha.`);
      return;
    }

    setIsSuccess(true);
    setTimeout(() => {
      loginAsStoreOwner(matchedStore.id, matchedStore.ownerName || matchedStore.name, matchedStore.email);
      onSelectStoreAndGoToAdmin(matchedStore.id);
      onClose();
      setIsSuccess(false);
      setPasswordInput('');
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* Cabeçalho */}
        <div className={`px-6 py-5 border-b flex items-center justify-between ${
          isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50/70'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-2xl border ${
              loginRole === 'admin'
                ? 'bg-purple-600/10 text-purple-400 border-purple-500/20'
                : 'bg-blue-600/10 text-blue-500 border border-blue-500/20'
            }`}>
              {loginRole === 'admin' ? <Shield className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                {loginRole === 'admin' ? 'Acesso Administrador Master' : 'Acesso do Lojista'}
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {loginRole === 'admin' ? 'Painel de controle SaaS 3facil.com' : 'Gerencie seu catálogo e atenda seus clientes'}
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

        {/* Abas de Seleção de Perfil: Lojista vs Super Admin */}
        <div className="p-6 pb-0">
          <div className={`grid grid-cols-2 p-1 rounded-2xl border ${
            isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              type="button"
              onClick={() => {
                setLoginRole('lojista');
                setErrorMessage('');
              }}
              className={`flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-bold transition ${
                loginRole === 'lojista'
                  ? 'bg-blue-600 text-white shadow-md'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Store className="h-4 w-4" />
              <span>Sou Lojista</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLoginRole('admin');
                setErrorMessage('');
              }}
              className={`flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-bold transition ${
                loginRole === 'admin'
                  ? 'bg-purple-600 text-white shadow-md'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Administrador</span>
            </button>
          </div>
        </div>

        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>Autenticado com sucesso! Redirecionando...</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {loginRole === 'admin' ? 'E-mail do Administrador Master' : 'E-mail ou WhatsApp da Loja'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder={loginRole === 'admin' ? 'ex: wilsonlimamn@gmail.com' : 'ex: seu-email@loja.com.br ou WhatsApp'}
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setErrorMessage('');
                  }}
                  className={`w-full text-xs sm:text-sm pl-3.5 pr-10 py-2.5 rounded-xl border focus:outline-none focus:border-blue-500 transition ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
                <div className={`absolute right-3 top-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {loginRole === 'admin' ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`block text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Senha de Acesso
                </label>
                {loginRole === 'admin' && (
                  <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Padrão: admin
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setErrorMessage('');
                  }}
                  className={`w-full text-xs sm:text-sm pl-3.5 pr-10 py-2.5 rounded-xl border focus:outline-none focus:border-blue-500 transition ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-3 transition ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSuccess}
                className={`w-full py-3 px-4 rounded-xl text-white text-xs sm:text-sm font-bold shadow-lg transition flex items-center justify-center space-x-2 active:scale-[0.98] ${
                  loginRole === 'admin'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/30'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/30'
                }`}
              >
                <KeyRound className="h-4 w-4" />
                <span>Entrar no Painel</span>
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
                Cadastrar Minha Loja (R$ 30/mês)
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};
