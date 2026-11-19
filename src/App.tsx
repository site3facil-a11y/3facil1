import React, { useState, useEffect } from 'react';
import { StoreProvider, useStoreContext } from './context/StoreContext';
import { StoreHeader, AppViewMode } from './components/layout/StoreHeader';
import { LandingPageView } from './components/landing/LandingPageView';
import { PublicStoreView } from './components/public/PublicStoreView';
import { StoreNotFoundView } from './components/public/StoreNotFoundView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { MasterPlatformManager } from './components/admin/MasterPlatformManager';
import { ItemFormModal } from './components/admin/ItemFormModal';
import { StoreCreatorModal } from './components/admin/StoreCreatorModal';
import { StoreSettingsModal } from './components/admin/StoreSettingsModal';
import { LoginModal } from './components/auth/LoginModal';
import { ResetPasswordModal } from './components/auth/ResetPasswordModal';
import { TermsAndPrivacyModal } from './components/modals/TermsAndPrivacyModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { StoreItem, StoreType } from './types/store';
import { Cloud, Server, Boxes, Database, Award, FileCheck2 } from 'lucide-react';
import { parseAppUrl } from './utils/urlRouting';

const MainApp: React.FC = () => {
  const { activeStore, stores, selectStore, theme, currentUser, logout } = useStoreContext();

  const isDark = theme === 'dark';

  const [resetToken, setResetToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return parseAppUrl().resetToken;
  });

  const [viewMode, setViewMode] = useState<AppViewMode>(() => {
    if (typeof window !== 'undefined') {
      const parsed = parseAppUrl();
      if (parsed.isMasterRoute) return 'master';
      if (parsed.isAdminRoute) return 'admin';
      if (parsed.requestedSlug || parsed.queryStoreId) return 'public';
    }
    return 'landing';
  });
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<StoreItem | null>(null);
  const [isNewStoreModalOpen, setIsNewStoreModalOpen] = useState(false);
  const [initialNewStoreType, setInitialNewStoreType] = useState<StoreType>('veiculo');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    const parsed = parseAppUrl();
    return parsed.isAdminRoute || parsed.isMasterRoute;
  });
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<'terms' | 'privacy'>('terms');

  const openNewStoreModal = (defaultType: StoreType = 'veiculo') => {
    setInitialNewStoreType(defaultType);
    setIsNewStoreModalOpen(true);
  };

  // Resolve qual loja abrir com base no slug ou ?loja / ?store da URL
  useEffect(() => {
    if (typeof window === 'undefined' || stores.length === 0) return;
    const parsed = parseAppUrl();

    if (parsed.queryStoreId) {
      const matchedById = stores.find((s) => s.id === parsed.queryStoreId);
      if (matchedById) {
        selectStore(matchedById.id);
      }
      if (parsed.isAdminRoute) {
        setViewMode('admin');
      } else if (!parsed.isMasterRoute) {
        setViewMode('public');
      }
      return;
    }

    if (parsed.requestedSlug) {
      const matchedStore = stores.find((s) => s.slug?.toLowerCase() === parsed.requestedSlug);
      if (matchedStore) {
        selectStore(matchedStore.id);
      }
      setViewMode('public');
    }
  }, [stores, selectStore]);

  // Suporte à navegação do histórico do navegador (botão Voltar/Avançar)
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseAppUrl();
      if (parsed.isMasterRoute) {
        setViewMode('master');
      } else if (parsed.isAdminRoute) {
        if (parsed.queryStoreId) {
          const matched = stores.find((s) => s.id === parsed.queryStoreId);
          if (matched) selectStore(matched.id);
        }
        setViewMode('admin');
      } else if (parsed.requestedSlug) {
        const matched = stores.find((s) => s.slug?.toLowerCase() === parsed.requestedSlug);
        if (matched) {
          selectStore(matched.id);
        }
        setViewMode('public');
      } else if (parsed.queryStoreId) {
        const matched = stores.find((s) => s.id === parsed.queryStoreId);
        if (matched) selectStore(matched.id);
        setViewMode('public');
      } else {
        setViewMode('landing');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [stores, selectStore]);

  // Interceptar expiração de sessão / 401 / 403 e redirecionar ao login
  useEffect(() => {
    const handleAuthExpired = () => {
      logout();
      setIsLoginModalOpen(true);
      if (viewMode === 'master' || viewMode === 'admin') {
        setViewMode('landing');
      }
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, [logout, viewMode]);

  // Sincronização e Proteção de rotas em tempo de execução
  useEffect(() => {
    // Permite que o usuário acesse o painel sem ser jogado de volta durante a transição
    if (viewMode === 'master' && currentUser && currentUser.role !== 'superadmin') {
      setViewMode('landing');
    }
  }, [viewMode, currentUser]);

  // Atualizar a URL do navegador conforme a navegação sem recarregar ou causar redirecionamentos falsos
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const parsed = parseAppUrl();
      if (viewMode === 'public' && activeStore?.slug) {
        const targetPath = `/${activeStore.slug}`;
        const currentPath = window.location.pathname;

        // Se a URL já possui um slug conhecido diferente da loja atual, não sobrescreva a URL
        // enquanto a loja correspondente estiver sendo sincronizada!
        if (parsed.requestedSlug && parsed.requestedSlug !== activeStore.slug.toLowerCase()) {
          const isKnownStore = stores.some((s) => s.slug?.toLowerCase() === parsed.requestedSlug);
          if (isKnownStore) {
            return;
          }
        }

        if (currentPath !== targetPath || parsed.queryStoreSlug) {
          window.history.replaceState(null, '', targetPath);
        }
      } else if (viewMode === 'landing') {
        if ((window.location.pathname !== '/' && window.location.pathname !== '') || parsed.queryStoreSlug) {
          window.history.replaceState(null, '', '/');
        }
      }
    } catch (e) {}
  }, [viewMode, activeStore, stores]);

  const handleOpenNewItem = () => {
    setItemToEdit(null);
    setIsItemModalOpen(true);
  };

  const handleEditItem = (item: StoreItem) => {
    setItemToEdit(item);
    setIsItemModalOpen(true);
  };

  const handleSelectStoreAndGoToAdmin = (storeId: string) => {
    selectStore(storeId);
    if (currentUser) {
      setViewMode('admin');
    } else {
      setIsLoginModalOpen(true);
    }
  };

  const handleSelectStoreAndGoToPublic = (storeId: string) => {
    selectStore(storeId);
    const store = stores.find((s) => s.id === storeId);
    if (store?.slug && typeof window !== 'undefined') {
      window.history.pushState(null, '', `/${store.slug}`);
    }
    setViewMode('public');
  };

  const handleGoToMasterAdmin = () => {
    if (currentUser?.role === 'superadmin') {
      setViewMode('master');
    } else {
      setIsLoginModalOpen(true);
    }
  };

  const handleViewModeChange = (mode: AppViewMode) => {
    if (mode === 'master' && currentUser?.role !== 'superadmin') {
      setIsLoginModalOpen(true);
      return;
    }
    if (mode === 'admin' && !currentUser) {
      setIsLoginModalOpen(true);
      return;
    }
    setViewMode(mode);
  };

  const requestedSlug = typeof window !== 'undefined'
    ? parseAppUrl().requestedSlug
    : '';

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-blue-600 selection:text-white transition-colors duration-200 ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>

      {resetToken && (
        <ResetPasswordModal
          token={resetToken}
          onDone={() => {
            setResetToken(null);
            window.history.replaceState(null, '', '/');
            setIsLoginModalOpen(true);
          }}
        />
      )}
      
      {/* Barra de Cabeçalho com Visualização Condicional por Perfil */}
      <StoreHeader
        viewMode={viewMode}
        onChangeViewMode={handleViewModeChange}
        onOpenNewStore={() => openNewStoreModal()}
        onOpenLogin={() => setIsLoginModalOpen(true)}
      />

      {/* Conteúdo Principal com Error Boundary Individual */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-6">
        <ErrorBoundary>
          {viewMode === 'landing' && (
            <LandingPageView
              onOpenRegister={() => openNewStoreModal()}
              onOpenRegisterWithType={(storeType) => openNewStoreModal(storeType)}
              onOpenLogin={() => setIsLoginModalOpen(true)}
              onSelectStoreAndGoToPublic={handleSelectStoreAndGoToPublic}
              onSelectStoreAndGoToAdmin={handleSelectStoreAndGoToAdmin}
              onGoToMasterAdmin={handleGoToMasterAdmin}
            />
          )}

          {viewMode === 'master' && currentUser?.role === 'superadmin' && (
            <MasterPlatformManager
              onSelectStoreAndGoToAdmin={handleSelectStoreAndGoToAdmin}
              onSelectStoreAndGoToPublic={handleSelectStoreAndGoToPublic}
              onOpenNewStoreModal={() => openNewStoreModal()}
            />
          )}

          {viewMode === 'admin' && currentUser && (
            <AdminDashboard
              onOpenNewItemModal={handleOpenNewItem}
              onEditItem={handleEditItem}
              onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
              onOpenNewStoreModal={() => openNewStoreModal()}
              onViewPublicStore={() => setViewMode('public')}
            />
          )}

          {(viewMode === 'admin' || viewMode === 'master') && !currentUser && (
            <div className={`max-w-md mx-auto my-16 p-8 rounded-3xl border text-center space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <h2 className="text-lg font-bold">Autenticação Necessária</h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Faça login com o e-mail e senha da sua loja para acessar o painel administrativo.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLoginModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
                >
                  Entrar no Painel
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('landing')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition ${
                    isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  Voltar ao Início
                </button>
              </div>
            </div>
          )}

          {viewMode === 'public' && (
            activeStore ? (
              <PublicStoreView
                onOpenAdmin={() => {
                  if (currentUser) {
                    setViewMode('admin');
                  } else {
                    setIsLoginModalOpen(true);
                  }
                }}
              />
            ) : (
              <StoreNotFoundView
                requestedSlug={requestedSlug}
                onGoToHome={() => {
                  setViewMode('landing');
                  window.history.pushState(null, '', '/');
                }}
                onSelectStore={(id) => {
                  handleSelectStoreAndGoToPublic(id);
                }}
              />
            )
          )}
        </ErrorBoundary>
      </main>

      {/* Rodapé Oficial da Plataforma SaaS 3facil.com */}
      <footer className={`border-t py-6 text-xs transition-colors ${
        isDark 
          ? 'border-slate-800/80 bg-slate-950 text-slate-400' 
          : 'border-slate-200 bg-white text-slate-600'
      }`}>
        <div className="max-w-7xl mx-auto px-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>3facil.com SaaS</span>
              <span>—</span>
              <span>Plataforma de Gestão de Lojas, Catálogos Digitais e Assinaturas (R$ 30,00/mês)</span>
            </div>
            <div>
              Finalize orçamentos, contratos e propostas direto no <strong className="text-emerald-500 font-semibold">WhatsApp</strong> e <strong className="text-blue-500 font-semibold">E-mail</strong>
            </div>
          </div>

          {/* Selos de Tecnologias Empregadas e Formação de Governança */}
          <div className={`pt-3 border-t flex flex-wrap items-center justify-center sm:justify-between gap-2.5 ${
            isDark ? 'border-slate-800/60' : 'border-slate-100'
          }`}>
            <div className="text-[11px] text-slate-400 font-medium">
              Infraestrutura Cloud & Engenharia com Governança de TI:
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <Cloud className="h-3 w-3 text-red-500" />
                Oracle Cloud (OCI)
              </span>

              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <Server className="h-3 w-3 text-emerald-500" />
                Node.js
              </span>

              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <Boxes className="h-3 w-3 text-blue-500" />
                Docker
              </span>

              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <Database className="h-3 w-3 text-indigo-400" />
                PostgreSQL
              </span>

              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <Award className="h-3 w-3 text-purple-400" />
                ITIL® 4
              </span>

              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <FileCheck2 className="h-3 w-3 text-teal-400" />
                ISO/IEC 20000
              </span>
            </div>
          </div>

          {/* Links Legais e Copyright */}
          <div className={`pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] ${
            isDark ? 'border-slate-800/40 text-slate-500' : 'border-slate-100 text-slate-500'
          }`}>
            <div>
              © 2026 <strong>3facil.com</strong> • Todos os direitos reservados • Suporte: <a href="mailto:site3facil@gmail.com" className="hover:underline text-blue-500">site3facil@gmail.com</a>
            </div>
            <div className="flex items-center gap-4 font-medium">
              <button
                type="button"
                onClick={() => {
                  setLegalModalTab('terms');
                  setIsLegalModalOpen(true);
                }}
                className="hover:text-blue-500 transition"
              >
                Termos de Uso
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  setLegalModalTab('privacy');
                  setIsLegalModalOpen(true);
                }}
                className="hover:text-emerald-500 transition"
              >
                Privacidade & LGPD
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Modais Administrativos e de Autenticação */}
      {activeStore && (
        <ItemFormModal
          isOpen={isItemModalOpen}
          onClose={() => setIsItemModalOpen(false)}
          itemToEdit={itemToEdit}
          store={activeStore}
        />
      )}

      <StoreCreatorModal
        isOpen={isNewStoreModalOpen}
        initialType={initialNewStoreType}
        onClose={() => setIsNewStoreModalOpen(false)}
      />

      {activeStore && (
        <StoreSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          store={activeStore}
        />
      )}

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSelectStoreAndGoToAdmin={(storeId) => {
          selectStore(storeId);
          setViewMode('admin');
        }}
        onGoToMasterAdmin={() => setViewMode('master')}
        onOpenRegister={() => {
          setIsLoginModalOpen(false);
          openNewStoreModal();
        }}
      />

      <TermsAndPrivacyModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        defaultTab={legalModalTab}
      />

    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <MainApp />
      </StoreProvider>
    </ErrorBoundary>
  );
}
export default App;

