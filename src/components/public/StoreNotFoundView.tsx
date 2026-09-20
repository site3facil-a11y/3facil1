import React from 'react';
import { Store, ArrowLeft, Search, ShoppingBag } from 'lucide-react';
import { useStoreContext } from '../../context/StoreContext';

interface StoreNotFoundViewProps {
  requestedSlug: string;
  onGoToHome: () => void;
  onSelectStore: (storeId: string) => void;
}

export const StoreNotFoundView: React.FC<StoreNotFoundViewProps> = ({
  requestedSlug,
  onGoToHome,
  onSelectStore,
}) => {
  const { stores, theme } = useStoreContext();
  const isDark = theme === 'dark';

  return (
    <div className="py-12 px-4 max-w-3xl mx-auto text-center">
      <div className={`rounded-3xl border p-8 sm:p-12 shadow-sm ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto mb-4">
          <Store className="h-8 w-8" />
        </div>

        <h2 className={`text-xl sm:text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Vitrine não encontrada
        </h2>

        <p className={`text-sm max-w-md mx-auto mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Não encontramos nenhuma loja ativa com o endereço <code className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-blue-500 font-mono text-xs">/{requestedSlug}</code>.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <button
            onClick={onGoToHome}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Ver Todas as Lojas no 3fácil.com</span>
          </button>
        </div>

        {stores.length > 0 && (
          <div className="text-left pt-6 border-t border-slate-200 dark:border-slate-800">
            <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              Lojas disponíveis na plataforma:
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {stores.slice(0, 6).map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelectStore(s.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition ${
                    isDark 
                      ? 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/60 text-white' 
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-xs sm:text-sm truncate">{s.name}</div>
                    <div className="text-[11px] text-slate-400 truncate font-mono">/{s.slug}</div>
                  </div>
                  <span className="text-xs text-blue-500 font-semibold shrink-0">Acessar &rarr;</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
