import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  Mail, 
  MapPin, 
  Instagram, 
  ShieldCheck, 
  Sparkles, 
  Search, 
  MessageCircle,
  Building2,
  Car,
  ShoppingBag,
  Briefcase
} from 'lucide-react';
import { useStoreContext } from '../../context/StoreContext';
import { sanitizeImageUrl } from '../../utils/formatters';

interface StoreHeroProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  totalItemsCount: number;
}

const getDefaultBanner = (type?: string): string => {
  switch (type) {
    case 'veiculo':
      return '/uploads/demo/photo-1503376780353-7e6692767b70.jpg';
    case 'produto':
      return '/uploads/demo/photo-1550745165-9bc0b252726f.jpg';
    case 'servico':
      return '/uploads/demo/photo-1618221195710-dd6b41faaea6.jpg';
    case 'imovel':
    default:
      return '/uploads/demo/photo-1600585154340-be6161a56a0c.jpg';
  }
};

const getDefaultLogo = (type?: string): string => {
  switch (type) {
    case 'veiculo':
      return '/uploads/demo/photo-1549399542-7e3f8b79c341.jpg';
    case 'produto':
      return '/uploads/demo/photo-1526738549149-8e07eca6c147.jpg';
    case 'servico':
      return '/uploads/demo/photo-1507003211169-0a1dd7228f2d.jpg';
    case 'imovel':
    default:
      return '/uploads/demo/photo-1560518883-ce09059eeffa.jpg';
  }
};

export const StoreHero: React.FC<StoreHeroProps> = ({
  searchTerm,
  onSearchChange,
  totalItemsCount,
}) => {
  const { activeStore, theme } = useStoreContext();
  const isDark = theme === 'dark';

  const defaultBanner = getDefaultBanner(activeStore.type);
  const defaultLogo = getDefaultLogo(activeStore.type);

  const [currentLogoSrc, setCurrentLogoSrc] = useState<string>(() => {
    return activeStore.logoUrl ? sanitizeImageUrl(activeStore.logoUrl, activeStore.type) : defaultLogo;
  });
  const [currentBannerSrc, setCurrentBannerSrc] = useState<string>(() => {
    return activeStore.bannerUrl ? sanitizeImageUrl(activeStore.bannerUrl, activeStore.type) : defaultBanner;
  });
  const [logoAllFailed, setLogoAllFailed] = useState(false);

  useEffect(() => {
    const rawLogo = activeStore.logoUrl ? sanitizeImageUrl(activeStore.logoUrl, activeStore.type) : defaultLogo;
    const rawBanner = activeStore.bannerUrl ? sanitizeImageUrl(activeStore.bannerUrl, activeStore.type) : defaultBanner;
    setCurrentLogoSrc(rawLogo || defaultLogo);
    setCurrentBannerSrc(rawBanner || defaultBanner);
    setLogoAllFailed(false);
  }, [activeStore.id, activeStore.logoUrl, activeStore.bannerUrl, activeStore.type, defaultLogo, defaultBanner]);

  const cleanPhone = activeStore.whatsapp ? activeStore.whatsapp.replace(/\D/g, '') : '';
  const waUrl = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(`Olá, estou no catálogo da ${activeStore.name} e gostaria de atendimento.`)}` : '#';

  const storeThemeColor = activeStore.themeColor || '#1e6b3a';

  return (
    <div className={`relative rounded-3xl overflow-hidden mb-8 shadow-sm transition-colors border ${
      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-slate-100'
    }`}>
      
      {/* Background Banner com Gradiente Suave */}
      <div className="relative h-48 sm:h-64 w-full overflow-hidden bg-slate-900">
        <img
          src={currentBannerSrc}
          alt={activeStore.name}
          className={`w-full h-full object-cover scale-105 transition-transform duration-700 ${
            isDark ? 'brightness-[0.55]' : 'brightness-[0.90]'
          }`}
          referrerPolicy="no-referrer"
          onError={() => {
            if (currentBannerSrc !== defaultBanner) {
              setCurrentBannerSrc(defaultBanner);
            }
          }}
        />
        <div className={`absolute inset-0 ${
          isDark 
            ? 'bg-gradient-to-t from-slate-900 via-slate-950/60 to-transparent' 
            : 'bg-gradient-to-t from-white via-white/30 to-transparent'
        }`} />
      </div>

      {/* Conteúdo Principal do Topo da Loja */}
      <div className="relative px-6 sm:px-8 pb-6 -mt-16 sm:-mt-20">
        <div className={`flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pb-6 border-b ${
          isDark ? 'border-slate-800/80' : 'border-slate-200'
        }`}>
          
          {/* Logo e Informações da Marca */}
          <div className="flex items-end space-x-4">
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 p-1 shadow-md overflow-hidden shrink-0 ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-white shadow-lg'
            }`}>
              {!logoAllFailed && currentLogoSrc ? (
                <img
                  src={currentLogoSrc}
                  alt={activeStore.name}
                  className="w-full h-full object-cover rounded-xl"
                  referrerPolicy="no-referrer"
                  onError={() => {
                    if (currentLogoSrc !== defaultLogo) {
                      setCurrentLogoSrc(defaultLogo);
                    } else {
                      setLogoAllFailed(true);
                    }
                  }}
                />
              ) : (
                <div 
                  className="w-full h-full flex flex-col items-center justify-center font-bold text-lg sm:text-xl rounded-xl text-white shadow-inner"
                  style={{ backgroundColor: storeThemeColor }}
                >
                  <span>{activeStore.name.slice(0, 2).toUpperCase()}</span>
                  <span className="text-[9px] font-normal opacity-80 uppercase tracking-wider">3Fácil</span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  {activeStore.name}
                </h1>
                <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                  <ShieldCheck className="h-3 w-3" />
                  Verificado
                </span>
              </div>
              <p className={`text-sm font-medium line-clamp-1 ${
                isDark ? 'text-slate-300' : 'text-slate-600'
              }`}>
                {activeStore.slogan}
              </p>
              <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pt-1 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                {activeStore.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-blue-500" />
                    {activeStore.neighborhood ? `${activeStore.neighborhood}, ` : ''}{activeStore.city} - {activeStore.state}
                  </span>
                )}
                {activeStore.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-emerald-500" />
                    {activeStore.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Botões de Ação do Topo */}
          <div className="flex items-center space-x-2.5 w-full sm:w-auto pt-2 sm:pt-0">
            {activeStore.whatsapp && (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-semibold text-xs shadow-md shadow-emerald-600/20 transition active:scale-95"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Atendimento WhatsApp</span>
              </a>
            )}

            {activeStore.instagram && (
              <a
                href={`https://instagram.com/${activeStore.instagram.replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                className={`p-2.5 rounded-xl border transition ${
                  isDark 
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-pink-400 border-slate-700' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-pink-600 border-slate-200'
                }`}
                title="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>

        {/* Barra de Busca Rápida no Catálogo */}
        <div className="pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-lg">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 ${
              isDark ? 'text-slate-400' : 'text-slate-400'
            }`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={`Buscar em ${totalItemsCount} anúncios de ${activeStore.name}...`}
              className={`w-full text-sm pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:border-blue-500 transition ${
                isDark 
                  ? 'bg-slate-950/80 text-slate-200 border-slate-800 placeholder:text-slate-500' 
                  : 'bg-slate-50 text-slate-900 border-slate-200 placeholder:text-slate-400 focus:bg-white'
              }`}
            />
          </div>

          <div className={`text-xs flex items-center gap-2 ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalItemsCount}</span> itens disponíveis no momento
          </div>
        </div>

      </div>

    </div>
  );
};
