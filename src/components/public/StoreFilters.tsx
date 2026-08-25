import React from 'react';
import { Filter, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { StoreType } from '../../types/store';
import { useStoreContext } from '../../context/StoreContext';

export interface FilterState {
  category: string;
  priceSort: 'none' | 'asc' | 'desc';
  propertyTransaction: 'todos' | 'venda' | 'aluguel';
  propertyType: string;
  minBedrooms: number;
  vehicleTransmission: string;
  vehicleFuel: string;
  rentalMileage: string;
  onlyInStock: boolean;
  onlyFeatured: boolean;
}

interface StoreFiltersProps {
  storeType: StoreType;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onResetFilters: () => void;
  categories: string[];
}

export const StoreFilters: React.FC<StoreFiltersProps> = ({
  storeType,
  filters,
  onFilterChange,
  onResetFilters,
  categories,
}) => {
  const { theme } = useStoreContext();
  const isDark = theme === 'dark';

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFilterChange({
      ...filters,
      [key]: value,
    });
  };

  const selectClass = `w-full text-xs rounded-xl border px-2.5 py-2 focus:outline-none focus:border-blue-500 transition ${
    isDark 
      ? 'bg-slate-950 text-slate-300 border-slate-800' 
      : 'bg-white text-slate-800 border-slate-200 focus:bg-white'
  }`;

  const labelClass = `block text-[11px] font-medium mb-1 ${
    isDark ? 'text-slate-400' : 'text-slate-600'
  }`;

  return (
    <div className={`border rounded-2xl p-4 mb-6 shadow-sm transition-colors ${
      isDark ? 'bg-slate-900/90 border-slate-800/90' : 'bg-white border-slate-200 shadow-slate-100'
    }`}>
      <div className={`flex flex-wrap items-center justify-between gap-3 pb-3 border-b text-xs font-semibold uppercase tracking-wider ${
        isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'
      }`}>
        <div className={`flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
          <SlidersHorizontal className="h-4 w-4 text-blue-500" />
          <span>Filtros do Catálogo</span>
        </div>
        <button
          onClick={onResetFilters}
          className={`flex items-center gap-1 transition font-normal ${
            isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <RotateCcw className="h-3 w-3" />
          <span>Limpar</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-3">
        
        {/* 1. Ordenação por Preço / Diária */}
        <div>
          <label className={labelClass}>
            {storeType === 'locadora' ? 'Valor da Diária' : 'Ordenar por'}
          </label>
          <select
            value={filters.priceSort}
            onChange={(e) => updateFilter('priceSort', e.target.value as any)}
            className={selectClass}
          >
            <option value="none">Padrão (Mais recentes)</option>
            <option value="asc">Menor Preço</option>
            <option value="desc">Maior Preço</option>
          </select>
        </div>

        {/* 2. Categorias (Produtos, Serviços, Locadoras) */}
        {(storeType === 'produto' || storeType === 'servico' || storeType === 'locadora') && categories.length > 0 && (
          <div>
            <label className={labelClass}>
              {storeType === 'locadora' ? 'Categoria da Frota' : 'Categoria'}
            </label>
            <select
              value={filters.category}
              onChange={(e) => updateFilter('category', e.target.value)}
              className={selectClass}
            >
              <option value="">Todas as Categorias</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 3. Filtros Exclusivos para LOCADORA */}
        {storeType === 'locadora' && (
          <>
            <div>
              <label className={labelClass}>Câmbio</label>
              <select
                value={filters.vehicleTransmission}
                onChange={(e) => updateFilter('vehicleTransmission', e.target.value)}
                className={selectClass}
              >
                <option value="">Todos</option>
                <option value="automatico">Automático</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Política de KM</label>
              <select
                value={filters.rentalMileage}
                onChange={(e) => updateFilter('rentalMileage', e.target.value)}
                className={selectClass}
              >
                <option value="">Todas as Políticas</option>
                <option value="km_livre">Quilometragem Livre</option>
                <option value="km_controlado">KM Controlado</option>
              </select>
            </div>
          </>
        )}

        {/* 4. Filtros Exclusivos para IMÓVEIS */}
        {storeType === 'imovel' && (
          <>
            <div>
              <label className={labelClass}>Finalidade</label>
              <select
                value={filters.propertyTransaction}
                onChange={(e) => updateFilter('propertyTransaction', e.target.value as any)}
                className={selectClass}
              >
                <option value="todos">Venda ou Aluguel</option>
                <option value="venda">Apenas Venda</option>
                <option value="aluguel">Apenas Aluguel</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Tipo de Imóvel</label>
              <select
                value={filters.propertyType}
                onChange={(e) => updateFilter('propertyType', e.target.value)}
                className={selectClass}
              >
                <option value="">Todos os Tipos</option>
                <option value="apartamento">Apartamento</option>
                <option value="casa">Casa</option>
                <option value="cobertura">Cobertura</option>
                <option value="terreno">Terreno</option>
                <option value="comercial">Comercial</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Mínimo Quartos</label>
              <select
                value={filters.minBedrooms}
                onChange={(e) => updateFilter('minBedrooms', Number(e.target.value))}
                className={selectClass}
              >
                <option value={0}>Qualquer quantidade</option>
                <option value={1}>1+ Quarto</option>
                <option value={2}>2+ Quartos</option>
                <option value={3}>3+ Quartos</option>
                <option value={4}>4+ Quartos</option>
              </select>
            </div>
          </>
        )}

        {/* 5. Filtros Exclusivos para VEÍCULOS (Venda) */}
        {storeType === 'veiculo' && (
          <>
            <div>
              <label className={labelClass}>Câmbio</label>
              <select
                value={filters.vehicleTransmission}
                onChange={(e) => updateFilter('vehicleTransmission', e.target.value)}
                className={selectClass}
              >
                <option value="">Todos os Câmbios</option>
                <option value="automatico">Automático / CVT</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Combustível</label>
              <select
                value={filters.vehicleFuel}
                onChange={(e) => updateFilter('vehicleFuel', e.target.value)}
                className={selectClass}
              >
                <option value="">Todos os Combustíveis</option>
                <option value="flex">Flex (Gasolina/Etanol)</option>
                <option value="gasolina">Gasolina</option>
                <option value="diesel">Diesel</option>
                <option value="hibrido">Híbrido / Elétrico</option>
              </select>
            </div>
          </>
        )}

        {/* 6. Apenas Destaques */}
        <div className="flex items-center pt-5">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.onlyFeatured}
              onChange={(e) => updateFilter('onlyFeatured', e.target.checked)}
              className={`w-4 h-4 rounded text-blue-600 focus:ring-0 ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-300'
              }`}
            />
            <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Apenas Destaques ⭐
            </span>
          </label>
        </div>

      </div>
    </div>
  );
};

