import React, { useState, useEffect } from 'react';
import { parseCurrencyInput, formatCurrency, formatCurrencyExtended } from '../../utils/formatters';

interface CurrencyInputProps {
  label?: string;
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  colorTheme?: 'emerald' | 'blue' | 'purple' | 'amber' | 'slate';
  showPresets?: boolean;
  presetsType?: 'imovel' | 'veiculo' | 'geral';
  id?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  label,
  value,
  onChange,
  placeholder = '0,00',
  required = false,
  className = '',
  colorTheme = 'emerald',
  showPresets = false,
  presetsType = 'geral',
  id,
}) => {
  // Formata o número inicial para texto legível
  const formatInitial = (val: number): string => {
    if (!val || isNaN(val) || val === 0) return '';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: val % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const [text, setText] = useState<string>(() => formatInitial(value));
  const [isFocused, setIsFocused] = useState(false);

  // Sincroniza se o valor numérico externo mudar (ex: ao abrir item para edição)
  useEffect(() => {
    if (!isFocused) {
      setText(formatInitial(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setText(rawVal);
    const parsed = parseCurrencyInput(rawVal);
    onChange(parsed);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseCurrencyInput(text);
    onChange(parsed);
    setText(formatInitial(parsed));
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const addAmount = (amount: number) => {
    const current = parseCurrencyInput(text);
    const next = current + amount;
    onChange(next);
    setText(formatInitial(next));
  };

  const setExactAmount = (amount: number) => {
    onChange(amount);
    setText(formatInitial(amount));
  };

  const themeColors = {
    emerald: {
      border: 'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30',
      badge: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
      button: 'bg-slate-800/80 hover:bg-emerald-950/70 hover:border-emerald-700 text-slate-300 hover:text-emerald-300 border-slate-700/60',
    },
    blue: {
      border: 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30',
      badge: 'bg-blue-950/60 text-blue-300 border-blue-800/60',
      button: 'bg-slate-800/80 hover:bg-blue-950/70 hover:border-blue-700 text-slate-300 hover:text-blue-300 border-slate-700/60',
    },
    purple: {
      border: 'focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30',
      badge: 'bg-purple-950/60 text-purple-300 border-purple-800/60',
      button: 'bg-slate-800/80 hover:bg-purple-950/70 hover:border-purple-700 text-slate-300 hover:text-purple-300 border-slate-700/60',
    },
    amber: {
      border: 'focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30',
      badge: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
      button: 'bg-slate-800/80 hover:bg-amber-950/70 hover:border-amber-700 text-slate-300 hover:text-amber-300 border-slate-700/60',
    },
    slate: {
      border: 'focus:border-slate-400 focus:ring-1 focus:ring-slate-400/30',
      badge: 'bg-slate-800 text-slate-300 border-slate-700',
      button: 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700',
    },
  }[colorTheme];

  const currentNumeric = parseCurrencyInput(text);
  const extendedText = formatCurrencyExtended(currentNumeric);

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs text-slate-300 mb-1 font-medium">
          {label}
        </label>
      )}

      <div className="relative">
        <span className="absolute left-3 top-2.5 text-xs font-semibold text-slate-400 select-none">
          R$
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          required={required}
          placeholder={placeholder}
          value={text}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={`w-full bg-slate-950 text-slate-100 text-sm font-bold pl-9 pr-3 py-2.5 rounded-xl border border-slate-800 transition-all focus:outline-none ${themeColors.border} ${className}`}
        />
      </div>

      {/* Badge de visualização do valor formatado em tempo real com extenso */}
      {currentNumeric > 0 && (
        <div className={`mt-1.5 flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] ${themeColors.badge} animate-in fade-in duration-150`}>
          <span className="font-bold">{formatCurrency(currentNumeric)}</span>
          {extendedText && (
            <span className="opacity-90 font-medium">
              ({extendedText})
            </span>
          )}
        </div>
      )}

      {/* Botões de atalho rápido para valores altos (Imóveis / Veículos) */}
      {showPresets && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {presetsType === 'imovel' && (
            <>
              <button
                type="button"
                onClick={() => addAmount(100_000)}
                className={`text-[10px] px-2 py-0.5 rounded-md border font-medium transition ${themeColors.button}`}
              >
                +100 mil
              </button>
              <button
                type="button"
                onClick={() => addAmount(500_000)}
                className={`text-[10px] px-2 py-0.5 rounded-md border font-medium transition ${themeColors.button}`}
              >
                +500 mil
              </button>
              <button
                type="button"
                onClick={() => addAmount(1_000_000)}
                className={`text-[10px] px-2 py-0.5 rounded-md border font-medium transition ${themeColors.button}`}
              >
                +1 Milhão
              </button>
              <button
                type="button"
                onClick={() => setExactAmount(1_000_000)}
                className={`text-[10px] px-2 py-0.5 rounded-md border font-medium transition ${themeColors.button}`}
              >
                Exato: 1M
              </button>
            </>
          )}

          {presetsType === 'veiculo' && (
            <>
              <button
                type="button"
                onClick={() => addAmount(10_000)}
                className={`text-[10px] px-2 py-0.5 rounded-md border font-medium transition ${themeColors.button}`}
              >
                +10 mil
              </button>
              <button
                type="button"
                onClick={() => addAmount(50_000)}
                className={`text-[10px] px-2 py-0.5 rounded-md border font-medium transition ${themeColors.button}`}
              >
                +50 mil
              </button>
              <button
                type="button"
                onClick={() => addAmount(100_000)}
                className={`text-[10px] px-2 py-0.5 rounded-md border font-medium transition ${themeColors.button}`}
              >
                +100 mil
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
