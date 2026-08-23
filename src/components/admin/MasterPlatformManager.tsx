import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  DollarSign, 
  Users, 
  Package, 
  TrendingUp, 
  Search, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Ban, 
  ExternalLink, 
  Settings, 
  MessageSquare, 
  CreditCard, 
  Edit, 
  Trash2, 
  Send, 
  Sparkles, 
  Check, 
  Layers, 
  Phone, 
  Mail, 
  Filter, 
  Eye, 
  ShieldCheck, 
  QrCode, 
  Copy,
  Calendar,
  Car,
  Home,
  ShoppingBag,
  Briefcase,
  Store,
  FileText,
  Database,
  HardDrive,
  Download,
  RefreshCw,
  Server,
  GitBranch,
  GitPullRequest,
  ArrowUpCircle,
  Sparkle,
  Upload,
  FileArchive,
  Lock,
  Key,
  EyeOff,
  RotateCcw
} from 'lucide-react';
import { StoreProfile, StoreType, SaaSPlanTier, SubscriptionStatus } from '../../types/store';
import { useStoreContext } from '../../context/StoreContext';
import { formatCurrency } from '../../utils/formatters';
import { apiService, EmailStatusResponse } from '../../services/apiService';

interface MasterPlatformManagerProps {
  onSelectStoreAndGoToAdmin: (storeId: string) => void;
  onSelectStoreAndGoToPublic: (storeId: string) => void;
  onOpenNewStoreModal: () => void;
}

