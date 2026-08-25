import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Store, StoreItem, User } from '../types/store';

interface StoreContextType {
  stores: Store[];
  activeStore: Store | null;
  currentUser: User | null;
  theme: 'light' | 'dark';
  selectStore: (storeId: string) => void;
  deleteItem: (storeId: string, itemId: string) => void;
  deleteStore: (storeId: string) => void;
  toggleTheme: () => void;
}

// Chaves para persistência no navegador
const LOCAL_STORAGE_STORES = '3facil_stores_data_v1';
const LOCAL_STORAGE_DELETED_ITEMS = '3facil_deleted_items_v1';

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // 1. Carrega os IDs bloqueados/excluídos para impedir a volta dos anúncios
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_DELETED_ITEMS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 2. Carrega as lojas salvas no localStorage
  const [stores, setStores] = useState<Store[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_STORES);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Salva no localStorage sempre que houver alteração nas lojas
  useEffect(() => {
    if (stores.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_STORES, JSON.stringify(stores));
    }
  }, [stores]);

  // Salva no localStorage a lista de bloqueios
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_DELETED_ITEMS, JSON.stringify(deletedItemIds));
  }, [deletedItemIds]);

  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);

  const selectStore = (storeId: string) => {
    setActiveStoreId(storeId);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // 3. Função de exclusão definitiva
  const deleteItem = (storeId: string, itemId: string) => {
    // Adiciona o ID na lista de bloqueios permanentes
    setDeletedItemIds((prev) => [...prev, itemId]);

    // Remove do estado ativo da aplicação
    setStores((prevStores) =>
      prevStores.map((store) => {
        if (store.id === storeId) {
          return {
            ...store,
            items: (store.items || []).filter((item) => item.id !== itemId),
          };
        }
        return store;
      })
    );
  };

  const deleteStore = (storeId: string) => {
    setStores((prevStores) => prevStores.filter((store) => store.id !== storeId));
  };

  // 4. Garante que os itens retornados pela loja ativa NUNCA incluam os deletados
  const activeStore = stores.find((s) => s.id === activeStoreId) || stores[0] || null;
  const sanitizedActiveStore = activeStore
    ? {
        ...activeStore,
        items: (activeStore.items || []).filter((item) => !deletedItemIds.includes(item.id)),
      }
    : null;

  return (
    <StoreContext.Provider
      value={{
        stores,
        activeStore: sanitizedActiveStore,
        currentUser,
        theme,
        selectStore,
        deleteItem,
        deleteStore,
        toggleTheme,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStoreContext = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStoreContext deve ser usado dentro de um StoreProvider');
  }
  return context;
};
