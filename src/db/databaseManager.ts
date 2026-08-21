import { StoreItem, ProposalLead, StoreProfile, SaaSPlatformSettings } from '../types/store';
import { usuariosDB } from './usuariosDB';
import { autoDB } from './autoDB';
import { imoveisDB } from './imoveisDB';
import { lojaDB } from './lojaDB';
import { servicosDB } from './servicosDB';

export interface DatabaseStats {
  usuariosDB: { storesCount: number; sizeBytes: number };
  autoDB: { itemsCount: number; leadsCount: number; sizeBytes: number };
  imoveisDB: { itemsCount: number; leadsCount: number; sizeBytes: number };
  lojaDB: { itemsCount: number; leadsCount: number; sizeBytes: number };
  servicosDB: { itemsCount: number; leadsCount: number; sizeBytes: number };
  totalItems: number;
  totalLeads: number;
  totalStores: number;
}

export const databaseManager = {
  // Carrega todos os itens de todos os bancos segregados
  getAllItems(): StoreItem[] {
    const vehicles = autoDB.getItems();
    const imoveis = imoveisDB.getItems();
    const produtos = lojaDB.getItems();
    const servicos = servicosDB.getItems();
    return [...vehicles, ...imoveis, ...produtos, ...servicos];
  },

  // Salva os itens roteando para o banco de dados correto de cada nicho
  saveAllItems(items: StoreItem[]): void {
    const vehicles = items.filter((i) => i.itemType === 'veiculo');
    const imoveis = items.filter((i) => i.itemType === 'imovel');
    const produtos = items.filter((i) => i.itemType === 'produto');
    const servicos = items.filter((i) => i.itemType === 'servico');

    autoDB.saveItems(vehicles as any);
    imoveisDB.saveItems(imoveis as any);
    lojaDB.saveItems(produtos as any);
    servicosDB.saveItems(servicos as any);
  },

  // Salva ou atualiza um item individual
  saveItem(item: StoreItem): void {
    const currentItems = this.getAllItems();
    const index = currentItems.findIndex((i) => i.id === item.id);
    let updatedItems: StoreItem[];
    if (index >= 0) {
      updatedItems = currentItems.map((i) => (i.id === item.id ? item : i));
    } else {
      updatedItems = [item, ...currentItems];
    }
    this.saveAllItems(updatedItems);
  },

  // Remove um item individual
  deleteItem(itemId: string): void {
    const currentItems = this.getAllItems();
    const updatedItems = currentItems.filter((i) => i.id !== itemId);
    this.saveAllItems(updatedItems);
  },

  // Carrega todos os leads roteados dos 4 bancos
  getAllLeads(): ProposalLead[] {
    return [
      ...autoDB.getLeads(),
      ...imoveisDB.getLeads(),
      ...lojaDB.getLeads(),
      ...servicosDB.getLeads(),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  // Salva leads distribuindo para os bancos de dados específicos
  saveAllLeads(leads: ProposalLead[]): void {
    autoDB.saveLeads(leads.filter((l) => l.itemType === 'veiculo'));
    imoveisDB.saveLeads(leads.filter((l) => l.itemType === 'imovel'));
    lojaDB.saveLeads(leads.filter((l) => l.itemType === 'produto'));
    servicosDB.saveLeads(leads.filter((l) => l.itemType === 'servico'));
  },

  // Obtém estatísticas de cada banco de dados segregado
  getStats(): DatabaseStats {
    const stores = usuariosDB.getStores();
    const autoItems = autoDB.getItems();
    const autoLeads = autoDB.getLeads();
    const imoveisItems = imoveisDB.getItems();
    const imoveisLeads = imoveisDB.getLeads();
    const lojaItems = lojaDB.getItems();
    const lojaLeads = lojaDB.getLeads();
    const servicosItems = servicosDB.getItems();
    const servicosLeads = servicosDB.getLeads();

    const getBytes = (obj: any) => new Blob([JSON.stringify(obj)]).size;

    return {
      usuariosDB: {
        storesCount: stores.length,
        sizeBytes: getBytes(stores) + getBytes(usuariosDB.getSettings()),
      },
      autoDB: {
        itemsCount: autoItems.length,
        leadsCount: autoLeads.length,
        sizeBytes: getBytes(autoItems) + getBytes(autoLeads),
      },
      imoveisDB: {
        itemsCount: imoveisItems.length,
        leadsCount: imoveisLeads.length,
        sizeBytes: getBytes(imoveisItems) + getBytes(imoveisLeads),
      },
      lojaDB: {
        itemsCount: lojaItems.length,
        leadsCount: lojaLeads.length,
        sizeBytes: getBytes(lojaItems) + getBytes(lojaLeads),
      },
      servicosDB: {
        itemsCount: servicosItems.length,
        leadsCount: servicosLeads.length,
        sizeBytes: getBytes(servicosItems) + getBytes(servicosLeads),
      },
      totalStores: stores.length,
      totalItems: autoItems.length + imoveisItems.length + lojaItems.length + servicosItems.length,
      totalLeads: autoLeads.length + imoveisLeads.length + lojaLeads.length + servicosLeads.length,
    };
  },

  // Exporta um banco de dados específico em JSON para backup independente
  exportSingleDatabase(dbName: 'usuariosDB' | 'autoDB' | 'imoveisDB' | 'lojaDB' | 'servicosDB') {
    switch (dbName) {
      case 'usuariosDB':
        return usuariosDB.exportDatabase();
      case 'autoDB':
        return autoDB.exportDatabase();
      case 'imoveisDB':
        return imoveisDB.exportDatabase();
      case 'lojaDB':
        return lojaDB.exportDatabase();
      case 'servicosDB':
        return servicosDB.exportDatabase();
    }
  },

  // Exporta todos os 5 bancos em um arquivo consolidado
  exportFullCluster() {
    return {
      platform: '3facil.com',
      version: '5.0.0',
      exportedAt: new Date().toISOString(),
      cluster: {
        usuariosDB: usuariosDB.exportDatabase(),
        autoDB: autoDB.exportDatabase(),
        imoveisDB: imoveisDB.exportDatabase(),
        lojaDB: lojaDB.exportDatabase(),
        servicosDB: servicosDB.exportDatabase(),
      },
    };
  },

  // Reseta um banco de dados específico
  resetSingleDatabase(dbName: 'usuariosDB' | 'autoDB' | 'imoveisDB' | 'lojaDB' | 'servicosDB') {
    switch (dbName) {
      case 'usuariosDB':
        usuariosDB.reset();
        break;
      case 'autoDB':
        autoDB.reset();
        break;
      case 'imoveisDB':
        imoveisDB.reset();
        break;
      case 'lojaDB':
        lojaDB.reset();
        break;
      case 'servicosDB':
        servicosDB.reset();
        break;
    }
  },

  // Reseta todos os 5 bancos para as configurações de fábrica
  resetAllDatabases(): void {
    usuariosDB.reset();
    autoDB.reset();
    imoveisDB.reset();
    lojaDB.reset();
    servicosDB.reset();
  }
};
