import React, { useState } from 'react';
import { X, ShieldCheck, FileText, Lock, CheckCircle2, Mail, ExternalLink } from 'lucide-react';
import { useStoreContext } from '../../context/StoreContext';

interface TermsAndPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'terms' | 'privacy';
}

export const TermsAndPrivacyModal: React.FC<TermsAndPrivacyModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'terms',
}) => {
  const { theme } = useStoreContext();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(defaultTab);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200 ${
      isDark ? 'bg-slate-950/80' : 'bg-slate-900/60'
    }`}>
      
      <div className={`border rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col transition-all my-auto ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        
        {/* Topo / Tabs */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50'
        }`}>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className={`font-bold text-base leading-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                Segurança, Termos e Privacidade
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                3facil.com Tecnologia & Conformidade LGPD
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl border transition ${
              isDark 
                ? 'border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white' 
                : 'border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900'
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Seleção de Abas */}
        <div className={`flex border-b text-xs font-semibold px-6 pt-2 ${
          isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-100/50'
        }`}>
          <button
            onClick={() => setActiveTab('terms')}
            className={`pb-2.5 px-4 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'terms'
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Termos de Uso</span>
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`pb-2.5 px-4 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'privacy'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="h-4 w-4" />
            <span>Privacidade & LGPD</span>
          </button>
        </div>

        {/* Corpo do Texto */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm leading-relaxed text-justify">
          
          {activeTab === 'terms' ? (
            <div className={`space-y-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <div className="space-y-1">
                <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  1. Objeto e Natureza da Plataforma
                </h4>
                <p>
                  O <strong>3facil.com</strong> é uma plataforma SaaS (Software as a Service) que fornece infraestrutura tecnológica digital para que corretores de imóveis, revendedores de veículos, comércios e prestadores de serviços criem vitrines e catálogos online interativos com atendimento e formalização de propostas diretas via WhatsApp e E-mail.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  2. Responsabilidade sobre Anúncios e Conteúdo
                </h4>
                <p>
                  Cada anunciante ou lojista é integralmente responsável pela veracidade, disponibilidade, precificação, dados técnicos e legais dos itens cadastrados em sua respectiva vitrine. O 3facil.com não intermedeia custódia financeira de valores transacionados entre comprador e vendedor, atuando como viabilizador técnico de catálogo e canal de contato direto.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  3. Condições de Assinatura e Planos
                </h4>
                <p>
                  Os planos SaaS para lojistas e corretores possuem valores mensais (ex: Plano Oficial por R$ 30,00/mês), sem carência ou multas rescisórias, podendo ser suspensos ou cancelados a qualquer momento mediante solicitação ao suporte.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  4. Disponibilidade e Suporte
                </h4>
                <p>
                  Nossa infraestrutura opera em servidores de alta disponibilidade com backups diários e criptografia SSL ponta a ponta. Atendimento e suporte oficial através do e-mail <strong>site3facil@gmail.com</strong> e WhatsApp corporativo.
                </p>
              </div>
            </div>
          ) : (
            <div className={`space-y-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <div className="space-y-1">
                <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  1. Compromisso com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018)
                </h4>
                <p>
                  O <strong>3facil.com</strong> respeita a privacidade de todos os visitantes, anunciantes e clientes. Todos os dados tratados nesta plataforma obedecem rigorosamente aos princípios de finalidade, necessidade, transparência e segurança.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  2. Coleta e Finalidade dos Dados
                </h4>
                <p>
                  Ao enviar uma proposta ou iniciar uma conversa via WhatsApp, o visitante pode fornecer voluntariamente seu nome, telefone/WhatsApp e endereço de e-mail. Esses dados são utilizados exclusivamente para que o anunciante responsável pelo item possa responder à sua solicitação e dar andamento ao atendimento.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  3. Não Compartilhamento com Terceiros
                </h4>
                <p>
                  O 3facil.com <strong>não vende, não aluga e não cede</strong> bases de dados ou informações pessoais para terceiros para fins de marketing ou publicidade em massa.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  4. Direitos do Titular de Dados
                </h4>
                <p>
                  Em conformidade com a legislação brasileira, qualquer usuário pode solicitar a confirmação da existência de tratamento, a correção de dados incompletos ou a exclusão de seus dados entrando em contato pelo e-mail <strong>site3facil@gmail.com</strong>.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Rodapé do Modal */}
        <div className={`px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${
          isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50'
        }`}>
          <div className="flex items-center gap-1.5 text-emerald-500 font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            <span>Plataforma 100% em conformidade com as leis brasileiras</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition text-center"
          >
            Entendido e Fechar
          </button>
        </div>

      </div>

    </div>
  );
};
