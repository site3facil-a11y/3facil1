import React from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Car, 
  Home, 
  ShoppingBag, 
  Briefcase, 
  MessageCircle, 
  Mail, 
  Smartphone, 
  ShieldCheck, 
  QrCode, 
  Zap, 
  Layers, 
  DollarSign, 
  Star, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Clock,
  Palette
} from 'lucide-react';
import { useStoreContext } from '../../context/StoreContext';
import { StoreType } from '../../types/store';
import { formatCurrency } from '../../utils/formatters';

interface LandingPageViewProps {
  onOpenRegister: () => void;
  onOpenLogin: () => void;
  onSelectStoreAndGoToPublic: (storeId: string) => void;
  onSelectStoreAndGoToAdmin: (storeId: string) => void;
  onGoToMasterAdmin: () => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onOpenRegister,
  onOpenLogin,
  onSelectStoreAndGoToPublic,
  onSelectStoreAndGoToAdmin,
  onGoToMasterAdmin,
}) => {
  const { stores, theme } = useStoreContext();
  const isDark = theme === 'dark';

  const nicheCards = [
    {
      type: 'veiculo' as StoreType,
      title: 'Concessionárias & Revendas',
      tag: 'Automotivo',
      headline: 'Venda carros, motos e seminovos com ficha técnica completa',
      features: [
        'Comparativo com Tabela FIPE oficial',
        'Ficha com KM, Ano, Câmbio e Combustível',
        'Filtros por marcas, valores e carroceria',
        'Simulação e proposta rápida no WhatsApp'
      ],
      icon: Car,
      accentColor: 'text-red-500',
      badgeBg: 'bg-red-500/10 text-red-400 border-red-500/20',
      borderHover: 'hover:border-red-500/50',
      store: stores.find((s) => s.type === 'veiculo') || stores[0],
    },
    {
      type: 'imovel' as StoreType,
      title: 'Imobiliárias & Corretores',
      tag: 'Imóveis',
      headline: 'Apresente casas, apartamentos e terrenos para venda e locação',
      features: [
        'Metragem útil (m²), quartos e suítes',
        'Localização detalhada por bairro e cidade',
        'Filtro por Venda vs. Aluguel Mensal',
        'Formulário formal de proposta de compra'
      ],
      icon: Home,
      accentColor: 'text-emerald-500',
      badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      borderHover: 'hover:border-emerald-500/50',
      store: stores.find((s) => s.type === 'imovel') || stores[1] || stores[0],
    },
    {
      type: 'produto' as StoreType,
      title: 'Lojas & Catálogo de Varejo',
      tag: 'Produtos',
      headline: 'Catálogo digital com preço promocional, variações e fotos',
      features: [
        'Preço de/por com desconto automático',
        'Controle de código SKU e estoque',
        'Galeria de fotos em alta definição',
        'Fechamento direto no WhatsApp do vendedor'
      ],
      icon: ShoppingBag,
      accentColor: 'text-blue-500',
      badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      borderHover: 'hover:border-blue-500/50',
      store: stores.find((s) => s.type === 'produto') || stores[2] || stores[0],
    },
    {
      type: 'servico' as StoreType,
      title: 'Prestadores de Serviços',
      tag: 'Serviços',
      headline: 'Apresente seus pacotes, escopos de trabalho e orçamentos',
      features: [
        'Opção de Preço Fixo ou Sob Consulta',
        'Lista de entregáveis e diferenciais inclusos',
        'Estimativa de prazo de execução',
        'Captação de leads qualificados por e-mail'
      ],
      icon: Briefcase,
      accentColor: 'text-purple-500',
      badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      borderHover: 'hover:border-purple-500/50',
      store: stores.find((s) => s.type === 'servico') || stores[3] || stores[0],
    },
  ];

  return (
    <div className="space-y-16 sm:space-y-24 pb-16 animate-in fade-in duration-300">
      
      {/* 1. HERO SECTION */}
      <section className="relative pt-6 sm:pt-12 text-center max-w-4xl mx-auto px-4">
        
        {/* Badge Flutuante */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 border-blue-500/20 text-blue-400 text-xs font-semibold mb-6 shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
          <span>Plataforma SaaS Multi-Lojas • Mensalidade de R$ 30,00</span>
        </div>

        {/* Título Principal */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight sm:leading-none mb-6">
          A Vitrine Digital Perfeita para o <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">Seu Negócio</span>
        </h1>

        {/* Subtítulo */}
        <p className={`text-sm sm:text-lg max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed ${
          isDark ? 'text-slate-300' : 'text-slate-600'
        }`}>
          Crie catálogos modernos e especializados para <strong>Veículos</strong>, <strong>Imóveis</strong>, <strong>Produtos</strong> e <strong>Serviços</strong>. Receba pedidos e propostas estruturadas direto no WhatsApp e no seu E-mail.
        </p>

        {/* Botões de Ação Principal (Cadastro & Login) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
          <button
            onClick={onOpenRegister}
            className="w-full sm:w-auto py-3.5 px-8 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-sm sm:text-base font-bold shadow-xl shadow-blue-600/30 transition flex items-center justify-center space-x-2.5"
          >
            <span>Cadastrar Minha Loja</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            onClick={onOpenLogin}
            className={`w-full sm:w-auto py-3.5 px-6 rounded-2xl border text-sm sm:text-base font-semibold transition active:scale-95 flex items-center justify-center space-x-2 ${
              isDark 
                ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700' 
                : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-sm'
            }`}
          >
            <span>Já sou Cadastrado (Login)</span>
          </button>
        </div>

        {/* Mini Garantias */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Sem taxas sobre suas vendas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Plano único de R$ 30,00/mês</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Link na Bio pronto para Instagram</span>
          </div>
        </div>
      </section>

      {/* 2. DEMONSTRAÇÕES DOS 4 NICHOS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            4 Modelos Especializados com Fichas Técnicas Sob Medida
          </h2>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Cada segmento possui campos específicos, geradores de propostas inteligentes e layout otimizado para conversão no celular e computador.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {nicheCards.map((niche, idx) => {
            const Icon = niche.icon;
            return (
              <div
                key={idx}
                className={`p-6 sm:p-7 rounded-3xl border transition duration-200 flex flex-col justify-between ${
                  isDark 
                    ? `bg-slate-900/90 border-slate-800 ${niche.borderHover} hover:bg-slate-900` 
                    : `bg-white border-slate-200 ${niche.borderHover} shadow-sm hover:shadow-md`
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2.5 rounded-2xl border ${
                        isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'
                      }`}>
                        <Icon className={`h-6 w-6 ${niche.accentColor}`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-base sm:text-lg">{niche.title}</h3>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${niche.badgeBg}`}>
                          {niche.tag}
                        </span>
                      </div>
                    </div>

                    {niche.store && (
                      <span className={`text-xs px-2.5 py-1 rounded-xl font-mono ${
                        isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {niche.store.itemsCount} itens no catálogo
                      </span>
                    )}
                  </div>

                  <p className={`text-xs sm:text-sm mb-5 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {niche.headline}
                  </p>

                  <div className="space-y-2 mb-6">
                    {niche.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-center space-x-2 text-xs">
                        <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${niche.accentColor}`} />
                        <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botões de Ação da Vitrine */}
                <div className={`pt-4 border-t flex flex-col sm:flex-row items-center gap-2.5 ${
                  isDark ? 'border-slate-800' : 'border-slate-100'
                }`}>
                  {niche.store ? (
                    <>
                      <button
                        onClick={() => onSelectStoreAndGoToPublic(niche.store.id)}
                        className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition active:scale-95 flex items-center justify-center space-x-1.5"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Ver Vitrine de Exemplo ({niche.store.name})</span>
                      </button>

                      <button
                        onClick={() => onSelectStoreAndGoToAdmin(niche.store.id)}
                        className={`w-full sm:w-auto py-2.5 px-3 rounded-xl border text-xs font-medium transition ${
                          isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        Gerenciar
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={onOpenRegister}
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition flex items-center justify-center space-x-1.5"
                    >
                      <span>Criar Loja deste Tipo</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </section>

      {/* 3. RECURSOS QUE IMPULSIONAM VENDAS */}
      <section className={`py-12 sm:py-16 rounded-3xl border ${
        isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-100/70 border-slate-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
              Tudo o Que Seu Cliente Precisa Para Comprar Rápido
            </h2>
            <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Sem cadastros demorados e sem carrinhos abandonados: leve o cliente diretamente para a negociação.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <div className={`p-5 rounded-2xl border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit mb-3">
                <MessageCircle className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold mb-1">WhatsApp Integrado & Formatado</h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                O cliente clica e já envia uma mensagem completa com foto, preço, link e detalhes do item que deseja.
              </p>
            </div>

            <div className={`p-5 rounded-2xl border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 w-fit mb-3">
                <Mail className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold mb-1">Propostas Formais por E-mail</h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Geração automática de propostas detalhadas com dados do cliente, valor ofertado e condições de pagamento.
              </p>
            </div>

            <div className={`p-5 rounded-2xl border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 w-fit mb-3">
                <Smartphone className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold mb-1">Link na Bio Ultra Rápido</h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Perfeito para colocar no Instagram, TikTok, Facebook ou Google Meu Negócio. Carregamento instantâneo.
              </p>
            </div>

            <div className={`p-5 rounded-2xl border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 w-fit mb-3">
                <QrCode className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold mb-1">QR Code de Balcão e Loja Física</h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Gere o QR Code exclusivo da sua vitrine para imprimir em mesas, balcões, cartões de visita e vitrines.
              </p>
            </div>

            <div className={`p-5 rounded-2xl border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 w-fit mb-3">
                <Palette className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold mb-1">Modo Claro & Escuro (Dark/Light)</h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Visual sofisticado e adaptável com botão de troca de tema para atender a preferência de cada visitante.
              </p>
            </div>

            <div className={`p-5 rounded-2xl border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 w-fit mb-3">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold mb-1">Painel Master & Gestão SaaS</h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Controle central de lojistas, mensalidades de R$ 30,00, status de cobrança e métricas de desempenho.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 4. PLANOS E PREÇOS (R$ 30,00/MÊS) */}
      <section className="max-w-3xl mx-auto px-4 text-center">
        <div className={`p-8 sm:p-10 rounded-3xl border relative overflow-hidden ${
          isDark 
            ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-blue-500/30 shadow-2xl shadow-blue-950/40' 
            : 'bg-gradient-to-b from-blue-50 to-white border-blue-200 shadow-xl'
        }`}>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600/10 text-blue-500 border border-blue-500/20 text-xs font-bold mb-4">
            <DollarSign className="h-3.5 w-3.5" />
            <span>Preço Justo e Sem Surpresas</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold mb-2">
            Plano Completo Por Apenas
          </h2>

          <div className="flex items-baseline justify-center gap-1 my-4">
            <span className="text-sm font-semibold text-slate-400">R$</span>
            <span className="text-5xl sm:text-6xl font-black text-blue-500">30,00</span>
            <span className="text-sm font-semibold text-slate-400">/mês</span>
          </div>

          <p className={`text-xs sm:text-sm max-w-lg mx-auto mb-8 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Tudo o que você precisa para digitalizar o estoque da sua empresa, receber propostas e fechar vendas no WhatsApp.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-md mx-auto mb-8 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Itens e produtos ilimitados</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Integração direta WhatsApp</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Gerador de propostas formais</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Suporte e painel exclusivo</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onOpenRegister}
              className="w-full sm:w-auto py-3.5 px-8 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-sm font-bold shadow-lg shadow-blue-600/30 transition"
            >
              Criar Minha Loja Agora
            </button>

            <button
              onClick={onOpenLogin}
              className={`w-full sm:w-auto py-3.5 px-6 rounded-2xl border text-sm font-semibold transition ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
              }`}
            >
              Entrar no Meu Painel
            </button>
          </div>

        </div>
      </section>

      {/* 5. ACESSO RÁPIDO AO GESTOR MASTER */}
      <section className="text-center max-w-xl mx-auto pt-4">
        <button
          onClick={onGoToMasterAdmin}
          className={`inline-flex items-center gap-2 text-xs font-semibold py-2 px-4 rounded-xl border transition ${
            isDark 
              ? 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800' 
              : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-200 shadow-sm'
          }`}
        >
          <ShieldCheck className="h-4 w-4 text-blue-400" />
          <span>Acessar Painel Master SaaS (Gestão de Todas as Lojas e Mensalidades)</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </section>

    </div>
  );
};
