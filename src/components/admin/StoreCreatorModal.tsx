import React, { useState } from 'react';
import { 
  X, 
  Car, 
  Home, 
  ShoppingBag, 
  Briefcase, 
  Sparkles, 
  Check, 
  ArrowRight, 
  Store,
  Mail,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Database
} from 'lucide-react';
import { StoreType, StoreProfile } from '../../types/store';
import { useStoreContext } from '../../context/StoreContext';

interface StoreCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StoreCreatorModal: React.FC<StoreCreatorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { createStore, theme } = useStoreContext();
  const isDark = theme === 'dark';

  const [selectedType, setSelectedType] = useState<StoreType>('veiculo');
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('São Paulo');
  const [state, setState] = useState('SP');
  const [bannerUrl, setBannerUrl] = useState('');
  const [password, setPassword] = useState('123456');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [createdResult, setCreatedResult] = useState<{
    store: StoreProfile;
    emailResult?: { success: boolean; message: string; simulated?: boolean };
    postgresSaved?: boolean;
    dbError?: string;
  } | null>(null);

  if (!isOpen) return null;

  const modelOptions = [
    {
      type: 'veiculo' as StoreType,
      title: 'Loja de Veículos & Autos',
      description: 'Carros, motos e seminovos com ano, km, câmbio e tabela FIPE',
      icon: Car,
      color: 'from-red-600 to-rose-700',
      badge: 'Automotivo',
      defaultBanner: '/uploads/demo/photo-1503376780353-7e6692767b70.jpg',
    },
    {
      type: 'imovel' as StoreType,
      title: 'Imobiliária & Corretores',
      description: 'Casas, apartamentos e terrenos com m², quartos, suítes e condomínio',
      icon: Home,
      color: 'from-emerald-600 to-teal-700',
      badge: 'Imóveis',
      defaultBanner: '/uploads/demo/photo-1600585154340-be6161a56a0c.jpg',
    },
    {
      type: 'produto' as StoreType,
      title: 'Loja de Produtos Físicos',
      description: 'E-commerce e catálogo com estoque, variações, promoções e SKU',
      icon: ShoppingBag,
      color: 'from-blue-600 to-indigo-700',
      badge: 'Varejo',
      defaultBanner: '/uploads/demo/photo-1550745165-9bc0b252726f.jpg',
    },
    {
      type: 'servico' as StoreType,
      title: 'Prestador de Serviços',
      description: 'Consultorias, design, reformas e projetos com portfólio e escopo',
      icon: Briefcase,
      color: 'from-purple-600 to-violet-700',
      badge: 'Serviços',
      defaultBanner: '/uploads/demo/photo-1618221195710-dd6b41faaea6.jpg',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !whatsapp.trim() || !email.trim()) return;

    setIsSubmitting(true);

    const matchedOption = modelOptions.find((m) => m.type === selectedType);
    const finalBanner = bannerUrl.trim() || matchedOption?.defaultBanner || '';

    const themeColors: Record<StoreType, string> = {
      veiculo: '#dc2626',
      imovel: '#0f766e',
      produto: '#2563eb',
      servico: '#7c3aed',
    };

    try {
      const result = await createStore({
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        type: selectedType,
        name: name.trim(),
        slogan: slogan.trim() || 'Qualidade, procedência e excelência no atendimento',
        description: `Bem-vindo à ${name}. Entre em contato conosco pelo WhatsApp ou solicite uma proposta formal.`,
        bannerUrl: finalBanner,
        themeColor: themeColors[selectedType],
        phone: whatsapp.trim(),
        whatsapp: whatsapp.replace(/\D/g, ''),
        email: email.trim(),
        city: city.trim(),
        state: state.trim(),
        enableWhatsApp: true,
        enableEmailProposal: true,
        currency: 'BRL',
        ownerName: ownerName.trim() || name.trim(),
        ownerEmail: email.trim(),
        ownerPhone: whatsapp.trim(),
        password: password.trim() || '123456',
        plan: 'pro',
        planName: 'Profissional',
        monthlyFee: 30.00,
        subscriptionStatus: 'ativo',
        isPublished: true,
        nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });

      setCreatedResult({
        store: result.store,
        emailResult: result.emailResult,
        postgresSaved: result.postgresSaved,
        dbError: result.dbError
      });
    } catch (err: any) {
      alert('Ocorreu um erro ao criar a loja: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/?loja=${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleClose = () => {
    setCreatedResult(null);
    setName('');
    setOwnerName('');
    setSlogan('');
    setWhatsapp('');
    setEmail('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      
      <div className={`rounded-3xl w-full max-w-2xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto border transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between transition-colors ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-xl border ${
              isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200'
            }`}>
              <Store className="h-4 w-4" />
            </div>
            <div>
              <h3 className={`text-sm sm:text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {createdResult ? 'Loja Criada com Sucesso!' : 'Criar Nova Loja / Catálogo'}
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {createdResult ? 'A vitrine e o painel já estão disponíveis' : 'Selecione o modelo do negócio e preencha os dados cadastrais'}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className={`p-2 rounded-xl transition ${
              isDark ? 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* TELA DE SUCESSO PÓS-CRIAÇÃO */}
        {createdResult ? (
          <div className="p-6 space-y-6 overflow-y-auto">
            
            <div className="text-center py-4 space-y-2">
              <div className="inline-flex items-center justify-center p-3.5 rounded-full bg-emerald-500/20 text-emerald-400 mb-1 ring-8 ring-emerald-500/10">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-bold">Parabéns! A loja "{createdResult.store.name}" foi criada!</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                A vitrine digital já foi estruturada com dados cadastrais e produtos iniciais de exemplo.
              </p>
            </div>

            {/* Links de Acesso */}
            <div className={`p-4 rounded-2xl border space-y-3 ${
              isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/40">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Link da Vitrine Pública:</span>
                  <span className="text-sm font-bold text-blue-400 break-all font-mono">
                    {window.location.origin}/?loja={createdResult.store.slug}
                  </span>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleCopyLink(createdResult.store.slug)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition flex items-center space-x-1"
                  >
                    {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedLink ? 'Copiado!' : 'Copiar Link'}</span>
                  </button>
                  <a
                    href={`/?loja=${createdResult.store.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center space-x-1 border border-slate-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Abrir Vitrine</span>
                  </a>
                </div>
              </div>

              {/* Status do Banco de Dados PostgreSQL */}
              <div className="pt-2 pb-2 border-b border-slate-800/40">
                <div className="flex items-start space-x-2.5">
                  <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${
                    createdResult.postgresSaved 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    <Database className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      Banco de Dados PostgreSQL (usuarios.lojas):
                    </h4>
                    {createdResult.postgresSaved ? (
                      <p className="text-xs text-emerald-400 mt-0.5 font-medium">
                        ✅ Loja gravada diretamente no PostgreSQL (ID UUID: <code className="font-mono text-[11px]">{createdResult.store.id}</code>)!
                      </p>
                    ) : (
                      <p className="text-xs text-amber-300 mt-0.5">
                        ⚠️ Salvo no armazenamento persistente do servidor. {createdResult.dbError ? `(Aviso: ${createdResult.dbError})` : ''}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Status do Envio de E-mail */}
              <div className="pt-1">
                <div className="flex items-start space-x-2.5">
                  <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 mt-0.5 shrink-0">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      Disparo de E-mail de Boas-Vindas ({createdResult.store.email}):
                    </h4>
                    {createdResult.emailResult?.success ? (
                      <p className="text-xs text-emerald-400 mt-0.5">
                        ✅ E-mail de confirmação enviado com sucesso para o cliente!
                      </p>
                    ) : (
                      <div className="text-xs text-amber-400 mt-0.5 space-y-1">
                        <p>
                          ⚠️ {createdResult.emailResult?.message || 'Servidor SMTP em modo de simulação.'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Dica: Para que seus clientes recebam e-mails reais no Gmail/Outlook, configure as credenciais SMTP no seu arquivo <code>.env</code> (ou na aba "Envio de E-mails & SMTP" do Painel Master).
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={handleClose}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-xs shadow-md hover:from-blue-500 hover:to-indigo-500 transition"
              >
                Concluir e Ver no Painel
              </button>
            </div>

          </div>
        ) : (
          /* Formulário de Criação */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
            
            {/* Passo 1: Seleção do Modelo */}
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-3 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                1. Selecione o Tipo de Loja que Deseja Criar
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {modelOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = selectedType === opt.type;
                  return (
                    <div
                      key={opt.type}
                      onClick={() => setSelectedType(opt.type)}
                      className={`p-3.5 rounded-2xl border-2 cursor-pointer transition relative flex flex-col justify-between ${
                        isSelected
                          ? isDark
                            ? 'border-blue-500 bg-blue-600/10 shadow-lg shadow-blue-500/10'
                            : 'border-blue-600 bg-blue-50/80 shadow-md ring-1 ring-blue-500/20'
                          : isDark
                            ? 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-800/40'
                            : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${opt.color} text-white shadow-md`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDark ? 'bg-slate-800 text-slate-300' : 'bg-white border border-slate-200 text-slate-700'
                        }`}>
                          {opt.badge}
                        </span>
                      </div>
                      <div>
                        <h4 className={`text-sm font-semibold mb-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{opt.title}</h4>
                        <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{opt.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Passo 2: Dados da Empresa & Cliente */}
            <div className={`space-y-3 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <label className={`block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                2. Informações Cadastrais da Loja
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Nome da Loja / Empresa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: RentPro Locadora, Elite Motors"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-950 text-slate-200 border-slate-800' : 'bg-slate-50 text-slate-900 border-slate-300'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Nome do Cliente / Responsável</label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos Eduardo Silva"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-950 text-slate-200 border-slate-800' : 'bg-slate-50 text-slate-900 border-slate-300'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Tipo de Loja / Segmento</label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value as StoreType)}
                    className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-950 text-slate-200 border-slate-800' : 'bg-slate-50 text-slate-900 border-slate-300'
                    }`}
                  >
                    <option value="veiculo">🚗 Loja de Veículos & Autos</option>
                    <option value="imovel">🏠 Imobiliária & Corretores</option>
                    <option value="produto">🛍️ Loja de Produtos Físicos</option>
                    <option value="servico">💼 Prestador de Serviços</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-xs mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Slogan ou Subtítulo</label>
                  <input
                    type="text"
                    placeholder="Ex: Qualidade e procedência garantida"
                    value={slogan}
                    onChange={(e) => setSlogan(e.target.value)}
                    className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-950 text-slate-200 border-slate-800' : 'bg-slate-50 text-slate-900 border-slate-300'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>WhatsApp para Vendas (com DDD) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 11987654321"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-950 text-slate-200 border-slate-800' : 'bg-slate-50 text-slate-900 border-slate-300'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>E-mail para Receber Propostas e Boas-Vindas *</label>
                  <input
                    type="email"
                    required
                    placeholder="Ex: contato@minhaloja.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-950 text-slate-200 border-slate-800' : 'bg-slate-50 text-slate-900 border-slate-300'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Senha de Acesso do Lojista *</label>
                  <input
                    type="password"
                    required
                    placeholder="Defina sua senha de acesso"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-blue-500 ${
                      isDark ? 'bg-slate-950 text-slate-200 border-slate-800' : 'bg-slate-50 text-slate-900 border-slate-300'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Cidade</label>
                  <input
                    type="text"
                    placeholder="Ex: São Paulo"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border ${
                      isDark ? 'bg-slate-950 text-slate-200 border-slate-800' : 'bg-slate-50 text-slate-900 border-slate-300'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Estado (UF)</label>
                  <input
                    type="text"
                    placeholder="Ex: SP"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border ${
                      isDark ? 'bg-slate-950 text-slate-200 border-slate-800' : 'bg-slate-50 text-slate-900 border-slate-300'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Aviso de Confirmação por E-mail */}
            <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 ${
              isDark ? 'bg-sky-500/10 border-sky-500/20 text-sky-300' : 'bg-sky-50 border-sky-200 text-sky-800'
            }`}>
              <Sparkles className="h-4 w-4 shrink-0 text-sky-500" />
              <span>
                Ao concluir, um <strong>e-mail de boas-vindas com confirmação de cadastro</strong> e links de acesso direto será enviado para o endereço informado.
              </span>
            </div>

            <div className={`pt-3 border-t flex items-center justify-end space-x-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className={`px-4 py-2.5 rounded-xl text-xs font-medium transition ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Criando Loja e Enviando E-mail...</span>
                  </>
                ) : (
                  <>
                    <span>Criar Loja</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>

    </div>
  );
};
