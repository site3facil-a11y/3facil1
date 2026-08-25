import { RealEstateItem, ProposalLead } from '../types/store';
import { REAL_IMOVEIS, REAL_LEADS } from '../data/real3facilData';

const STORAGE_KEY_ITEMS = '3facil_imoveisDB_items_v6_real';
const STORAGE_KEY_LEADS = '3facil_imoveisDB_leads_v6_real';

export const imoveisDB = {
  getItems(): RealEstateItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_ITEMS);
      if (!data) {
        this.saveItems(REAL_IMOVEIS);
        return REAL_IMOVEIS;
      }
      const parsed: RealEstateItem[] = JSON.parse(data);
      const valid = parsed.filter((i) => i.itemType === 'imovel');
      let hasChanges = false;
      REAL_IMOVEIS.forEach((initItem) => {
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
      return REAL_IMOVEIS;
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
        this.saveLeads(REAL_LEADS);
        return REAL_LEADS;
      }
      return JSON.parse(data);
    } catch {
      return REAL_LEADS;
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
    this.saveItems(REAL_IMOVEIS);
    this.saveLeads(REAL_LEADS);
  }
};
