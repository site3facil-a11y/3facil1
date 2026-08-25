import { StoreProfile, StoreItem, ProposalLead, SaaSPlatformSettings } from '../types/store';

export interface BootstrapResponse {
  stores: StoreProfile[];
  items: StoreItem[];
  leads: ProposalLead[];
  settings: SaaSPlatformSettings;
  connectedToPostgres: boolean;
  error?: string;
}

export interface HealthResponse {
  status: string;
  database: string;
  connected: boolean;
  schemas: string[];
  stats?: {
    lojas_count: string;
    autos_count: string;
    imoveis_count: string;
    produtos_count: string;
    servicos_count: string;
    autos_leads: string;
    imoveis_leads: string;
    loja_leads: string;
    servicos_leads: string;
  };
  error?: string;
}

export interface EmailStatusResponse {
  configured: boolean;
  connected?: boolean;
  host: string;
  port: number;
  user: string;
  from?: string;
  message: string;
}

export interface SendEmailResponse {
  success: boolean;
  message: string;
  simulated?: boolean;
}

export const apiService = {
  // 1. Checagem de Saúde do PostgreSQL
  async checkHealth(): Promise<HealthResponse> {
    try {
      const res = await fetch(`/api/health?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      return {
        status: 'offline',
        database: 'PostgreSQL',
        connected: false,
        schemas: [],
        error: err.message
      };
    }
  },

  // 2. Carregar todos os dados do banco
  async getBootstrap(): Promise<BootstrapResponse | null> {
    try {
      const res = await fetch(`/api/bootstrap?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[API Service] Backend não respondeu bootstrap, usando cache local:', err);
      return null;
    }
  },

  // 3. Salvar / Criar Loja
  async saveStore(store: StoreProfile): Promise<{
    success: boolean;
    store?: StoreProfile;
    postgresSaved?: boolean;
    dbError?: string;
    emailResult?: { success: boolean; message: string; simulated?: boolean };
  }> {
    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store)
      });
      if (!res.ok) {
        return { success: false, dbError: `HTTP ${res.status}` };
      }
      return await res.json();
    } catch (err: any) {
      console.warn('[API Service] Erro ao salvar loja na API:', err);
      return { success: true, store, postgresSaved: false, dbError: err.message };
    }
  },

  // Atualizar Loja
  async updateStore(store: StoreProfile): Promise<boolean> {
    try {
      const res = await fetch(`/api/stores/${store.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store)
      });
      return res.ok;
    } catch (err) {
      console.warn('[API Service] Erro ao atualizar loja na API:', err);
      return false;
    }
  },

  // Deletar Loja
  async deleteStore(storeId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/stores/${storeId}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch (err) {
      console.warn('[API Service] Erro ao deletar loja na API:', err);
      return false;
    }
  },

  // 4. Salvar / Criar Item (distribuído nos schemas autos, imoveis, loja, servicos)
  async saveItem(item: StoreItem): Promise<boolean> {
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      return res.ok;
    } catch (err) {
      console.warn('[API Service] Erro ao salvar item na API:', err);
      return false;
    }
  },

  // Deletar Item
  async deleteItem(itemId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch (err) {
      console.warn('[API Service] Erro ao deletar item na API:', err);
      return false;
    }
  },

  // 5. Salvar / Criar Proposta ou Lead
  async saveLead(lead: ProposalLead): Promise<boolean> {
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead)
      });
      return res.ok;
    } catch (err) {
      console.warn('[API Service] Erro ao salvar lead na API:', err);
      return false;
    }
  },

  // Atualizar Status do Lead
  async updateLeadStatus(leadId: string, status: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      return res.ok;
    } catch (err) {
      console.warn('[API Service] Erro ao atualizar status do lead na API:', err);
      return false;
    }
  },

  // Deletar Lead
  async deleteLead(leadId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch (err) {
      console.warn('[API Service] Erro ao deletar lead na API:', err);
      return false;
    }
  },

  // 6. Salvar Configurações da Plataforma
  async saveSettings(settings: SaaSPlatformSettings): Promise<boolean> {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      return res.ok;
    } catch (err) {
      console.warn('[API Service] Erro ao salvar configurações na API:', err);
      return false;
    }
  },

  // 7. Resetar para Dados Padrão no Banco
  async resetToDefaults(): Promise<boolean> {
    try {
      const res = await fetch('/api/reset-defaults', {
        method: 'POST'
      });
      return res.ok;
    } catch (err) {
      console.warn('[API Service] Erro ao resetar dados na API:', err);
      return false;
    }
  },

  // 7.1 Sincronizar todos os dados do Disco Persistente para o PostgreSQL
  async migrateToPostgres(): Promise<{
    success: boolean;
    migratedStores?: number;
    migratedItems?: number;
    migratedLeads?: number;
    message?: string;
    errors?: string[];
    error?: string;
  }> {
    try {
      const res = await fetch('/api/migrate-to-postgres', {
        method: 'POST'
      });
      return await res.json();
    } catch (err: any) {
      console.warn('[API Service] Erro ao migrar para PostgreSQL:', err);
      return { success: false, error: err.message, message: 'Falha ao conectar com o servidor.' };
    }
  },

  // 8. Obter Status do SMTP / E-mail
  async getEmailStatus(): Promise<EmailStatusResponse> {
    try {
      const res = await fetch('/api/email/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      return {
        configured: false,
        connected: false,
        host: 'Erro ao conectar',
        port: 0,
        user: '',
        message: err.message || 'Não foi possível consultar status do SMTP.'
      };
    }
  },

  // 8.1 Salvar Configurações de SMTP diretamente pelo Painel
  async saveEmailConfig(config: {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure?: boolean;
    from?: string;
  }): Promise<{ success: boolean; saved: boolean; connected: boolean; message: string }> {
    try {
      const res = await fetch('/api/email/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      return await res.json();
    } catch (err: any) {
      return {
        success: false,
        saved: false,
        connected: false,
        message: err.message || 'Erro ao conectar com o servidor para salvar SMTP.'
      };
    }
  },

  // 9. Enviar E-mail de Teste
  async sendTestEmail(to: string): Promise<SendEmailResponse> {
    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to })
      });
      return await res.json();
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Erro ao enviar requisição de teste de e-mail.'
      };
    }
  },

  // 10. Enviar / Reenviar E-mail de Boas-Vindas & Confirmação de Cadastro
  async sendWelcomeEmail(store: StoreProfile): Promise<SendEmailResponse> {
    try {
      const res = await fetch('/api/email/send-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store })
      });
      return await res.json();
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Erro ao disparar e-mail de boas-vindas.'
      };
    }
  },

  // 11. Atualizar Sistema da Nuvem (Auto-Deploy)
  async updateSystem(): Promise<{ success: boolean; message: string; output?: string; error?: string }> {
    try {
      const res = await fetch('/api/system/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return await res.json();
    } catch (err: any) {
      return {
        success: false,
        message: 'Falha ao solicitar atualização do sistema.',
        error: err.message
      };
    }
  },

  // 12. Obter Informações do Sistema & Versão do Git
  async getSystemInfo(): Promise<{ lastCommit: string; branch?: string; nodeVersion: string; uptime: number; timestamp: string }> {
    try {
      const res = await fetch('/api/system/info');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      return {
        lastCommit: '3facil.com (Produção Online)',
        branch: 'main',
        nodeVersion: 'Node 20 LTS',
        uptime: 0,
        timestamp: new Date().toISOString()
      };
    }
  },

  // 13. Checar se há Atualização no GitHub
  async checkSystemUpdate(): Promise<{
    hasUpdate: boolean;
    localCommit?: string;
    remoteCommit?: string;
    commitsBehind: number;
    pendingCommits: string[];
    message: string;
    checkedAt: string;
  }> {
    try {
      const res = await fetch('/api/system/check-update');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      return {
        hasUpdate: false,
        commitsBehind: 0,
        pendingCommits: [],
        message: 'Não foi possível contatar o Git da VPS no momento.',
        checkedAt: new Date().toISOString()
      };
    }
  },

  // 14. Upload de Arquivo ZIP de Atualização Direta
  async uploadUpdateZip(file: File): Promise<{ success: boolean; message: string; extractedFilesCount?: number; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('updateZip', file);

      const res = await fetch('/api/admin/upload-update-zip', {
        method: 'POST',
        body: formData
      });

      const responseText = await res.text();
      let data: any = null;

      try {
        data = JSON.parse(responseText);
      } catch (jsonErr) {
        if (res.status === 413) {
          throw new Error('O arquivo ZIP é maior do que o limite permitido pelo servidor web/Nginx (413 Request Entity Too Large). Ajuste "client_max_body_size 150M;" no /etc/nginx/nginx.conf ou descompacte com "unzip" no terminal.');
        } else if (res.status === 404) {
          throw new Error('O endpoint de upload ZIP não foi encontrado no servidor ativo (404). Reinicie o processo Node/PM2 com "pm2 restart all".');
        } else if (res.status === 502 || res.status === 504) {
          throw new Error(`O servidor Node.js/PM2 não respondeu a tempo (${res.status}). O build pode estar em andamento em segundo plano.`);
        } else if (res.status === 500) {
          throw new Error('Erro interno 500 no servidor. Verifique os logs do backend com "pm2 logs" ou certifique-se de que o arquivo é um arquivo .ZIP válido e descompactável.');
        } else {
          throw new Error(`Resposta do servidor (HTTP ${res.status}): ${responseText.replace(/<[^>]*>/g, '').trim().slice(0, 160)}`);
        }
      }

      if (!res.ok) {
        throw new Error(data.error || data.message || `Erro HTTP ${res.status} ao processar arquivo ZIP.`);
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Falha na conexão durante o envio do arquivo ZIP.',
        error: err.message
      };
    }
  }
};
