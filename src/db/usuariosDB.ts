import { StoreProfile, SaaSPlatformSettings, SubscriptionStatus } from '../types/store';
import { INITIAL_STORES, DEFAULT_PLATFORM_SETTINGS } from '../data/demoStores';

export interface UserAccount {
  id: string;
  storeId: string;
  name: string;
  email: string;
  phone: string;
  document?: string;
  role: 'superadmin' | 'lojista';
  monthlyFee: number;
  subscriptionStatus: SubscriptionStatus;
  nextDueDate: string;
  createdAt: string;
}

const STORAGE_KEY_STORES = '3facil_usuariosDB_stores_v5';
const STORAGE_KEY_SETTINGS = '3facil_usuariosDB_settings_v5';
const STORAGE_KEY_ACCOUNTS = '3facil_usuariosDB_accounts_v5';

export const usuariosDB = {
  getStores(): StoreProfile[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_STORES);
      if (!data) {
        this.saveStores(INITIAL_STORES);
        return INITIAL_STORES;
      }
      const parsed: StoreProfile[] = JSON.parse(data);
      // Garantir apenas os 4 tipos válidos
      const valid = parsed.filter((s) => ['veiculo', 'imovel', 'produto', 'servico'].includes(s.type));
      let hasChanges = false;
      INITIAL_STORES.forEach((initialStore) => {
        if (!valid.some((s) => s.id === initialStore.id || s.slug === initialStore.slug)) {
          valid.push(initialStore);
          hasChanges = true;
        }
      });
      if (hasChanges) {
        this.saveStores(valid);
      }
      return valid.length > 0 ? valid : INITIAL_STORES;
    } catch {
      return INITIAL_STORES;
    }
  },

  saveStores(stores: StoreProfile[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_STORES, JSON.stringify(stores));
    } catch (e) {
      console.error('Erro ao persistir usuariosDB (stores):', e);
    }
  },

  getSettings(): SaaSPlatformSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (!data) {
        const defaultSettings = {
          ...DEFAULT_PLATFORM_SETTINGS,
          platformName: '3facil.com',
        };
        this.saveSettings(defaultSettings);
        return defaultSettings;
      }
      return JSON.parse(data);
    } catch {
      return {
        ...DEFAULT_PLATFORM_SETTINGS,
        platformName: '3facil.com',
      };
    }
  },

  saveSettings(settings: SaaSPlatformSettings): void {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Erro ao persistir usuariosDB (settings):', e);
    }
  },

  exportDatabase(): { stores: StoreProfile[]; settings: SaaSPlatformSettings; exportedAt: string } {
    return {
      stores: this.getStores(),
      settings: this.getSettings(),
      exportedAt: new Date().toISOString(),
    };
  },

  reset(): void {
    this.saveStores(INITIAL_STORES);
    this.saveSettings({
      ...DEFAULT_PLATFORM_SETTINGS,
      platformName: '3facil.com',
    });
  }
};
