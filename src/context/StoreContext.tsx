import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { StoreProfile, StoreItem, ProposalLead, StoreType, SaaSPlanConfig, SaaSPlatformSettings, CurrentUser } from '../types/store';
import { INITIAL_STORES, INITIAL_ITEMS, INITIAL_LEADS, DEFAULT_SAAS_PLANS, DEFAULT_PLATFORM_SETTINGS } from '../data/demoStores';
import { usuariosDB } from '../db/usuariosDB';
import { autoDB } from '../db/autoDB';
import { imoveisDB } from '../db/imoveisDB';
import { lojaDB } from '../db/lojaDB';
import { servicosDB } from '../db/servicosDB';
import { databaseManager, DatabaseStats } from '../db/databaseManager';
import { apiService, HealthResponse } from '../services/apiService';
import { generateUUID } from '../utils/uuid';

interface StoreContextType {
  stores: StoreProfile[];
  activeStore: StoreProfile;
  items: StoreItem[];
  currentStoreItems: StoreItem[];
  leads: ProposalLead[];
  currentStoreLeads: ProposalLead[];
  plans: SaaSPlanConfig[];
  platformSettings: SaaSPlatformSettings;

  // Usuário Autenticado
  currentUser: CurrentUser | null;
  loginAsSuperAdmin: (name?: string, email?: string) => void;
  loginAsStoreOwner: (storeId: string, name?: string, email?: string) => void;
  logout: () => void;
  
  // Status do PostgreSQL
  isPostgresConnected: boolean;
  postgresStats: HealthResponse['stats'] | null;
  refreshDatabaseStatus: () => Promise<void>;

  // Ações de Loja
  selectStore: (storeId: string) => void;
  createStore: (storeData: Omit<StoreProfile, 'id' | 'createdAt'>) => Promise<{
    storeId: string;
    store: StoreProfile;
    postgresSaved?: boolean;
    dbError?: string;
    emailResult?: { success: boolean; message: string; simulated?: boolean };
  }>;
  updateStore: (storeData: StoreProfile) => void;
  deleteStore: (storeId: string) => void;
  resetToDefaults: () => void;

  // Tema do Sistema (Escuro / Claro)
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;

  // Ações de Gestão SaaS do Painel Master
  updateStoreSubscription: (storeId: string, data: Partial<StoreProfile>) => void;
  markPaymentReceived: (storeId: string, daysToAdd?: number) => void;
  toggleStorePublished: (storeId: string) => void;
  updatePlatformSettings: (settings: Partial<SaaSPlatformSettings>) => void;

  // Ações de Itens
  addItem: (itemData: Omit<StoreItem, 'id' | 'storeId' | 'createdAt'>) => void;
  updateItem: (item: StoreItem) => void;
  deleteItem: (itemId: string) => void;
  toggleItemFeatured: (itemId: string) => void;
  updateItemStatus: (itemId: string, status: any) => void;

  // Ações de Propostas & Leads
  submitProposal: (proposalData: Omit<ProposalLead, 'id' | 'storeId' | 'createdAt' | 'status'>) => ProposalLead;
  updateLeadStatus: (leadId: string, status: ProposalLead['status']) => void;
  deleteLead: (leadId: string) => void;

  // Gestão dos Bancos de Dados Segregados (usuariosDB, autoDB, imoveisDB, lojaDB, servicosDB)
  getDatabaseStats: () => DatabaseStats;
  exportDatabaseJSON: (dbName?: 'all' | 'usuariosDB' | 'autoDB' | 'imoveisDB' | 'lojaDB' | 'servicosDB') => string;
  resetDatabase: (dbName?: 'all' | 'usuariosDB' | 'autoDB' | 'imoveisDB' | 'lojaDB' | 'servicosDB') => void;

  // Import / Export Backup
  exportDataJSON: () => string;
  importDataJSON: (jsonString: string) => boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const STORAGE_KEY_ACTIVE_STORE = '3facil_active_store_id_v5';
const STORAGE_KEY_CURRENT_USER = '3facil_current_user_v1';

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Estado das Lojas
  const [stores, setStores] = useState<StoreProfile[]>(() => {
    return usuariosDB.getStores();
  });

