import { StoreProfile, StoreItem, ProposalLead, SaaSPlatformSettings } from '../types/store';
import { apiFetch, setAuthToken, removeAuthToken, getAuthToken } from './api';

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

export interface AuthUser {
  id: string;
  email: string;
  role: 'superadmin' | 'lojista' | string;
  storeId?: string | null;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  accessToken?: string;
  user?: AuthUser;
  error?: string;
  message?: string;
}

export const apiService = {
  // 0. Autenticação e Sessão
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Credenciais inválidas.'
        };
      }
      if (data.token) {
        setAuthToken(data.token);
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Falha ao conectar com o serviço de autenticação.'
      };
    }
  },

  async register(registerData: {
    email: string;
    password: string;
    role?: 'superadmin' | 'lojista';
    storeId?: string;
    storeName?: string;
  }): Promise<AuthResponse> {
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerData)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Não foi possível cadastrar a conta.'
        };
      }
      if (data.token) {
        setAuthToken(data.token);
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Erro de rede ao registrar conta.'
      };
    }
  },

  async getMe(): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    try {
      const token = getAuthToken();
      if (!token) return { success: false, error: 'Sem token' };

      const res = await apiFetch('/api/auth/me');
      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}` };
      }
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async logout(): Promise<void> {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
      removeAuthToken();
    }
  },

  // 1. Checagem de Saúde do PostgreSQL
  async checkHealth(): Promise<HealthResponse> {
    try {
      const res = await apiFetch(`/api/health?_t=${Date.now()}`, {
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

  // 2. Carregar dados do catálogo (público ou autenticado com RBAC)
  async getBootstrap(): Promise<BootstrapResponse | null> {
    try {
      const token = getAuthToken();
      const endpoint = token ? '/api/bootstrap' : '/api/public/bootstrap';
      const res = await apiFetch(`${endpoint}?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (!res.ok) {
        // Se a chamada autenticada falhou com 401 ou 403, faz fallback automático para o bootstrap público
        if (token && (res.status === 401 || res.status === 403)) {
          const publicRes = await apiFetch(`/api/public/bootstrap?_t=${Date.now()}`);
          if (publicRes.ok) return await publicRes.json();
        }
        throw new Error(`HTTP ${res.status}`);
      }
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
      const res = await apiFetch('/api/stores', {
        method: 'POST',
        body: JSON.stringify(store)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          dbError: data.error?.message || data.error || `HTTP ${res.status}`
        };
      }
      return data;
    } catch (err: any) {
      console.warn('[API Service] Erro ao salvar loja na API:', err);
      return { success: false, store, postgresSaved: false, dbError: err.message };
    }
  },

  // Atualizar Loja
  async updateStore(store: StoreProfile): Promise<boolean> {
    try {
      const res = await apiFetch(`/api/stores/${store.id}`, {
        method: 'PUT',
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
      const res = await apiFetch(`/api/stores/${storeId}`, {
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
      const res = await apiFetch('/api/items', {
        method: 'POST',
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
      const res = await apiFetch(`/api/items/${itemId}`, {
        method: 'DELETE'
      });
      return res.ok;
    } catch (err) {
      console.warn('[API Service] Erro ao deletar item na API:', err);
      return false;
    }
  },

  // 5. Salvar / Criar Proposta ou Lead (público)
  async saveLead(lead: ProposalLead): Promise<boolean> {
    try {
      const res = await apiFetch('/api/leads', {
        method: 'POST',
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
      const res = await apiFetch(`/api/leads/${leadId}`, {
        method: 'PUT',
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
      const res = await apiFetch(`/api/leads/${leadId}`, {
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
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
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
      const res = await apiFetch('/api/reset-defaults', {
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
      const res = await apiFetch('/api/migrate-to-postgres', {
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
      const res = await apiFetch('/api/email/status');
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
      const res = await apiFetch('/api/email/config', {
        method: 'POST',
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
      const res = await apiFetch('/api/email/test', {
        method: 'POST',
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
      const res = await apiFetch('/api/email/send-welcome', {
        method: 'POST',
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
      const res = await apiFetch('/api/system/update', {
        method: 'POST'
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

  // 12. Obter Informações do Sistema & Versão Publicada
  async getSystemInfo(): Promise<{ lastCommit: string; repo?: string; repoUrl?: string; nodeVersion: string; uptime: number; timestamp: string }> {
    try {
      const res = await apiFetch('/api/system/info');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      return {
        lastCommit: 'unknown',
        repo: 'site3facil-a11y/3facil1',
        repoUrl: 'https://github.com/site3facil-a11y/3facil1',
        nodeVersion: 'Node 20 LTS',
        uptime: 0,
        timestamp: new Date().toISOString()
      };
    }
  },

  // 13. Checar se há Atualização no GitHub
  async checkSystemUpdate(): Promise<{
    hasUpdate: boolean;
    repo?: string;
    repoUrl?: string;
    localCommit?: string;
    remoteCommit?: string;
    commitsBehind: number;
    pendingCommits: string[];
    message: string;
    checkedAt: string;
  }> {
    try {
      const res = await apiFetch('/api/system/check-update');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      return {
        hasUpdate: false,
        repo: 'site3facil-a11y/3facil1',
        repoUrl: 'https://github.com/site3facil-a11y/3facil1',
        commitsBehind: 0,
        pendingCommits: [],
        message: 'Não foi possível contatar o GitHub no momento.',
        checkedAt: new Date().toISOString()
      };
    }
  },

  // 14. Upload de Arquivo ZIP de Atualização Direta
  async uploadUpdateZip(file: File): Promise<{ success: boolean; message: string; extractedFilesCount?: number; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('updateZip', file);

      const res = await apiFetch('/api/admin/upload-update-zip', {
        method: 'POST',
        body: formData
      });

      const responseText = await res.text();
      let data: any = null;

      try {
        data = JSON.parse(responseText);
      } catch (jsonErr) {
        if (res.status === 413) {
          throw new Error('O arquivo ZIP é maior do que o limite permitido pelo servidor web (413 Request Entity Too Large).');
        } else if (res.status === 404) {
          throw new Error('O endpoint de upload ZIP não foi encontrado no servidor ativo (404).');
        } else if (res.status === 502 || res.status === 504) {
          throw new Error(`O servidor não respondeu a tempo (${res.status}).`);
        } else if (res.status === 500) {
          throw new Error('Erro interno 500 no servidor.');
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
  },

  // "Esqueci minha senha" (Lojista ou Super Admin)
  async requestPasswordReset(email: string, role?: 'store' | 'admin' | 'lojista'): Promise<{ success: boolean; message: string; simulated?: boolean }> {
    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email, role: role === 'lojista' ? 'store' : role })
      });
      const data = await res.json().catch(() => null);
      if (!data) {
        return { success: false, message: 'Resposta inválida do servidor.' };
      }
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Erro ao solicitar redefinição de senha.' };
    }
  },

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword })
      });
      const data = await res.json().catch(() => null);
      if (!data) {
        return { success: false, message: 'Resposta inválida do servidor ao redefinir a senha.' };
      }
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Erro ao redefinir a senha.' };
    }
  }
};
