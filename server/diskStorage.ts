import fs from 'fs';
import path from 'path';
import { INITIAL_STORES, INITIAL_ITEMS, INITIAL_LEADS, DEFAULT_PLATFORM_SETTINGS } from '../src/data/demoStores.js';
import { StoreProfile, StoreItem, ProposalLead, SaaSPlatformSettings } from '../src/types/store.js';

// Diretório de armazenamento persistente em disco (tolerante a reinicializações de PM2 e quedas de banco)
const DATA_DIR = path.join(process.cwd(), 'database_storage');

const STORES_FILE = path.join(DATA_DIR, 'stores.json');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Garantir que a pasta database_storage exista
function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('[DiskStorage] Erro ao criar diretório de dados:', err);
  }
}

// Leitura segura com fallback
function readJsonFile<T>(filePath: string, defaultValue: T): T {
  ensureDataDir();
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content && content.trim().length > 0) {
        return JSON.parse(content);
      }
    }
  } catch (err) {
    console.warn(`[DiskStorage] Erro ao ler ${filePath}, usando valor padrão:`, err);
  }
  return defaultValue;
}

// Escrita atômica e segura em disco
function writeJsonFile<T>(filePath: string, data: T): boolean {
  ensureDataDir();
  try {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (err) {
    console.error(`[DiskStorage] Erro ao salvar dados em ${filePath}:`, err);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (e) {
      console.error(`[DiskStorage] Falha crítica de escrita em ${filePath}:`, e);
      return false;
    }
  }
}

export const diskStorage = {
  // Lojas
  getStores(): StoreProfile[] {
    const stores = readJsonFile<StoreProfile[]>(STORES_FILE, [...INITIAL_STORES]);
    if (!fs.existsSync(STORES_FILE)) {
      writeJsonFile(STORES_FILE, stores);
    }
    return stores;
  },

  saveStores(stores: StoreProfile[]): boolean {
    return writeJsonFile(STORES_FILE, stores);
  },

  saveStore(store: StoreProfile): StoreProfile[] {
    const stores = this.getStores();
    const existingIndex = stores.findIndex((s) => s.id === store.id);
    let updatedStores: StoreProfile[];
    if (existingIndex >= 0) {
      updatedStores = [...stores];
      updatedStores[existingIndex] = { ...updatedStores[existingIndex], ...store };
    } else {
      updatedStores = [store, ...stores];
    }
    this.saveStores(updatedStores);
    return updatedStores;
  },

  deleteStore(storeId: string): StoreProfile[] {
    const stores = this.getStores();
    const filtered = stores.filter((s) => s.id !== storeId);
    this.saveStores(filtered);
    
    // Também remove itens e leads dessa loja
    const items = this.getItems().filter((i) => i.storeId !== storeId);
    this.saveItems(items);
    const leads = this.getLeads().filter((l) => l.storeId !== storeId);
    this.saveLeads(leads);

    return filtered;
  },

  // Itens (Veículos, Imóveis, Produtos, Serviços)
  getItems(): StoreItem[] {
    const items = readJsonFile<StoreItem[]>(ITEMS_FILE, [...INITIAL_ITEMS]);
    if (!fs.existsSync(ITEMS_FILE)) {
      writeJsonFile(ITEMS_FILE, items);
    }
    return items;
  },

  saveItems(items: StoreItem[]): boolean {
    return writeJsonFile(ITEMS_FILE, items);
  },

  saveItem(item: StoreItem): StoreItem[] {
    const items = this.getItems();
    const existingIndex = items.findIndex((i) => i.id === item.id);
    let updatedItems: StoreItem[];
    if (existingIndex >= 0) {
      updatedItems = [...items];
      updatedItems[existingIndex] = { ...updatedItems[existingIndex], ...item };
    } else {
      updatedItems = [item, ...items];
    }
    this.saveItems(updatedItems);
    return updatedItems;
  },

  deleteItem(itemId: string): StoreItem[] {
    const items = this.getItems();
    const filtered = items.filter((i) => i.id !== itemId);
    this.saveItems(filtered);
    return filtered;
  },

  // Leads e Propostas
  getLeads(): ProposalLead[] {
    const leads = readJsonFile<ProposalLead[]>(LEADS_FILE, [...INITIAL_LEADS]);
    if (!fs.existsSync(LEADS_FILE)) {
      writeJsonFile(LEADS_FILE, leads);
    }
    return leads;
  },

  saveLeads(leads: ProposalLead[]): boolean {
    return writeJsonFile(LEADS_FILE, leads);
  },

  saveLead(lead: ProposalLead): ProposalLead[] {
    const leads = this.getLeads();
    const existingIndex = leads.findIndex((l) => l.id === lead.id);
    let updatedLeads: ProposalLead[];
    if (existingIndex >= 0) {
      updatedLeads = [...leads];
      updatedLeads[existingIndex] = { ...updatedLeads[existingIndex], ...lead };
    } else {
      updatedLeads = [lead, ...leads];
    }
    this.saveLeads(updatedLeads);
    return updatedLeads;
  },

  updateLeadStatus(leadId: string, status: ProposalLead['status']): ProposalLead[] {
    const leads = this.getLeads();
    const updated = leads.map((l) => (l.id === leadId ? { ...l, status } : l));
    this.saveLeads(updated);
    return updated;
  },

  deleteLead(leadId: string): ProposalLead[] {
    const leads = this.getLeads();
    const filtered = leads.filter((l) => l.id !== leadId);
    this.saveLeads(filtered);
    return filtered;
  },

  // Configurações do SaaS Master
  getSettings(): SaaSPlatformSettings {
    const settings = readJsonFile<SaaSPlatformSettings>(SETTINGS_FILE, { ...DEFAULT_PLATFORM_SETTINGS });
    if (!fs.existsSync(SETTINGS_FILE)) {
      writeJsonFile(SETTINGS_FILE, settings);
    }
    return settings;
  },

  saveSettings(settings: SaaSPlatformSettings): boolean {
    return writeJsonFile(SETTINGS_FILE, settings);
  },

  // Resetar tudo para os dados padrão
  resetToDefaults() {
    this.saveStores([...INITIAL_STORES]);
    this.saveItems([...INITIAL_ITEMS]);
    this.saveLeads([...INITIAL_LEADS]);
    this.saveSettings({ ...DEFAULT_PLATFORM_SETTINGS });
  }
};