export const MasterPlatformManager: React.FC<MasterPlatformManagerProps> = ({
  onSelectStoreAndGoToAdmin,
  onSelectStoreAndGoToPublic,
  onOpenNewStoreModal,
}) => {
  const { 
    stores, 
    items, 
    leads, 
    plans, 
    platformSettings, 
    isPostgresConnected,
    postgresStats,
    refreshDatabaseStatus,
    updateStoreSubscription, 
    markPaymentReceived, 
    toggleStorePublished, 
    deleteStore,
    updatePlatformSettings,
    getDatabaseStats,
    exportDatabaseJSON,
    resetDatabase,
    theme
  } = useStoreContext();

  const isDark = theme === 'dark';

  const [isRefreshingDb, setIsRefreshingDb] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [leadStoreFilter, setLeadStoreFilter] = useState<string>('todos');
  const [activeTab, setActiveTab] = useState<'clients' | 'proposals' | 'plans' | 'databases' | 'emails' | 'update'>('clients');

  // Estado para Atualização Remota da VPS / Git Deploy
  const [isUpdatingSystem, setIsUpdatingSystem] = useState(false);
  const [updateOutput, setUpdateOutput] = useState<string | null>(null);
  const [systemInfo, setSystemInfo] = useState<{ lastCommit: string; branch?: string; nodeVersion: string; uptime: number; timestamp: string } | null>(null);
  const [isLoadingSystemInfo, setIsLoadingSystemInfo] = useState(false);
  const [updateAlert, setUpdateAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Estado do Verificador de Atualizações no GitHub
  const [updateStatus, setUpdateStatus] = useState<{
    hasUpdate: boolean;
    localCommit?: string;
    remoteCommit?: string;
    commitsBehind: number;
    pendingCommits: string[];
    message: string;
    checkedAt: string;
  } | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  const fetchSystemInfo = async (manualClick = false) => {
    setIsLoadingSystemInfo(true);
    try {
      const info = await apiService.getSystemInfo();
      setSystemInfo(info);
      if (manualClick) {
        setUpdateAlert({
          type: 'success',
          message: `Versão do Git verificada com sucesso! Último commit: "${info.lastCommit}" (Branch: ${info.branch || 'main'})`
        });
      }
    } catch (e: any) {
      console.warn(e);
      if (manualClick) {
        setUpdateAlert({
          type: 'error',
          message: 'Erro ao consultar o Git no servidor: ' + (e.message || 'Sem resposta')
        });
      }
    } finally {
      setIsLoadingSystemInfo(false);
      if (manualClick) {
        setTimeout(() => setUpdateAlert(null), 7000);
      }
    }
  };

  const handleCheckForUpdates = async (manual = false) => {
    setIsCheckingUpdate(true);
    try {
      const res = await apiService.checkSystemUpdate();
      setUpdateStatus(res);
      if (manual) {
        if (res.hasUpdate) {
          setUpdateAlert({
            type: 'info',
            message: `🔥 Há ${res.commitsBehind} nova(s) atualização(ões) no GitHub! Clique em 'Atualizar Sistema Agora' para aplicar.`
          });
        } else {
          setUpdateAlert({
            type: 'success',
            message: '✅ O sistema já está 100% atualizado com a versão mais recente do GitHub!'
          });
        }
        setTimeout(() => setUpdateAlert(null), 7000);
      }
    } catch (err: any) {
      console.warn('Erro ao checar atualizações:', err);
      if (manual) {
        setUpdateAlert({
          type: 'error',
          message: 'Não foi possível contatar o Git da VPS no momento.'
        });
        setTimeout(() => setUpdateAlert(null), 6000);
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // Checa status do Git e atualizações no carregamento do painel
  useEffect(() => {
    fetchSystemInfo();
    handleCheckForUpdates();
  }, []);

  const [isUploadingZip, setIsUploadingZip] = useState(false);
  const [zipProgressText, setZipProgressText] = useState<string | null>(null);

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      alert('Por favor, selecione um arquivo no formato .zip válido (ex: baixado do AI Studio ou GitHub).');
      return;
    }

    if (!window.confirm(`Deseja enviar e instalar o pacote "${file.name}"? O sistema substituirá os arquivos alterados e recompilará a aplicação automaticamente.`)) {
      e.target.value = '';
      return;
    }

    setIsUploadingZip(true);
    setZipProgressText('Enviando arquivo ZIP para o servidor...');
    setUpdateAlert({ type: 'info', message: 'Enviando pacote ZIP para o servidor e extraindo arquivos...' });

    try {
      const res = await apiService.uploadUpdateZip(file);
      if (res.success) {
        setZipProgressText('Arquivos substituídos com sucesso! Recompilando com npm run build e reiniciando...');
        setUpdateAlert({ type: 'success', message: `${res.extractedFilesCount || 0} arquivos atualizados! O servidor está compilando e reiniciando.` });
        setUpdateOutput(`Sucesso: ${res.message}`);
        
        // Aguarda 8 segundos para dar tempo do build compilar e reinicia checagem
        setTimeout(() => {
          fetchSystemInfo();
          handleCheckForUpdates();
          setZipProgressText(null);
        }, 8000);
      } else {
        setZipProgressText(null);
        setUpdateAlert({ type: 'error', message: res.error || res.message || 'Falha ao processar arquivo ZIP.' });
        setUpdateOutput(`Erro: ${res.error || res.message}`);
      }
    } catch (err: any) {
      setZipProgressText(null);
      setUpdateAlert({ type: 'error', message: err.message || 'Erro durante o envio do arquivo ZIP.' });
      setUpdateOutput(`Erro: ${err.message}`);
    } finally {
      setIsUploadingZip(false);
      e.target.value = '';
    }
  };

  const handleTriggerSystemUpdate = async () => {
    if (!window.confirm('Deseja puxar as últimas atualizações da nuvem e recompilar o sistema agora? O servidor será atualizado automaticamente.')) {
      return;
    }

    setIsUpdatingSystem(true);
    setUpdateOutput('Iniciando git pull origin main e npm run build...');
    setUpdateAlert({ type: 'info', message: 'Executando atualização no servidor... Isso pode levar cerca de 15 a 30 segundos.' });

    try {
      const result = await apiService.updateSystem();
      if (result.success) {
        setUpdateOutput(result.output || 'Atualização concluída com sucesso!');
        setUpdateAlert({ type: 'success', message: 'Sistema atualizado e recompilado com sucesso! O PM2 está reiniciando a aplicação.' });
        setTimeout(() => {
          fetchSystemInfo();
          handleCheckForUpdates();
        }, 4000);
      } else {
        setUpdateOutput(result.output || result.error || 'Erro durante a compilação.');
        setUpdateAlert({ type: 'error', message: result.message || 'Falha ao atualizar o sistema.' });
      }
    } catch (err: any) {
      setUpdateOutput(err.message);
      setUpdateAlert({ type: 'error', message: 'Erro na requisição de atualização.' });
    } finally {
      setIsUpdatingSystem(false);
    }
  };

  // Estado para Modal de Edição de Cliente SaaS
  const [editingStore, setEditingStore] = useState<StoreProfile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Estado para Modal de Configurações do SaaS
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState(platformSettings);
  const [copiedPix, setCopiedPix] = useState(false);
  const [dbSuccessMessage, setDbSuccessMessage] = useState<string | null>(null);

  // Estado para Gestão de E-mails / SMTP
  const [emailStatus, setEmailStatus] = useState<EmailStatusResponse | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [testEmailTarget, setTestEmailTarget] = useState(platformSettings.superAdminEmail || 'wilsonlimamn@gmail.com');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [emailAlert, setEmailAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [resendingEmailForStoreId, setResendingEmailForStoreId] = useState<string | null>(null);

  // Estados do Formulário de Configuração Direta de SMTP
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState<number>(587);
  const [smtpUser, setSmtpUser] = useState('site3facil@gmail.com');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpFrom, setSmtpFrom] = useState('"3Fácil Plataforma" <site3facil@gmail.com>');
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);

  const applySmtpPreset = (preset: 'gmail' | 'hostinger' | 'titan' | 'cpanel') => {
    if (preset === 'gmail') {
      setSmtpHost('smtp.gmail.com');
      setSmtpPort(587);
      setSmtpSecure(false);
      if (!smtpUser || smtpUser.includes('hostinger') || smtpUser.includes('3facil.com')) {
        setSmtpUser('site3facil@gmail.com');
        setSmtpFrom('"3Fácil Plataforma" <site3facil@gmail.com>');
      }
    } else if (preset === 'hostinger') {
      setSmtpHost('smtp.hostinger.com');
      setSmtpPort(465);
      setSmtpSecure(true);
      setSmtpUser('contato@3facil.com');
      setSmtpFrom('"3Fácil Plataforma" <contato@3facil.com>');
    } else if (preset === 'titan') {
      setSmtpHost('smtp.titan.email');
      setSmtpPort(465);
      setSmtpSecure(true);
    } else if (preset === 'cpanel') {
      setSmtpHost('mail.3facil.com');
      setSmtpPort(465);
      setSmtpSecure(true);
    }
  };

  const handleSaveSmtpConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpHost.trim() || !smtpUser.trim() || !smtpPass.trim()) {
      setEmailAlert({ type: 'error', message: 'Por favor, preencha o Servidor Host, Usuário e a Senha SMTP.' });
      return;
    }

    setIsSavingSmtp(true);
    try {
      const res = await apiService.saveEmailConfig({
        host: smtpHost.trim(),
        port: Number(smtpPort) || 587,
        user: smtpUser.trim(),
        pass: smtpPass.trim(),
        secure: smtpSecure,
        from: smtpFrom.trim() || `"3Fácil Plataforma" <${smtpUser.trim()}>`
      });

      if (res.success) {
        if (res.connected) {
          setEmailAlert({ 
            type: 'success', 
            message: `🎉 SMTP Salvo e Autenticado com sucesso em ${smtpHost}:${smtpPort}! O envio de e-mails reais está 100% ativo.` 
          });
        } else {
          setEmailAlert({ 
            type: 'error', 
            message: `Configuração salva, mas o servidor retornou erro na autenticação: ${res.message}` 
          });
        }
        // Atualiza status na tela
        handleCheckEmailStatus();
      } else {
        setEmailAlert({ type: 'error', message: res.message || 'Erro ao salvar credenciais SMTP.' });
      }
    } catch (err: any) {
      setEmailAlert({ type: 'error', message: err.message || 'Erro na requisição.' });
    } finally {
      setIsSavingSmtp(false);
      setTimeout(() => setEmailAlert(null), 8000);
    }
  };

  const handleCheckEmailStatus = async () => {
    setIsCheckingEmail(true);
    try {
      const status = await apiService.getEmailStatus();
      setEmailStatus(status);
      if (status.connected) {
        setEmailAlert({ type: 'success', message: `Conexão SMTP com ${status.host}:${status.port} testada com sucesso!` });
      } else if (status.configured) {
        setEmailAlert({ type: 'error', message: `Falha na autenticação SMTP: ${status.message}` });
      } else {
        setEmailAlert({ type: 'info', message: 'SMTP não configurado. Os e-mails são processados em modo simulado até que você preencha as variáveis no .env.' });
      }
    } catch (e: any) {
      setEmailAlert({ type: 'error', message: e.message || 'Erro ao consultar SMTP.' });
    } finally {
      setIsCheckingEmail(false);
      setTimeout(() => setEmailAlert(null), 5000);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailTarget.trim()) return;
    setIsSendingTestEmail(true);
    try {
      const res = await apiService.sendTestEmail(testEmailTarget.trim());
      if (res.success) {
        setEmailAlert({ 
          type: 'success', 
          message: res.simulated 
            ? `[Simulado] ${res.message}` 
            : `E-mail de teste enviado com sucesso para ${testEmailTarget}!` 
        });
      } else {
        setEmailAlert({ type: 'error', message: res.message });
      }
    } catch (e: any) {
      setEmailAlert({ type: 'error', message: e.message || 'Erro ao enviar teste.' });
    } finally {
      setIsSendingTestEmail(false);
      setTimeout(() => setEmailAlert(null), 6000);
    }
  };

  const handleReSendWelcomeEmail = async (store: StoreProfile) => {
    setResendingEmailForStoreId(store.id);
    try {
      const res = await apiService.sendWelcomeEmail(store);
      if (res.success) {
        setEmailAlert({ 
          type: 'success', 
          message: `E-mail de confirmação de cadastro reenviado para ${store.ownerEmail || store.email} (${store.name})!` 
        });
      } else {
        setEmailAlert({ type: 'error', message: res.message });
      }
    } catch (e: any) {
      setEmailAlert({ type: 'error', message: e.message || 'Erro ao reenviar e-mail.' });
    } finally {
      setResendingEmailForStoreId(null);
      setTimeout(() => setEmailAlert(null), 5000);
    }
  };

  const dbStats = getDatabaseStats();

  const handleDownloadDatabase = (dbName: 'all' | 'usuariosDB' | 'autoDB' | 'imoveisDB' | 'lojaDB' | 'servicosDB') => {
    const jsonStr = exportDatabaseJSON(dbName);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `3facil_${dbName}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDbSuccessMessage(`Backup do ${dbName} exportado com sucesso!`);
    setTimeout(() => setDbSuccessMessage(null), 3500);
  };

  const [isMigratingToPg, setIsMigratingToPg] = useState(false);

  const handleExportSqlScript = () => {
    let sql = `-- ============================================================================\n`;
    sql += `-- SCRIPT SQL DE CARGA DIRETA PARA POSTGRESQL / PGADMIN (3facil_db)\n`;
    sql += `-- Gerado em: ${new Date().toISOString()}\n`;
    sql += `-- ============================================================================\n\n`;

    sql += `-- 1. GARANTIR SCHEMAS\n`;
    sql += `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n`;
    sql += `CREATE EXTENSION IF NOT EXISTS "pgcrypto";\n\n`;
    sql += `CREATE SCHEMA IF NOT EXISTS usuarios;\n`;
    sql += `CREATE SCHEMA IF NOT EXISTS autos;\n`;
    sql += `CREATE SCHEMA IF NOT EXISTS imoveis;\n`;
    sql += `CREATE SCHEMA IF NOT EXISTS loja;\n`;
    sql += `CREATE SCHEMA IF NOT EXISTS servicos;\n\n`;

    sql += `-- 2. AJUSTAR COLUNA conta_id\n`;
    sql += `ALTER TABLE usuarios.lojas ALTER COLUMN conta_id DROP NOT NULL;\n\n`;

    sql += `-- 3. INSERIR OU ATUALIZAR LOJAS (usuarios.lojas)\n`;
    for (const store of stores) {
      const escape = (val: any) => {
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'number' || typeof val === 'boolean') return val;
        return `'${String(val).replace(/'/g, "''")}'`;
      };
      const escapeUuid = (val: any) => {
        if (!val) return 'gen_random_uuid()';
        return `'${String(val).replace(/'/g, "''")}'::uuid`;
      };
      const escapeJson = (val: any) => `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;

      sql += `INSERT INTO usuarios.lojas (\n`;
      sql += `  id, nome, slug, tipo, descricao, slogan, theme_color, logo_url, banner_url,\n`;
      sql += `  whatsapp, email, telefone, instagram, cidade, estado, endereco,\n`;
      sql += `  plano_tier, mensalidade, status_assinatura, vencimento_mensalidade,\n`;
      sql += `  data_ultimo_pagamento, owner_name, owner_email, owner_phone,\n`;
      sql += `  configuracoes, is_published, created_at\n`;
      sql += `) VALUES (\n`;
      sql += `  ${escapeUuid(store.id)}, ${escape(store.name)}, ${escape(store.slug)}, ${escape(store.type)}, ${escape(store.description || '')}, ${escape(store.slogan || '')}, ${escape(store.themeColor || '#2563eb')}, ${escape(store.logoUrl || '')}, ${escape(store.bannerUrl || '')},\n`;
      sql += `  ${escape(store.whatsapp)}, ${escape(store.email || '')}, ${escape(store.phone || '')}, ${escape(store.instagram || '')}, ${escape(store.city || '')}, ${escape(store.state || '')}, ${escape(store.address || '')},\n`;
      sql += `  ${escape(store.plan || 'pro')}, ${Number(store.monthlyFee) || 30.00}, ${escape(store.subscriptionStatus || 'ativo')}, ${escape(store.nextDueDate || '2026-09-15')},\n`;
      sql += `  ${escape(store.lastPaymentDate || '2026-08-15')}, ${escape(store.ownerName || 'Lojista')}, ${escape(store.ownerEmail || store.email || '')}, ${escape(store.ownerPhone || store.whatsapp)},\n`;
      sql += `  ${escapeJson(store)}, ${store.isPublished !== false}, ${escape(store.createdAt || new Date().toISOString())}\n`;
      sql += `) ON CONFLICT (id) DO UPDATE SET\n`;
      sql += `  nome = EXCLUDED.nome, slug = EXCLUDED.slug, tipo = EXCLUDED.tipo, whatsapp = EXCLUDED.whatsapp, is_published = EXCLUDED.is_published, configuracoes = EXCLUDED.configuracoes;\n\n`;
    }

    sql += `-- 4. INSERIR OU ATUALIZAR ITENS DE ESTOQUE / CATÁLOGO\n`;
    for (const item of items) {
      const escape = (val: any) => {
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'number' || typeof val === 'boolean') return val;
        return `'${String(val).replace(/'/g, "''")}'`;
      };
      const escapeUuid = (val: any) => {
        if (!val) return 'gen_random_uuid()';
        return `'${String(val).replace(/'/g, "''")}'::uuid`;
      };
      const escapeJson = (val: any) => `'${JSON.stringify(val || []).replace(/'/g, "''")}'::jsonb`;

      if (item.itemType === 'veiculo') {
        const v = item as any;
        sql += `INSERT INTO autos.estoque (\n`;
        sql += `  id, loja_id, titulo, tipo, preco, descricao, fotos, destaque, status,\n`;
        sql += `  marca, modelo, ano_fabricacao, ano_modelo, quilometragem, combustivel, cambio, cor, placa_final, opcionais, dados_extras\n`;
        sql += `) VALUES (\n`;
        sql += `  ${escapeUuid(v.id)}, ${escapeUuid(v.storeId)}, ${escape(v.title)}, 'veiculo', ${Number(v.price) || 0}, ${escape(v.description || '')}, ${escapeJson(v.images || [])}, ${Boolean(v.featured)}, ${escape(v.status || 'disponivel')},\n`;
        sql += `  ${escape(v.brand || '')}, ${escape(v.model || '')}, ${Number(v.yearFab) || 2023}, ${Number(v.yearModel) || 2024}, ${Number(v.mileage) || 0}, ${escape(v.fuel || 'flex')}, ${escape(v.transmission || 'automatico')}, ${escape(v.color || '')}, ${escape(v.plateEnd || '')}, ${escapeJson(v.accessories || [])}, ${escapeJson(v)}\n`;
        sql += `) ON CONFLICT (id) DO UPDATE SET titulo = EXCLUDED.titulo, preco = EXCLUDED.preco, status = EXCLUDED.status;\n\n`;
      } else if (item.itemType === 'imovel') {
        const im = item as any;
        sql += `INSERT INTO imoveis.catalogo (\n`;
        sql += `  id, loja_id, titulo, tipo, preco, descricao, fotos, destaque, status,\n`;
        sql += `  tipo_imovel, tipo_transacao, area_util_m2, area_total_m2, quartos, suites, banheiros, vagas_garagem, valor_condominio, valor_iptu, bairro, cidade, estado, caracteristicas, dados_extras\n`;
        sql += `) VALUES (\n`;
        sql += `  ${escapeUuid(im.id)}, ${escapeUuid(im.storeId)}, ${escape(im.title)}, 'imovel', ${Number(im.price) || 0}, ${escape(im.description || '')}, ${escapeJson(im.images || [])}, ${Boolean(im.featured)}, ${escape(im.status || 'disponivel')},\n`;
        sql += `  ${escape(im.propertyType || 'apartamento')}, ${escape(im.transactionType || 'venda')}, ${Number(im.areaUtil) || 80}, ${Number(im.areaTotal) || 100}, ${Number(im.bedrooms) || 2}, ${Number(im.suites) || 1}, ${Number(im.bathrooms) || 2}, ${Number(im.garageSpots) || 1}, ${Number(im.condoFee) || 0}, ${Number(im.iptu) || 0}, ${escape(im.neighborhood || '')}, ${escape(im.city || 'São Paulo')}, ${escape(im.state || 'SP')}, ${escapeJson(im.amenities || [])}, ${escapeJson(im)}\n`;
        sql += `) ON CONFLICT (id) DO UPDATE SET titulo = EXCLUDED.titulo, preco = EXCLUDED.preco, status = EXCLUDED.status;\n\n`;
      } else if (item.itemType === 'produto') {
        const pr = item as any;
        sql += `INSERT INTO loja.produtos (\n`;
        sql += `  id, loja_id, titulo, tipo, preco, preco_promocional, descricao, fotos, destaque, status, sku, categoria, estoque_quantidade, em_estoque, condicao, dados_extras\n`;
        sql += `) VALUES (\n`;
        sql += `  ${escapeUuid(pr.id)}, ${escapeUuid(pr.storeId)}, ${escape(pr.title)}, 'produto', ${Number(pr.price) || 0}, ${pr.promotionalPrice ? Number(pr.promotionalPrice) : 'NULL'}, ${escape(pr.description || '')}, ${escapeJson(pr.images || [])}, ${Boolean(pr.featured)}, ${escape(pr.status || 'ativo')}, ${escape(pr.sku || '')}, ${escape(pr.category || 'Geral')}, ${Number(pr.stockQuantity) || 10}, ${pr.inStock !== false}, ${escape(pr.condition || 'novo')}, ${escapeJson(pr)}\n`;
        sql += `) ON CONFLICT (id) DO UPDATE SET titulo = EXCLUDED.titulo, preco = EXCLUDED.preco, status = EXCLUDED.status;\n\n`;
      } else if (item.itemType === 'servico') {
        const sr = item as any;
        sql += `INSERT INTO servicos.catalogo (\n`;
        sql += `  id, loja_id, titulo, tipo, preco, descricao, fotos, destaque, status, tipo_preco, duracao_estimada, itens_inclusos, dados_extras\n`;
        sql += `) VALUES (\n`;
        sql += `  ${escapeUuid(sr.id)}, ${escapeUuid(sr.storeId)}, ${escape(sr.title)}, 'servico', ${Number(sr.price) || 0}, ${escape(sr.description || '')}, ${escapeJson(sr.images || [])}, ${Boolean(sr.featured)}, ${escape(sr.status || 'ativo')}, ${escape(sr.priceType || 'fixo')}, ${escape(sr.estimatedDuration || 'A combinar')}, ${escapeJson(sr.includedItems || [])}, ${escapeJson(sr)}\n`;
        sql += `) ON CONFLICT (id) DO UPDATE SET titulo = EXCLUDED.titulo, preco = EXCLUDED.preco, status = EXCLUDED.status;\n\n`;
      }
    }

    const blob = new Blob([sql], { type: 'text/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carga_pgadmin_3facil_${new Date().toISOString().split('T')[0]}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDbSuccessMessage(`Script SQL gerado com sucesso! Abra no pgAdmin e execute (F5) para carregar todas as lojas.`);
    setTimeout(() => setDbSuccessMessage(null), 6000);
  };

  const handleMigrateAllToPostgres = async () => {
    if (!window.confirm('Deseja migrar e sincronizar todas as lojas, anúncios e leads do armazenamento persistente para as tabelas dos 5 schemas do PostgreSQL agora?')) {
      return;
    }

    setIsMigratingToPg(true);
    try {
      const res = await apiService.migrateToPostgres();
      if (res.success) {
        setDbSuccessMessage(`🎉 ${res.message}`);
        await refreshDatabaseStatus();
      } else {
        setDbSuccessMessage(`⚠️ ${res.message || res.error}`);
      }
    } catch (err: any) {
      setDbSuccessMessage(`Erro: ${err.message}`);
    } finally {
      setIsMigratingToPg(false);
      setTimeout(() => setDbSuccessMessage(null), 6000);
    }
  };

  const handleResetSingleDb = (dbName: 'usuariosDB' | 'autoDB' | 'imoveisDB' | 'lojaDB' | 'servicosDB', dbTitle: string) => {
    if (window.confirm(`Tem certeza que deseja restaurar o banco de dados [${dbTitle}] para a configuração padrão? Apenas os dados deste banco serão resetados.`)) {
      resetDatabase(dbName);
      setDbSuccessMessage(`Banco ${dbTitle} restaurado para o padrão com sucesso!`);
      setTimeout(() => setDbSuccessMessage(null), 3500);
    }
  };

  // Métricas Globais da Plataforma Mãe
  const totalStores = stores.length;
  const activeStoresCount = stores.filter((s) => s.subscriptionStatus === 'ativo' && s.isPublished).length;
  const pendingStoresCount = stores.filter((s) => s.subscriptionStatus === 'pendente').length;
  const trialStoresCount = stores.filter((s) => s.subscriptionStatus === 'trial').length;
  const suspendedStoresCount = stores.filter((s) => s.subscriptionStatus === 'suspenso' || !s.isPublished).length;

  // Faturamento Recorrente Mensal (MRR) - Soma das lojas ativas e pendentes
  const currentMRR = stores
    .filter((s) => s.subscriptionStatus === 'ativo' || s.subscriptionStatus === 'pendente')
    .reduce((acc, s) => acc + (s.monthlyFee || 0), 0);

  const projectedARR = currentMRR * 12;
  const totalItemsCount = items.length;
  const totalLeadsCount = leads.length;

  // Filtragem de Lojas de Clientes
  const filteredStores = stores.filter((s) => {
    if (statusFilter !== 'todos' && s.subscriptionStatus !== statusFilter) return false;
    if (typeFilter !== 'todos' && s.type !== typeFilter) return false;

    const query = searchTerm.toLowerCase();
    const matchName = s.name.toLowerCase().includes(query);
    const matchOwner = (s.ownerName || '').toLowerCase().includes(query);
    const matchEmail = (s.ownerEmail || s.email || '').toLowerCase().includes(query);
    const matchPhone = (s.ownerPhone || s.whatsapp || '').includes(query);
    const matchSlug = s.slug.toLowerCase().includes(query);

    return matchName || matchOwner || matchEmail || matchPhone || matchSlug;
  });

  const getStoreIcon = (type: StoreType) => {
    switch (type) {
      case 'veiculo': return <Car className="h-4 w-4 text-red-400" />;
      case 'imovel': return <Home className="h-4 w-4 text-emerald-400" />;
      case 'produto': return <ShoppingBag className="h-4 w-4 text-blue-400" />;
      case 'servico': return <Briefcase className="h-4 w-4 text-purple-400" />;
    }
  };

  const getStoreTypeName = (type: StoreType) => {
    switch (type) {
      case 'veiculo': return 'Veículos';
      case 'imovel': return 'Imóveis';
      case 'produto': return 'Produtos';
      case 'servico': return 'Serviços';
    }
  };

  const getStatusBadge = (status: SubscriptionStatus, isPublished: boolean) => {
    if (!isPublished || status === 'suspenso') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/80">
          <Ban className="h-3 w-3 mr-1" /> Suspenso
        </span>
      );
    }
    switch (status) {
      case 'ativo':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Ativo
          </span>
        );
      case 'pendente':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/80 animate-pulse">
            <AlertTriangle className="h-3 w-3 mr-1" /> Vencido / Cobrar
          </span>
        );
      case 'trial':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/80">
            <Clock className="h-3 w-3 mr-1" /> Período de Teste
          </span>
        );
    }
  };

  // Gerador de mensagem de cobrança pronta no WhatsApp
  const handleSendWhatsAppBilling = (store: StoreProfile) => {
    const phone = (store.ownerPhone || store.whatsapp || '').replace(/\D/g, '');
    if (!phone) {
      alert('Esta loja não possui número de WhatsApp cadastrado.');
      return;
    }

    const message = `Olá, ${store.ownerName || 'Lojista'}! 👋\n\nAqui é da equipe de suporte do *${platformSettings.platformName}*.\n\nPassando para informar sobre a mensalidade de manutenção da sua loja *${store.name}*:\n\n📌 *Plano:* ${store.planName || 'Profissional'}\n💰 *Valor:* R$ ${store.monthlyFee?.toFixed(2) || '99.90'}\n📅 *Vencimento:* ${store.nextDueDate || 'Imediato'}\n\n🔑 *Chave Pix para Pagamento:* \n${platformSettings.pixKey} (${platformSettings.pixBeneficiary})\n\nAssim que realizar o pagamento, nos envie o comprovante por aqui para mantermos sua vitrine e suporte 100% ativos!\n\nQualquer dúvida, estamos à disposição! 🚀`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/55${phone}?text=${encoded}`, '_blank');
  };

  const handleOpenEdit = (store: StoreProfile) => {
    setEditingStore({ ...store });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;
    updateStoreSubscription(editingStore.id, editingStore);
    setIsEditModalOpen(false);
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText(platformSettings.pixKey);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Header do Painel Master SaaS */}
      <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 border p-6 rounded-3xl shadow-xl transition-colors ${
        isDark
          ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/50 border-slate-800 text-white'
          : 'bg-gradient-to-r from-white via-blue-50/50 to-indigo-50/50 border-slate-200 text-slate-900 shadow-slate-200/50'
      }`}>
        <div className="flex items-start sm:items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
            <Building2 className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Painel Master SaaS
              </h1>
              <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                isDark 
                  ? 'bg-blue-500/20 text-blue-300 border-blue-400/30' 
                  : 'bg-blue-100 text-blue-800 border-blue-200'
              }`}>
                Super Admin
              </span>
            </div>
            <p className={`text-sm mt-1 max-w-2xl ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Gerenciador central de clientes, faturamento de mensalidades de manutenção e monitoramento de todas as lojas da plataforma.
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 pt-2 lg:pt-0">
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
            }`}
          >
            <Settings className={`h-4 w-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            <span>Configurar Pix / SaaS</span>
          </button>

          <button
            onClick={onOpenNewStoreModal}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Cliente / Nova Loja</span>
          </button>
        </div>
      </div>

      {/* Grid de Métricas Financeiras e Operacionais (MRR) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: MRR (Faturamento Recorrente Mensal) */}
        <div className={`p-5 rounded-2xl relative overflow-hidden group border transition ${
          isDark 
            ? 'bg-slate-900 border-slate-800 hover:border-emerald-500/40' 
            : 'bg-white border-slate-200 shadow-sm hover:border-emerald-500/40'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>MRR Recorrente</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {formatCurrency(currentMRR)}
              <span className={`text-xs font-medium ml-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>/mês</span>
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-medium">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>ARR Projetado: {formatCurrency(projectedARR)}/ano</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total de Clientes / Lojas */}
        <div className={`p-5 rounded-2xl relative overflow-hidden group border transition ${
          isDark 
            ? 'bg-slate-900 border-slate-800 hover:border-blue-500/40' 
            : 'bg-white border-slate-200 shadow-sm hover:border-blue-500/40'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Clientes & Lojas</span>
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {totalStores} <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>lojas cadastradas</span>
            </div>
            <div className="text-xs mt-1 flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{activeStoresCount} ativas</span>
              <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold">{pendingStoresCount} pendentes</span>
              <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold">{trialStoresCount} teste</span>
            </div>
          </div>
        </div>

        {/* Card 3: Total de Anúncios / Catálogo Hospedado */}
        <div className={`p-5 rounded-2xl relative overflow-hidden group border transition ${
          isDark 
            ? 'bg-slate-900 border-slate-800 hover:border-purple-500/40' 
            : 'bg-white border-slate-200 shadow-sm hover:border-purple-500/40'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Catálogo Hospedado</span>
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-500">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {totalItemsCount} <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>itens e anúncios</span>
            </div>
            <div className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Distribuídos nos 5 modelos de negócios
            </div>
          </div>
        </div>

        {/* Card 4: Oportunidades & Leads Gerados */}
        <div className={`p-5 rounded-2xl relative overflow-hidden group border transition ${
          isDark 
            ? 'bg-slate-900 border-slate-800 hover:border-amber-500/40' 
            : 'bg-white border-slate-200 shadow-sm hover:border-amber-500/40'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Propostas Geradas</span>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <MessageSquare className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {totalLeadsCount} <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>propostas formais</span>
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
              Convertidas para os lojistas
            </div>
          </div>
        </div>

      </div>

      {/* Navegação por Abas do Painel Master */}
      <div className={`flex items-center space-x-2 border-b pb-2 flex-wrap gap-y-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <button
          onClick={() => setActiveTab('clients')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'clients'
              ? 'bg-blue-600 text-white shadow-md'
              : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Gestão de Clientes & Mensalidades ({stores.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('proposals')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'proposals'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
              : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <MessageSquare className="h-4 w-4 text-amber-400" />
          <span>Todas as Propostas & Leads ({totalLeadsCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('plans')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'plans'
              ? 'bg-blue-600 text-white shadow-md'
              : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>Tabela de Planos SaaS & Preços</span>
        </button>

        <button
          onClick={() => setActiveTab('databases')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'databases'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
              : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Database className="h-4 w-4 text-emerald-400" />
          <span>Bancos de Dados Segregados (5 DBs)</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('emails');
            if (!emailStatus) {
              handleCheckEmailStatus();
            }
          }}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'emails'
              ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md'
              : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Mail className="h-4 w-4 text-sky-400" />
          <span>Envio de E-mails & SMTP</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('update');
            fetchSystemInfo();
            handleCheckForUpdates();
          }}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition relative ${
            activeTab === 'update'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
              : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${isCheckingUpdate ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
          <span>Atualizar Sistema da Nuvem (1 Clique)</span>
          {updateStatus?.hasUpdate ? (
            <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-red-500 text-white animate-pulse shadow-sm shadow-red-500/50">
              {updateStatus.commitsBehind > 1 ? `${updateStatus.commitsBehind} Novidades` : 'Nova Versão'}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/20 text-emerald-400">
              v.Online
            </span>
          )}
        </button>

        <button
          onClick={async () => {
            try {
              localStorage.removeItem('3facil_usuariosDB_stores_v5');
              localStorage.removeItem('3facil_autoDB_items_v5');
              localStorage.removeItem('3facil_imoveisDB_items_v5');
              localStorage.removeItem('3facil_lojaDB_items_v5');
              localStorage.removeItem('3facil_servicosDB_items_v5');
              setDbSuccessMessage('🧹 Cache limpo! Buscando imobiliárias e anúncios do PostgreSQL...');
              await refreshDatabaseStatus();
              setTimeout(() => setDbSuccessMessage(null), 4000);
            } catch (e: any) {
              alert('Erro ao limpar cache: ' + e.message);
            }
          }}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition border ${
            isDark 
              ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30' 
              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
          }`}
          title="Limpa cache e recarrega dados direto do PostgreSQL"
        >
          <RotateCcw className="h-4 w-4 text-rose-400" />
          <span>Limpar Cache & Forçar PostgreSQL</span>
        </button>
      </div>

      {emailAlert && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between animate-in fade-in ${
          emailAlert.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : emailAlert.type === 'error'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
        }`}>
          <div className="flex items-center gap-2">
            {emailAlert.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
            {emailAlert.type === 'error' && <AlertTriangle className="h-4 w-4 shrink-0" />}
            {emailAlert.type === 'info' && <Mail className="h-4 w-4 shrink-0" />}
            <span>{emailAlert.message}</span>
          </div>
          <button onClick={() => setEmailAlert(null)} className="text-slate-400 hover:text-white text-xs">
            Fechar
          </button>
        </div>
      )}

      {dbSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{dbSuccessMessage}</span>
          </div>
          <button onClick={() => setDbSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200 text-xs">
            Fechar
          </button>
        </div>
      )}

      {/* ABA 1: LISTAGEM E GESTÃO DE CLIENTES & LOJAS */}
      {activeTab === 'clients' && (
        <div className="space-y-4">
          
          {/* Filtros e Barra de Pesquisa */}
          <div className={`flex flex-col md:flex-row gap-3 items-center justify-between p-4 rounded-2xl border transition ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            
            {/* Campo de Busca */}
            <div className="relative w-full md:w-80">
              <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="Buscar por loja, cliente, WhatsApp..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-xl text-xs border focus:outline-none focus:border-blue-500 ${
                  isDark ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            {/* Filtros de Status e Tipo */}
            <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
              
              {/* Filtro Status da Mensalidade */}
              <div className="flex items-center space-x-1 text-xs">
                <span className={`hidden sm:inline ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`rounded-xl px-3 py-2 text-xs border focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                >
                  <option value="todos">Todos os Status ({stores.length})</option>
                  <option value="ativo">Ativos ({activeStoresCount})</option>
                  <option value="pendente">Vencidos / Pendentes ({pendingStoresCount})</option>
                  <option value="trial">Em Período de Teste ({trialStoresCount})</option>
                  <option value="suspenso">Suspensos ({suspendedStoresCount})</option>
                </select>
              </div>

              {/* Filtro Modelo de Loja */}
              <div className="flex items-center space-x-1 text-xs">
                <span className={`hidden sm:inline ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nicho:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className={`rounded-xl px-3 py-2 text-xs border focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                >
                  <option value="todos">Todos os Nichos</option>
                  <option value="veiculo">Veículos</option>
                  <option value="imovel">Imóveis</option>
                  <option value="produto">Produtos Físicos</option>
                  <option value="servico">Prestadores de Serviços</option>
                </select>
              </div>

            </div>
          </div>

          {/* Lista / Tabela de Clientes */}
          {filteredStores.length === 0 ? (
            <div className={`text-center py-12 rounded-2xl p-6 border ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <Users className={`h-10 w-10 mx-auto mb-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Nenhum cliente encontrado</h3>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tente ajustar os termos da pesquisa ou os filtros selecionados.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStores.map((store) => {
                const storeItemsCount = items.filter((i) => i.storeId === store.id).length;
                const storeLeadsCount = leads.filter((l) => l.storeId === store.id).length;

                return (
                  <div
                    key={store.id}
                    className={`border rounded-2xl p-4 sm:p-5 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                      store.subscriptionStatus === 'pendente'
                        ? isDark 
                          ? 'border-amber-500/40 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/20' 
                          : 'border-amber-400 bg-amber-50/50 shadow-sm'
                        : !store.isPublished || store.subscriptionStatus === 'suspenso'
                        ? isDark 
                          ? 'border-rose-900/50 bg-slate-950/60 opacity-85' 
                          : 'border-rose-300 bg-rose-50/50 opacity-85 shadow-sm'
                        : isDark 
                          ? 'bg-slate-900 border-slate-800 hover:border-slate-700' 
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    {/* Informações da Loja e Cliente */}
                    <div className="flex items-start space-x-3.5 min-w-0">
                      <div className={`p-3 rounded-2xl border shrink-0 ${
                        isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}>
                        {getStoreIcon(store.type)}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`text-base font-bold truncate max-w-xs sm:max-w-md ${
                            isDark ? 'text-white' : 'text-slate-900'
                          }`}>
                            {store.name}
                          </h3>
                          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md border ${
                            isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {getStoreTypeName(store.type)}
                          </span>
                          {getStatusBadge(store.subscriptionStatus, store.isPublished)}
                        </div>

                        {/* Detalhes do Cliente */}
                        <div className={`flex items-center flex-wrap gap-x-4 gap-y-1 text-xs ${
                          isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          <span className={`flex items-center gap-1 font-medium ${
                            isDark ? 'text-slate-300' : 'text-slate-800'
                          }`}>
                            <Users className="h-3 w-3 text-slate-500" />
                            {store.ownerName || 'Cliente Lojista'}
                          </span>
                          {store.ownerPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-emerald-500" />
                              {store.ownerPhone}
                            </span>
                          )}
                          {store.ownerEmail && (
                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                              <Mail className="h-3 w-3 text-blue-500" />
                              {store.ownerEmail}
                            </span>
                          )}
                        </div>

                        {/* Estatísticas da Loja */}
                        <div className={`flex items-center gap-3 text-[11px] pt-1 ${
                          isDark ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          <span>📦 {storeItemsCount} itens cadastrados</span>
                          <span>•</span>
                          <span>📬 {storeLeadsCount} propostas recebidas</span>
                          {store.internalNotes && (
                            <>
                              <span>•</span>
                              <span className={`italic truncate max-w-xs ${
                                isDark ? 'text-slate-400' : 'text-slate-600'
                              }`}>
                                "{store.internalNotes}"
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Dados Financeiros / Assinatura & Ações */}
                    <div className={`flex flex-col sm:flex-row lg:flex-col xl:flex-row sm:items-center justify-between lg:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 ${
                      isDark ? 'border-slate-800' : 'border-slate-200'
                    }`}>
                      
                      {/* Box da Mensalidade */}
                      <div className={`border rounded-xl p-2.5 px-3 min-w-[170px] text-left sm:text-right lg:text-left xl:text-right ${
                        isDark ? 'bg-slate-950 border-slate-800/80' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {store.planName || 'Plano Profissional'}
                        </div>
                        <div className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {formatCurrency(store.monthlyFee || 99.90)}
                          <span className={`text-[10px] font-normal ml-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>/mês</span>
                        </div>
                        <div className={`text-[11px] flex items-center sm:justify-end lg:justify-start xl:justify-end gap-1 mt-0.5 ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span>Vence: <strong className={store.subscriptionStatus === 'pendente' ? 'text-amber-500 font-bold' : isDark ? 'text-slate-200' : 'text-slate-700'}>{store.nextDueDate || '15/09/2026'}</strong></span>
                        </div>
                      </div>

                      {/* Botões de Ação do Super Admin */}
                      <div className="flex items-center flex-wrap gap-1.5">
                        
                        {/* 1. Cobrar via WhatsApp */}
                        <button
                          onClick={() => handleSendWhatsAppBilling(store)}
                          title="Enviar Cobrança / Notificação via WhatsApp"
                          className={`flex items-center space-x-1 px-2.5 py-2 rounded-xl text-xs font-semibold transition shadow-sm border ${
                            isDark
                              ? 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border-emerald-500/30'
                              : 'bg-emerald-100 hover:bg-emerald-600 text-emerald-800 hover:text-white border-emerald-300'
                          }`}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Cobrar</span>
                        </button>

                        {/* 2. Confirmar Pagamento (+30 dias) */}
                        <button
                          onClick={() => {
                            if (window.confirm(`Confirmar recebimento do pagamento de ${formatCurrency(store.monthlyFee || 99.90)} de ${store.name}? A assinatura será renovada por mais 30 dias.`)) {
                              markPaymentReceived(store.id);
                            }
                          }}
                          title="Confirmar Pagamento e Renovar 30 Dias"
                          className={`flex items-center space-x-1 px-2.5 py-2 rounded-xl text-xs font-semibold transition border ${
                            isDark
                              ? 'bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border-blue-500/30'
                              : 'bg-blue-100 hover:bg-blue-600 text-blue-800 hover:text-white border-blue-300'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Renovar</span>
                        </button>

                        {/* 3. Acessar Painel do Lojista */}
                        <button
                          onClick={() => onSelectStoreAndGoToAdmin(store.id)}
                          title="Acessar o Painel de Gestão desta Loja"
                          className={`p-2 rounded-xl border transition ${
                            isDark
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                              : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border-slate-200 shadow-sm'
                          }`}
                        >
                          <Settings className="h-4 w-4" />
                        </button>

                        {/* 4. Abrir Vitrine Pública */}
                        <button
                          onClick={() => onSelectStoreAndGoToPublic(store.id)}
                          title="Abrir Vitrine Pública da Loja"
                          className={`p-2 rounded-xl border transition ${
                            isDark
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                              : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border-slate-200 shadow-sm'
                          }`}
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* 5. Editar Assinatura & Dados do Cliente */}
                        <button
                          onClick={() => handleOpenEdit(store)}
                          title="Editar Assinatura e Dados do Cliente"
                          className={`p-2 rounded-xl border transition ${
                            isDark
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                              : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border-slate-200 shadow-sm'
                          }`}
                        >
                          <Edit className="h-4 w-4" />
                        </button>

                        {/* 6. Suspender / Reativar Loja */}
                        <button
                          onClick={() => toggleStorePublished(store.id)}
                          title={store.isPublished ? 'Suspender Loja do Ar' : 'Reativar Loja Online'}
                          className={`p-2 rounded-xl border transition ${
                            store.isPublished 
                              ? isDark
                                ? 'bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border-slate-700'
                                : 'bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border-slate-200 shadow-sm'
                              : 'bg-rose-600 text-white border-rose-600'
                          }`}
                        >
                          <Ban className="h-4 w-4" />
                        </button>

                        {/* 7. Excluir Loja */}
                        {stores.length > 1 && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Tem certeza que deseja excluir a loja "${store.name}" e todos os seus itens?`)) {
                                deleteStore(store.id);
                              }
                            }}
                            title="Excluir Loja"
                            className={`p-2 rounded-xl border transition ${
                              isDark
                                ? 'bg-slate-800 hover:bg-rose-900/60 text-slate-500 hover:text-rose-400 border-slate-700'
                                : 'bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border-slate-200 shadow-sm'
                            }`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}

                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ABA 2: TABELA DE PLANOS SAAS & SIMULADOR */}
      {/* ABA PROPOSTAS & LEADS GLOBAIS DO SAAS */}
      {activeTab === 'proposals' && (
        <div className="space-y-4">
          <div className={`p-6 rounded-3xl border transition ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/40">
              <div>
                <h2 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Central Unificada de Propostas & Leads ({leads.length})
                </h2>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Acompanhe todas as cotações, propostas formais geradas e leads recebidos pelos lojistas em toda a plataforma.
                </p>
              </div>

              {/* Filtro por Loja */}
              <div className="flex items-center space-x-2">
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Filtrar Loja:</span>
                <select
                  value={leadStoreFilter}
                  onChange={(e) => setLeadStoreFilter(e.target.value)}
                  className={`px-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:border-blue-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="todos">Todas as Lojas ({leads.length} leads)</option>
                  {stores.map((s) => {
                    const count = leads.filter((l) => l.storeId === s.id).length;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Listagem de Propostas */}
            {(() => {
              const displayLeads = leadStoreFilter === 'todos' 
                ? leads 
                : leads.filter((l) => l.storeId === leadStoreFilter);

              if (displayLeads.length === 0) {
                return (
                  <div className="text-center py-12 space-y-2">
                    <MessageSquare className="h-10 w-10 mx-auto text-slate-500/40" />
                    <p className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Nenhuma proposta encontrada para o filtro selecionado.
                    </p>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Quando clientes enviarem propostas formais nas vitrines, elas serão listadas em tempo real aqui.
                    </p>
                  </div>
                );
              }

              return (
                <div className="mt-4 space-y-3">
                  {displayLeads.map((lead) => {
                    const store = stores.find((s) => s.id === lead.storeId);
                    return (
                      <div
                        key={lead.id}
                        className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                          isDark
                            ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300 shadow-sm'
                        }`}
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="font-bold text-sm">{lead.customerName}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              lead.status === 'novo'
                                ? 'bg-sky-500/20 text-sky-400'
                                : lead.status === 'atendido'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {lead.status}
                            </span>
                            {store && (
                              <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border ${
                                isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                              }`}>
                                Loja: {store.name}
                              </span>
                            )}
                          </div>

                          <div className={`text-xs flex items-center flex-wrap gap-x-4 gap-y-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {lead.customerPhone && (
                              <span className="flex items-center gap-1 font-mono">
                                <Phone className="h-3 w-3 text-emerald-400" />
                                {lead.customerPhone}
                              </span>
                            )}
                            {lead.customerEmail && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3 text-sky-400" />
                                {lead.customerEmail}
                              </span>
                            )}
                            {lead.customerCity && (
                              <span>📍 {lead.customerCity} - {lead.customerState || 'BR'}</span>
                            )}
                            <span className="text-[11px] opacity-75">
                              📅 {new Date(lead.createdAt).toLocaleDateString('pt-BR')} às {new Date(lead.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {lead.notes && (
                            <p className={`text-xs italic mt-1 line-clamp-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              "{lead.notes}"
                            </p>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          {lead.customerPhone && (
                            <a
                              href={`https://wa.me/55${lead.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${lead.customerName}! Recebemos sua proposta na plataforma 3facil.com.`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center space-x-1 shadow-sm"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              <span>WhatsApp</span>
                            </a>
                          )}
                          {store && (
                            <button
                              onClick={() => onSelectStoreAndGoToAdmin(store.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center space-x-1 ${
                                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              <Store className="h-3.5 w-3.5" />
                              <span>Painel da Loja</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* ABA 2: TABELA DE PLANOS SAAS */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
            <div className="max-w-2xl">
              <h2 className="text-lg font-bold text-white">Planos de Assinatura Recomendados para seus Clientes</h2>
              <p className="text-xs text-slate-400 mt-1">
                Estruture suas mensalidades de manutenção e suporte recorrente para cada tipo de cliente na sua plataforma.
              </p>
            </div>

            {/* Grid dos Planos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`bg-slate-950 rounded-2xl p-5 border flex flex-col justify-between relative ${
                    plan.highlighted
                      ? 'border-blue-500 shadow-xl shadow-blue-500/10'
                      : 'border-slate-800'
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-3 right-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-md">
                      {plan.badge}
                    </span>
                  )}

                  <div>
                    <h3 className="text-base font-bold text-white">{plan.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 min-h-[32px]">{plan.description}</p>
                    
                    <div className="mt-4 pt-4 border-t border-slate-800/80">
                      <div className="text-2xl font-black text-white">
                        {formatCurrency(plan.price)}
                        <span className="text-xs font-normal text-slate-400">/mês</span>
                      </div>
                      <div className="text-[11px] text-blue-400 font-medium mt-0.5">
                        {plan.maxItems >= 9999 ? 'Itens Ilimitados' : `Até ${plan.maxItems} itens ativos`}
                      </div>
                    </div>

                    <ul className="mt-4 space-y-2 text-xs text-slate-300">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80">
                    <button
                      onClick={onOpenNewStoreModal}
                      className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition"
                    >
                      Cadastrar Cliente neste Plano
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Simulador de Faturamento SaaS */}
            <div className="mt-8 bg-slate-950 border border-slate-800/90 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                Simulador de Escala de Receita SaaS (R$ 30,00/mês)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Projeção de faturamento recorrente mensal com base no número de clientes ativos na plataforma 3facil.com (R$ 30,00/mês fixo):
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
                  <div className="text-xs text-slate-400">10 Lojas</div>
                  <div className="text-base font-black text-emerald-400 mt-1">R$ 300,00/mês</div>
                  <div className="text-[10px] text-slate-500">R$ 3.600/ano</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
                  <div className="text-xs text-slate-400">50 Lojas</div>
                  <div className="text-base font-black text-emerald-400 mt-1">R$ 1.500,00/mês</div>
                  <div className="text-[10px] text-slate-500">R$ 18.000/ano</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
                  <div className="text-xs text-slate-400">100 Lojas</div>
                  <div className="text-base font-black text-emerald-400 mt-1">R$ 3.000,00/mês</div>
                  <div className="text-[10px] text-slate-500">R$ 36.000/ano</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
                  <div className="text-xs text-slate-400">500 Lojas</div>
                  <div className="text-base font-black text-blue-400 mt-1">R$ 15.000,00/mês</div>
                  <div className="text-[10px] text-slate-500">R$ 180.000/ano</div>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ABA 3: GERENCIAMENTO DE BANCOS DE DADOS SEGREGADOS */}
      {activeTab === 'databases' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Card de Status PostgreSQL em Tempo Real */}
          <div className={`p-5 sm:p-6 rounded-2xl border ${
            isPostgresConnected 
              ? isDark 
                ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 border-emerald-500/30 shadow-lg' 
                : 'bg-emerald-50/70 border-emerald-300 shadow-sm'
              : isDark 
                ? 'bg-slate-900 border-slate-800' 
                : 'bg-white border-slate-200'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start space-x-3.5">
                <div className={`p-3 rounded-2xl border shrink-0 ${
                  isPostgresConnected
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  <Server className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      PostgreSQL 14+ (3facil_db)
                    </h3>
                    {isPostgresConnected ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        Conectado ao Backend PostgreSQL
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        Cache Local Ativo (Aguardando Conexão PG)
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Arquitetura multi-tenant com 5 schemas isolados: <code className="text-emerald-400 font-mono text-[11px]">usuarios</code>, <code className="text-blue-400 font-mono text-[11px]">autos</code>, <code className="text-purple-400 font-mono text-[11px]">imoveis</code>, <code className="text-amber-400 font-mono text-[11px]">loja</code>, <code className="text-cyan-400 font-mono text-[11px]">servicos</code>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={async () => {
                    setIsRefreshingDb(true);
                    await refreshDatabaseStatus();
                    setTimeout(() => setIsRefreshingDb(false), 600);
                  }}
                  disabled={isRefreshingDb}
                  className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingDb ? 'animate-spin text-emerald-400' : ''}`} />
                  <span>{isRefreshingDb ? 'Verificando...' : 'Testar Conexão'}</span>
                </button>
              </div>
            </div>

            {/* Contadores dos Schemas PostgreSQL */}
            {postgresStats && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4 pt-4 border-t border-slate-800/80 text-xs">
                <div className={`p-2.5 rounded-xl border text-center ${isDark ? 'bg-slate-950 border-slate-800/60' : 'bg-white border-slate-200'}`}>
                  <div className="text-slate-400 text-[10px] uppercase font-bold">usuarios.lojas</div>
                  <div className="text-base font-black text-indigo-400 mt-0.5">{postgresStats.lojas_count || 0}</div>
                </div>
                <div className={`p-2.5 rounded-xl border text-center ${isDark ? 'bg-slate-950 border-slate-800/60' : 'bg-white border-slate-200'}`}>
                  <div className="text-slate-400 text-[10px] uppercase font-bold">autos.estoque</div>
                  <div className="text-base font-black text-blue-400 mt-0.5">{postgresStats.autos_count || 0}</div>
                </div>
                <div className={`p-2.5 rounded-xl border text-center ${isDark ? 'bg-slate-950 border-slate-800/60' : 'bg-white border-slate-200'}`}>
                  <div className="text-slate-400 text-[10px] uppercase font-bold">imoveis.catalogo</div>
                  <div className="text-base font-black text-purple-400 mt-0.5">{postgresStats.imoveis_count || 0}</div>
                </div>
                <div className={`p-2.5 rounded-xl border text-center ${isDark ? 'bg-slate-950 border-slate-800/60' : 'bg-white border-slate-200'}`}>
                  <div className="text-slate-400 text-[10px] uppercase font-bold">loja.produtos</div>
                  <div className="text-base font-black text-amber-400 mt-0.5">{postgresStats.produtos_count || 0}</div>
                </div>
                <div className={`p-2.5 rounded-xl border text-center ${isDark ? 'bg-slate-950 border-slate-800/60' : 'bg-white border-slate-200'}`}>
                  <div className="text-slate-400 text-[10px] uppercase font-bold">servicos.catalogo</div>
                  <div className="text-base font-black text-cyan-400 mt-0.5">{postgresStats.servicos_count || 0}</div>
                </div>
              </div>
            )}
          </div>

          {/* Header e Ação de Export Geral */}
          <div className={`p-5 sm:p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-emerald-400" />
                <h2 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Cluster de Bancos de Dados Segregados (3facil.com)
                </h2>
              </div>
              <p className={`text-xs mt-1 max-w-2xl ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Os dados da plataforma são divididos em 5 módulos isolados: <strong>usuariosDB</strong>, <strong>autoDB</strong>, <strong>imoveisDB</strong>, <strong>lojaDB</strong> e <strong>servicosDB</strong>. Isso garante máxima escalabilidade, segurança e independência para cada modelo de negócio.
              </p>
            </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={handleExportSqlScript}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-md transition active:scale-95"
                  title="Gera um arquivo .sql com todas as lojas e itens para rodar direto no pgAdmin (F5)"
                >
                  <Database className="h-4 w-4" />
                  <span>Gerar Carga SQL para pgAdmin (.sql)</span>
                </button>

                <button
                  onClick={handleMigrateAllToPostgres}
                  disabled={isMigratingToPg}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isMigratingToPg ? 'animate-spin' : ''}`} />
                  <span>{isMigratingToPg ? 'Migrando para Postgres...' : 'Sincronizar Tudo no PostgreSQL'}</span>
                </button>

                <button
                  onClick={() => handleDownloadDatabase('all')}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition active:scale-95"
                >
                  <Download className="h-4 w-4" />
                  <span>Exportar Todos os 5 DBs (JSON)</span>
                </button>
              </div>
          </div>

          {/* Grid com os 5 Bancos de Dados Segregados */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            
            {/* DB 1: usuariosDB */}
            <div className={`p-5 rounded-2xl border flex flex-col justify-between ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">usuariosDB</h3>
                      <span className="text-[10px] text-slate-400 font-mono">Autenticação & SaaS</span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                    Online
                  </span>
                </div>

                <p className={`text-xs mb-4 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Armazena contas de usuários, lojas cadastradas, assinaturas de R$ 30,00/mês, status de pagamento Pix e credenciais.
                </p>

                <div className={`p-3 rounded-xl mb-4 space-y-1.5 text-xs ${isDark ? 'bg-slate-950 border border-slate-800' : 'bg-slate-50 border border-slate-200'}`}>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Lojas Registradas:</span>
                    <strong className="text-white">{dbStats.usuariosDB.storesCount}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tamanho Estimado:</span>
                    <span className="font-mono text-emerald-400 font-bold">{(dbStats.usuariosDB.sizeBytes / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => handleDownloadDatabase('usuariosDB')}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Backup JSON</span>
                </button>
                <button
                  onClick={() => handleResetSingleDb('usuariosDB', 'usuariosDB (Contas)')}
                  title="Resetar apenas este banco de dados"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* DB 2: autoDB */}
            <div className={`p-5 rounded-2xl border flex flex-col justify-between ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                      <Car className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">autoDB</h3>
                      <span className="text-[10px] text-slate-400 font-mono">Veículos & Seminovos</span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                    Online
                  </span>
                </div>

                <p className={`text-xs mb-4 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Catálogo de carros, motos e caminhões, ficha técnica FIPE, quilometragem, combustível, opcionais e propostas de veículos.
                </p>

                <div className={`p-3 rounded-xl mb-4 space-y-1.5 text-xs ${isDark ? 'bg-slate-950 border border-slate-800' : 'bg-slate-50 border border-slate-200'}`}>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Veículos Anunciados:</span>
                    <strong className="text-white">{dbStats.autoDB.itemsCount}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Propostas Recebidas:</span>
                    <strong className="text-emerald-400">{dbStats.autoDB.leadsCount}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tamanho Estimado:</span>
                    <span className="font-mono text-emerald-400 font-bold">{(dbStats.autoDB.sizeBytes / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => handleDownloadDatabase('autoDB')}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Backup JSON</span>
                </button>
                <button
                  onClick={() => handleResetSingleDb('autoDB', 'autoDB (Veículos)')}
                  title="Resetar apenas este banco de dados"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* DB 3: imoveisDB */}
            <div className={`p-5 rounded-2xl border flex flex-col justify-between ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Home className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">imoveisDB</h3>
                      <span className="text-[10px] text-slate-400 font-mono">Imóveis & Corretagem</span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                    Online
                  </span>
                </div>

                <p className={`text-xs mb-4 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Casas, apartamentos, terrenos, metragens (m²), quartos, suítes, valores de IPTU/condomínio e propostas de compra/locação.
                </p>

                <div className={`p-3 rounded-xl mb-4 space-y-1.5 text-xs ${isDark ? 'bg-slate-950 border border-slate-800' : 'bg-slate-50 border border-slate-200'}`}>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Imóveis Ativos:</span>
                    <strong className="text-white">{dbStats.imoveisDB.itemsCount}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Propostas Recebidas:</span>
                    <strong className="text-emerald-400">{dbStats.imoveisDB.leadsCount}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tamanho Estimado:</span>
                    <span className="font-mono text-emerald-400 font-bold">{(dbStats.imoveisDB.sizeBytes / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => handleDownloadDatabase('imoveisDB')}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Backup JSON</span>
                </button>
                <button
                  onClick={() => handleResetSingleDb('imoveisDB', 'imoveisDB (Imóveis)')}
                  title="Resetar apenas este banco de dados"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* DB 4: lojaDB */}
            <div className={`p-5 rounded-2xl border flex flex-col justify-between ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">lojaDB</h3>
                      <span className="text-[10px] text-slate-400 font-mono">Produtos & Varejo</span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                    Online
                  </span>
                </div>

                <p className={`text-xs mb-4 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Catálogo de produtos físicos, código SKU, estoque, tamanhos, cores, preços promocionais e pedidos via WhatsApp.
                </p>

                <div className={`p-3 rounded-xl mb-4 space-y-1.5 text-xs ${isDark ? 'bg-slate-950 border border-slate-800' : 'bg-slate-50 border border-slate-200'}`}>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Produtos no Catálogo:</span>
                    <strong className="text-white">{dbStats.lojaDB.itemsCount}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pedidos Recebidos:</span>
                    <strong className="text-emerald-400">{dbStats.lojaDB.leadsCount}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tamanho Estimado:</span>
                    <span className="font-mono text-emerald-400 font-bold">{(dbStats.lojaDB.sizeBytes / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => handleDownloadDatabase('lojaDB')}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Backup JSON</span>
                </button>
                <button
                  onClick={() => handleResetSingleDb('lojaDB', 'lojaDB (Produtos)')}
                  title="Resetar apenas este banco de dados"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* DB 5: servicosDB */}
            <div className={`p-5 rounded-2xl border flex flex-col justify-between ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">servicosDB</h3>
                      <span className="text-[10px] text-slate-400 font-mono">Prestadores & Escopos</span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                    Online
                  </span>
                </div>

                <p className={`text-xs mb-4 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Pacotes de serviços, escopos de trabalho, prazos de entrega, modalidades de cobrança e solicitações de orçamentos.
                </p>

                <div className={`p-3 rounded-xl mb-4 space-y-1.5 text-xs ${isDark ? 'bg-slate-950 border border-slate-800' : 'bg-slate-50 border border-slate-200'}`}>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Serviços Listados:</span>
                    <strong className="text-white">{dbStats.servicosDB.itemsCount}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Orçamentos Solicitados:</span>
                    <strong className="text-emerald-400">{dbStats.servicosDB.leadsCount}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tamanho Estimado:</span>
                    <span className="font-mono text-emerald-400 font-bold">{(dbStats.servicosDB.sizeBytes / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => handleDownloadDatabase('servicosDB')}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Backup JSON</span>
                </button>
                <button
                  onClick={() => handleResetSingleDb('servicosDB', 'servicosDB (Serviços)')}
                  title="Resetar apenas este banco de dados"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

          </div>

          {/* Seção de Recomendações e Arquitetura */}
          <div className={`p-6 rounded-2xl border ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <h3 className="text-sm sm:text-base font-bold flex items-center gap-2 mb-3">
              <Server className="h-4 w-4 text-blue-400" />
              <span>Recomendações de Engenharia para Bancos Segregados</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <h4 className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  1. Por que esta separação é excelente?
                </h4>
                <p className={`leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Cada nicho possui atributos 100% únicos (ex: Tabela FIPE em <code>autoDB</code>, m² e suítes em <code>imoveisDB</code>, SKU/Estoque em <code>lojaDB</code>). A segregação evita tabelas "monstruosas" cheias de colunas vazias (nulls), acelerando consultas e buscas com indexação perfeita.
                </p>
              </div>

              <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <h4 className="font-bold text-blue-400 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  2. Segurança & Multi-Tenant Isolado
                </h4>
                <p className={`leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  O <code>usuariosDB</code> guarda dados sensíveis (senhas, documentos, planos de R$ 30,00). Os bancos de catálogo contêm apenas os anúncios. Um vazamento ou erro em um nicho jamais compromete os dados cadastrais da plataforma.
                </p>
              </div>

              <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <h4 className="font-bold text-purple-400 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  3. Integração Externa por Nicho
                </h4>
                <p className={`leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Permite exportar e sincronizar o <code>autoDB</code> diretamente com portais como Webmotors/iCarros, e o <code>imoveisDB</code> com VivaReal/Zap Imóveis via API ou XML sem misturar produtos de vestuário ou serviços.
                </p>
              </div>

              <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <h4 className="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  4. Escalabilidade & Microserviços
                </h4>
                <p className={`leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Se o segmento de veículos crescer mais rápido, você pode migrar apenas o <code>autoDB</code> para um servidor ou banco PostgreSQL dedicado de alta performance sem precisar reescrever a plataforma inteira.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ABA 4: GESTÃO DE E-MAILS & SMTP */}
      {activeTab === 'emails' && (
        <div className="space-y-6">
          
          {/* Header e Status da Conexão SMTP */}
          <div className={`p-6 rounded-3xl border transition ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start space-x-3.5">
                <div className={`p-3 rounded-2xl border ${
                  emailStatus?.connected 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                    : emailStatus?.configured 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                }`}>
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Serviço de E-mails Transacionais & Confirmação de Cadastro
                    </h2>
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                      emailStatus?.connected 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' 
                        : emailStatus?.configured 
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                        : 'bg-sky-500/20 text-sky-300 border-sky-400/30'
                    }`}>
                      {emailStatus?.connected 
                        ? 'SMTP Conectado & Autenticado' 
                        : emailStatus?.configured 
                        ? 'SMTP Configurado (Verificando)' 
                        : 'Modo Simulado / Aguardando .env'}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 max-w-3xl ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Disparo automático de e-mails de boas-vindas com dados de acesso para novos clientes cadastrados, além de notificações de orçamentos e propostas para os lojistas.
                  </p>
                </div>
              </div>

              <button
                onClick={handleCheckEmailStatus}
                disabled={isCheckingEmail}
                className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition active:scale-95 shrink-0"
              >
                <RefreshCw className={`h-4 w-4 ${isCheckingEmail ? 'animate-spin text-sky-400' : 'text-slate-400'}`} />
                <span>{isCheckingEmail ? 'Testando Conexão...' : 'Testar Conexão SMTP'}</span>
              </button>
            </div>

            {/* Detalhes Técnicos Atuais */}
            <div className={`mt-5 p-4 rounded-2xl border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs ${
              isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <span className={`block font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Servidor Host (SMTP_HOST):</span>
                <span className={`font-mono font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {emailStatus?.host || 'smtp.gmail.com'}
                </span>
              </div>
              <div>
                <span className={`block font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Porta (SMTP_PORT):</span>
                <span className={`font-mono font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {emailStatus?.port || 587} (TLS/STARTTLS)
                </span>
              </div>
              <div>
                <span className={`block font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Usuário Remetente (SMTP_USER):</span>
                <span className={`font-mono font-bold truncate block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {emailStatus?.user || 'contato@3facil.com'}
                </span>
              </div>
              <div>
                <span className={`block font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Disparo Automático:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" /> Ativo em Novos Cadastros
                </span>
              </div>
            </div>
          </div>

          {/* Bloco Interativo: Formulário de Configuração Direta de SMTP */}
          <div className={`p-6 rounded-3xl border ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Configurar Credenciais SMTP Diretamente pelo Painel
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Preencha os dados abaixo para salvar no servidor e ativar o envio real de e-mails instantaneamente.
                  </p>
                </div>
              </div>

              {/* Botões de Preenchimento Rápido (Presets) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400 font-medium mr-1">Preenchimento Rápido:</span>
                <button
                  type="button"
                  onClick={() => applySmtpPreset('gmail')}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/30 transition"
                >
                  Gmail / Workspace
                </button>
                <button
                  type="button"
                  onClick={() => applySmtpPreset('hostinger')}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/30 transition"
                >
                  Hostinger
                </button>
                <button
                  type="button"
                  onClick={() => applySmtpPreset('titan')}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 border border-blue-500/30 transition"
                >
                  Titan Mail
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveSmtpConfig} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Host */}
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Servidor Host (SMTP_HOST):
                  </label>
                  <input
                    type="text"
                    required
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="ex: smtp.gmail.com"
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border transition outline-none ${
                      isDark 
                        ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500'
                    }`}
                  />
                </div>

                {/* Porta */}
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Porta (SMTP_PORT):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      required
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(Number(e.target.value))}
                      placeholder="587 ou 465"
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border transition outline-none ${
                        isDark 
                          ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                          : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500'
                      }`}
                    />
                    <label className="flex items-center space-x-1.5 text-xs text-slate-400 shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smtpSecure}
                        onChange={(e) => setSmtpSecure(e.target.checked)}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                      />
                      <span>SSL/TLS (Porta 465)</span>
                    </label>
                  </div>
                </div>

                {/* Usuário / E-mail */}
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Usuário / E-mail Remetente (SMTP_USER):
                  </label>
                  <input
                    type="text"
                    required
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="ex: site3facil@gmail.com"
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border transition outline-none ${
                      isDark 
                        ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500'
                    }`}
                  />
                </div>

                {/* Senha */}
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Senha do E-mail / Senha de App (SMTP_PASS):
                  </label>
                  <div className="relative">
                    <input
                      type={showSmtpPass ? 'text' : 'password'}
                      required
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="Senha do e-mail ou Senha de Aplicativo"
                      className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl text-xs font-mono border transition outline-none ${
                        isDark 
                          ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                          : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPass(!showSmtpPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                    >
                      {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Nome de Exibição / From */}
                <div className="sm:col-span-2">
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Nome e Cabeçalho do Remetente (SMTP_FROM):
                  </label>
                  <input
                    type="text"
                    value={smtpFrom}
                    onChange={(e) => setSmtpFrom(e.target.value)}
                    placeholder='"3Fácil Plataforma" <contato@3facil.com>'
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs border transition outline-none ${
                      isDark 
                        ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500'
                    }`}
                  />
                </div>

              </div>

              {/* Dica do Gmail */}
              <div className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Importante para contas Gmail / Google Workspace:</strong> O Google não aceita sua senha comum por segurança. Você deve ativar a <em>Verificação em 2 Etapas</em> da Conta Google e gerar uma <strong>Senha de Aplicativo (16 letras)</strong> no link: <code className="bg-black/30 px-1 py-0.5 rounded text-amber-200">myaccount.google.com/apppasswords</code>. Cole essa senha de 16 caracteres no campo de senha acima.
                </div>
              </div>

              {/* Botão de Salvar */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingSmtp}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition flex items-center justify-center space-x-2"
                >
                  {isSavingSmtp ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Testando e Salvando Credenciais...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Salvar e Ativar SMTP Agora</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Grid: Formulário de Teste de E-mail + Guia de Configuração */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Bloco 1: Enviar E-mail de Teste */}
            <div className={`p-6 rounded-3xl border flex flex-col justify-between ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div>
                <div className="flex items-center space-x-2.5 mb-2">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Send className="h-4 w-4" />
                  </div>
                  <h3 className={`text-sm sm:text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Disparar E-mail de Teste
                  </h3>
                </div>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-4`}>
                  Informe um endereço de e-mail para validar imediatamente a entrega de mensagens pelo seu servidor SMTP.
                </p>

                <form onSubmit={handleSendTestEmail} className="space-y-3">
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      E-mail do Destinatário:
                    </label>
                    <input
                      type="email"
                      required
                      value={testEmailTarget}
                      onChange={(e) => setTestEmailTarget(e.target.value)}
                      placeholder="ex: seuemail@gmail.com"
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs border transition outline-none ${
                        isDark 
                          ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500' 
                          : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
                      }`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSendingTestEmail || !testEmailTarget.trim()}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition flex items-center justify-center space-x-2"
                  >
                    {isSendingTestEmail ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Enviando Teste...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Enviar Mensagem de Teste Agora</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              <div className={`mt-5 p-3.5 rounded-xl border text-[11px] leading-relaxed ${
                isDark ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                💡 <strong>Como funciona:</strong> Ao cadastrar uma nova loja pelo botão "Novo Cliente" ou na Landing Page, o sistema dispara automaticamente um e-mail com layout profissional contendo os dados do plano, link da vitrine e link do painel administrativo.
              </div>
            </div>

            {/* Bloco 2: O que falta para funcionar / Guia de Configuração SMTP no .env */}
            <div className={`p-6 rounded-3xl border ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center space-x-2.5 mb-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h3 className={`text-sm sm:text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  O que é necessário para o Envio Real de E-mails?
                </h3>
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-3`}>
                O código de envio com <code>nodemailer</code> já está 100% implementado e ativo no backend. Para enviar via internet a partir do seu servidor VPS, basta colocar suas credenciais SMTP no arquivo <code>.env</code>:
              </p>

              <div className="space-y-2 text-xs">
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="font-bold text-sky-400 block mb-1">Opção A: Hostinger / Titan / cPanel</span>
                  <code className="text-[11px] block font-mono text-slate-300">
                    SMTP_HOST=smtp.hostinger.com<br />
                    SMTP_PORT=465<br />
                    SMTP_SECURE=true<br />
                    SMTP_USER=contato@seudominio.com<br />
                    SMTP_PASS=SuaSenhaDoEmail
                  </code>
                </div>

                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="font-bold text-emerald-400 block mb-1">Opção B: Gmail / Google Workspace</span>
                  <code className="text-[11px] block font-mono text-slate-300">
                    SMTP_HOST=smtp.gmail.com<br />
                    SMTP_PORT=587<br />
                    SMTP_SECURE=false<br />
                    SMTP_USER=seuemail@gmail.com<br />
                    SMTP_PASS=abcd efgh ijkl mnop (Senha de Aplicativo do Google)
                  </code>
                </div>
              </div>
            </div>

          </div>

          {/* Bloco 3: Reenviar E-mails de Confirmação para Lojas Existentes */}
          <div className={`p-6 rounded-3xl border ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className={`text-sm sm:text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Clientes Cadastrados & Disparo Manual de Confirmação
                </h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Clique em "Reenviar Confirmação" para enviar o e-mail de boas-vindas para o responsável de cada loja.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {stores.length} lojas registradas
              </span>
            </div>

            <div className="divide-y divide-slate-800/60 overflow-hidden">
              {stores.map((store) => (
                <div key={store.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 px-3 rounded-xl transition">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm" style={{ backgroundColor: store.themeColor || '#2563eb' }}>
                      {store.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{store.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                          {store.slug}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                        <span>👤 {store.ownerName || 'Cliente'}</span>
                        <span>✉️ {store.ownerEmail || store.email}</span>
                        <span>📱 {store.whatsapp}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-center">
                    <button
                      onClick={() => handleReSendWelcomeEmail(store)}
                      disabled={resendingEmailForStoreId === store.id}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 text-xs font-semibold transition active:scale-95 disabled:opacity-50"
                    >
                      {resendingEmailForStoreId === store.id ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Mail className="h-3.5 w-3.5" />
                          <span>Reenviar Confirmação</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ABA 5: ATUALIZAÇÃO DO SISTEMA DA NUVEM (AUTO-DEPLOY 1-CLIQUE) */}
      {activeTab === 'update' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {updateAlert && (
            <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between animate-in fade-in ${
              updateAlert.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                : updateAlert.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-500'
            }`}>
              <span>{updateAlert.message}</span>
              <button onClick={() => setUpdateAlert(null)} className="text-slate-400 hover:text-white ml-2">✕</button>
            </div>
          )}

          {/* Top Banner de Atualização Remota */}
          <div className={`p-6 sm:p-8 rounded-3xl border ${
            isDark 
              ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border-slate-800' 
              : 'bg-gradient-to-br from-white via-amber-50/40 to-orange-50/40 border-slate-200 shadow-sm'
          }`}>
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center space-x-2">
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <RefreshCw className={`h-6 w-6 ${isUpdatingSystem ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                    <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Atualização Automática do Servidor (VPS)
                    </h2>
                    <span className="text-xs text-amber-500 font-semibold">
                      Auto-Deploy com 1 Clique sem precisar de terminal SSH
                    </span>
                  </div>
                </div>

                <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Ao clicar no botão abaixo, o próprio backend do seu servidor executará os comandos <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">git pull</code> (para puxar todo o código novo), <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">npm install</code>, <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">npm run build</code> e reiniciará o serviço no <strong>PM2</strong>.
                </p>
              </div>

              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <button
                  onClick={handleTriggerSystemUpdate}
                  disabled={isUpdatingSystem}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 transition active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isUpdatingSystem ? 'animate-spin' : ''}`} />
                  <span>{isUpdatingSystem ? 'Atualizando Servidor...' : 'Atualizar Sistema Agora (1 Clique)'}</span>
                </button>

                <button
                  onClick={() => handleCheckForUpdates(true)}
                  disabled={isCheckingUpdate}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition flex items-center justify-center space-x-1.5 ${
                    isDark 
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' 
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
                  }`}
                >
                  <GitPullRequest className={`h-3.5 w-3.5 ${isCheckingUpdate ? 'animate-spin text-amber-400' : 'text-amber-500'}`} />
                  <span>{isCheckingUpdate ? 'Verificando GitHub...' : 'Verificar se há Novidades no GitHub'}</span>
                </button>
              </div>
            </div>

            {/* SEÇÃO: Enviar Atualização por Arquivo .ZIP (Direto pelo Navegador) */}
            <div className={`mt-6 p-5 sm:p-6 rounded-2xl border ${
              isDark 
                ? 'bg-blue-950/20 border-blue-500/30' 
                : 'bg-blue-50/70 border-blue-200'
            }`}>
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="flex items-start space-x-3.5">
                  <div className="p-3 rounded-2xl bg-blue-500/20 text-blue-400 shrink-0">
                    <FileArchive className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className={`text-sm sm:text-base font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <span>Subir Atualização por Arquivo (.ZIP)</span>
                      <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">
                        Sem Git / Sem FileZilla
                      </span>
                    </h4>
                    <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Baixe o <strong>.zip</strong> do projeto no AI Studio (ou GitHub) e envie aqui. O servidor substitui os arquivos modificados, roda o build e reinicia o PM2 automaticamente.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 w-full sm:w-auto">
                  <label className={`cursor-pointer px-5 py-3 rounded-2xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-lg ${
                    isUploadingZip
                      ? 'bg-blue-500/50 text-white cursor-wait'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25 active:scale-95'
                  }`}>
                    {isUploadingZip ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span>{isUploadingZip ? 'Enviando & Instalando ZIP...' : 'Selecionar e Enviar .ZIP'}</span>
                    <input
                      type="file"
                      accept=".zip,application/zip,application/x-zip-compressed"
                      onChange={handleZipUpload}
                      disabled={isUploadingZip}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {zipProgressText && (
                <div className="mt-4 pt-3 border-t border-blue-500/20 flex items-center space-x-2 text-xs font-medium text-blue-400 animate-pulse">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
                  <span>{zipProgressText}</span>
                </div>
              )}
            </div>

            {/* Card de Status do GitHub & Novidades Pendentes */}
            {updateStatus && (
              <div className={`mt-6 p-5 rounded-2xl border transition-all ${
                updateStatus.hasUpdate
                  ? isDark 
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-300' 
                    : 'bg-amber-50/90 border-amber-300 text-amber-900 shadow-sm'
                  : isDark 
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' 
                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-xl mt-0.5 ${
                      updateStatus.hasUpdate ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'
                    }`}>
                      {updateStatus.hasUpdate ? (
                        <ArrowUpCircle className="h-5 w-5 animate-bounce" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-sm">
                          {updateStatus.hasUpdate 
                            ? `🔥 ${updateStatus.commitsBehind} Nova(s) Atualização(ões) Disponível(is) no GitHub!` 
                            : '✅ Sistema 100% Sincronizado com o GitHub'}
                        </h4>
                        {updateStatus.hasUpdate && (
                          <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-red-500 text-white animate-pulse">
                            Pronto para Instalar
                          </span>
                        )}
                      </div>
                      <p className="text-xs opacity-90 mt-0.5">
                        {updateStatus.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => handleCheckForUpdates(true)}
                      disabled={isCheckingUpdate}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-black/20 hover:bg-black/30 transition flex items-center space-x-1"
                    >
                      <RefreshCw className={`h-3 w-3 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                      <span>Rechecar</span>
                    </button>
                  </div>
                </div>

                {/* Lista de commits pendentes */}
                {updateStatus.hasUpdate && updateStatus.pendingCommits && updateStatus.pendingCommits.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-amber-500/20 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider block text-amber-400">
                      O que será atualizado no seu servidor:
                    </span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {updateStatus.pendingCommits.map((commit, idx) => (
                        <div key={idx} className="flex items-center space-x-2 text-xs font-mono bg-black/30 px-3 py-1.5 rounded-xl border border-white/5">
                          <GitBranch className="h-3 w-3 text-amber-400 shrink-0" />
                          <span className="truncate">{commit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Informações do Sistema em Produção */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-800/80">
              <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800/80' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[11px] text-slate-400 block mb-0.5 font-medium">Último Commit no Servidor:</span>
                <span className={`text-xs font-mono font-bold truncate block ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  {systemInfo ? systemInfo.lastCommit : 'Carregando...'}
                </span>
              </div>

              <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800/80' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[11px] text-slate-400 block mb-0.5 font-medium">Ambiente Node.js:</span>
                <span className={`text-xs font-mono font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {systemInfo ? systemInfo.nodeVersion : 'Node v20+'}
                </span>
              </div>

              <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950/60 border-slate-800/80' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[11px] text-slate-400 block mb-0.5 font-medium">Status do Gerenciador:</span>
                <span className="text-xs font-bold text-blue-500 block">
                  PM2 Online (3facil)
                </span>
              </div>
            </div>
          </div>

          {/* Terminal / Logs da Atualização */}
          {updateOutput && (
            <div className={`p-5 rounded-3xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 border-slate-800 text-white'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="text-xs font-mono text-slate-400 ml-2">Console de Atualização Remota</span>
                </div>
                <button
                  onClick={() => setUpdateOutput(null)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Limpar Logs
                </button>
              </div>

              <pre className="text-xs font-mono text-emerald-400 bg-black/80 p-4 rounded-2xl overflow-x-auto max-h-64 whitespace-pre-wrap">
                {updateOutput}
              </pre>
            </div>
          )}

          {/* Guia de Como Funciona */}
          <div className={`p-6 rounded-3xl border ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <h3 className={`text-sm sm:text-base font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Fluxo Seguro de Atualização
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800/80' : 'bg-slate-50 border-slate-200'}`}>
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center justify-center mb-2">1</div>
                <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Puxa o Código Novo</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  O servidor roda <code className="text-blue-400">git pull</code> para sincronizar todas as novas alterações feitas no repositório.
                </p>
              </div>

              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800/80' : 'bg-slate-50 border-slate-200'}`}>
                <div className="w-7 h-7 rounded-xl bg-amber-600 text-white text-xs font-black flex items-center justify-center mb-2">2</div>
                <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Instala & Compila</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Executa <code className="text-amber-400">npm install && npm run build</code> para gerar a versão de produção otimizada.
                </p>
              </div>

              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800/80' : 'bg-slate-50 border-slate-200'}`}>
                <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center justify-center mb-2">3</div>
                <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Reinicia o PM2</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  O processo no PM2 é reiniciado de forma suave (zero-downtime), mantendo tudo no ar e atualizado.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* MODAL 1: EDITAR ASSINATURA & CLIENTE SAAS */}
      {isEditModalOpen && editingStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-3xl shadow-2xl p-6 overflow-hidden max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Editar Cliente & Assinatura SaaS</h3>
                <p className="text-xs text-slate-400">Loja: {editingStore.name}</p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              
              {/* Dados do Cliente */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">Dados do Cliente Lojista</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Nome do Responsável *</label>
                    <input
                      type="text"
                      required
                      value={editingStore.ownerName || ''}
                      onChange={(e) => setEditingStore({ ...editingStore, ownerName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">WhatsApp / Telefone *</label>
                    <input
                      type="text"
                      required
                      value={editingStore.ownerPhone || ''}
                      onChange={(e) => setEditingStore({ ...editingStore, ownerPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">E-mail do Cliente</label>
                    <input
                      type="email"
                      value={editingStore.ownerEmail || ''}
                      onChange={(e) => setEditingStore({ ...editingStore, ownerEmail: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">CPF ou CNPJ</label>
                    <input
                      type="text"
                      value={editingStore.ownerDocument || ''}
                      onChange={(e) => setEditingStore({ ...editingStore, ownerDocument: e.target.value })}
                      placeholder="00.000.000/0001-00"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Dados da Assinatura SaaS */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Plano & Mensalidade de Manutenção</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Plano Contratado</label>
                    <select
                      value={editingStore.plan}
                      onChange={(e) => {
                        const newPlan = e.target.value as SaaSPlanTier;
                        const planCfg = plans.find((p) => p.id === newPlan);
                        setEditingStore({
                          ...editingStore,
                          plan: newPlan,
                          planName: planCfg ? planCfg.name : 'Plano Personalizado',
                          monthlyFee: planCfg ? planCfg.price : editingStore.monthlyFee,
                        });
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="starter">Starter (R$ 49,90/mês)</option>
                      <option value="pro">Profissional (R$ 99,90/mês)</option>
                      <option value="enterprise">Enterprise (R$ 199,90/mês)</option>
                      <option value="personalizado">Personalizado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Valor da Mensalidade (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editingStore.monthlyFee}
                      onChange={(e) => setEditingStore({ ...editingStore, monthlyFee: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Status da Assinatura</label>
                    <select
                      value={editingStore.subscriptionStatus}
                      onChange={(e) => setEditingStore({ ...editingStore, subscriptionStatus: e.target.value as SubscriptionStatus })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="ativo">Ativo (Pago)</option>
                      <option value="pendente">Pendente / Vencido</option>
                      <option value="trial">Período de Teste (Trial)</option>
                      <option value="suspenso">Suspenso / Bloqueado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Data do Próximo Vencimento</label>
                    <input
                      type="date"
                      value={editingStore.nextDueDate || ''}
                      onChange={(e) => setEditingStore({ ...editingStore, nextDueDate: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Anotações Internas do Super Admin</label>
                  <textarea
                    rows={2}
                    value={editingStore.internalNotes || ''}
                    onChange={(e) => setEditingStore({ ...editingStore, internalNotes: e.target.value })}
                    placeholder="Ex: Cliente solicitou alteração no layout dia 10, negociou desconto anual..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="editPublished"
                    checked={editingStore.isPublished}
                    onChange={(e) => setEditingStore({ ...editingStore, isPublished: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
                  />
                  <label htmlFor="editPublished" className="text-xs text-slate-300 font-medium">
                    Vitrine Online e Publicada para os clientes
                  </label>
                </div>

              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition"
                >
                  Salvar Alterações
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL 2: CONFIGURAÇÕES GLOBAIS DO SAAS (PIX & CONTATO) */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl p-6 overflow-hidden">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Configurações de Cobrança do SaaS</h3>
                  <p className="text-xs text-slate-400">Dados Pix usados nas mensagens de cobrança aos lojistas</p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updatePlatformSettings(tempSettings);
                setIsSettingsModalOpen(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nome da Plataforma SaaS</label>
                <input
                  type="text"
                  required
                  value={tempSettings.platformName}
                  onChange={(e) => setTempSettings({ ...tempSettings, platformName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Sua Chave Pix para Receber Mensalidades *</label>
                <input
                  type="text"
                  required
                  value={tempSettings.pixKey}
                  onChange={(e) => setTempSettings({ ...tempSettings, pixKey: e.target.value })}
                  placeholder="sua-chave@pix.com.br ou CNPJ/CPF"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Nome do Beneficiário / Titular da Conta Pix</label>
                <input
                  type="text"
                  required
                  value={tempSettings.pixBeneficiary}
                  onChange={(e) => setTempSettings({ ...tempSettings, pixBeneficiary: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">WhatsApp de Suporte Master</label>
                  <input
                    type="text"
                    value={tempSettings.superAdminPhone}
                    onChange={(e) => setTempSettings({ ...tempSettings, superAdminPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Dias de Teste Padrão (Trial)</label>
                  <input
                    type="number"
                    value={tempSettings.defaultTrialDays}
                    onChange={(e) => setTempSettings({ ...tempSettings, defaultTrialDays: parseInt(e.target.value) || 7 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition"
                >
                  Salvar Configurações
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
