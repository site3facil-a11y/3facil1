import React from 'react';
import { 
  Cloud, 
  Database, 
  Server, 
  Boxes, 
  Award, 
  ShieldCheck, 
  BadgeCheck, 
  Cpu, 
  CheckCircle2,
  FileCheck2,
  Lock,
  Layers
} from 'lucide-react';

interface TechStackAndGovernanceProps {
  isDark: boolean;
}

export const TechStackAndGovernance: React.FC<TechStackAndGovernanceProps> = ({ isDark }) => {
  return (
    <section id="tech-governance" className="max-w-6xl mx-auto px-4">
      {/* Cabeçalho da Seção */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border bg-gradient-to-r from-red-500/10 via-blue-500/10 to-emerald-500/10 border-blue-500/20 text-blue-400 text-xs font-semibold mb-4">
          <Cpu className="h-3.5 w-3.5 text-blue-400" />
          <span>Infraestrutura Corporativa & Engenharia Sólida</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-3">
          Tecnologias Empregadas & Governança de TI
        </h2>
        <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          A plataforma <strong>3fácil.com</strong> é construída com servidores dedicados em nuvem, conteinerização avançada e padrões internacionais de governança de serviços para garantir estabilidade ininterrupta para o seu negócio.
        </p>
      </div>

      {/* Grid de 3 Pilares Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        
        {/* Pilar 1: Infraestrutura em Nuvem (Oracle Cloud) */}
        <div className={`p-6 rounded-2xl border transition hover:shadow-lg flex flex-col justify-between ${
          isDark 
            ? 'bg-slate-900/70 border-slate-800 hover:border-red-500/30' 
            : 'bg-white border-slate-200 hover:border-red-400/40 shadow-sm'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20">
                <Cloud className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                Cloud Enterprise
              </span>
            </div>

            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              Infraestrutura Oracle Cloud
            </h3>
            <p className={`text-xs leading-relaxed mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Hospedagem em nuvem de nível corporativo (OCI) com servidores dedicados de alta performance e disponibilidade ininterrupta.
            </p>

            <ul className="space-y-2.5 text-xs">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Servidores Segregados:</strong> Isolamento físico e lógico entre servidor de aplicação e servidor de banco de dados.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Rede & Segurança:</strong> Proteção com firewall de camada de rede e baixa latência nacional.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Uptime Elevado:</strong> Arquitetura preparada para tráfego constante de catálogos e visualizações simultâneas.</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] text-slate-400 font-medium">Ambiente seguro com SSL/TLS de ponta a ponta</span>
          </div>
        </div>

        {/* Pilar 2: Desenvolvimento & Stack (Node.js, Docker, PostgreSQL) */}
        <div className={`p-6 rounded-2xl border transition hover:shadow-lg flex flex-col justify-between ${
          isDark 
            ? 'bg-slate-900/70 border-slate-800 hover:border-blue-500/30' 
            : 'bg-white border-slate-200 hover:border-blue-400/40 shadow-sm'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <Server className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                Full-Stack Moderno
              </span>
            </div>

            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              Desenvolvimento & Dados
            </h3>
            <p className={`text-xs leading-relaxed mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Tecnologias de referência mundial com arquitetura desacoplada e conteinerizada para máxima velocidade e confiabilidade.
            </p>

            <ul className="space-y-2.5 text-xs">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Node.js & Express:</strong> Backend assíncrono com APIs de alta resposta para propostas e WhatsApp.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>PostgreSQL:</strong> Banco de dados relacional robusto com conformidade ACID e dados segregados por módulo.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Docker:</strong> Conteinerização completa com isolamento de serviços e deploys automatizados.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>React 19 & TypeScript:</strong> Frontend ultra responsivo com navegação instantânea e tipagem rigorosa.</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center gap-2">
            <Boxes className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] text-slate-400 font-medium">Deploys conteinerizados rápidos e contínuos</span>
          </div>
        </div>

        {/* Pilar 3: Governança de TI & Formação (ITIL 4, ISO/IEC 20000) */}
        <div className={`p-6 rounded-2xl border transition hover:shadow-lg flex flex-col justify-between ${
          isDark 
            ? 'bg-slate-900/70 border-slate-800 hover:border-emerald-500/30' 
            : 'bg-white border-slate-200 hover:border-emerald-400/40 shadow-sm'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <Award className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Padrões Globais
              </span>
            </div>

            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              Formação & Governança de TI
            </h3>
            <p className={`text-xs leading-relaxed mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Gestão de TI orientada pelas melhores práticas globais de mercado, garantindo entrega de valor e qualidade no atendimento.
            </p>

            <ul className="space-y-2.5 text-xs">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>ITIL® 4:</strong> Metodologia de Gerenciamento de Serviços de TI focada no ciclo de valor, gestão proativa de incidentes e melhoria contínua.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>ISO/IEC 20000:</strong> Alinhamento com a norma internacional de Gestão de Serviços de Tecnologia da Informação (SGSTI), assegurando processos padronizados e confiabilidade.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Foco no Cliente:</strong> Gestão de chamados, suporte rápido e compromisso com o sucesso dos lojistas parceiros.</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center gap-2">
            <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[11px] text-slate-400 font-medium">Gestão profissional e qualificada de TI</span>
          </div>
        </div>

      </div>

      {/* Barra de Selos / Badges Rápidos das Tecnologias e Normas */}
      <div className={`p-4 sm:p-5 rounded-2xl border ${
        isDark ? 'bg-slate-900/50 border-slate-800/80' : 'bg-slate-100/70 border-slate-200'
      }`}>
        <div className="text-center mb-3">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
            Pilha Tecnológica & Certificações de Governança
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {/* Oracle Cloud */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
            isDark ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800 shadow-xs'
          }`}>
            <Cloud className="h-3.5 w-3.5 text-red-500" />
            <span>Oracle Cloud Infrastructure</span>
          </div>

          {/* Node.js */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
            isDark ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800 shadow-xs'
          }`}>
            <Server className="h-3.5 w-3.5 text-emerald-500" />
            <span>Node.js</span>
          </div>

          {/* Docker */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
            isDark ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800 shadow-xs'
          }`}>
            <Boxes className="h-3.5 w-3.5 text-blue-500" />
            <span>Docker</span>
          </div>

          {/* PostgreSQL */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
            isDark ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800 shadow-xs'
          }`}>
            <Database className="h-3.5 w-3.5 text-indigo-400" />
            <span>PostgreSQL</span>
          </div>

          {/* ITIL 4 */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
            isDark ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800 shadow-xs'
          }`}>
            <Award className="h-3.5 w-3.5 text-purple-400" />
            <span>ITIL® 4</span>
          </div>

          {/* ISO/IEC 20000 */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
            isDark ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800 shadow-xs'
          }`}>
            <FileCheck2 className="h-3.5 w-3.5 text-teal-400" />
            <span>ISO/IEC 20000</span>
          </div>

          {/* React & TypeScript */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
            isDark ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800 shadow-xs'
          }`}>
            <Layers className="h-3.5 w-3.5 text-cyan-400" />
            <span>React & TypeScript</span>
          </div>
        </div>
      </div>
    </section>
  );
};
