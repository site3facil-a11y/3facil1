import React, { useState } from 'react';
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
import { StoreItem } from './types/store';

const MainApp: React.FC = () => {
  const { activeStore, selectStore, theme } = useStoreContext();

  const isDark = theme === 'dark';

  const [viewMode, setViewMode] = useState<AppViewMode>('landing');
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<StoreItem | null>(null);
  const [isNewStoreModalOpen, setIsNewStoreModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

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
    setViewMode('admin');
  };

  const handleSelectStoreAndGoToPublic = (storeId: string) => {
    selectStore(storeId);
    setViewMode('public');
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-blue-600 selection:text-white transition-colors duration-200 ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* Barra de Cabeçalho com Seletor de Lojas e Modos (Index / Painel Master SaaS / Painel Lojista / Vitrine) */}
      <StoreHeader
        viewMode={viewMode}
        onChangeViewMode={(mode) => setViewMode(mode)}
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
            onGoToMasterAdmin={() => setViewMode('master')}
          />
        )}

        {viewMode === 'master' && (
          <MasterPlatformManager
            onSelectStoreAndGoToAdmin={handleSelectStoreAndGoToAdmin}
            onSelectStoreAndGoToPublic={handleSelectStoreAndGoToPublic}
            onOpenNewStoreModal={() => setIsNewStoreModalOpen(true)}
          />
        )}

        {viewMode === 'admin' && (
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
            onOpenAdmin={() => setViewMode('admin')}
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
        onSelectStoreAndGoToAdmin={handleSelectStoreAndGoToAdmin}
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
