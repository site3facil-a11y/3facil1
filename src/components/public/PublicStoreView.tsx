import React, { useState, useMemo, useEffect } from 'react';
import { 
  StoreHero 
} from './StoreHero';
import { 
  StoreFilters, 
  FilterState 
} from './StoreFilters';
import { 
  ItemCard 
} from './ItemCard';
import { 
  ItemDetailModal 
} from './ItemDetailModal';
import { 
  EmailProposalModal 
} from './EmailProposalModal';
import { 
  StoreProfile, 
  StoreItem 
} from '../../types/store';
import { useStoreContext } from '../../context/StoreContext';
import { 
  MessageCircle, 
  PackageSearch, 
  Sparkles, 
  PhoneCall, 
  Mail,
  HelpCircle,
  Car,
  Home,
  ShoppingBag,
  Briefcase,
  KeyRound
} from 'lucide-react';
import { generateGeneralWhatsAppLink } from '../../utils/formatters';

interface PublicStoreViewProps {
  onOpenAdmin: () => void;
}

export const PublicStoreView: React.FC<PublicStoreViewProps> = ({
  onOpenAdmin,
}) => {
  const { activeStore, currentStoreItems, theme } = useStoreContext();
  const isDark = theme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<StoreItem | null>(null);
  const [selectedItemForProposal, setSelectedItemForProposal] = useState<StoreItem | null>(null);

  // Abre automaticamente o item quando o link compartilhado contém ?item=ID
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('item');
    if (itemId) {
      const found = currentStoreItems.find((i) => i.id === itemId);
      if (found) setSelectedItemForDetails(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoreItems.length]);

  const initialFilters: FilterState = {
    category: '',
    priceSort: 'none',
    propertyTransaction: 'todos',
    propertyType: '',
    minBedrooms: 0,
    vehicleTransmission: '',
    vehicleFuel: '',
    rentalMileage: '',
    onlyInStock: false,
    onlyFeatured: false,
  };

  const [filters, setFilters] = useState<FilterState>(initialFilters);

  // Categorias únicas presentes nos itens atuais (Produtos, Serviços, Locadoras)
  const categories = useMemo(() => {
    const set = new Set<string>();
    currentStoreItems.forEach((item) => {
      if (item.itemType === 'produto' || item.itemType === 'servico') {
        if (item.category) set.add(item.category);
      } else if (item.itemType === 'locadora') {
        if (item.rentalCategory) set.add(item.rentalCategory);
      }
    });
    return Array.from(set);
  }, [currentStoreItems]);

  // Filtragem dos Itens
  const filteredItems = useMemo(() => {
    return currentStoreItems.filter((item) => {
      // 1. Busca por texto livre
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        let matchSpecial = false;

        if (item.itemType === 'locadora') {
          matchSpecial = (item.rentalCategory || '').toLowerCase().includes(q) ||
            (item.includedServices || []).some((s) => s.toLowerCase().includes(q));
        } else if (item.itemType === 'veiculo') {
          matchSpecial = `${item.brand} ${item.model} ${item.version || ''}`.toLowerCase().includes(q) ||
            (item.accessories || []).some((a) => a.toLowerCase().includes(q));
        } else if (item.itemType === 'imovel') {
          matchSpecial = `${item.neighborhood} ${item.city}`.toLowerCase().includes(q) ||
            (item.amenities || []).some((a) => a.toLowerCase().includes(q));
        } else if (item.itemType === 'produto') {
          matchSpecial = (item.brand || '').toLowerCase().includes(q) ||
            (item.category || '').toLowerCase().includes(q);
        } else if (item.itemType === 'servico') {
          matchSpecial = (item.category || '').toLowerCase().includes(q) ||
            (item.includedItems || []).some((inc) => inc.toLowerCase().includes(q));
        }

        if (!matchTitle && !matchDesc && !matchSpecial) {
          return false;
        }
      }

      // 2. Destaques
      if (filters.onlyFeatured && !item.featured) {
        return false;
      }

      // 3. Categoria
      if (filters.category) {
        if (item.itemType === 'produto' || item.itemType === 'servico') {
          if (item.category !== filters.category) return false;
        } else if (item.itemType === 'locadora') {
          if (item.rentalCategory !== filters.category) return false;
        }
      }

      // 4. Locadora
      if (item.itemType === 'locadora') {
        if (filters.vehicleTransmission && item.transmission !== filters.vehicleTransmission) {
          return false;
        }
        if (filters.rentalMileage && item.mileagePolicy !== filters.rentalMileage) {
          return false;
        }
      }

      // 5. Imóveis
      if (item.itemType === 'imovel') {
        if (filters.propertyTransaction !== 'todos' && item.transactionType !== filters.propertyTransaction) {
          return false;
        }
        if (filters.propertyType && item.propertyType !== filters.propertyType) {
          return false;
        }
        if (filters.minBedrooms > 0 && item.bedrooms < filters.minBedrooms) {
          return false;
        }
      }

      // 6. Veículos
      if (item.itemType === 'veiculo') {
        if (filters.vehicleTransmission && item.transmission !== filters.vehicleTransmission) {
          return false;
        }
        if (filters.vehicleFuel && item.fuel !== filters.vehicleFuel) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (filters.priceSort === 'asc') {
        return (a.price || 0) - (b.price || 0);
      }
      if (filters.priceSort === 'desc') {
        return (b.price || 0) - (a.price || 0);
      }
      return 0;
    });
  }, [currentStoreItems, searchQuery, filters]);

  const generalWaUrl = activeStore.whatsapp ? generateGeneralWhatsAppLink(activeStore) : '#';

  return (
    <div className="space-y-6 pb-16">
      
      {/* 1. Hero da Loja com Busca */}
      <StoreHero
        searchTerm={searchQuery}
        onSearchChange={setSearchQuery}
        totalItemsCount={currentStoreItems.length}
      />

      {/* 2. Filtros Dinâmicos */}
      <StoreFilters
        storeType={activeStore.type}
        filters={filters}
        onFilterChange={setFilters}
        onResetFilters={() => {
          setFilters(initialFilters);
          setSearchQuery('');
        }}
        categories={categories}
      />

      {/* 3. Grid de Anúncios */}
      {filteredItems.length === 0 ? (
        <div className={`border rounded-3xl p-12 text-center shadow-sm ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
        }`}>
          <PackageSearch className="h-12 w-12 mx-auto text-slate-400 mb-3" />
          <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Nenhum anúncio encontrado</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Não encontramos resultados para a sua busca ou filtros selecionados. Tente limpar os filtros ou buscar por outros termos.
          </p>
          <button
            onClick={() => {
              setFilters(initialFilters);
              setSearchQuery('');
            }}
            className={`mt-4 px-4 py-2 rounded-xl text-xs font-medium transition border ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
            }`}
          >
            Limpar Filtros e Ver Todos
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Exibindo <strong className={isDark ? 'text-white' : 'text-slate-900'}>{filteredItems.length}</strong> de {currentStoreItems.length} itens disponíveis
            </div>
            {searchQuery && (
              <span className="text-xs text-slate-400">
                Resultado para: <strong className="text-blue-500">"{searchQuery}"</strong>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                store={activeStore}
                onClickDetails={(it) => setSelectedItemForDetails(it)}
                onOpenProposal={(it) => setSelectedItemForProposal(it)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 4. Rodapé Informativo da Loja com Conversão Direta */}
      <div className={`mt-12 border rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="space-y-1.5 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-500">Atendimento Direto</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs text-emerald-500 font-medium">Online</span>
          </div>
          <h3 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Não encontrou o que procurava em nossa vitrine?
          </h3>
          <p className={`text-xs max-w-xl ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Fale diretamente com nossa equipe via WhatsApp ou envie sua solicitação com as condições que você procura.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {activeStore.whatsapp && (
            <a
              href={generalWaUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl font-semibold text-xs shadow-lg shadow-emerald-600/20 transition active:scale-95"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Chamar no WhatsApp</span>
            </a>
          )}
          {activeStore.email && (
            <a
              href={`mailto:${activeStore.email}?subject=Dúvida sobre locação/produtos/serviços - ${encodeURIComponent(activeStore.name)}`}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-4 py-3 rounded-xl font-medium text-xs border border-slate-700 transition"
            >
              <Mail className="h-4 w-4" />
              <span>{activeStore.email}</span>
            </a>
          )}
        </div>
      </div>

      {/* Floating WhatsApp Button */}
      {activeStore.whatsapp && (
        <a
          href={generalWaUrl}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-5 right-5 z-40 flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-full shadow-2xl hover:scale-105 transition-all duration-300 font-semibold text-xs border border-emerald-400/30 group"
        >
          <MessageCircle className="h-5 w-5 fill-white" />
          <span className="hidden sm:inline">WhatsApp Loja</span>
        </a>
      )}

      {/* Modais */}
      <ItemDetailModal
        item={selectedItemForDetails}
        store={activeStore}
        isOpen={!!selectedItemForDetails}
        onClose={() => setSelectedItemForDetails(null)}
        onOpenProposal={(item) => {
          setSelectedItemForDetails(null);
          setSelectedItemForProposal(item);
        }}
      />

      <EmailProposalModal
        item={selectedItemForProposal}
        store={activeStore}
        isOpen={!!selectedItemForProposal}
        onClose={() => setSelectedItemForProposal(null)}
      />

    </div>
  );
};
