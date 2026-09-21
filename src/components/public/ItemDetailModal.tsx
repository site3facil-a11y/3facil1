import React, { useState, useRef } from 'react';
import { 
  X, 
  MessageCircle, 
  Mail, 
  Share2, 
  MapPin, 
  Sparkles, 
  CheckCircle2, 
  Calendar, 
  Gauge, 
  Fuel, 
  ShieldCheck, 
  Maximize2, 
  Bed, 
  Bath, 
  Car as CarIcon, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  Tag,
  Check,
  Building,
  FileText,
  Users,
  Shield,
  ShoppingBag,
  Smartphone,
  ZoomIn
} from 'lucide-react';
import { StoreItem, StoreProfile } from '../../types/store';
import { formatCurrency, formatNumber, generateWhatsAppLink } from '../../utils/formatters';
import { useStoreContext } from '../../context/StoreContext';
import { StoryCardGeneratorModal } from '../modals/StoryCardGeneratorModal';

interface ItemDetailModalProps {
  item: StoreItem | null;
  store: StoreProfile;
  isOpen: boolean;
  onClose: () => void;
  onOpenProposal: (item: StoreItem) => void;
  onOpenWhatsAppLead?: (item: StoreItem) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  store,
  isOpen,
  onClose,
  onOpenProposal,
  onOpenWhatsAppLead,
}) => {
  const { theme } = useStoreContext();
  const isDark = theme === 'dark';

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);

  // Swipe touch support for mobile
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  if (!isOpen || !item) return null;

  const getDefaultFallbackImage = () => {
    switch (item.itemType) {
      case 'veiculo':
        return 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=1000&auto=format&fit=crop&q=80';
      case 'produto':
        return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1000&auto=format&fit=crop&q=80';
      case 'servico':
        return 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1000&auto=format&fit=crop&q=80';
      case 'imovel':
      default:
        return 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1000&auto=format&fit=crop&q=80';
    }
  };

  const validImages = (item.images || []).filter((img) => img && img.trim().length > 0);
  const images = validImages.length > 0
    ? validImages
    : [getDefaultFallbackImage()];

  const waUrl = store.whatsapp ? generateWhatsAppLink(store.whatsapp, item, store) : '#';

  const getItemShareUrl = () => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      return `${origin}/${store.slug}?item=${item.id}`;
    }
    return `https://www.3facil.com/${store.slug}?item=${item.id}`;
  };

  const handleShare = async () => {
    const shareUrl = getItemShareUrl();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${item.title} - ${store.name}`,
          text: `Confira este anúncio: ${item.title} por ${formatCurrency(item.price)} no 3fácil!`,
          url: shareUrl,
        });
        return;
      } catch {
        // Usuário cancelou ou navegador não suportou, fallback para copiar
      }
    }

    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleDirectWhatsAppShare = () => {
    const shareUrl = getItemShareUrl();
    const text = `Olha esse anúncio que vi no 3fácil:\n*${item.title}*\n💰 Valor: ${formatCurrency(item.price)}\n📍 ${store.name}\n\nConfira todos os detalhes e fotos em:\n${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const nextImage = () => {
    setActiveImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    if (diff > 50) {
      // Arrastou para a esquerda -> próxima imagem
      nextImage();
    } else if (diff < -50) {
      // Arrastou para a direita -> imagem anterior
      prevImage();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  return (
    <>
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200 ${
      isDark ? 'bg-slate-950/85' : 'bg-slate-900/60'
    }`}>
      
      <div className={`border rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        
        {/* Header do Modal */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50/80'
        }`}>
          <div className="flex items-center space-x-2">
            <span className={`text-xs font-semibold uppercase tracking-wider ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {item.itemType === 'veiculo' && 'Detalhes do Veículo'}
              {item.itemType === 'imovel' && 'Ficha Técnica do Imóvel'}
              {(item.itemType === 'produto' || item.itemType === 'servico') && 'Detalhes do Produto'}
            </span>
            {item.featured && (
              <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Destaque
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Botão Gerar Card para Status do WhatsApp */}
            <button
              onClick={() => setIsStoryModalOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center gap-1.5 transition active:scale-95"
              title="Gerar Card para WhatsApp Status e Instagram Stories"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Gerar Card Status</span>
            </button>

            {/* Botão Enviar no WhatsApp */}
            <button
              onClick={handleDirectWhatsAppShare}
              className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition active:scale-95"
              title="Compartilhar no WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
            </button>

            <button
              onClick={handleShare}
              className={`p-2 rounded-xl transition ${
                isDark 
                  ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700' 
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
              title="Compartilhar Link"
            >
              {copiedLink ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
            </button>

            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition ${
                isDark 
                  ? 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700' 
                  : 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Corpo com Scroll */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          
          {/* Galeria de Fotos com Suporte a Swipe Mobile */}
          <div className="space-y-3">
            <div 
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className={`relative h-64 sm:h-80 md:h-96 w-full rounded-2xl overflow-hidden group select-none ${
                isDark ? 'bg-slate-950' : 'bg-slate-100'
              }`}
            >
              <img
                src={images[activeImageIndex]}
                alt={item.title}
                onClick={() => setIsZoomOpen(true)}
                onError={(e) => {
                  const target = e.currentTarget;
                  const fallback = getDefaultFallbackImage();
                  if (target.src !== fallback) {
                    target.src = fallback;
                  }
                }}
                className="w-full h-full object-cover cursor-zoom-in"
              />

              {/* Botão de Zoom Flutuante */}
              <button
                type="button"
                onClick={() => setIsZoomOpen(true)}
                className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition shadow-md"
                title="Ampliar Foto"
              >
                <Maximize2 className="h-4 w-4" />
              </button>

              {/* Indicador de Swipe no Mobile */}
              {images.length > 1 && (
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-[10px] font-semibold backdrop-blur-xs">
                  {activeImageIndex + 1} / {images.length} • Deslize para ver mais
                </div>
              )}

              {/* Controles de Navegação Desktop */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); prevImage(); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/75 text-white backdrop-blur-xs transition opacity-0 group-hover:opacity-100"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); nextImage(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/75 text-white backdrop-blur-xs transition opacity-0 group-hover:opacity-100"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* Miniaturas */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative h-16 w-20 rounded-xl overflow-hidden shrink-0 border-2 transition ${
                      activeImageIndex === idx
                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cabeçalho do Anúncio & Preço */}
          <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <div>
              <h1 className={`text-xl sm:text-2xl font-bold mb-1 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {item.title}
              </h1>

              {item.itemType === 'imovel' && (
                <p className={`flex items-center gap-1.5 text-sm ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  <MapPin className="h-4 w-4 text-emerald-500" />
                  <span>{item.address ? `${item.address} - ` : ''}{item.neighborhood}, {item.city} - {item.state}</span>
                </p>
              )}

              {item.itemType === 'veiculo' && (
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {item.brand} {item.model} {item.version || ''} • Ano {item.yearFab}/{item.yearModel}
                </p>
              )}
            </div>

            {/* Bloco de Preços */}
            <div className={`p-4 rounded-2xl border text-left md:text-right shrink-0 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              {item.itemType === 'servico' && item.priceType === 'sob_consulta' ? (
                <span className="text-xl font-bold text-purple-500 dark:text-purple-400">Sob Consulta</span>
              ) : item.itemType === 'servico' && item.priceType === 'a_partir_de' ? (
                <div>
                  <span className={`text-xs block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>A partir de</span>
                  <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(item.price)}</span>
                </div>
              ) : item.itemType === 'produto' && item.promotionalPrice ? (
                <div>
                  <span className="text-xs text-slate-400 line-through block">{formatCurrency(item.price)}</span>
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(item.promotionalPrice)}</span>
                </div>
              ) : (
                <div>
                  <span className={`text-xs block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {item.itemType === 'imovel' ? (item.transactionType === 'venda' ? 'Valor de Venda' : 'Aluguel Mensal') : 'Valor'}
                  </span>
                  <span className={`text-2xl sm:text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(item.price)}</span>
                  {item.itemType === 'imovel' && item.condoFee && item.condoFee > 0 && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 block font-medium mt-0.5">
                      Condomínio: {formatCurrency(item.condoFee)}/mês
                    </span>
                  )}
                  {item.itemType === 'imovel' && item.iptu && item.iptu > 0 && (
                    <span className={`text-[11px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      IPTU: {formatCurrency(item.iptu)}/mês
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* FICHA TÉCNICA ESPECÍFICA DE CADA MODELO */}

          {/* 1. VEÍCULOS */}
          {item.itemType === 'veiculo' && (
            <div className="space-y-4">
              <h3 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Especificações Técnicas
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-[10px] block uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Quilometragem</span>
                  <span className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{formatNumber(item.mileage)} km</span>
                </div>
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-[10px] block uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Câmbio</span>
                  <span className={`text-sm font-semibold capitalize ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.transmission}</span>
                </div>
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-[10px] block uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Combustível</span>
                  <span className={`text-sm font-semibold capitalize ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.fuel}</span>
                </div>
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-[10px] block uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Cor</span>
                  <span className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.color}</span>
                </div>
              </div>

              {item.accessories && item.accessories.length > 0 && (
                <div>
                  <h4 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Opcionais & Acessórios
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {item.accessories.map((acc, idx) => (
                      <div key={idx} className={`flex items-center gap-2 text-xs p-2.5 rounded-xl border ${
                        isDark ? 'text-slate-300 bg-slate-950 border-slate-800/80' : 'text-slate-700 bg-slate-50 border-slate-200'
                      }`}>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{acc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. IMÓVEIS */}
          {item.itemType === 'imovel' && (
            <div className="space-y-4">
              <h3 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Características do Imóvel
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-[10px] block uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Área Útil</span>
                  <span className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.areaUtil} m²</span>
                </div>
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-[10px] block uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Quartos</span>
                  <span className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.bedrooms} quartos</span>
                </div>
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-[10px] block uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Banheiros</span>
                  <span className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.bathrooms || 1} banheiros</span>
                </div>
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-[10px] block uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Vagas</span>
                  <span className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.garageSpots} vagas</span>
                </div>
              </div>

              {item.condoFee && item.condoFee > 0 && (
                <div className={`p-3 rounded-xl flex items-center justify-between border ${
                  isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'
                }`}>
                  <span className={`text-xs font-medium ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>Condomínio Mensal:</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(item.condoFee)}</span>
                </div>
              )}

              {item.amenities && item.amenities.length > 0 && (
                <div>
                  <h4 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Lazer & Comodidades
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {item.amenities.map((am, idx) => (
                      <div key={idx} className={`flex items-center gap-2 text-xs p-2.5 rounded-xl border ${
                        isDark ? 'text-slate-300 bg-slate-950 border-slate-800/80' : 'text-slate-700 bg-slate-50 border-slate-200'
                      }`}>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{am}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. SERVIÇOS */}
          {item.itemType === 'servico' && item.includedItems && item.includedItems.length > 0 && (
            <div className="space-y-4">
              <h3 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                O que está incluso neste pacote:
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {item.includedItems.map((inc, idx) => (
                  <div key={idx} className={`flex items-start gap-2.5 text-xs p-3 rounded-xl border ${
                    isDark ? 'text-slate-200 bg-slate-950 border-slate-800/80' : 'text-slate-800 bg-slate-50 border-slate-200'
                  }`}>
                    <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                    <span>{inc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Descrição Geral */}
          <div>
            <h3 className={`text-sm font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Descrição Completa
            </h3>
            <div className={`text-sm leading-relaxed p-4 rounded-2xl border whitespace-pre-line ${
              isDark ? 'text-slate-300 bg-slate-950/60 border-slate-800' : 'text-slate-700 bg-slate-50 border-slate-200'
            }`}>
              {item.description}
            </div>
          </div>

        </div>

        {/* Footer com CTA Direta */}
        <div className={`p-4 sm:p-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
          isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50/90'
        }`}>
          <div className={`text-xs text-center sm:text-left ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span>Atendimento direto com a equipe de </span>
            <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{store.name}</strong>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {store.enableEmailProposal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenProposal(item);
                }}
                className={`flex-1 sm:flex-none flex items-center justify-center space-x-2 py-3 px-5 rounded-xl text-xs font-semibold border transition ${
                  isDark 
                    ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700' 
                    : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-sm'
                }`}
              >
                {(item.itemType === 'produto' || item.itemType === 'servico') ? (
                  <>
                    <ShoppingBag className="h-4 w-4 text-emerald-500" />
                    <span>Comprar</span>
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 text-blue-500" />
                    <span>Enviar Proposta Formal</span>
                  </>
                )}
              </button>
            )}

            {store.enableWhatsApp && store.whatsapp && (
              onOpenWhatsAppLead ? (
                <button
                  type="button"
                  onClick={() => onOpenWhatsAppLead(item)}
                  className="flex-1 sm:flex-none flex items-center justify-center space-x-2 py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md hover:shadow-emerald-600/30 transition active:scale-95"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Chamar no WhatsApp</span>
                </button>
              ) : (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 sm:flex-none flex items-center justify-center space-x-2 py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md hover:shadow-emerald-600/30 transition active:scale-95"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Chamar no WhatsApp</span>
                </a>
              )
            )}
          </div>
        </div>

      </div>

    </div>

    {/* Lightbox / Imagem Ampliada Fullscreen */}
    {isZoomOpen && (
      <div 
        className="fixed inset-0 z-60 bg-black/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-200"
        onClick={() => setIsZoomOpen(false)}
      >
        <button
          type="button"
          onClick={() => setIsZoomOpen(false)}
          className="absolute top-4 right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition backdrop-blur-xs"
          title="Fechar Visualização"
        >
          <X className="h-6 w-6" />
        </button>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition backdrop-blur-xs"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition backdrop-blur-xs"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        <div className="relative max-w-6xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
          <img
            src={images[activeImageIndex]}
            alt={item.title}
            className="max-h-[85vh] max-w-full object-contain rounded-2xl shadow-2xl"
          />
          <div className="mt-3 text-center text-white/80 text-xs font-semibold">
            {activeImageIndex + 1} de {images.length} • {item.title}
          </div>
        </div>
      </div>
    )}

    {/* Gerador de Card para Status do WhatsApp / Stories */}
    <StoryCardGeneratorModal
      isOpen={isStoryModalOpen}
      onClose={() => setIsStoryModalOpen(false)}
      item={item}
      store={store}
    />
    </>
  );
};
