import React, { useState } from 'react';
import { ProposalLead, StoreProfile } from '../../types/store';
import { formatCurrency } from '../../utils/formatters';
import { 
  MessageCircle, 
  Trash2, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Car, 
  Home, 
  ShoppingBag, 
  Wrench, 
  MapPin, 
  Phone, 
  CreditCard, 
  Search, 
  Kanban, 
  List, 
  Sparkles,
  Archive,
  ChevronRight
} from 'lucide-react';

interface CRMKanbanProps {
  leads: ProposalLead[];
  activeStore: StoreProfile;
  onUpdateLeadStatus: (leadId: string, status: ProposalLead['status']) => void;
  onDeleteLead: (leadId: string) => void;
  isDark: boolean;
}

interface ColumnConfig {
  id: ProposalLead['status'];
  title: string;
  subtitle: string;
  colorBadge: string;
  borderColor: string;
  bgLight: string;
  bgDark: string;
}

export const CRMKanban: React.FC<CRMKanbanProps> = ({
  leads,
  activeStore,
  onUpdateLeadStatus,
  onDeleteLead,
  isDark,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('todos');

  // Definição das colunas enxutas (3 a 4 colunas) de acordo com o segmento da loja
  const getColumnsForSegment = (): ColumnConfig[] => {
    switch (activeStore.storeType) {
      case 'produto':
        // Loja & Varejo (3 Colunas Enxutas)
        return [
          {
            id: 'novo',
            title: 'Novo Pedido',
            subtitle: 'Aguardando confirmação',
            colorBadge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
            borderColor: 'border-blue-500',
            bgLight: 'bg-blue-50/50',
            bgDark: 'bg-blue-950/20',
          },
          {
            id: 'em_contato',
            title: 'Em Preparo / Rota',
            subtitle: 'Separando ou a caminho',
            colorBadge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
            borderColor: 'border-amber-500',
            bgLight: 'bg-amber-50/50',
            bgDark: 'bg-amber-950/20',
          },
          {
            id: 'fechado',
            title: 'Concluído',
            subtitle: 'Entregue e pago',
            colorBadge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
            borderColor: 'border-emerald-500',
            bgLight: 'bg-emerald-50/50',
            bgDark: 'bg-emerald-950/20',
          },
        ];

      case 'veiculo':
        // Veículos (4 Colunas Enxutas)
        return [
          {
            id: 'novo',
            title: 'Novo Lead',
            subtitle: 'Interesse recebido',
            colorBadge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
            borderColor: 'border-blue-500',
            bgLight: 'bg-blue-50/50',
            bgDark: 'bg-blue-950/20',
          },
          {
            id: 'em_contato',
            title: 'Test Drive / Visita',
            subtitle: 'Agendado ou em loja',
            colorBadge: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
            borderColor: 'border-purple-500',
            bgLight: 'bg-purple-50/50',
            bgDark: 'bg-purple-950/20',
          },
          {
            id: 'proposta_enviada',
            title: 'Negociação / Crédito',
            subtitle: 'Ficha ou troca em análise',
            colorBadge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
            borderColor: 'border-amber-500',
            bgLight: 'bg-amber-50/50',
            bgDark: 'bg-amber-950/20',
          },
          {
            id: 'fechado',
            title: 'Venda Feita',
            subtitle: 'Veículo entregue',
            colorBadge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
            borderColor: 'border-emerald-500',
            bgLight: 'bg-emerald-50/50',
            bgDark: 'bg-emerald-950/20',
          },
        ];

      case 'imovel':
        // Imóveis (4 Colunas Enxutas)
        return [
          {
            id: 'novo',
            title: 'Novo Contato',
            subtitle: 'Interesse inicial',
            colorBadge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
            borderColor: 'border-blue-500',
            bgLight: 'bg-blue-50/50',
            bgDark: 'bg-blue-950/20',
          },
          {
            id: 'em_contato',
            title: 'Visita Agendada',
            subtitle: 'Alinhando chaves/portaria',
            colorBadge: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
            borderColor: 'border-cyan-500',
            bgLight: 'bg-cyan-50/50',
            bgDark: 'bg-cyan-950/20',
          },
          {
            id: 'proposta_enviada',
            title: 'Proposta & Docs',
            subtitle: 'Crédito, FGTS ou contrato',
            colorBadge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
            borderColor: 'border-amber-500',
            bgLight: 'bg-amber-50/50',
            bgDark: 'bg-amber-950/20',
          },
          {
            id: 'fechado',
            title: 'Chave na Mão',
            subtitle: 'Fechado com sucesso',
            colorBadge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
            borderColor: 'border-emerald-500',
            bgLight: 'bg-emerald-50/50',
            bgDark: 'bg-emerald-950/20',
          },
        ];

      case 'servico':
      default:
        // Serviços (3 Colunas Enxutas)
        return [
          {
            id: 'novo',
            title: 'Nova Solicitação',
            subtitle: 'Aguardando contato',
            colorBadge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
            borderColor: 'border-blue-500',
            bgLight: 'bg-blue-50/50',
            bgDark: 'bg-blue-950/20',
          },
          {
            id: 'proposta_enviada',
            title: 'Orçamento / Em Execução',
            subtitle: 'Enviado ou em atendimento',
            colorBadge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
            borderColor: 'border-amber-500',
            bgLight: 'bg-amber-50/50',
            bgDark: 'bg-amber-950/20',
          },
          {
            id: 'fechado',
            title: 'Concluído & Pago',
            subtitle: 'Finalizado com sucesso',
            colorBadge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
            borderColor: 'border-emerald-500',
            bgLight: 'bg-emerald-50/50',
            bgDark: 'bg-emerald-950/20',
          },
        ];
    }
  };

  const columns = getColumnsForSegment();

  // Filtra por termo de busca
  const filteredLeads = leads.filter((lead) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      lead.clientName.toLowerCase().includes(q) ||
      lead.clientPhone.toLowerCase().includes(q) ||
      lead.itemTitle.toLowerCase().includes(q) ||
      (lead.clientMessage || '').toLowerCase().includes(q);

    if (!matchSearch) return false;
    if (viewMode === 'list' && selectedStatusFilter !== 'todos') {
      return lead.status === selectedStatusFilter;
    }
    return true;
  });

  // Métricas do Funil
  const totalValueInFunnel = filteredLeads.reduce(
    (acc, l) => acc + (l.proposalValue || l.itemPrice || 0),
    0
  );
  const closedCount = filteredLeads.filter((l) => l.status === 'fechado').length;

  // Gerador de mensagem no WhatsApp específica para a etapa
  const getWhatsAppFollowUpUrl = (lead: ProposalLead) => {
    const rawPhone = lead.clientPhone.replace(/\D/g, '');
    if (!rawPhone) return '#';
    const finalPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;

    let msg = `Olá, *${lead.clientName}*! Tudo bem? Aqui é da equipe da *${activeStore.name}*.\n\n`;

    if (activeStore.storeType === 'produto') {
      if (lead.status === 'novo') {
        msg += `Recebemos seu pedido de *${lead.itemTitle}* e estamos prontos para confirmar os detalhes com você!`;
      } else if (lead.status === 'em_contato') {
        msg += `Passando para avisar que seu pedido de *${lead.itemTitle}* está sendo preparado com muito carinho!`;
      } else {
        msg += `Entrando em contato sobre seu pedido de *${lead.itemTitle}*. Esperamos que tenha gostado!`;
      }
    } else if (activeStore.storeType === 'veiculo') {
      if (lead.testDriveRequested) {
        msg += `Vimos seu interesse no *${lead.itemTitle}* e o agendamento de Test Drive. Podemos confirmar o melhor horário?`;
      } else {
        msg += `Vimos seu interesse no *${lead.itemTitle}*. Gostaria de saber se tem alguma dúvida ou se deseja simular condições especiais de financiamento?`;
      }
    } else if (activeStore.storeType === 'imovel') {
      if (lead.visitType === 'agendar_visita') {
        msg += `Recebemos seu pedido para agendar visita no imóvel *${lead.itemTitle}*. Gostaria de alinhar o acesso e confirmar a data com você!`;
      } else {
        msg += `Recebemos seu contato a respeito do imóvel *${lead.itemTitle}*. Como podemos te ajudar hoje?`;
      }
    } else {
      msg += `Recebemos sua solicitação referente a *${lead.itemTitle}*. Como podemos te ajudar no orçamento?`;
    }

    return `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`;
  };

  // Helper para avançar ou recuar etapa
  const handleMoveStep = (lead: ProposalLead, direction: 'next' | 'prev') => {
    const currentIdx = columns.findIndex((c) => c.id === lead.status);
    if (direction === 'next') {
      if (currentIdx !== -1 && currentIdx < columns.length - 1) {
        onUpdateLeadStatus(lead.id, columns[currentIdx + 1].id);
      } else if (lead.status !== 'fechado') {
        onUpdateLeadStatus(lead.id, 'fechado');
      }
    } else {
      if (currentIdx > 0) {
        onUpdateLeadStatus(lead.id, columns[currentIdx - 1].id);
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Barra de Controle do CRM */}
      <div className={`p-4 sm:p-5 rounded-3xl border transition shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              CRM & Funil de Vendas Especializado
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 capitalize">
              {activeStore.storeType === 'veiculo' ? 'Revenda de Veículos' :
               activeStore.storeType === 'imovel' ? 'Imobiliária & Corretores' :
               activeStore.storeType === 'produto' ? 'Loja & Delivery' : 'Prestador de Serviços'}
            </span>
          </div>
          <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {activeStore.storeType === 'produto' ? 'Gestão de Pedidos e Clientes' : 'Acompanhamento de Leads e Oportunidades'}
          </h3>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Funil otimizado em {columns.length} etapas estratégicas para agilizar o atendimento no WhatsApp.
          </p>
        </div>

        {/* Indicadores Rápidos & Alternância Kanban / Lista */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Caixa de Busca */}
          <div className="relative flex-1 md:w-56">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, tel ou item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-3 py-1.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            />
          </div>

          {/* Toggle Modo de Visualização */}
          <div className={`flex items-center p-1 rounded-xl border ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                viewMode === 'kanban'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Visualização em Colunas Kanban"
            >
              <Kanban className="h-3.5 w-3.5" />
              <span>Funil</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Visualização em Lista"
            >
              <List className="h-3.5 w-3.5" />
              <span>Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mini Resumo de Métricas do Funil */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total no CRM</span>
          <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{filteredLeads.length}</p>
        </div>
        <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">Ganhos / Concluídos</span>
          <p className="text-lg font-bold text-emerald-500">{closedCount}</p>
        </div>
        <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-500">Valor em Negociação</span>
          <p className={`text-lg font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {formatCurrency(totalValueInFunnel)}
          </p>
        </div>
        <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-500">Conversão de Vendas</span>
          <p className="text-lg font-bold text-purple-500">
            {filteredLeads.length > 0 ? `${Math.round((closedCount / filteredLeads.length) * 100)}%` : '0%'}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODO 1: KANBAN COM 3 OU 4 COLUNAS ENXUTAS                     */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'kanban' ? (
        <div className={`grid gap-4 ${
          columns.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        }`}>
          {columns.map((column, colIdx) => {
            const columnLeads = filteredLeads.filter((l) => l.status === column.id);
            const columnValue = columnLeads.reduce((acc, l) => acc + (l.proposalValue || l.itemPrice || 0), 0);

            return (
              <div
                key={column.id}
                className={`rounded-3xl border flex flex-col h-full min-h-[420px] transition shadow-sm ${
                  isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                {/* Cabeçalho da Coluna */}
                <div className={`p-4 border-b rounded-t-3xl flex items-center justify-between ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${column.borderColor.replace('border-', 'bg-')}`} />
                      <h4 className={`text-xs font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {column.title}
                      </h4>
                      <span className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full border ${column.colorBadge}`}>
                        {columnLeads.length}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{column.subtitle}</p>
                  </div>
                  {columnValue > 0 && (
                    <span className="text-[11px] font-semibold text-slate-500">
                      {formatCurrency(columnValue)}
                    </span>
                  )}
                </div>

                {/* Lista de Cards da Coluna */}
                <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                  {columnLeads.length === 0 ? (
                    <div className="h-36 flex flex-col items-center justify-center text-center p-4 border border-dashed rounded-2xl border-slate-300 dark:border-slate-800 text-slate-400">
                      <span className="text-xs">Nenhum cliente nesta etapa</span>
                    </div>
                  ) : (
                    columnLeads.map((lead) => {
                      const waUrl = getWhatsAppFollowUpUrl(lead);
                      const isWhatsAppOrigin = lead.leadOrigin === 'whatsapp';

                      return (
                        <div
                          key={lead.id}
                          className={`p-4 rounded-2xl border transition shadow-sm hover:shadow-md space-y-3 relative group ${
                            isDark 
                              ? 'bg-slate-950 border-slate-800 hover:border-slate-700' 
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* Top: Origem e Data */}
                          <div className="flex items-center justify-between gap-1.5">
                            {isWhatsAppOrigin ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                <MessageCircle className="h-2.5 w-2.5 fill-current" />
                                Botão WhatsApp
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                                {lead.itemType === 'produto' ? (
                                  <ShoppingBag className="h-2.5 w-2.5" />
                                ) : (
                                  <CreditCard className="h-2.5 w-2.5" />
                                )}
                                {lead.itemType === 'produto' ? 'Pedido Loja' : 'Proposta Formal'}
                              </span>
                            )}

                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {new Date(lead.createdAt).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          {/* Dados do Cliente */}
                          <div>
                            <h5 className={`text-xs font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {lead.clientName}
                            </h5>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3 text-emerald-500" />
                                {lead.clientPhone}
                              </span>
                            </div>
                          </div>

                          {/* Item e Valor */}
                          <div className={`p-2.5 rounded-xl text-xs border ${
                            isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'
                          }`}>
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {lead.itemTitle}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 uppercase font-medium">Valor:</span>
                              <strong className="text-xs font-bold text-slate-900 dark:text-emerald-400">
                                {lead.proposalValue ? formatCurrency(lead.proposalValue) : formatCurrency(lead.itemPrice)}
                              </strong>
                            </div>
                          </div>

                          {/* Contextos Especiais do Nicho */}
                          {lead.testDriveRequested && (
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 p-1.5 rounded-lg border border-purple-500/20">
                              <Car className="h-3 w-3" />
                              <span>Test Drive: {lead.preferredPeriod?.toUpperCase() || 'Confirmar horário'}</span>
                            </div>
                          )}

                          {lead.orderType && (
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                              <MapPin className="h-3 w-3" />
                              <span>{lead.orderType === 'entrega' ? 'Entrega em domicílio' : 'Retirada no Balcão'}</span>
                            </div>
                          )}

                          {lead.visitType === 'agendar_visita' && (
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 p-1.5 rounded-lg border border-cyan-500/20">
                              <Calendar className="h-3 w-3" />
                              <span>Visita no Imóvel ({lead.preferredPeriod || 'Flexível'})</span>
                            </div>
                          )}

                          {/* Ações Rápidas: WhatsApp e Mudança de Etapa */}
                          <div className="pt-1 flex items-center justify-between gap-1.5 border-t border-slate-100 dark:border-slate-800/80">
                            {/* Chamar no WhatsApp */}
                            {lead.clientPhone ? (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-sm transition active:scale-95"
                                title="Conversar no WhatsApp com mensagem de status"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                <span>Chamar</span>
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-400">Sem telefone</span>
                            )}

                            {/* Voltar Etapa */}
                            {colIdx > 0 && (
                              <button
                                onClick={() => handleMoveStep(lead, 'prev')}
                                className={`p-1.5 rounded-xl border transition ${
                                  isDark ? 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                                }`}
                                title="Recuar etapa"
                              >
                                <ArrowLeft className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Avançar Etapa */}
                            {colIdx < columns.length - 1 ? (
                              <button
                                onClick={() => handleMoveStep(lead, 'next')}
                                className={`p-1.5 rounded-xl border transition ${
                                  isDark ? 'bg-slate-900 hover:bg-blue-600 hover:text-white text-slate-300 border-slate-800' : 'bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 border-slate-200'
                                }`}
                                title={`Avançar para: ${columns[colIdx + 1]?.title}`}
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <span className="p-1 text-emerald-500" title="Finalizado com Sucesso">
                                <CheckCircle2 className="h-4 w-4" />
                              </span>
                            )}

                            {/* Excluir Lead */}
                            <button
                              onClick={() => {
                                if (confirm(`Excluir o lead de "${lead.clientName}"?`)) {
                                  onDeleteLead(lead.id);
                                }
                              }}
                              className={`p-1.5 rounded-xl border transition ${
                                isDark ? 'bg-slate-900 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 border-slate-800' : 'bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border-slate-200'
                              }`}
                              title="Excluir Lead"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ------------------------------------------------------------- */
        /* MODO 2: LISTA DE AUDITORIA COM FILTRO                         */
        /* ------------------------------------------------------------- */
        <div className={`border rounded-3xl overflow-hidden shadow-sm ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className={`p-4 border-b flex items-center justify-between gap-3 ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <span className="text-xs font-semibold text-slate-500">Filtrar por Status:</span>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className={`text-xs px-3 py-1.5 rounded-xl border focus:outline-none ${
                isDark ? 'bg-slate-950 text-slate-200 border-slate-800' : 'bg-slate-50 text-slate-800 border-slate-300'
              }`}
            >
              <option value="todos">Todos ({filteredLeads.length})</option>
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
              <option value="arquivado">Arquivados</option>
            </select>
          </div>

          <div className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
            {filteredLeads.map((lead) => {
              const waUrl = getWhatsAppFollowUpUrl(lead);
              const isWhatsAppOrigin = lead.leadOrigin === 'whatsapp';

              return (
                <div key={lead.id} className={`p-4 sm:p-5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'
                }`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {lead.clientName}
                      </h4>
                      {isWhatsAppOrigin ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                          Botão WhatsApp
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 border border-blue-500/30">
                          {lead.itemType === 'produto' ? 'Pedido Loja' : 'Proposta Formal'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {lead.clientPhone} • {lead.itemTitle} • <strong>{formatCurrency(lead.proposalValue || lead.itemPrice)}</strong>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Recebido em: {new Date(lead.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={lead.status}
                      onChange={(e) => onUpdateLeadStatus(lead.id, e.target.value as ProposalLead['status'])}
                      className={`text-xs px-2.5 py-1.5 rounded-xl border focus:outline-none ${
                        isDark ? 'bg-slate-950 text-slate-200 border-slate-800' : 'bg-slate-50 text-slate-800 border-slate-300'
                      }`}
                    >
                      {columns.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                      <option value="arquivado">Arquivado / Cancelado</option>
                    </select>

                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>WhatsApp</span>
                    </a>

                    <button
                      onClick={() => {
                        if (confirm('Excluir este lead?')) {
                          onDeleteLead(lead.id);
                        }
                      }}
                      className={`p-1.5 rounded-xl border transition ${
                        isDark ? 'bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border-slate-700' : 'bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border-slate-200'
                      }`}
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
