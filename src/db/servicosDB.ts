import { ServiceItem, ProposalLead } from '../types/store';
import { INITIAL_ITEMS, INITIAL_LEADS } from '../data/demoStores';

const STORAGE_KEY_ITEMS = '3facil_servicosDB_items_v5';
const STORAGE_KEY_LEADS = '3facil_servicosDB_leads_v5';

export const servicosDB = {
  getItems(): ServiceItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_ITEMS);
      if (!data) {
        const initialServices = INITIAL_ITEMS.filter((i): i is ServiceItem => i.itemType === 'servico');
        this.saveItems(initialServices);
        return initialServices;
      }
      const parsed: ServiceItem[] = JSON.parse(data);
      return parsed.filter((i) => i.itemType === 'servico');
    } catch {
      return INITIAL_ITEMS.filter((i): i is ServiceItem => i.itemType === 'servico');
    }
  },

  saveItems(items: ServiceItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    } catch (e) {
      console.error('Erro ao persistir servicosDB (items):', e);
    }
  },

  saveItem(item: ServiceItem): void {
    const items = this.getItems();
    const index = items.findIndex((i) => i.id === item.id);
    const updated = index >= 0 ? items.map((i) => (i.id === item.id ? item : i)) : [item, ...items];
    this.saveItems(updated);
  },

  deleteItem(itemId: string): void {
    const items = this.getItems();
    this.saveItems(items.filter((i) => i.id !== itemId));
  },

  getLeads(): ProposalLead[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_LEADS);
      if (!data) {
        const initialLeads = INITIAL_LEADS.filter((l) => l.itemType === 'servico');
        this.saveLeads(initialLeads);
        return initialLeads;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_LEADS.filter((l) => l.itemType === 'servico');
    }
  },

  saveLeads(leads: ProposalLead[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
    } catch (e) {
      console.error('Erro ao persistir servicosDB (leads):', e);
    }
  },

  exportDatabase(): { database: string; items: ServiceItem[]; leads: ProposalLead[]; exportedAt: string } {
    return {
      database: 'servicosDB',
      items: this.getItems(),
      leads: this.getLeads(),
      exportedAt: new Date().toISOString(),
    };
  },

  reset(): void {
    const initialServices = INITIAL_ITEMS.filter((i): i is ServiceItem => i.itemType === 'servico');
    const initialLeads = INITIAL_LEADS.filter((l) => l.itemType === 'servico');
    this.saveItems(initialServices);
    this.saveLeads(initialLeads);
  }
};
