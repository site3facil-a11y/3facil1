import { RealEstateItem, ProposalLead } from '../types/store';
import { INITIAL_ITEMS, INITIAL_LEADS } from '../data/demoStores';

const STORAGE_KEY_ITEMS = '3facil_imoveisDB_items_v5';
const STORAGE_KEY_LEADS = '3facil_imoveisDB_leads_v5';

export const imoveisDB = {
  getItems(): RealEstateItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_ITEMS);
      const initialImoveis = INITIAL_ITEMS.filter((i): i is RealEstateItem => i.itemType === 'imovel');
      if (!data) {
        this.saveItems(initialImoveis);
        return initialImoveis;
      }
      const parsed: RealEstateItem[] = JSON.parse(data);
      const valid = parsed.filter((i) => i.itemType === 'imovel');
      let hasChanges = false;
      initialImoveis.forEach((initItem) => {
        if (!valid.some((i) => i.id === initItem.id)) {
          valid.push(initItem);
          hasChanges = true;
        }
      });
      if (hasChanges) {
        this.saveItems(valid);
      }
      return valid;
    } catch {
      return INITIAL_ITEMS.filter((i): i is RealEstateItem => i.itemType === 'imovel');
    }
  },

  saveItems(items: RealEstateItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    } catch (e) {
      console.error('Erro ao persistir imoveisDB (items):', e);
    }
  },

  saveItem(item: RealEstateItem): void {
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
        const initialLeads = INITIAL_LEADS.filter((l) => l.itemType === 'imovel');
        this.saveLeads(initialLeads);
        return initialLeads;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_LEADS.filter((l) => l.itemType === 'imovel');
    }
  },

  saveLeads(leads: ProposalLead[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
    } catch (e) {
      console.error('Erro ao persistir imoveisDB (leads):', e);
    }
  },

  exportDatabase(): { database: string; items: RealEstateItem[]; leads: ProposalLead[]; exportedAt: string } {
    return {
      database: 'imoveisDB',
      items: this.getItems(),
      leads: this.getLeads(),
      exportedAt: new Date().toISOString(),
    };
  },

  reset(): void {
    const initialImoveis = INITIAL_ITEMS.filter((i): i is RealEstateItem => i.itemType === 'imovel');
    const initialLeads = INITIAL_LEADS.filter((l) => l.itemType === 'imovel');
    this.saveItems(initialImoveis);
    this.saveLeads(initialLeads);
  }
};
