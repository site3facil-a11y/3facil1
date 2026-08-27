import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  StoreProfile,
  StoreItem,
  ProposalLead,
  CurrentUser,
  SaaSPlatformSettings,
  SaaSPlanConfig,
} from '../types/store';
import { apiService, HealthResponse } from '../services/apiService';
import {
  INITIAL_STORES,
  INITIAL_ITEMS,
  INITIAL_LEADS,
  DEFAULT_PLATFORM_SETTINGS,
  DEFAULT_SAAS_PLANS,
} from '../data/demoStores';
import { generateUUID } from '../utils/uuid';

type DbName = 'usuariosDB' | 'autoDB' | 'imoveisDB' | 'lojaDB' | 'servicosDB';

interface DbStats {
  usuariosDB: { storesCount: number; sizeBytes: number };
  autoDB: { itemsCount: number; leadsCount: number; sizeBytes: number };
  imoveisDB: { itemsCount: number; leadsCount: number; sizeBytes: number };
  lojaDB: { itemsCount: number; leadsCount: number; sizeBytes: number };
  servicosDB: { itemsCount: number; leadsCount: number; sizeBytes: number };
}

interface StoreContextType {
  // Dados
  stores: StoreProfile[];
  items: StoreItem[];
  leads: ProposalLead[];
  plans: SaaSPlanConfig[];
  platformSettings: SaaSPlatformSettings;
  activeStore: StoreProfile | null;
  currentStoreItems: StoreItem[];
  currentStoreLeads: ProposalLead[];
  currentUser: CurrentUser | null;
  theme: 'light' | 'dark';

  // Status do Banco de Dados
  isPostgresConnected: boolean;
  postgresStats: HealthResponse['stats'] | null;
  refreshDatabaseStatus: () => Promise<void>;

  // Navegação / Sessão
  selectStore: (storeId: string) => void;
  toggleTheme: () => void;
  loginAsSuperAdmin: (name: string, email: string) => void;
  loginAsStoreOwner: (storeId: string, name: string, email: string) => void;
  logout: () => void;

  // Lojas
  createStore: (store: Omit<StoreProfile, 'id' | 'createdAt'>) => Promise<{
    success: boolean;
    store: StoreProfile;
    postgresSaved?: boolean;
    dbError?: string;
    emailResult?: { success: boolean; message: string; simulated?: boolean };
  }>;
  updateStore: (store: StoreProfile) => void;
  deleteStore: (storeId: string) => void;
  updateStoreSubscription: (storeId: string, updatedStore: StoreProfile) => void;
  markPaymentReceived: (storeId: string) => void;
  toggleStorePublished: (storeId: string) => void;

  // Itens
  addItem: (item: Omit<StoreItem, 'id' | 'storeId' | 'createdAt'>) => void;
  updateItem: (item: StoreItem) => void;
  deleteItem: (storeId: string, itemId: string) => void;
  toggleItemFeatured: (itemId: string) => void;
  updateItemStatus: (itemId: string, status: string) => void;

  // Propostas / Leads
  submitProposal: (
    lead: Omit<ProposalLead, 'id' | 'storeId' | 'createdAt' | 'status'>
  ) => ProposalLead;
  updateLeadStatus: (leadId: string, status: ProposalLead['status']) => void;
  deleteLead: (leadId: string) => void;

  // Configurações da Plataforma
  updatePlatformSettings: (settings: SaaSPlatformSettings) => void;

  // Backup / Manutenção
  exportDataJSON: () => string;
  importDataJSON: (json: string) => boolean;
  resetToDefaults: () => void;
  getDatabaseStats: () => DbStats;
  exportDatabaseJSON: (dbName: 'all' | DbName) => string;
  resetDatabase: (dbName: DbName) => void;
}

// Chaves para cache local (permite carregar instantaneamente enquanto o backend responde)
const LOCAL_STORAGE_STORES = '3facil_stores_data_v2';
const LOCAL_STORAGE_ITEMS = '3facil_items_data_v2';
const LOCAL_STORAGE_LEADS = '3facil_leads_data_v2';
const LOCAL_STORAGE_SETTINGS = '3facil_settings_data_v2';
const LOCAL_STORAGE_DELETED_ITEMS = '3facil_deleted_items_v2';

const loadCached = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
};

