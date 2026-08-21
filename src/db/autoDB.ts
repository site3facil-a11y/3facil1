import { VehicleItem, ProposalLead } from '../types/store';
import { INITIAL_ITEMS, INITIAL_LEADS } from '../data/demoStores';

const STORAGE_KEY_ITEMS = '3facil_autoDB_items_v5';
const STORAGE_KEY_LEADS = '3facil_autoDB_leads_v5';

export const autoDB = {
  getItems(): VehicleItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_ITEMS);
      if (!data) {
        const initialVehicles = INITIAL_ITEMS.filter((i): i is VehicleItem => i.itemType === 'veiculo');
        this.saveItems(initialVehicles);
        return initialVehicles;
      }
      const parsed: VehicleItem[] = JSON.parse(data);
      return parsed.filter((i) => i.itemType === 'veiculo');
    } catch {
      return INITIAL_ITEMS.filter((i): i is VehicleItem => i.itemType === 'veiculo');
    }
  },

  saveItems(items: VehicleItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    } catch (e) {
      console.error('Erro ao persistir autoDB (items):', e);
    }
  },

  saveItem(item: VehicleItem): void {
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
        const initialLeads = INITIAL_LEADS.filter((l) => l.itemType === 'veiculo');
        this.saveLeads(initialLeads);
        return initialLeads;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_LEADS.filter((l) => l.itemType === 'veiculo');
    }
  },

  saveLeads(leads: ProposalLead[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
    } catch (e) {
      console.error('Erro ao persistir autoDB (leads):', e);
    }
  },

  exportDatabase(): { database: string; items: VehicleItem[]; leads: ProposalLead[]; exportedAt: string } {
    return {
      database: 'autoDB',
      items: this.getItems(),
      leads: this.getLeads(),
      exportedAt: new Date().toISOString(),
    };
  },

  reset(): void {
    const initialVehicles = INITIAL_ITEMS.filter((i): i is VehicleItem => i.itemType === 'veiculo');
    const initialLeads = INITIAL_LEADS.filter((l) => l.itemType === 'veiculo');
    this.saveItems(initialVehicles);
    this.saveLeads(initialLeads);
  }
};
