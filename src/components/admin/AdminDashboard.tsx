import React, { useState, useEffect } from 'react';
import { 
  Package, 
  DollarSign, 
  Users, 
  Sparkles, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  ExternalLink, 
  MessageCircle, 
  Mail, 
  Eye, 
  CheckCircle2, 
  Clock, 
  Archive, 
  Download, 
  Upload, 
  RefreshCw, 
  Settings, 
  Car, 
  Home, 
  ShoppingBag, 
  Briefcase,
  Layers,
  ArrowUpRight,
  Filter,
  Key,
  Phone,
  Lock,
  Globe,
  Palette,
  Image as ImageIcon,
  MapPin,
  Save,
  ShieldCheck,
  Building
} from 'lucide-react';
import { StoreItem, StoreProfile, ProposalLead } from '../../types/store';
import { useStoreContext } from '../../context/StoreContext';
import { formatCurrency, formatNumber, generateProposalWhatsAppLink } from '../../utils/formatters';

interface AdminDashboardProps {
  onOpenNewItemModal: () => void;
  onEditItem: (item: StoreItem) => void;
  onOpenSettingsModal: () => void;
  onOpenNewStoreModal: () => void;
  onViewPublicStore: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onOpenNewItemModal,
  onEditItem,
  onOpenSettingsModal,
  onOpenNewStoreModal,
  onViewPublicStore,
}) => {
  const { 
    activeStore, 
    currentStoreItems, 
    currentStoreLeads, 
    deleteItem, 
    toggleItemFeatured, 
    updateItemStatus,
    updateLeadStatus,
    deleteLead,
    updateStore,
    exportDataJSON,
    importDataJSON,
    resetToDefaults,
    theme
  } = useStoreContext();

  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'items' | 'leads' | 'settings' | 'backup'>('items');
  const [searchTerm, setSearchTerm] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>('todos');
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Estados para edição direta das configurações da loja
  const [storeName, setStoreName] = useState(activeStore.name || '');
  const [storeSlogan, setStoreSlogan] = useState(activeStore.slogan || '');
  const [storeDescription, setStoreDescription] = useState(activeStore.description || '');
  const [storePhone, setStorePhone] = useState(activeStore.phone || '');
  const [storeWhatsapp, setStoreWhatsapp] = useState(activeStore.whatsapp || '');
  const [storeEmail, setStoreEmail] = useState(activeStore.email || '');
  const [storePassword, setStorePassword] = useState(activeStore.password || '123456');
  const [showPassword, setShowPassword] = useState(false);
  const [storeNeighborhood, setStoreNeighborhood] = useState(activeStore.neighborhood || '');
  const [storeCity, setStoreCity] = useState(activeStore.city || '');
  const [storeState, setStoreState] = useState(activeStore.state || '');
  const [storeAddress, setStoreAddress] = useState(activeStore.address || '');
  const [storeInstagram, setStoreInstagram] = useState(activeStore.instagram || '');
  const [storeLogoUrl, setStoreLogoUrl] = useState(activeStore.logoUrl || '');
  const [storeBannerUrl, setStoreBannerUrl] = useState(activeStore.bannerUrl || '');
  const [storeThemeColor, setStoreThemeColor] = useState(activeStore.themeColor || '#2563eb');
  const [storeOwnerName, setStoreOwnerName] = useState(activeStore.ownerName || '');
  const [storeOwnerDocument, setStoreOwnerDocument] = useState(activeStore.ownerDocument || '');
  const [settingsSavedSuccess, setSettingsSavedSuccess] = useState(false);

  // Sincroniza estados caso a loja ativa mude
  useEffect(() => {
    if (activeStore) {
      setStoreName(activeStore.name || '');
      setStoreSlogan(activeStore.slogan || '');
      setStoreDescription(activeStore.description || '');
      setStorePhone(activeStore.phone || '');
      setStoreWhatsapp(activeStore.whatsapp || '');
      setStoreEmail(activeStore.email || '');
      setStorePassword(activeStore.password || '123456');
      setStoreNeighborhood(activeStore.neighborhood || '');
      setStoreCity(activeStore.city || '');
      setStoreState(activeStore.state || '');
      setStoreAddress(activeStore.address || '');
      setStoreInstagram(activeStore.instagram || '');
      setStoreLogoUrl(activeStore.logoUrl || '');
      setStoreBannerUrl(activeStore.bannerUrl || '');
      setStoreThemeColor(activeStore.themeColor || '#2563eb');
      setStoreOwnerName(activeStore.ownerName || '');
      setStoreOwnerDocument(activeStore.ownerDocument || '');
    }
  }, [activeStore]);

  const handleSaveStoreSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedStore: StoreProfile = {
      ...activeStore,
      name: storeName.trim(),
      slogan: storeSlogan.trim(),
      description: storeDescription.trim(),
      phone: storePhone.trim(),
      whatsapp: storeWhatsapp.replace(/\D/g, ''),
      email: storeEmail.trim(),
      password: storePassword.trim() || '123456',
      neighborhood: storeNeighborhood.trim(),
      city: storeCity.trim(),
      state: storeState.trim(),
      address: storeAddress.trim(),
      instagram: storeInstagram.trim(),
      logoUrl: storeLogoUrl.trim(),
      bannerUrl: storeBannerUrl.trim(),
      themeColor: storeThemeColor,
      ownerName: storeOwnerName.trim(),
      ownerDocument: storeOwnerDocument.trim(),
      ownerEmail: storeEmail.trim(),
      ownerPhone: storeWhatsapp.trim()
    };

    updateStore(updatedStore);
    setSettingsSavedSuccess(true);
    setTimeout(() => {
      setSettingsSavedSuccess(false);
    }, 4000);
  };

  // Cálculos de Métricas
  const totalItems = currentStoreItems.length;
  const activeItems = currentStoreItems.filter((i) => (i.status === 'disponivel' || i.status === 'ativo')).length;
  const totalValue = currentStoreItems.reduce((acc, item) => acc + (item.price || 0), 0);
  const totalLeads = currentStoreLeads.length;
  const newLeads = currentStoreLeads.filter((l) => l.status === 'novo').length;

  // Filtragem de Itens
  const filteredItems = currentStoreItems.filter((item) => {
    const matchText = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.itemType === 'veiculo' && `${item.brand} ${item.model}`.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.itemType === 'imovel' && `${item.neighborhood} ${item.city}`.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.itemType === 'produto' && (item.sku || '').toLowerCase().includes(searchTerm.toLowerCase()));
    return matchText;
  });

  // Filtragem de Leads
  const filteredLeads = currentStoreLeads.filter((lead) => {
    if (leadStatusFilter !== 'todos' && lead.status !== leadStatusFilter) return false;
    return true;
  });

  const handleExport = () => {
    const data = exportDataJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `3facil-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    const ok = importDataJSON(importText.trim());
    if (ok) {
      setImportStatus('Backup restaurado com sucesso!');
      setImportText('');
      setTimeout(() => setImportStatus(null), 3000);
    } else {
      setImportStatus('Erro: Arquivo JSON inválido.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Banner de Boas-Vindas do Painel */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl border transition shadow-sm ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center space-x-3.5">
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${
            isDark ? 'bg-blue-600/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'
          }`}>
            {activeStore.type === 'veiculo' && <Car className="h-6 w-6 text-red-500" />}
            {activeStore.type === 'imovel' && <Home className="h-6 w-6 text-emerald-500" />}
            {activeStore.type === 'produto' && <ShoppingBag className="h-6 w-6 text-blue-500" />}
            {activeStore.type === 'servico' && <Briefcase className="h-6 w-6 text-purple-500" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Painel da Loja: {activeStore.name}</h2>
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                {activeStore.type}
              </span>
            </div>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Gerencie seus anúncios, propostas de clientes recebidas e configurações da vitrine.
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={onViewPublicStore}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border-slate-200'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Ver Vitrine Pública</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : isDark 
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border-slate-200'
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Configurações & Senha</span>
          </button>

          <button
            onClick={onOpenNewItemModal}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Anúncio</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className={`p-4 rounded-2xl border transition shadow-sm ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Itens Anunciados</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalItems}</div>
          <div className={`text-[11px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            <strong className="text-emerald-500">{activeItems}</strong> disponíveis para venda
          </div>
        </div>

        <div className={`p-4 rounded-2xl border transition shadow-sm ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Valor do Inventário</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className={`text-2xl font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {formatCurrency(totalValue)}
          </div>
          <div className={`text-[11px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            Soma dos preços anunciados
          </div>
        </div>

        <div className={`p-4 rounded-2xl border transition shadow-sm ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Propostas Recebidas</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <Mail className="h-4 w-4" />
            </div>
          </div>
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalLeads}</div>
          <div className={`text-[11px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            <strong className="text-rose-500">{newLeads} novas</strong> propostas pendentes
          </div>
        </div>

        <div className={`p-4 rounded-2xl border transition shadow-sm ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Canais de Conversão</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <MessageCircle className="h-4 w-4" />
            </div>
          </div>
          <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>WhatsApp & E-mail</div>
          <div className="text-[11px] text-emerald-500 mt-1 flex items-center gap-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            100% Gratuito e Direto
          </div>
        </div>

      </div>

      {/* Navegação por Abas do Painel */}
      <div className={`flex items-center flex-wrap gap-2 border-b pb-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <button
          onClick={() => setActiveTab('items')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'items'
              ? 'bg-blue-600 text-white shadow-sm'
              : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Package className="h-4 w-4" />
          <span>Gerenciar Anúncios ({totalItems})</span>
        </button>

        <button
          onClick={() => setActiveTab('leads')}
          className={`relative flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'leads'
              ? 'bg-blue-600 text-white shadow-sm'
              : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Mail className="h-4 w-4" />
          <span>Propostas & Clientes ({totalLeads})</span>
          {newLeads > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {newLeads}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'settings'
              ? 'bg-blue-600 text-white shadow-sm'
              : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>Configurações, Senha & Perfil</span>
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'backup'
              ? 'bg-blue-600 text-white shadow-sm'
              : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Download className="h-4 w-4" />
          <span>Backup & JSON</span>
        </button>
      </div>

      {/* ABA 1: GERENCIAR ITENS */}
      {activeTab === 'items' && (
        <div className={`border rounded-3xl overflow-hidden shadow-sm transition ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          
          {/* Barra de Filtro e Busca */}
          <div className={`p-4 border-b flex flex-col sm:flex-row items-center justify-between gap-3 ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <div className="relative w-full sm:w-80">
              <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="Buscar anúncio cadastrado..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full text-xs pl-10 pr-4 py-2 rounded-xl border focus:outline-none focus:border-blue-500 ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Mostrando <strong className={isDark ? 'text-white' : 'text-slate-900'}>{filteredItems.length}</strong> itens de {totalItems}
            </div>
          </div>

          {/* Tabela de Itens */}
          {filteredItems.length === 0 ? (
            <div className={`p-12 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Package className={`h-10 w-10 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
              <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>Nenhum anúncio encontrado</p>
              <p className="text-xs text-slate-400 mt-1">
                Clique no botão "Novo Anúncio" acima para cadastrar o primeiro item.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`font-semibold border-b ${
                  isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}>
                  <tr>
                    <th className="p-3.5 pl-5">Item / Título</th>
                    <th className="p-3.5">Categoria / Tipo</th>
                    <th className="p-3.5">Preço</th>
                    <th className="p-3.5">Destaque</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 pr-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800/60 text-slate-300' : 'divide-slate-200 text-slate-700'}`}>
                  {filteredItems.map((item) => {
                    const img = item.images?.[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=200&auto=format&fit=crop&q=80';
                    return (
                      <tr key={item.id} className={`transition ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                        <td className="p-3.5 pl-5">
                          <div className="flex items-center space-x-3">
                            <img
                              src={img}
                              alt=""
                              className={`w-12 h-12 rounded-xl object-cover shrink-0 border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0 max-w-xs">
                              <div className={`font-semibold truncate text-xs sm:text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {item.title}
                              </div>
                              <div className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {item.itemType === 'veiculo' && `${item.yearFab}/${item.yearModel} • ${formatNumber(item.mileage)} km`}
                                {item.itemType === 'imovel' && `${item.areaUtil}m² • ${item.bedrooms} qtos • ${item.neighborhood}`}
                                {item.itemType === 'produto' && `SKU: ${item.sku || 'N/A'}`}
                                {item.itemType === 'servico' && `Duração: ${item.estimatedDuration || 'A combinar'}`}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className={`p-3.5 capitalize ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {item.itemType === 'veiculo' && `${item.brand} • ${item.fuel}`}
                          {item.itemType === 'imovel' && `${item.propertyType} (${item.transactionType})`}
                          {item.itemType === 'produto' && item.category}
                          {item.itemType === 'servico' && item.category}
                        </td>

                        <td className={`p-3.5 font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {item.itemType === 'servico' && item.priceType === 'sob_consulta'
                            ? 'Sob Consulta'
                            : formatCurrency(item.price)}
                        </td>

                        <td className="p-3.5">
                          <button
                            onClick={() => toggleItemFeatured(item.id)}
                            className={`p-1.5 rounded-lg border transition ${
                              item.featured
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-500'
                                : isDark ? 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-700'
                            }`}
                            title="Alternar Destaque na Home"
                          >
                            <Sparkles className="h-4 w-4" />
                          </button>
                        </td>

                        <td className="p-3.5">
                          <select
                            value={item.status as any}
                            onChange={(e) => updateItemStatus(item.id, e.target.value)}
                            className={`text-xs px-2.5 py-1 rounded-lg border capitalize focus:outline-none ${
                              isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                            }`}
                          >
                            <option value="disponivel">Disponível</option>
                            <option value="ativo">Ativo</option>
                            <option value="reservado">Reservado</option>
                            <option value="vendido">Vendido</option>
                            <option value="alugado">Alugado</option>
                            <option value="esgotado">Esgotado</option>
                            <option value="pausado">Pausado</option>
                          </select>
                        </td>

                        <td className="p-3.5 pr-5 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => onEditItem(item)}
                              className={`p-1.5 rounded-lg border transition ${
                                isDark 
                                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700' 
                                  : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border-slate-200 shadow-sm'
                              }`}
                              title="Editar Anúncio"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Deseja excluir "${item.title}"?`)) {
                                  deleteItem(item.id);
                                }
                              }}
                              className={`p-1.5 rounded-lg border transition ${
                                isDark 
                                  ? 'bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border-slate-700' 
                                  : 'bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border-slate-200 shadow-sm'
                              }`}
                              title="Excluir Anúncio"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {/* ABA 2: PROPOSTAS & LEADS */}
      {activeTab === 'leads' && (
        <div className={`border rounded-3xl overflow-hidden shadow-sm transition ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          
          <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <div className="flex items-center space-x-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Filtrar Status:</span>
              <select
                value={leadStatusFilter}
                onChange={(e) => setLeadStatusFilter(e.target.value)}
                className={`text-xs px-3 py-1.5 rounded-xl border focus:outline-none ${
                  isDark ? 'bg-slate-950 text-slate-200 border-slate-800' : 'bg-slate-50 text-slate-800 border-slate-300'
                }`}
              >
                <option value="todos">Todos ({totalLeads})</option>
                <option value="novo">Novos ({newLeads})</option>
                <option value="em_contato">Em Contato</option>
                <option value="fechado">Fechados / Ganhos</option>
                <option value="arquivado">Arquivados</option>
              </select>
            </div>

            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Propostas enviadas por clientes através da vitrine
            </div>
          </div>

          {filteredLeads.length === 0 ? (
            <div className={`p-12 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Mail className={`h-10 w-10 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
              <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>Nenhuma proposta nesta categoria</p>
              <p className="text-xs text-slate-400 mt-1">
                Quando um cliente preencher a proposta formal de compra, ela aparecerá listada aqui.
              </p>
            </div>
          ) : (
            <div className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
              {filteredLeads.map((lead) => {
                const waReplyUrl = generateProposalWhatsAppLink(lead, activeStore);
                return (
                  <div key={lead.id} className={`p-5 transition space-y-3 ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}`}>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${
                          isDark ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'
                        }`}>
                          {lead.clientName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{lead.clientName}</h4>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                              lead.status === 'novo' ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' :
                              lead.status === 'fechado' ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30' :
                              isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {lead.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {lead.clientPhone} • {lead.clientEmail}
                          </div>
                        </div>
                      </div>

                      <div className={`text-right text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span>{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</span> às{' '}
                        <span>{new Date(lead.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    {/* Dados da Proposta */}
                    <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                      isDark ? 'bg-slate-950/80 border-slate-800/80' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 font-medium">
                        <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                          Item: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{lead.itemTitle}</strong>
                        </span>
                        <span className="text-emerald-500 font-bold text-sm">
                          Proposta: {lead.proposalValue ? formatCurrency(lead.proposalValue) : formatCurrency(lead.itemPrice)}
                        </span>
                      </div>

                      <div className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                        Forma de Pagamento: <strong className={`capitalize ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{lead.paymentMethod.replace('_', ' ')}</strong>
                      </div>

                      {lead.tradeDetails && (
                        <div className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                          Bem na Troca: <span className="text-amber-500 font-medium">{lead.tradeDetails}</span>
                        </div>
                      )}

                      {lead.clientMessage && (
                        <div className={`pt-1.5 border-t italic ${
                          isDark ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-700'
                        }`}>
                          "{lead.clientMessage}"
                        </div>
                      )}
                    </div>

                    {/* Ações do Lead */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Alterar Status:</span>
                        <select
                          value={lead.status}
                          onChange={(e) => updateLeadStatus(lead.id, e.target.value as any)}
                          className={`text-xs px-2.5 py-1 rounded-lg border focus:outline-none ${
                            isDark ? 'bg-slate-950 text-slate-200 border-slate-800' : 'bg-slate-50 text-slate-800 border-slate-300'
                          }`}
                        >
                          <option value="novo">Novo</option>
                          <option value="em_contato">Em Contato</option>
                          <option value="fechado">Fechado / Ganho</option>
                          <option value="arquivado">Arquivado</option>
                        </select>
                      </div>

                      <div className="flex items-center space-x-2">
                        {lead.clientPhone && (
                          <a
                            href={waReplyUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>Responder no WhatsApp</span>
                          </a>
                        )}

                        <button
                          onClick={() => {
                            if (confirm('Excluir este registro de proposta?')) {
                              deleteLead(lead.id);
                            }
                          }}
                          className={`p-1.5 rounded-xl border transition ${
                            isDark 
                              ? 'bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border-slate-700' 
                              : 'bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border-slate-200 shadow-sm'
                          }`}
                          title="Excluir Lead"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ABA 3: CONFIGURAÇÕES DA LOJA, SENHA & PERFIL */}
      {activeTab === 'settings' && (
        <div className={`border rounded-3xl p-6 shadow-sm space-y-6 transition animate-in fade-in ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          
          {/* Header da Aba */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-slate-800/80">
            <div>
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Building className="h-5 w-5" />
                </div>
                <div>
                  <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Configurações da Loja, Contatos & Senha
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Altere sua senha de acesso, telefones comerciais, logotipo, cores e dados cadastrais.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onViewPublicStore}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center space-x-1.5 ${
                  isDark ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Ver Vitrine</span>
              </button>
            </div>
          </div>

          {/* Notificação de Sucesso */}
          {settingsSavedSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center space-x-2 animate-in fade-in duration-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>✅ Informações, senha e dados da loja salvos e sincronizados com sucesso!</span>
            </div>
          )}

          <form onSubmit={handleSaveStoreSettings} className="space-y-6">
            
            {/* Bloco 1: Credenciais de Acesso & Segurança */}
            <div className={`p-5 rounded-2xl border ${
              isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center space-x-2 mb-4">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  Acesso ao Painel & Senha
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    E-mail de Login *
                  </label>
                  <div className="relative">
                    <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input
                      type="email"
                      required
                      value={storeEmail}
                      onChange={(e) => setStoreEmail(e.target.value)}
                      placeholder="ex: contato@suacorrectora.com"
                      className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl text-xs border transition outline-none ${
                        isDark 
                          ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' 
                          : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Este e-mail é utilizado para entrar no painel desta loja.
                  </span>
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Senha de Acesso ao Painel *
                  </label>
                  <div className="relative">
                    <Key className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={storePassword}
                      onChange={(e) => setStorePassword(e.target.value)}
                      placeholder="Digite a nova senha"
                      className={`w-full pl-9 pr-20 py-2.5 rounded-xl text-xs font-mono border transition outline-none ${
                        isDark 
                          ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' 
                          : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold px-2 py-1 rounded-lg border transition ${
                        isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {showPassword ? 'Ocultar' : 'Ver'}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Altere quando desejar. Use pelo menos 4 caracteres.
                  </span>
                </div>
              </div>
            </div>

            {/* Bloco 2: Contatos Comerciais & WhatsApp */}
            <div className={`p-5 rounded-2xl border ${
              isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center space-x-2 mb-4">
                <Phone className="h-4 w-4 text-blue-400" />
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                  Contatos & WhatsApp de Vendas
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    WhatsApp de Vendas *
                  </label>
                  <div className="relative">
                    <MessageCircle className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input
                      type="text"
                      required
                      value={storeWhatsapp}
                      onChange={(e) => setStoreWhatsapp(e.target.value)}
                      placeholder="Ex: 91985931012"
                      className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl text-xs border transition outline-none ${
                        isDark 
                          ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' 
                          : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Os botões "Conversar no WhatsApp" abrirão direto neste número.
                  </span>
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Telefone Fixo / Alternativo
                  </label>
                  <div className="relative">
                    <Phone className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input
                      type="text"
                      value={storePhone}
                      onChange={(e) => setStorePhone(e.target.value)}
                      placeholder="Ex: (91) 3222-0000"
                      className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl text-xs border transition outline-none ${
                        isDark 
                          ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' 
                          : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Instagram (@)
                  </label>
                  <div className="relative">
                    <Globe className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input
                      type="text"
                      value={storeInstagram}
                      onChange={(e) => setStoreInstagram(e.target.value)}
                      placeholder="@seunome_corretor"
                      className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl text-xs border transition outline-none ${
                        isDark 
                          ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' 
                          : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco 3: Identidade Visual & Dados da Empresa */}
            <div className={`p-5 rounded-2xl border ${
              isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center space-x-2 mb-4">
                <Palette className="h-4 w-4 text-purple-400" />
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
                  Identidade Visual & Cadastro
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Nome da Empresa / Corretora *
                  </label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs border transition outline-none ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Slogan / Subtítulo
                  </label>
                  <input
                    type="text"
                    value={storeSlogan}
                    onChange={(e) => setStoreSlogan(e.target.value)}
                    placeholder="Ex: Os melhores imóveis da região"
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs border transition outline-none ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Nome do Responsável / Corretor
                  </label>
                  <input
                    type="text"
                    value={storeOwnerName}
                    onChange={(e) => setStoreOwnerName(e.target.value)}
                    placeholder="Ex: Moises Coutinho"
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs border transition outline-none ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    CRECI / CPF / CNPJ
                  </label>
                  <input
                    type="text"
                    value={storeOwnerDocument}
                    onChange={(e) => setStoreOwnerDocument(e.target.value)}
                    placeholder="Ex: CRECI 10016 ou CPF"
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs border transition outline-none ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    URL do Logotipo (Imagem)
                  </label>
                  <input
                    type="text"
                    value={storeLogoUrl}
                    onChange={(e) => setStoreLogoUrl(e.target.value)}
                    placeholder="https://..."
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs border transition outline-none ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Cor Primária da Marca
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={storeThemeColor}
                      onChange={(e) => setStoreThemeColor(e.target.value)}
                      className="w-10 h-9 rounded-xl cursor-pointer border-0 bg-transparent p-0"
                    />
                    <input
                      type="text"
                      value={storeThemeColor}
                      onChange={(e) => setStoreThemeColor(e.target.value)}
                      className={`flex-1 px-3.5 py-2 rounded-xl text-xs font-mono border transition outline-none ${
                        isDark 
                          ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' 
                          : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco 4: Endereço & Localização */}
            <div className={`p-5 rounded-2xl border ${
              isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center space-x-2 mb-4">
                <MapPin className="h-4 w-4 text-rose-400" />
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-rose-400' : 'text-rose-700'}`}>
                  Localização & Endereço
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Endereço Completo
                  </label>
                  <input
                    type="text"
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    placeholder="Ex: Av. Nazaré, 1200 - Sala 402"
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs border transition outline-none ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Bairro
                  </label>
                  <input
                    type="text"
                    value={storeNeighborhood}
                    onChange={(e) => setStoreNeighborhood(e.target.value)}
                    placeholder="Ex: Nazaré"
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs border transition outline-none ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Cidade
                    </label>
                    <input
                      type="text"
                      value={storeCity}
                      onChange={(e) => setStoreCity(e.target.value)}
                      placeholder="Belém"
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs border transition outline-none ${
                        isDark 
                          ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' 
                          : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      UF
                    </label>
                    <input
                      type="text"
                      value={storeState}
                      onChange={(e) => setStoreState(e.target.value.toUpperCase())}
                      placeholder="PA"
                      maxLength={2}
                      className={`w-full px-2 py-2.5 rounded-xl text-xs uppercase text-center border transition outline-none ${
                        isDark 
                          ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' 
                          : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Descrição da Empresa / Sobre
                </label>
                <textarea
                  rows={3}
                  value={storeDescription}
                  onChange={(e) => setStoreDescription(e.target.value)}
                  placeholder="Conte um pouco sobre sua atuação no mercado, diferenciais e experiência..."
                  className={`w-full p-3 rounded-xl text-xs border transition outline-none ${
                    isDark 
                      ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' 
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                  }`}
                />
              </div>
            </div>

            {/* Botão de Salvar Alterações */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                As alterações são salvas e sincronizadas instantaneamente no servidor.
              </span>

              <button
                type="submit"
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-xl shadow-blue-600/30 transition active:scale-95 flex items-center justify-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>Salvar Todas as Configurações</span>
              </button>
            </div>

          </form>

        </div>
      )}

      {/* ABA 4: BACKUP & RESTAURAÇÃO JSON */}
      {activeTab === 'backup' && (
        <div className={`border rounded-3xl p-6 shadow-sm space-y-6 transition ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div>
            <h3 className={`text-base font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Backup & Restauração dos Dados</h3>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Todos os seus dados (as 4 lojas, itens cadastrados e propostas de clientes) ficam salvos no seu próprio navegador e podem ser exportados para um arquivo JSON seguro a qualquer momento.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Exportar */}
            <div className={`p-5 rounded-2xl border space-y-3 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center space-x-2.5 text-blue-500 font-semibold text-sm">
                <Download className="h-5 w-5" />
                <span>Exportar Dados (Download JSON)</span>
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Baixe uma cópia completa de segurança contendo todas as lojas, anúncios e leads recebidos.
              </p>
              <button
                onClick={handleExport}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition"
              >
                <Download className="h-4 w-4" />
                <span>Baixar Arquivo JSON de Backup</span>
              </button>
            </div>

            {/* Importar */}
            <div className={`p-5 rounded-2xl border space-y-3 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center space-x-2.5 text-emerald-500 font-semibold text-sm">
                <Upload className="h-5 w-5" />
                <span>Restaurar / Importar JSON</span>
              </div>
              <textarea
                rows={3}
                placeholder="Cole o código JSON do seu backup aqui..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className={`w-full text-xs font-mono p-2.5 rounded-xl border focus:outline-none ${
                  isDark ? 'bg-slate-900 text-slate-200 border-slate-800' : 'bg-white text-slate-900 border-slate-300'
                }`}
              />
              {importStatus && (
                <div className={`text-xs ${importStatus.includes('sucesso') ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {importStatus}
                </div>
              )}
              <button
                onClick={handleImport}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition"
              >
                <Upload className="h-4 w-4" />
                <span>Restaurar Backup</span>
              </button>
            </div>

          </div>

          <div className={`pt-4 border-t flex items-center justify-between ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              Precisa resetar para os 4 modelos de demonstração originais?
            </span>
            <button
              onClick={() => {
                if (confirm('Tem certeza que deseja restaurar as lojas de demonstração padrão?')) {
                  resetToDefaults();
                }
              }}
              className={`flex items-center space-x-1.5 text-xs transition ${
                isDark ? 'text-slate-400 hover:text-rose-400' : 'text-slate-600 hover:text-rose-600'
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Restaurar Modelos Padrão</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
