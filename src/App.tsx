import React, { useState, useEffect } from 'react';
import { StoreProvider, useStoreContext } from './context/StoreContext';
import { StoreHeader, AppViewMode } from './components/layout/StoreHeader';
import { LandingPageView } from './components/landing/LandingPageView';
import { PublicStoreView } from './components/public/PublicStoreView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { MasterPlatformManager } from './components/admin/MasterPlatformManager';
import { ItemFormModal } from './components/admin/ItemFormModal';
import { StoreCreatorModal } from './components/admin/StoreCreatorModal';
import { StoreSettingsModal } from './components/admin/StoreSettingsModal';
import { LoginModal } from './components/auth/LoginModal';
import { ResetPasswordModal } from './components/auth/ResetPasswordModal';
import { StoreItem } from './types/store';

const MainApp: React.FC = () => {
  const { activeStore, selectStore, theme, currentUser } = useStoreContext();

  const isDark = theme === 'dark';

  const [resetToken, setResetToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('reset-token');
  });

  const [viewMode, setViewMode] = useState<AppViewMode>(() => {
    if (typeof window !== 'undefined' && window.location.pathname) {
      const pathSlug = window.location.pathname.replace(/^\/+/, '').split('/')[0]?.toLowerCase();
      if (pathSlug === 'admin') return 'admin';
      if (pathSlug === 'master') return 'master';
      if (pathSlug && !['landing', 'login', 'api'].includes(pathSlug)) {
        return 'public';
      }
    }
    return 'landing';
  });
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<StoreItem | null>(null);
  const [isNewStoreModalOpen, setIsNewStoreModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Sincronização e Proteção de rotas em tempo de execução
  useEffect(() => {
    // Permite que o usuário acesse o painel sem ser jogado de volta durante a transição
    if (viewMode === 'master' && currentUser && currentUser.role !== 'superadmin') {
      setViewMode('landing');
    }
  }, [viewMode, currentUser]);

  // Atualizar a URL do navegador conforme a navegação sem recarregar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (viewMode === 'public' && activeStore?.slug) {
        const targetPath = `/${activeStore.slug}`;
        if (window.location.pathname !== targetPath) {
          window.history.replaceState(null, '', targetPath);
        }
      } else if (viewMode === 'landing') {
        if (window.location.pathname !== '/' && window.location.pathname !== '') {
          window.history.replaceState(null, '', '/');
        }
      }
    } catch (e) {}
  }, [viewMode, activeStore]);

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
        onOpenNewStore={() => setIsNewStoreModalOpen(true)}
        onOpenLogin={() => setIsLoginModalOpen(true)}
      />

      {/* Conteúdo Principal de acordo com a visão selecionada */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-6">
        {viewMode === 'landing' && (
          <LandingPageView
            onOpenRegister={() => setIsNewStoreModalOpen(true)}
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
            onOpenNewStoreModal={() => setIsNewStoreModalOpen(true)}
          />
        )}

        {viewMode === 'admin' && currentUser && (
          <AdminDashboard
            onOpenNewItemModal={handleOpenNewItem}
            onEditItem={handleEditItem}
            onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
            onOpenNewStoreModal={() => setIsNewStoreModalOpen(true)}
            onViewPublicStore={() => setViewMode('public')}
          />
        )}

        {viewMode === 'public' && (
          <PublicStoreView
            onOpenAdmin={() => {
              if (currentUser) {
                setViewMode('admin');
              } else {
                setIsLoginModalOpen(true);
              }
            }}
          />
        )}
      </main>

      {/* Rodapé Oficial da Plataforma SaaS 3facil.com */}
      <footer className={`border-t py-6 text-center text-xs transition-colors ${
        isDark 
          ? 'border-slate-800/80 bg-slate-950 text-slate-500' 
          : 'border-slate-200 bg-white text-slate-500'
      }`}>
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>3facil.com SaaS</span>
            <span>—</span>
            <span>Plataforma de Gestão de Lojas, Catálogos Digitais e Assinaturas (R$ 30,00/mês)</span>
          </div>
          <div className={isDark ? 'text-slate-400' : 'text-slate-600'}>
            Finalize orçamentos, contratos e propostas direto no <strong className="text-emerald-500 font-semibold">WhatsApp</strong> e <strong className="text-blue-500 font-semibold">E-mail</strong>
          </div>
        </div>
      </footer>

      {/* Modais Administrativos e de Autenticação */}
      <ItemFormModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        itemToEdit={itemToEdit}
        store={activeStore}
      />

      <StoreCreatorModal
        isOpen={isNewStoreModalOpen}
        onClose={() => setIsNewStoreModalOpen(false)}
      />

      <StoreSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        store={activeStore}
      />

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
          setIsNewStoreModalOpen(true);
        }}
      />

    </div>
  );
};

export function App() {
  return (
    <StoreProvider>
      <MainApp />
    </StoreProvider>
  );
}
export default App;