const ITEM_TYPE_BY_DB: Record<DbName, StoreItem['itemType'] | null> = {
  usuariosDB: null,
  autoDB: 'veiculo',
  imoveisDB: 'imovel',
  lojaDB: 'produto',
  servicosDB: 'servico',
};

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [stores, setStores] = useState<StoreProfile[]>(() => loadCached(LOCAL_STORAGE_STORES, INITIAL_STORES));
  const [items, setItems] = useState<StoreItem[]>(() => loadCached(LOCAL_STORAGE_ITEMS, INITIAL_ITEMS));
  const [leads, setLeads] = useState<ProposalLead[]>(() => loadCached(LOCAL_STORAGE_LEADS, INITIAL_LEADS));
  const [platformSettings, setPlatformSettings] = useState<SaaSPlatformSettings>(() =>
    loadCached(LOCAL_STORAGE_SETTINGS, DEFAULT_PLATFORM_SETTINGS)
  );
  const [plans] = useState<SaaSPlanConfig[]>(DEFAULT_SAAS_PLANS);

  const [deletedItemIds, setDeletedItemIds] = useState<string[]>(() =>
    loadCached(LOCAL_STORAGE_DELETED_ITEMS, [] as string[])
  );

  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);

  const [isPostgresConnected, setIsPostgresConnected] = useState(false);
  const [postgresStats, setPostgresStats] = useState<HealthResponse['stats'] | null>(null);

  // 1. Ao carregar, tenta buscar os dados reais do backend (Postgres / disco)
  useEffect(() => {
    let cancelled = false;

    const loadFromBackend = async () => {
      const bootstrap = await apiService.getBootstrap();
      if (cancelled) return;

      if (bootstrap && !bootstrap.error) {
        if (bootstrap.stores?.length) setStores(bootstrap.stores);
        if (bootstrap.items) setItems(bootstrap.items);
        if (bootstrap.leads) setLeads(bootstrap.leads);
        if (bootstrap.settings) setPlatformSettings(bootstrap.settings);
        setIsPostgresConnected(!!bootstrap.connectedToPostgres);
      }

      const health = await apiService.checkHealth();
      if (cancelled) return;
      setIsPostgresConnected(health.connected);
      setPostgresStats(health.stats || null);
    };

    loadFromBackend();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Cacheia localmente sempre que os dados mudam (carregamento instantâneo na próxima visita)
  useEffect(() => {
    if (stores.length > 0) localStorage.setItem(LOCAL_STORAGE_STORES, JSON.stringify(stores));
  }, [stores]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_ITEMS, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_LEADS, JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS, JSON.stringify(platformSettings));
  }, [platformSettings]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_DELETED_ITEMS, JSON.stringify(deletedItemIds));
  }, [deletedItemIds]);

  // ---------------------------------------------------------------------
  // Navegação / Sessão
  // ---------------------------------------------------------------------
  const selectStore = (storeId: string) => setActiveStoreId(storeId);
  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const loginAsSuperAdmin = (name: string, email: string) => {
    setCurrentUser({ id: 'superadmin', name, email, role: 'superadmin' });
  };

  const loginAsStoreOwner = (storeId: string, name: string, email: string) => {
    const store = stores.find((s) => s.id === storeId);
    setCurrentUser({ id: storeId, name, email, role: 'lojista', storeId, storeName: store?.name });
    setActiveStoreId(storeId);
  };

  const logout = () => setCurrentUser(null);

  const refreshDatabaseStatus = async () => {
    const health = await apiService.checkHealth();
    setIsPostgresConnected(health.connected);
    setPostgresStats(health.stats || null);

    const bootstrap = await apiService.getBootstrap();
    if (bootstrap && !bootstrap.error) {
      if (bootstrap.stores?.length) setStores(bootstrap.stores);
      if (bootstrap.items) setItems(bootstrap.items);
      if (bootstrap.leads) setLeads(bootstrap.leads);
      if (bootstrap.settings) setPlatformSettings(bootstrap.settings);
    }
  };

  // ---------------------------------------------------------------------
  // Lojas
  // ---------------------------------------------------------------------
  const createStore: StoreContextType['createStore'] = async (storeData) => {
    const fullStore: StoreProfile = {
      ...storeData,
      id: generateUUID(),
      createdAt: new Date().toISOString(),
    };

    setStores((prev) => [...prev, fullStore]);

    try {
      const result = await apiService.saveStore(fullStore);
      const finalStore = result.store || fullStore;
      if (result.store) {
        setStores((prev) => prev.map((s) => (s.id === fullStore.id ? finalStore : s)));
      }
      return {
        success: result.success !== false,
        store: finalStore,
        postgresSaved: result.postgresSaved,
        dbError: result.dbError,
        emailResult: result.emailResult,
      };
    } catch (err: any) {
      return { success: true, store: fullStore, postgresSaved: false, dbError: err.message };
    }
  };

  const updateStore = (store: StoreProfile) => {
    setStores((prev) => prev.map((s) => (s.id === store.id ? store : s)));
    apiService.updateStore(store);
  };

  const deleteStore = (storeId: string) => {
    setStores((prev) => prev.filter((s) => s.id !== storeId));
    setItems((prev) => prev.filter((i) => i.storeId !== storeId));
    setLeads((prev) => prev.filter((l) => l.storeId !== storeId));
    if (activeStoreId === storeId) setActiveStoreId(null);
    apiService.deleteStore(storeId);
  };

  const updateStoreSubscription = (storeId: string, updatedStore: StoreProfile) => {
    setStores((prev) => prev.map((s) => (s.id === storeId ? updatedStore : s)));
    apiService.updateStore(updatedStore);
  };

  const markPaymentReceived = (storeId: string) => {
    setStores((prev) =>
      prev.map((s) => {
        if (s.id !== storeId) return s;
        const updated: StoreProfile = {
          ...s,
          lastPaymentDate: new Date().toISOString().split('T')[0],
          nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          subscriptionStatus: 'ativo',
        };
        apiService.updateStore(updated);
        return updated;
      })
    );
  };

  const toggleStorePublished = (storeId: string) => {
    setStores((prev) =>
      prev.map((s) => {
        if (s.id !== storeId) return s;
        const updated = { ...s, isPublished: !s.isPublished };
        apiService.updateStore(updated);
        return updated;
      })
    );
  };

  // ---------------------------------------------------------------------
  // Itens
  // ---------------------------------------------------------------------
  const addItem: StoreContextType['addItem'] = (itemData) => {
    if (!activeStoreId) return;
    const fullItem = {
      ...itemData,
      id: generateUUID(),
      storeId: activeStoreId,
      createdAt: new Date().toISOString(),
    } as StoreItem;

    setItems((prev) => [fullItem, ...prev]);
    apiService.saveItem(fullItem);
  };

  const updateItem = (item: StoreItem) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
    apiService.saveItem(item);
  };

  const deleteItem = (_storeId: string, itemId: string) => {
    setDeletedItemIds((prev) => [...prev, itemId]);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    apiService.deleteItem(itemId);
  };

  const toggleItemFeatured = (itemId: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const updated = { ...i, featured: !i.featured };
        apiService.saveItem(updated);
        return updated;
      })
    );
  };

  const updateItemStatus = (itemId: string, status: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const updated = { ...i, status } as StoreItem;
        apiService.saveItem(updated);
        return updated;
      })
    );
  };

  // ---------------------------------------------------------------------
  // Propostas / Leads
  // ---------------------------------------------------------------------
  const submitProposal: StoreContextType['submitProposal'] = (leadData) => {
    const newLead: ProposalLead = {
      ...leadData,
      id: generateUUID(),
      storeId: activeStoreId || '',
      createdAt: new Date().toISOString(),
      status: 'novo',
    };

    setLeads((prev) => [newLead, ...prev]);
    apiService.saveLead(newLead);
    return newLead;
  };

  const updateLeadStatus = (leadId: string, status: ProposalLead['status']) => {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));
    apiService.updateLeadStatus(leadId, status);
  };

  const deleteLead = (leadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    apiService.deleteLead(leadId);
  };

  // ---------------------------------------------------------------------
  // Configurações da Plataforma
  // ---------------------------------------------------------------------
  const updatePlatformSettings = (settings: SaaSPlatformSettings) => {
    setPlatformSettings(settings);
    apiService.saveSettings(settings);
  };

  // ---------------------------------------------------------------------
  // Backup / Manutenção
  // ---------------------------------------------------------------------
  const exportDataJSON = () => {
    return JSON.stringify({ stores, items, leads, platformSettings }, null, 2);
  };

  const importDataJSON = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || !Array.isArray(parsed.stores)) return false;
      setStores(parsed.stores);
      if (Array.isArray(parsed.items)) setItems(parsed.items);
      if (Array.isArray(parsed.leads)) setLeads(parsed.leads);
      if (parsed.platformSettings) setPlatformSettings(parsed.platformSettings);
      return true;
    } catch {
      return false;
    }
  };

  const resetToDefaults = () => {
    setStores(INITIAL_STORES);
    setItems(INITIAL_ITEMS);
    setLeads(INITIAL_LEADS);
    setPlatformSettings(DEFAULT_PLATFORM_SETTINGS);
    setDeletedItemIds([]);
    apiService.resetToDefaults();
  };

  const getDatabaseStats = (): DbStats => {
    const byType = (type: StoreItem['itemType']) => items.filter((i) => i.itemType === type);
    const leadsByType = (type: StoreItem['itemType']) => leads.filter((l) => l.itemType === type);
    const sizeOf = (data: unknown) => new Blob([JSON.stringify(data)]).size;

    return {
      usuariosDB: { storesCount: stores.length, sizeBytes: sizeOf(stores) },
      autoDB: {
        itemsCount: byType('veiculo').length,
        leadsCount: leadsByType('veiculo').length,
        sizeBytes: sizeOf(byType('veiculo')) + sizeOf(leadsByType('veiculo')),
      },
      imoveisDB: {
        itemsCount: byType('imovel').length,
        leadsCount: leadsByType('imovel').length,
        sizeBytes: sizeOf(byType('imovel')) + sizeOf(leadsByType('imovel')),
      },
      lojaDB: {
        itemsCount: byType('produto').length,
        leadsCount: leadsByType('produto').length,
        sizeBytes: sizeOf(byType('produto')) + sizeOf(leadsByType('produto')),
      },
      servicosDB: {
        itemsCount: byType('servico').length,
        leadsCount: leadsByType('servico').length,
        sizeBytes: sizeOf(byType('servico')) + sizeOf(leadsByType('servico')),
      },
    };
  };

  const exportDatabaseJSON = (dbName: 'all' | DbName): string => {
    if (dbName === 'all') {
      return JSON.stringify({ stores, items, leads, platformSettings }, null, 2);
    }
    if (dbName === 'usuariosDB') {
      return JSON.stringify({ stores }, null, 2);
    }
    const itemType = ITEM_TYPE_BY_DB[dbName];
    return JSON.stringify(
      {
        items: items.filter((i) => i.itemType === itemType),
        leads: leads.filter((l) => l.itemType === itemType),
      },
      null,
      2
    );
  };

  const resetDatabase = (dbName: DbName) => {
    if (dbName === 'usuariosDB') {
      setStores([]);
      return;
    }
    const itemType = ITEM_TYPE_BY_DB[dbName];
    setItems((prev) => prev.filter((i) => i.itemType !== itemType));
    setLeads((prev) => prev.filter((l) => l.itemType !== itemType));
  };

  // ---------------------------------------------------------------------
  // Derivados
  // ---------------------------------------------------------------------
  const activeStore = stores.find((s) => s.id === activeStoreId) || stores[0] || null;
  const currentStoreItems = activeStore
    ? items.filter((i) => i.storeId === activeStore.id && !deletedItemIds.includes(i.id))
    : [];
  const currentStoreLeads = activeStore ? leads.filter((l) => l.storeId === activeStore.id) : [];

  return (
    <StoreContext.Provider
      value={{
        stores,
        items,
        leads,
        plans,
        platformSettings,
        activeStore,
        currentStoreItems,
        currentStoreLeads,
        currentUser,
        theme,
        isPostgresConnected,
        postgresStats,
        refreshDatabaseStatus,
        selectStore,
        toggleTheme,
        loginAsSuperAdmin,
        loginAsStoreOwner,
        logout,
        createStore,
        updateStore,
        deleteStore,
        updateStoreSubscription,
        markPaymentReceived,
        toggleStorePublished,
        addItem,
        updateItem,
        deleteItem,
        toggleItemFeatured,
        updateItemStatus,
        submitProposal,
        updateLeadStatus,
        deleteLead,
        updatePlatformSettings,
        exportDataJSON,
        importDataJSON,
        resetToDefaults,
        getDatabaseStats,
        exportDatabaseJSON,
        resetDatabase,
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
