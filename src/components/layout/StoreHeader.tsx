import React, { useState } from 'react';
import { 
  Store, 
  Layers, 
  Settings, 
  Eye, 
  Plus, 
  MessageSquare, 
  Car, 
  Home, 
  ShoppingBag, 
  Briefcase, 
  Check, 
  ChevronDown,
  Sparkles,
  PhoneCall,
  Building2,
  DollarSign,
  Users,
  Sun,
  Moon,
  LogIn,
  LogOut,
  UserCheck,
  ShieldAlert
} from 'lucide-react';
import { useStoreContext } from '../../context/StoreContext';
import { StoreType } from '../../types/store';
import { formatCurrency } from '../../utils/formatters';

export type AppViewMode = 'landing' | 'master' | 'admin' | 'public';

interface StoreHeaderProps {
  viewMode: AppViewMode;
  onChangeViewMode: (mode: AppViewMode) => void;
  onOpenNewStore: () => void;
  onOpenLogin?: () => void;
}

export const StoreHeader: React.FC<StoreHeaderProps> = ({
  viewMode,
  onChangeViewMode,
  onOpenNewStore,
  onOpenLogin,
}) => {
  const { stores, activeStore, selectStore, currentStoreLeads, resetToDefaults, theme, toggleTheme, currentUser, logout } = useStoreContext();
  const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);

  const isDark = theme === 'dark';
  const isInAdminMode = viewMode === 'master' || viewMode === 'admin';

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

  const getStoreTypeName = (type: StoreType) => {
    switch (type) {
      case 'veiculo':
        return 'Veículos';
      case 'imovel':
        return 'Imóveis';
      case 'produto':
        return 'Produtos';
      case 'servico':
        return 'Serviços';
    }
  };

  const newLeadsCount = currentStoreLeads.filter((l) => l.status === 'novo').length;

  return (
    <header className={`sticky top-0 z-40 backdrop-blur-md border-b shadow-md transition-colors duration-200 ${
      isDark 
        ? 'bg-slate-900/95 border-slate-800' 
        : 'bg-white/95 border-slate-200 shadow-slate-100'
    }`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          
          {/* Logo / Seletor de Loja Ativa */}
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            
            {/* Seletor Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsStoreMenuOpen(!isStoreMenuOpen)}
                className={`flex items-center space-x-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border transition shadow-sm text-left group ${
                  isDark
                    ? 'bg-slate-800/90 hover:bg-slate-700/90 text-white border-slate-700/80'
                    : 'bg-slate-100/90 hover:bg-slate-200/90 text-slate-900 border-slate-300'
                }`}
              >
                <div className={`p-1 sm:p-1.5 rounded-lg border shrink-0 ${
                  isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                }`}>
                  {getStoreIcon(activeStore.type)}
                </div>
                <div className="hidden sm:block min-w-0">
                  <div className={`text-[11px] font-medium leading-none flex items-center gap-1.5 ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    <span>{getStoreTypeName(activeStore.type)}</span>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span className="text-[10px] text-blue-500 dark:text-blue-400 font-mono">
                      {formatCurrency(activeStore.monthlyFee || 99.90)}/mês
                    </span>
                  </div>
                  <div className={`text-xs sm:text-sm font-semibold group-hover:text-blue-500 transition truncate max-w-[170px] ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    {activeStore.name}
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                } ${isStoreMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown de Seleção de Lojas / Modelos */}
              {isStoreMenuOpen && (
                <div className={`absolute left-0 mt-2 w-84 sm:w-96 rounded-2xl border shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-150 ${
                  isDark ? 'bg-slate-900 border-slate-700/80' : 'bg-white border-slate-200'
                }`}>
                  <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b flex items-center justify-between ${
                    isDark ? 'text-slate-400 border-slate-800' : 'text-slate-500 border-slate-100'
                  }`}>
                    <span>Lojas & Clientes Cadastrados</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {stores.length} lojas
                    </span>
                  </div>

                  <div className="space-y-1 py-2 max-h-72 overflow-y-auto">
                    {stores.map((s) => {
                      const isCurrent = s.id === activeStore.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            selectStore(s.id);
                            setIsStoreMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl transition text-left ${
                            isCurrent
                              ? isDark
                                ? 'bg-blue-600/20 border border-blue-500/30 text-white'
                                : 'bg-blue-50 border border-blue-200 text-blue-900'
                              : isDark
                              ? 'hover:bg-slate-800 text-slate-300 hover:text-white'
                              : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                          }`}
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className={`p-2 rounded-lg border shrink-0 ${
                              isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                            }`}>
                              {getStoreIcon(s.type)}
                            </div>
                            <div className="truncate">
                              <div className={`text-[11px] font-medium flex items-center gap-1.5 ${
                                isDark ? 'text-slate-400' : 'text-slate-500'
                              }`}>
                                <span>{getStoreTypeName(s.type)}</span>
                                <span>•</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatCurrency(s.monthlyFee || 99.90)}/mês</span>
                              </div>
                              <div className={`text-xs sm:text-sm font-semibold truncate ${
                                isDark ? 'text-slate-100' : 'text-slate-900'
                              }`}>
                                {s.name}
                              </div>
                              <div className={`text-[10px] truncate ${
                                isDark ? 'text-slate-500' : 'text-slate-400'
                              }`}>
                                Resp: {s.ownerName || 'Cliente Lojista'}
                              </div>
                            </div>
                          </div>
                          {isCurrent && <Check className="h-4 w-4 text-blue-500 shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className={`pt-2 border-t space-y-1.5 ${
                    isDark ? 'border-slate-800' : 'border-slate-100'
                  }`}>
                    <button
                      onClick={() => {
                        setIsStoreMenuOpen(false);
                        onOpenNewStore();
                      }}
                      className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold transition shadow-md"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Cadastrar Novo Cliente / Loja</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        if (window.confirm('Deseja recarregar as lojas e configurações padrão com os 4 modelos (Veículo, Imóvel, Produto e Serviço)? Todos os itens e valores serão restaurados para a configuração de fábrica (R$ 30,00/mês).')) {
                          resetToDefaults();
                          setIsStoreMenuOpen(false);
                        }
                      }}
                      className={`w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-xl text-[11px] font-medium transition ${
                        isDark 
                          ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>🔄 Restaurar 4 Modelos Padrão</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Navegação entre os 4 Modos: Index / Apresentação, Painel Master (SaaS), Painel Lojista e Vitrine */}
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            
            <div className={`flex items-center p-1 rounded-xl border ${
              isDark ? 'bg-slate-800/90 border-slate-700/80' : 'bg-slate-100 border-slate-200'
            }`}>
              
              {/* Modo 0: Index / Apresentação do Produto */}
              <button
                onClick={() => onChangeViewMode('landing')}
                className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'landing'
                    ? 'bg-blue-600 text-white shadow-md'
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span className="hidden md:inline">Início (Index)</span>
                <span className="md:hidden">Início</span>
              </button>

              {/* Modo 1: Painel Master (Super Admin SaaS) */}
              <button
                onClick={() => onChangeViewMode('master')}
                className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  viewMode === 'master'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Painel Master</span>
                <span className="md:hidden">Master</span>
              </button>

              {/* Modo 2: Painel do Lojista */}
              <button
                onClick={() => onChangeViewMode('admin')}
                className={`relative flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  viewMode === 'admin'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Settings className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Painel Lojista</span>
                <span className="md:hidden">Lojista</span>
                {newLeadsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-slate-900">
                    {newLeadsCount}
                  </span>
                )}
              </button>

              {/* Modo 3: Vitrine Pública */}
              <button
                onClick={() => onChangeViewMode('public')}
                className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  viewMode === 'public'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Vitrine Pública</span>
                <span className="md:hidden">Vitrine</span>
              </button>

            </div>

            {/* Badge de Identificação do Usuário Logado */}
            {currentUser ? (
              <div className={`hidden sm:flex items-center space-x-2 px-2.5 py-1.5 rounded-xl border text-xs ${
                currentUser.role === 'superadmin'
                  ? isDark
                    ? 'bg-blue-950/60 border-blue-800/80 text-blue-300'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                  : isDark
                    ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div className={`w-2 h-2 rounded-full animate-pulse ${
                  currentUser.role === 'superadmin' ? 'bg-blue-400' : 'bg-emerald-400'
                }`} />
                <div className="flex flex-col leading-tight">
                  <span className="font-bold text-[11px] truncate max-w-[130px]">
                    {currentUser.name}
                  </span>
                  <span className="text-[9px] opacity-75 font-medium">
                    {currentUser.role === 'superadmin' ? 'Super Admin Master' : `Lojista (${currentUser.storeName || 'Loja'})`}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Botão Dinâmico de Entrar / Sair do Painel */}
            {isInAdminMode ? (
              <button
                onClick={() => {
                  onChangeViewMode('landing');
                }}
                title="Sair do painel e voltar para a página inicial"
                className={`flex items-center space-x-1.5 px-3 py-1.5 sm:py-2 rounded-xl border text-xs font-bold transition shadow-sm ${
                  isDark
                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                }`}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sair</span>
              </button>
            ) : onOpenLogin ? (
              <button
                onClick={onOpenLogin}
                title="Entrar no painel administrativo"
                className={`flex items-center space-x-1.5 px-3 py-1.5 sm:py-2 rounded-xl border text-xs font-bold transition shadow-sm ${
                  isDark
                    ? 'bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border-blue-500/30'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                }`}
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>{currentUser ? 'Painel' : 'Entrar'}</span>
              </button>
            ) : null}

            {/* Alternador de Tema (Modo Escuro / Modo Claro) */}
            <button
              onClick={toggleTheme}
              title={isDark ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border transition shadow-sm font-semibold text-xs ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
              }`}
            >
              {isDark ? (
                <>
                  <Sun className="h-4 w-4 text-amber-400 animate-in spin-in-90 duration-200" />
                  <span className="hidden lg:inline text-slate-200">Tema Claro</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-indigo-600 animate-in spin-in-90 duration-200" />
                  <span className="hidden lg:inline text-slate-700">Tema Escuro</span>
                </>
              )}
            </button>

            {/* Contato WhatsApp rápido na vitrine */}
            {viewMode === 'public' && activeStore.whatsapp && (
              <a
                href={`https://wa.me/55${activeStore.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Estou visitando a ${activeStore.name} e gostaria de informações.`)}`}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-md transition"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                <span>WhatsApp</span>
              </a>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};