  // 2. Configurações da Plataforma Master
  const [platformSettings, setPlatformSettings] = useState<SaaSPlatformSettings>(() => {
    return usuariosDB.getSettings();
  });

  // 3. Status da Conexão Real com PostgreSQL
  const [isPostgresConnected, setIsPostgresConnected] = useState<boolean>(false);
  const [postgresStats, setPostgresStats] = useState<HealthResponse['stats'] | null>(null);

  // Usuário Autenticado no Sistema (Padrão: null / Deslogado)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && (parsed.role === 'superadmin' || parsed.role === 'lojista')) {
          return parsed;
        }
      }
    } catch (e) {}
    return null;
  });

  const loginAsSuperAdmin = (name = 'Wilson Lima (Admin)', email = 'wilsonlimamn@gmail.com') => {
    const user: CurrentUser = {
      id: 'admin-master',
      name,
      email,
      role: 'superadmin',
    };
    setCurrentUser(user);
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
    } catch (e) {}
  };

  const loginAsStoreOwner = (storeId: string, name?: string, email?: string) => {
    const st = stores.find((s) => s.id === storeId) || activeStore;
    const user: CurrentUser = {
      id: `owner-${st.id}`,
      name: name || st.ownerName || st.name,
      email: email || st.email,
      role: 'lojista',
      storeId: st.id,
      storeName: st.name,
    };
    setCurrentUser(user);
    setActiveStoreId(st.id);
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
    } catch (e) {}
  };

  const logout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    } catch (e) {}
  };

  // Tema: 'dark' (Escuro) ou 'light' (Claro)
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    try {
      const savedTheme = localStorage.getItem('3facil_theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
    } catch (e) {}
    return 'dark';
  });

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme: 'dark' | 'light') => {
    setThemeState(newTheme);
  };

  // Efeito para sincronizar classe no elemento raiz HTML
  useEffect(() => {
    try {
      localStorage.setItem('3facil_theme', theme);
      const root = document.documentElement;
      if (theme === 'light') {
        root.classList.remove('dark');
        root.classList.add('light');
        document.body.style.backgroundColor = '#f8fafc';
        document.body.style.color = '#0f172a';
      } else {
        root.classList.remove('light');
        root.classList.add('dark');
        document.body.style.backgroundColor = '#020617';
        document.body.style.color = '#f8fafc';
      }
    } catch (e) {}
  }, [theme]);

  // 4. Planos do SaaS
  const [plans] = useState<SaaSPlanConfig[]>(DEFAULT_SAAS_PLANS);

  // 5. ID da Loja Ativa
  const [activeStoreId, setActiveStoreId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_KEY_ACTIVE_STORE);
      if (savedId && stores.some((s) => s.id === savedId)) return savedId;
    } catch (e) {}
    return stores[0]?.id || INITIAL_STORES[0].id;
  });

  // 6. Itens
  const [items, setItems] = useState<StoreItem[]>(() => {
    return databaseManager.getAllItems();
  });

  // 7. Propostas e Leads
  const [leads, setLeads] = useState<ProposalLead[]>(() => {
    return databaseManager.getAllLeads();
  });

  // Função para verificar status do PostgreSQL e sincronizar dados
  const refreshDatabaseStatus = useCallback(async () => {
    try {
      const health = await apiService.checkHealth();
      setIsPostgresConnected(health.connected);
      if (health.stats) {
        setPostgresStats(health.stats);
      }

      // Buscar dados atualizados do banco PostgreSQL
      const bootstrap = await apiService.getBootstrap();
      if (bootstrap) {
        if (bootstrap.stores && bootstrap.stores.length > 0) {
          setStores(bootstrap.stores);
          usuariosDB.saveStores(bootstrap.stores);
        }
        if (bootstrap.items && bootstrap.items.length > 0) {
          setItems(bootstrap.items);
          databaseManager.saveAllItems(bootstrap.items);
        }
        if (bootstrap.leads && bootstrap.leads.length > 0) {
          setLeads(bootstrap.leads);
          databaseManager.saveAllLeads(bootstrap.leads);
        }
        if (bootstrap.settings) {
          setPlatformSettings(bootstrap.settings);
          usuariosDB.saveSettings(bootstrap.settings);
        }
        setIsPostgresConnected(bootstrap.connectedToPostgres);
      }
    } catch (e) {
      console.warn('[StoreContext] Erro ao sincronizar com backend PostgreSQL:', e);
    }
  }, []);

  // Inicialização na montagem do componente
  useEffect(() => {
    refreshDatabaseStatus();
  }, [refreshDatabaseStatus]);

  // Sincronizar com os bancos de dados modulares locais como cache
  useEffect(() => {
    usuariosDB.saveStores(stores);
  }, [stores]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_STORE, activeStoreId);
    } catch (e) {}
  }, [activeStoreId]);

  useEffect(() => {
    databaseManager.saveAllItems(items);
  }, [items]);

  useEffect(() => {
    databaseManager.saveAllLeads(leads);
  }, [leads]);

  useEffect(() => {
    usuariosDB.saveSettings(platformSettings);
  }, [platformSettings]);

  // Loja ativa atual garantida
  const activeStore = stores.find((s) => s.id === activeStoreId) || stores[0] || INITIAL_STORES[0];

  // Itens da loja ativa
  const currentStoreItems = items.filter((item) => item.storeId === activeStore.id);

  // Leads da loja ativa
  const currentStoreLeads = leads.filter((lead) => lead.storeId === activeStore.id);

  // Selecionar Loja
  const selectStore = (storeId: string) => {
    const found = stores.find((s) => s.id === storeId);
    if (found) {
      setActiveStoreId(storeId);
    }
  };

  // Criar Nova Loja (Persiste no schema usuarios.lojas do PostgreSQL e cria itens iniciais de demonstração)
  const createStore = async (storeData: Omit<StoreProfile, 'id' | 'createdAt'>) => {
    const newId = generateUUID();
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    const formattedDue = nextMonth.toISOString().split('T')[0];

    const newStore: StoreProfile = {
      ...storeData,
      id: newId,
      createdAt: new Date().toISOString(),
      ownerName: storeData.ownerName || 'Novo Cliente',
      ownerEmail: storeData.ownerEmail || storeData.email,
      ownerPhone: storeData.ownerPhone || storeData.whatsapp,
      plan: storeData.plan || 'pro',
      planName: storeData.planName || 'Plano Profissional',
      monthlyFee: storeData.monthlyFee !== undefined ? storeData.monthlyFee : 30.00,
      subscriptionStatus: storeData.subscriptionStatus || 'ativo',
      nextDueDate: storeData.nextDueDate || formattedDue,
      isPublished: storeData.isPublished !== undefined ? storeData.isPublished : true,
    };

    // Criar um item de vitrine inicial de exemplo conforme o tipo da loja
    let sampleItem: StoreItem | null = null;
    const nowIso = new Date().toISOString();
    if (newStore.type === 'veiculo') {
      sampleItem = {
        id: generateUUID(),
        storeId: newId,
        itemType: 'veiculo',
        title: 'Exemplo: Veículo em Destaque 1.0 Flex',
        brand: 'Marca Modelo',
        model: 'Comfortline',
        yearFab: 2023,
        yearModel: 2024,
        price: 78900.00,
        mileage: 18500,
        fuel: 'flex',
        transmission: 'automatico',
        color: 'Prata Metálico',
        accessories: ['Ar Condicionado', 'Direção Elétrica', 'Vidros Elétricos', 'Airbag', 'Freios ABS', 'Sensor de Ré'],
        description: 'Veículo em excelente estado de conservação, único dono, revisado e com garantia.',
        images: ['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200&auto=format&fit=crop&q=80'],
        featured: true,
        status: 'disponivel',
        createdAt: nowIso
      };
    } else if (newStore.type === 'imovel') {
      sampleItem = {
        id: generateUUID(),
        storeId: newId,
        itemType: 'imovel',
        title: 'Exemplo: Apartamento Alto Padrão 3 Suítes',
        propertyType: 'apartamento',
        transactionType: 'venda',
        areaUtil: 112,
        areaTotal: 145,
        bedrooms: 3,
        suites: 3,
        bathrooms: 4,
        garageSpots: 2,
        neighborhood: 'Bairro Nobre',
        city: newStore.city || 'São Paulo',
        state: newStore.state || 'SP',
        amenities: ['Piscina', 'Churrasqueira', 'Varanda Gourmet', 'Elevador', 'Academia'],
        price: 650000.00,
        description: 'Imóvel com vista panorâmica, varanda gourmet e condomínio completo com piscina e academia.',
        images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&auto=format&fit=crop&q=80'],
        featured: true,
        status: 'disponivel',
        createdAt: nowIso
      };
    } else if (newStore.type === 'produto') {
      sampleItem = {
        id: generateUUID(),
        storeId: newId,
        itemType: 'produto',
        title: 'Exemplo: Produto Destaque da Loja',
        category: 'Geral',
        sku: 'PROD-001',
        stockQuantity: 15,
        inStock: true,
        condition: 'novo',
        price: 199.90,
        description: 'Produto de alta qualidade com garantia de satisfação e envio imediato.',
        images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&auto=format&fit=crop&q=80'],
        featured: true,
        status: 'ativo',
        createdAt: nowIso
      };
    } else {
      sampleItem = {
        id: generateUUID(),
        storeId: newId,
        itemType: 'servico',
        title: 'Exemplo: Consultoria e Projeto Especializado',
        category: 'Consultoria',
        priceType: 'a_partir_de',
        estimatedDuration: '2 a 5 dias úteis',
        includedItems: ['Diagnóstico completo', 'Escopo detalhado', 'Suporte'],
        price: 450.00,
        description: 'Serviço profissional sob medida para sua necessidade com equipe qualificada.',
        images: ['https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&auto=format&fit=crop&q=80'],
        featured: true,
        status: 'ativo',
        createdAt: nowIso
      };
    }

    // Salvar localmente
    setStores((prev) => [newStore, ...prev]);
    usuariosDB.saveStores([newStore, ...stores]);
    setActiveStoreId(newId);

    if (sampleItem) {
      setItems((prev) => [sampleItem!, ...prev]);
      databaseManager.saveItem(sampleItem);
      apiService.saveItem(sampleItem);
    }

    // Persistência no PostgreSQL e disparo de e-mail de boas-vindas
    const apiRes = await apiService.saveStore(newStore);
    
    // Atualiza contadores e status
    refreshDatabaseStatus();

    return {
      storeId: newId,
      store: newStore,
      postgresSaved: apiRes.postgresSaved,
      dbError: apiRes.dbError,
      emailResult: apiRes.emailResult
    };
  };

  // Atualizar Loja
  const updateStore = (storeData: StoreProfile) => {
    setStores((prev) => prev.map((s) => (s.id === storeData.id ? storeData : s)));
    apiService.updateStore(storeData);
  };

  // Ações de Gestão SaaS do Super Admin
  const updateStoreSubscription = (storeId: string, data: Partial<StoreProfile>) => {
    setStores((prev) =>
      prev.map((s) => {
        if (s.id === storeId) {
          const updated = { ...s, ...data };
          apiService.updateStore(updated);
          return updated;
        }
        return s;
      })
    );
  };

  const markPaymentReceived = (storeId: string, daysToAdd = 30) => {
    setStores((prev) =>
      prev.map((s) => {
        if (s.id !== storeId) return s;
        const currentDue = s.nextDueDate ? new Date(s.nextDueDate) : new Date();
        const baseDate = isNaN(currentDue.getTime()) || currentDue < new Date() ? new Date() : currentDue;
        baseDate.setDate(baseDate.getDate() + daysToAdd);
        const newDue = baseDate.toISOString().split('T')[0];
        const updated: StoreProfile = {
          ...s,
          subscriptionStatus: 'ativo',
          lastPaymentDate: new Date().toISOString().split('T')[0],
          nextDueDate: newDue,
        };
        apiService.updateStore(updated);
        return updated;
      })
    );
  };

  const toggleStorePublished = (storeId: string) => {
    setStores((prev) =>
      prev.map((s) => {
        if (s.id === storeId) {
          const updated = { ...s, isPublished: !s.isPublished };
          apiService.updateStore(updated);
          return updated;
        }
        return s;
      })
    );
  };

  const updatePlatformSettings = (settings: Partial<SaaSPlatformSettings>) => {
    const updated = { ...platformSettings, ...settings };
    setPlatformSettings(updated);
    apiService.saveSettings(updated);
  };

  // Deletar Loja (Persiste no schema usuarios.lojas com CASCADE)
  const deleteStore = (storeId: string) => {
    if (stores.length <= 1) {
      alert('Não é possível excluir a única loja existente.');
      return;
    }
    setStores((prev) => prev.filter((s) => s.id !== storeId));
    setItems((prev) => prev.filter((i) => i.storeId !== storeId));
    setLeads((prev) => prev.filter((l) => l.storeId !== storeId));
    
    if (activeStoreId === storeId) {
      const remaining = stores.filter((s) => s.id !== storeId);
      if (remaining.length > 0) {
        setActiveStoreId(remaining[0].id);
      }
    }

    apiService.deleteStore(storeId).then(() => {
      refreshDatabaseStatus();
    });
  };

  // Resetar aos Padrões
  const resetToDefaults = () => {
    databaseManager.resetAllDatabases();
    setStores(usuariosDB.getStores());
    setItems(databaseManager.getAllItems());
    setLeads(databaseManager.getAllLeads());
    setPlatformSettings(usuariosDB.getSettings());
    setActiveStoreId(INITIAL_STORES[0].id);
    
    apiService.resetToDefaults().then(() => {
      refreshDatabaseStatus();
    });
  };

  // Adicionar Item (Persiste no schema correspondente: autos.estoque, imoveis.catalogo, loja.produtos, servicos.catalogo)
  const addItem = (itemData: Omit<StoreItem, 'id' | 'storeId' | 'createdAt'>) => {
    const newItem = {
      ...itemData,
      id: generateUUID(),
      storeId: activeStore.id,
      createdAt: new Date().toISOString(),
    } as StoreItem;

    setItems((prev) => [newItem, ...prev]);

    apiService.saveItem(newItem).then(() => {
      refreshDatabaseStatus();
    });
  };

  // Atualizar Item
  const updateItem = (updatedItem: StoreItem) => {
    setItems((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
    apiService.saveItem(updatedItem);
  };

  // Deletar Item
  const deleteItem = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    apiService.deleteItem(itemId).then(() => {
      refreshDatabaseStatus();
    });
  };

  // Destacar Item
  const toggleItemFeatured = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const updated = { ...item, featured: !item.featured };
          apiService.saveItem(updated);
          return updated;
        }
        return item;
      })
    );
  };

  // Atualizar Status do Item
  const updateItemStatus = (itemId: string, status: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const updated = { ...item, status };
          apiService.saveItem(updated);
          return updated;
        }
        return item;
      })
    );
  };

  // Enviar Proposta / Lead (Salva em autos.propostas, imoveis.propostas, loja.pedidos, servicos.orcamentos)
  const submitProposal = (
    proposalData: Omit<ProposalLead, 'id' | 'storeId' | 'createdAt' | 'status'>
  ): ProposalLead => {
    const newLead: ProposalLead = {
      ...proposalData,
      id: generateUUID(),
      storeId: activeStore.id,
      createdAt: new Date().toISOString(),
      status: 'novo',
    };

    setLeads((prev) => [newLead, ...prev]);
    apiService.saveLead(newLead).then(() => {
      refreshDatabaseStatus();
    });

    return newLead;
  };

  // Atualizar Status do Lead
  const updateLeadStatus = (leadId: string, status: ProposalLead['status']) => {
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id === leadId) {
          const updated = { ...lead, status };
          apiService.updateLeadStatus(leadId, status);
          return updated;
        }
        return lead;
      })
    );
  };

  // Deletar Lead
  const deleteLead = (leadId: string) => {
    setLeads((prev) => prev.filter((lead) => lead.id !== leadId));
    apiService.deleteLead(leadId).then(() => {
      refreshDatabaseStatus();
    });
  };

  // Métodos de Gestão de Bancos de Dados Segregados
  const getDatabaseStats = (): DatabaseStats => {
    return databaseManager.getStats();
  };

  const exportDatabaseJSON = (dbName: 'all' | 'usuariosDB' | 'autoDB' | 'imoveisDB' | 'lojaDB' | 'servicosDB' = 'all'): string => {
    if (dbName === 'all') {
      return JSON.stringify(databaseManager.exportFullCluster(), null, 2);
    }
    return JSON.stringify(databaseManager.exportSingleDatabase(dbName), null, 2);
  };

  const resetDatabase = (dbName: 'all' | 'usuariosDB' | 'autoDB' | 'imoveisDB' | 'lojaDB' | 'servicosDB' = 'all') => {
    if (dbName === 'all') {
      resetToDefaults();
    } else {
      databaseManager.resetSingleDatabase(dbName);
      setStores(usuariosDB.getStores());
      setItems(databaseManager.getAllItems());
      setLeads(databaseManager.getAllLeads());
      setPlatformSettings(usuariosDB.getSettings());
    }
  };

  // Exportar Backup Geral
  const exportDataJSON = () => {
    return JSON.stringify(databaseManager.exportFullCluster(), null, 2);
  };

  // Importar Backup JSON
  const importDataJSON = (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.cluster) {
        if (parsed.cluster.usuariosDB?.stores) {
          setStores(parsed.cluster.usuariosDB.stores);
          parsed.cluster.usuariosDB.stores.forEach((s: StoreProfile) => apiService.saveStore(s));
        }
        if (parsed.cluster.usuariosDB?.settings) {
          setPlatformSettings(parsed.cluster.usuariosDB.settings);
          apiService.saveSettings(parsed.cluster.usuariosDB.settings);
        }
        const importedItems = [
          ...(parsed.cluster.autoDB?.items || []),
          ...(parsed.cluster.imoveisDB?.items || []),
          ...(parsed.cluster.lojaDB?.items || []),
          ...(parsed.cluster.servicosDB?.items || []),
        ];
        if (importedItems.length > 0) {
          setItems(importedItems);
          importedItems.forEach((i: StoreItem) => apiService.saveItem(i));
        }
        const importedLeads = [
          ...(parsed.cluster.autoDB?.leads || []),
          ...(parsed.cluster.imoveisDB?.leads || []),
          ...(parsed.cluster.lojaDB?.leads || []),
          ...(parsed.cluster.servicosDB?.leads || []),
        ];
        if (importedLeads.length > 0) {
          setLeads(importedLeads);
          importedLeads.forEach((l: ProposalLead) => apiService.saveLead(l));
        }
        return true;
      }

      if (parsed.platformSettings) {
        setPlatformSettings(parsed.platformSettings);
        apiService.saveSettings(parsed.platformSettings);
      }
      if (parsed.stores && Array.isArray(parsed.stores)) {
        setStores(parsed.stores);
        parsed.stores.forEach((s: StoreProfile) => apiService.saveStore(s));
      }
      if (parsed.items && Array.isArray(parsed.items)) {
        setItems(parsed.items);
        parsed.items.forEach((i: StoreItem) => apiService.saveItem(i));
      }
      if (parsed.leads && Array.isArray(parsed.leads)) {
        setLeads(parsed.leads);
        parsed.leads.forEach((l: ProposalLead) => apiService.saveLead(l));
      }
      if (parsed.stores?.[0]?.id) setActiveStoreId(parsed.stores[0].id);
      return true;
    } catch (e) {
      console.error('Falha ao importar JSON', e);
      return false;
    }
  };

  return (
    <StoreContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        currentUser,
        loginAsSuperAdmin,
        loginAsStoreOwner,
        logout,
        stores,
        activeStore,
        items,
        currentStoreItems,
        leads,
        currentStoreLeads,
        plans,
        platformSettings,
        isPostgresConnected,
        postgresStats,
        refreshDatabaseStatus,
        selectStore,
        createStore,
        updateStore,
        deleteStore,
        resetToDefaults,
        updateStoreSubscription,
        markPaymentReceived,
        toggleStorePublished,
        updatePlatformSettings,
        addItem,
        updateItem,
        deleteItem,
        toggleItemFeatured,
        updateItemStatus,
        submitProposal,
        updateLeadStatus,
        deleteLead,
        getDatabaseStats,
        exportDatabaseJSON,
        resetDatabase,
        exportDataJSON,
        importDataJSON,
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
