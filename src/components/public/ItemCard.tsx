import React from 'react';
import { 
  MessageCircle, 
  Sparkles, 
  MapPin, 
  Gauge, 
  Calendar, 
  Fuel, 
  Tag, 
  CheckCircle2, 
  Bed, 
  Bath, 
  Car as CarIcon, 
  Maximize2, 
  Layers,
  Clock,
  Send,
  Users,
  Shield
} from 'lucide-react';
import { StoreItem, StoreProfile } from '../../types/store';
import { formatCurrency, formatNumber, generateWhatsAppLink, sanitizeImageUrl, getDefaultImageForItem } from '../../utils/formatters';
import { useStoreContext } from '../../context/StoreContext';

interface ItemCardProps {
  item: StoreItem;
  store: StoreProfile;
  onClickDetails: (item: StoreItem) => void;
  onOpenProposal: (item: StoreItem) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  store,
  onClickDetails,
  onOpenProposal,
}) => {
  const { theme } = useStoreContext();
  const isDark = theme === 'dark';

  const rawImage = item.images && item.images.length > 0 ? item.images[0] : '';
  const mainImage = sanitizeImageUrl(rawImage, item.itemType);
  const fallbackImage = getDefaultImageForItem(item.itemType);

  const waUrl = store.whatsapp ? generateWhatsAppLink(store.whatsapp, item, store) : '#';

  return (
    <div className={`group rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col flex-1 border ${
      isDark 
        ? 'bg-slate-900 border-slate-800 hover:border-slate-700' 
        : 'bg-white border-slate-200 hover:border-blue-400 shadow-slate-100'
    }`}>
      
      {/* Imagem de Capa com Badges */}
      <div 
        onClick={() => onClickDetails(item)}
        className={`relative h-48 sm:h-52 w-full overflow-hidden cursor-pointer ${
          isDark ? 'bg-slate-950' : 'bg-slate-100'
        }`}
      >
        <img
          src={mainImage}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== fallbackImage) {
              target.src = fallbackImage;
            }
          }}
        />
        <div className={`absolute inset-0 ${
          isDark 
            ? 'bg-gradient-to-t from-slate-950/80 via-transparent to-transparent' 
            : 'bg-gradient-to-t from-black/60 via-transparent to-transparent'
        }`} />

        {/* Badges no Topo da Foto */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1">
          <div className="flex flex-wrap gap-1.5">
            {item.featured && (
              <span className="bg-amber-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Destaque
              </span>
            )}
            {item.itemType === 'imovel' && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md uppercase tracking-wider ${
                item.transactionType === 'venda' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
              }`}>
                {item.transactionType === 'venda' ? 'Venda' : 'Aluguel'}
              </span>
            )}
            {item.itemType === 'produto' && item.promotionalPrice && (
              <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md">
                Oferta
              </span>
            )}
          </div>

          {item.images && item.images.length > 1 && (
            <span className="bg-slate-950/80 text-slate-200 text-[10px] font-medium px-2 py-0.5 rounded-md border border-slate-700/60 backdrop-blur-sm">
              +{item.images.length} fotos
            </span>
          )}
        </div>

        {/* Categoria / Localização Sobreposta */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 text-xs text-white truncate drop-shadow">
          {item.itemType === 'imovel' && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-white">
              <MapPin className="h-3 w-3 text-emerald-400 shrink-0" />
              {item.neighborhood}, {item.city}
            </span>
          )}
          {item.itemType === 'veiculo' && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-white">
              <Calendar className="h-3 w-3 text-red-400 shrink-0" />
              {item.yearFab}/{item.yearModel} • {item.brand}
            </span>
          )}
          {item.itemType === 'produto' && (
            <span className="text-[11px] font-medium text-white">
              {item.category} {item.brand ? `• ${item.brand}` : ''}
            </span>
          )}
          {item.itemType === 'servico' && (
            <span className="text-[11px] font-medium text-white">
              {item.category}
            </span>
          )}
        </div>
      </div>

      {/* Conteúdo do Card */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        
        <div>
          {/* Título */}
          <h3 
            onClick={() => onClickDetails(item)}
            className={`text-sm sm:text-base font-semibold transition cursor-pointer line-clamp-2 mb-2 leading-snug ${
              isDark 
                ? 'text-white group-hover:text-blue-400' 
                : 'text-slate-900 group-hover:text-blue-600'
            }`}
          >
            {item.title}
          </h3>

          {/* Especificações Rápidas por Nicho */}
          
          {/* 1. VEÍCULO (VENDA) */}
          {item.itemType === 'veiculo' && (
            <div className={`grid grid-cols-2 gap-1.5 text-xs p-2 rounded-xl border mb-3 ${
              isDark 
                ? 'bg-slate-950/60 border-slate-800/80 text-slate-400' 
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <div className="flex items-center gap-1 truncate">
                <Gauge className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="font-medium">{formatNumber(item.mileage)} km</span>
              </div>
              <div className="flex items-center gap-1 truncate capitalize">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                <span>{item.transmission}</span>
              </div>
              <div className="flex items-center gap-1 truncate capitalize">
                <Fuel className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>{item.fuel}</span>
              </div>
              <div className="flex items-center gap-1 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                <span>{item.color}</span>
              </div>
            </div>
          )}

          {/* 2. IMÓVEL */}
          {item.itemType === 'imovel' && (
            <div className={`flex items-center justify-between text-xs px-2.5 py-2 rounded-xl border mb-3 ${
              isDark 
                ? 'bg-slate-950/60 border-slate-800/80 text-slate-400' 
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <div className="flex items-center gap-1" title="Área total ou útil">
                <Maximize2 className="h-3.5 w-3.5 text-slate-400" />
                <span>{item.areaUtil || item.areaTotal || 0} m²</span>
              </div>
              {item.bedrooms && item.bedrooms > 0 ? (
                <div className="flex items-center gap-1" title="Quartos">
                  <Bed className="h-3.5 w-3.5 text-slate-400" />
                  <span>{item.bedrooms} qts</span>
                </div>
              ) : null}
              {item.bathrooms && item.bathrooms > 0 ? (
                <div className="flex items-center gap-1" title="Banheiros">
                  <Bath className="h-3.5 w-3.5 text-slate-400" />
                  <span>{item.bathrooms} ban</span>
                </div>
              ) : null}
              {item.garageSpots && item.garageSpots > 0 ? (
                <div className="flex items-center gap-1" title="Vagas de Garagem">
                  <CarIcon className="h-3.5 w-3.5 text-slate-400" />
                  <span>{item.garageSpots} vg</span>
                </div>
              ) : null}
              {(!item.bedrooms || item.bedrooms === 0) && (!item.bathrooms || item.bathrooms === 0) && (
                <span className="text-[11px] font-medium text-emerald-500 capitalize">
                  {item.propertyType || 'Terreno / Lote'}
                </span>
              )}
            </div>
          )}

          {/* 3. PRODUTO */}
          {item.itemType === 'produto' && (
            <div className="space-y-1.5 mb-3 text-xs">
              <p className={`line-clamp-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {item.description}
              </p>
              {item.colors && item.colors.length > 0 && (
                <div className={`flex items-center gap-1 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  <span>Cores:</span>
                  <span className={`truncate font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{item.colors.join(', ')}</span>
                </div>
              )}
            </div>
          )}

          {/* 4. SERVIÇO */}
          {item.itemType === 'servico' && (
            <div className="space-y-1.5 mb-3 text-xs">
              {item.estimatedDuration && (
                <div className={`flex items-center gap-1 text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <Clock className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                  <span>Duração: {item.estimatedDuration}</span>
                </div>
              )}
              {item.includedItems && item.includedItems.length > 0 && (
                <div className={`text-[11px] line-clamp-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  ✓ {item.includedItems[0]} e mais
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preço e Botões de Ação */}
        <div className={`pt-3 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-100'}`}>
          
          <div className="flex items-baseline justify-between mb-3">
            <div>
              {item.itemType === 'servico' && item.priceType === 'sob_consulta' ? (
                <span className="text-sm font-bold text-purple-500">Sob Consulta</span>
              ) : item.itemType === 'servico' && item.priceType === 'a_partir_de' ? (
                <div>
                  <span className={`text-[10px] block leading-none ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>A partir de</span>
                  <span className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {formatCurrency(item.price)}
                  </span>
                </div>
              ) : item.itemType === 'produto' && item.promotionalPrice ? (
                <div>
                  <span className="text-[11px] text-slate-400 line-through mr-1.5">
                    {formatCurrency(item.price)}
                  </span>
                  <span className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(item.promotionalPrice)}
                  </span>
                </div>
              ) : (!item.price || item.price === 0) ? (
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  Sob Consulta
                </span>
              ) : (
                <span className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {formatCurrency(item.price)}
                </span>
              )}
            </div>

            {item.itemType === 'veiculo' && item.fipePrice && (
              <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                FIPE: {formatCurrency(item.fipePrice)}
              </span>
            )}

            {item.itemType === 'imovel' && item.condoFee && item.condoFee > 0 && (
              <span className={`text-[10px] font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                Cond: {formatCurrency(item.condoFee)}
              </span>
            )}
          </div>

          {/* Botões de Ação Direta */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onClickDetails(item)}
              className={`py-2 px-2.5 rounded-xl text-xs font-medium transition text-center border ${
                isDark 
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
              }`}
            >
              Ver Detalhes
            </button>

            {store.whatsapp ? (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition active:scale-95 text-center"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>WhatsApp</span>
              </a>
            ) : (
              <button
                onClick={() => onOpenProposal(item)}
                className="flex items-center justify-center space-x-1 py-2 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition active:scale-95"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Proposta</span>
              </button>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
