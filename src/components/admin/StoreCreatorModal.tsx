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
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  ShieldCheck
} from 'lucide-react';
import { StoreType, StoreProfile } from '../../types/store';
import { useStoreContext } from '../../context/StoreContext';
import { apiService } from '../../services/apiService';

interface StoreCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StoreCreatorModal: React.FC<StoreCreatorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { theme, currentUser } = useStoreContext();
  const isDark = theme === 'dark';
  const isSuperAdmin = currentUser?.role === 'superadmin';

  const [selectedType, setSelectedType] = useState<StoreType>('veiculo');
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('São Paulo');
  const [state, setState] = useState('SP');
  const [bannerUrl, setBannerUrl] = useState('');
  const [password, setPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [createdResult, setCreatedResult] = useState<{
    store: StoreProfile;
    isSuperAdminCreation?: boolean;
    emailQueued?: boolean;
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
    setErrorMessage(null);

    const cleanName = name.trim();
    const cleanEmail = email.toLowerCase().trim();
    const cleanWhatsapp = whatsapp.replace(/\D/g, '');

    if (!cleanName || !cleanWhatsapp || !cleanEmail) {
      setErrorMessage('Por favor, preencha todos os campos obrigatórios (*).');
      return;
    }

    // Se NÃO for superadmin, valida senha mínima de 10 caracteres no frontend
    if (!isSuperAdmin) {
      if (!password || password.length < 10) {
        setErrorMessage('A senha de acesso deve conter no mínimo 10 caracteres.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (!isSuperAdmin) {
        // REGISTRO PÚBLICO: Chama EXCLUSIVAMENTE /api/auth/register
        const result = await apiService.register({
          name: cleanName,
          email: cleanEmail,
          password: password,
          type: selectedType,
          whatsapp: cleanWhatsapp,
          city: city.trim(),
          state: state.trim()
        });

        if (!result.success || result.error) {
          // Mostra o erro real do servidor (400, 409, 429, 503) e NÃO adiciona a loja localmente
          setErrorMessage(result.error || 'Ocorreu um erro ao processar seu cadastro.');
          setIsSubmitting(false);
          return;
        }

        const registeredStore: StoreProfile = (result.store as StoreProfile) || {
          id: result.user?.storeId || `store-${Date.now()}`,
          name: cleanName,
          slug: cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          type: selectedType,
          description: '',
          slogan: slogan.trim(),
          themeColor: '#2563eb',
          email: cleanEmail,
          whatsapp: cleanWhatsapp,
          phone: cleanWhatsapp,
          city: city.trim(),
          state: state.trim(),
          ownerName: ownerName.trim() || cleanName,
          ownerEmail: cleanEmail,
          ownerPhone: cleanWhatsapp,
          plan: 'starter',
          monthlyFee: 30,
          subscriptionStatus: 'trial',
          nextDueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          isPublished: false,
          enableWhatsApp: true,
          enableEmailProposal: true,
          currency: 'BRL',
          createdAt: new Date().toISOString()
        };

        setCreatedResult({
          store: registeredStore,
          isSuperAdminCreation: false,
          emailQueued: result.emailQueued
        });
      } else {
        // SUPERADMIN CRIANDO LOJA PELO PAINEL MASTER: Chama /api/stores (sem senha no corpo)
        const themeColors: Record<StoreType, string> = {
          veiculo: '#dc2626',
          imovel: '#0f766e',
          produto: '#2563eb',
          servico: '#7c3aed',
          locadora: '#ea580c',
        };

        const res = await apiService.saveStore({
          slug: cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          type: selectedType,
          name: cleanName,
          slogan: slogan.trim() || 'Qualidade, procedência e excelência no atendimento',
          description: `Bem-vindo à ${cleanName}. Entre em contato conosco pelo WhatsApp ou solicite uma proposta formal.`,
          bannerUrl: bannerUrl.trim() || '',
          themeColor: themeColors[selectedType],
          phone: cleanWhatsapp,
          whatsapp: cleanWhatsapp,
          email: cleanEmail,
          city: city.trim(),
          state: state.trim(),
          enableWhatsApp: true,
          enableEmailProposal: true,
          currency: 'BRL',
          ownerName: ownerName.trim() || cleanName,
          ownerEmail: cleanEmail,
          ownerPhone: cleanWhatsapp,
          plan: 'pro',
          planName: 'Profissional',
          monthlyFee: 30.00,
          subscriptionStatus: 'ativo',
          isPublished: true
        } as any);

        if (!res.success || !res.store) {
          setErrorMessage(res.dbError || 'Erro ao criar loja pelo painel master.');
          setIsSubmitting(false);
          return;
        }

        setCreatedResult({
          store: res.store,
          isSuperAdminCreation: true
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado na comunicação com o servidor.');
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
    setErrorMessage(null);
    setName('');
    setOwnerName('');
    setSlogan('');
    setWhatsapp('');
    setEmail('');
    setPassword('');
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
                {createdResult ? 'Cadastro Concluído!' : 'Criar Nova Loja / Catálogo'}
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {createdResult 
                  ? 'Instruções e dados de acesso'
                  : 'Selecione o modelo do negócio e preencha os dados cadastrais'}
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

        {/* TELA DE SUCESSO PÓS-CRIAÇÃO (SEM EXPOSIÇÃO DE SENHAS) */}
        {createdResult ? (
          <div className="p-6 space-y-5 overflow-y-auto">
            
            <div className="text-center py-2 space-y-1.5">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-500/20 text-emerald-400 mb-1 ring-8 ring-emerald-500/10">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold">
                {createdResult.isSuperAdminCreation 
                  ? `Loja "${createdResult.store.name}" criada com sucesso!`
                  : `Cadastro realizado com sucesso!`}
              </h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {createdResult.isSuperAdminCreation
                  ? 'Um e-mail de convite com link seguro para definir a senha foi enviado ao lojista.'
                  : 'Um e-mail de confirmação foi enviado. Verifique sua caixa de entrada para ativar a vitrine.'}
              </p>
            </div>

            {/* Links e Orientações */}
            <div className={`p-4 rounded-2xl border space-y-3.5 ${
              isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              {/* Vitrine */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/40">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Link da Vitrine Pública:</span>
                  <span className="text-xs sm:text-sm font-bold text-blue-400 break-all font-mono">
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

              {/* Status de Confirmação por E-mail */}
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold">
                  <Mail className="h-4 w-4" />
                  <span>
                    {createdResult.isSuperAdminCreation ? 'Convite Seguro Enviado' : 'Confirmação de E-mail Pendente'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {createdResult.isSuperAdminCreation
                    ? `Enviamos um convite para ${createdResult.store.ownerEmail || createdResult.store.email} com um link exclusivo e seguro para o lojista definir sua própria senha de acesso.`
                    : `Para sua segurança e conformidade, sua loja começará como não publicada até você clicar no botão "Confirmar cadastro" enviado para ${createdResult.store.email || email}.`}
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition"
                >
                  Concluir
                </button>
              </div>
            </div>

          </div>
        ) : (
          /* FORMULÁRIO DE CADASTRO */
          <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
            
            {/* Mensagem de Erro Real do Servidor */}
            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block mb-0.5">Não foi possível prosseguir:</span>
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Passo 1: Segmento do Negócio */}
            <div className="space-y-3">
              <label className={`block text-xs font-semibold uppercase tracking-wider ${
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

                {/* Senha: Apenas exigida para cadastro público do visitante */}
                {!isSuperAdmin && (
                  <div>
                    <label className={`block text-xs mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Senha de Acesso do Lojista * <span className="text-[10px] text-slate-400 font-normal">(mínimo 10 caracteres)</span>
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Mínimo 10 caracteres"
                      value={password}
                      minLength={10}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:border-blue-500 ${
                        isDark ? 'bg-slate-950 text-slate-200 border-slate-800' : 'bg-slate-50 text-slate-900 border-slate-300'
                      }`}
                    />
                  </div>
                )}

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
                {isSuperAdmin ? (
                  <>Um <strong>convite seguro por e-mail</strong> será enviado para o lojista definir sua senha e acessar o painel.</>
                ) : (
                  <>Ao concluir, um <strong>e-mail de confirmação de cadastro</strong> será enviado. Sua loja será publicada após a confirmação.</>
                )}
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
                    <span>Processando Cadastro...</span>
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
