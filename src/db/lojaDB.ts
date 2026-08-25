import { ProductItem, ProposalLead } from '../types/store';
import { INITIAL_ITEMS, INITIAL_LEADS } from '../data/demoStores';

const STORAGE_KEY_ITEMS = '3facil_lojaDB_items_v5';
const STORAGE_KEY_LEADS = '3facil_lojaDB_leads_v5';

export const lojaDB = {
  getItems(): ProductItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_ITEMS);
      if (data === null) {
        const initialProducts = INITIAL_ITEMS.filter((i): i is ProductItem => i.itemType === 'produto');
        this.saveItems(initialProducts);
        return initialProducts;
      }
      const parsed: ProductItem[] = JSON.parse(data);
      return parsed.filter((i) => i.itemType === 'produto');
    } catch {
      return [];
    }
  },

  saveItems(items: ProductItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    } catch (e) {
      console.error('Erro ao persistir lojaDB (items):', e);
    }
  },

  saveItem(item: ProductItem): void {
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
        const initialLeads = INITIAL_LEADS.filter((l) => l.itemType === 'produto');
        this.saveLeads(initialLeads);
        return initialLeads;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_LEADS.filter((l) => l.itemType === 'produto');
    }
  },

  saveLeads(leads: ProposalLead[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
    } catch (e) {
      console.error('Erro ao persistir lojaDB (leads):', e);
    }
  },

  exportDatabase(): { database: string; items: ProductItem[]; leads: ProposalLead[]; exportedAt: string } {
    return {
      database: 'lojaDB',
      items: this.getItems(),
      leads: this.getLeads(),
      exportedAt: new Date().toISOString(),
    };
  },

  reset(): void {
    const initialProducts = INITIAL_ITEMS.filter((i): i is ProductItem => i.itemType === 'produto');
    const initialLeads = INITIAL_LEADS.filter((l) => l.itemType === 'produto');
    this.saveItems(initialProducts);
    this.saveLeads(initialLeads);
  }
};
