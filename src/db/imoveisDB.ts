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
      let hasChanges = false;
      const valid = parsed.filter((i) => i.itemType === 'imovel').map((storedItem) => {
        const initMatch = REAL_IMOVEIS.find((init) => init.id === storedItem.id);
        if (initMatch) {
          const needsPrice = (!storedItem.price || storedItem.price === 0) && initMatch.price > 0;
          const needsAttr = !storedItem.bedrooms || !storedItem.areaUtil || storedItem.areaUtil === 0;
          if (needsPrice || needsAttr) {
            hasChanges = true;
            return {
              ...initMatch,
              ...storedItem,
              price: initMatch.price > 0 ? initMatch.price : storedItem.price,
              areaUtil: initMatch.areaUtil,
              areaTotal: initMatch.areaTotal,
              bedrooms: initMatch.bedrooms,
              suites: initMatch.suites,
              bathrooms: initMatch.bathrooms,
              garageSpots: initMatch.garageSpots,
              neighborhood: initMatch.neighborhood,
              city: initMatch.city,
              state: initMatch.state,
              address: initMatch.address,
            };
          }
        }
        return storedItem;
      });

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
