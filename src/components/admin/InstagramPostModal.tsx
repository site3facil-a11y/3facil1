import React, { useState, useRef, useEffect } from 'react';
import { 
  Instagram, 
  X, 
  Download, 
  Copy, 
  Check, 
  Sparkles, 
  Smartphone, 
  Square, 
  ExternalLink, 
  MessageCircle, 
  Palette, 
  Image as ImageIcon,
  Flame,
  CheckCircle2,
  Share2,
  Tag,
  Zap,
  Info
} from 'lucide-react';
import { StoreItem, StoreProfile } from '../../types/store';
import { formatCurrency, formatNumber } from '../../utils/formatters';

interface InstagramPostModalProps {
  item: StoreItem;
  store: StoreProfile;
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
}

type PostFormat = 'feed' | 'stories';
type ThemeStyle = 'dark' | 'light' | 'brand';
type CaptionTone = 'vendedor' | 'premium' | 'urgente';

export const InstagramPostModal: React.FC<InstagramPostModalProps> = ({
  item,
  store,
  isOpen,
  onClose,
  isDark = false
}) => {
  if (!isOpen) return null;

  const [format, setFormat] = useState<PostFormat>('feed');
  const [themeStyle, setThemeStyle] = useState<ThemeStyle>('dark');
  const [captionTone, setCaptionTone] = useState<CaptionTone>('vendedor');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [customBadge, setCustomBadge] = useState('🔥 OPORTUNIDADE');
  const [showPrice, setShowPrice] = useState(true);
  const [showSpecs, setShowSpecs] = useState(true);
  const [showContact, setShowContact] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [captionText, setCaptionText] = useState('');

  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const images = (item.images && item.images.length > 0)
    ? item.images
    : ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80'];

  const currentImage = images[selectedImageIndex] || images[0];

  // Gera especificações resumidas para o banner
  const getSpecsList = (): string[] => {
    const specs: string[] = [];
    if (item.itemType === 'veiculo') {
      if (item.yearFab && item.yearModel) specs.push(`${item.yearFab}/${item.yearModel}`);
      if (item.mileage !== undefined) specs.push(`${formatNumber(item.mileage)} km`);
      if (item.transmission) specs.push(item.transmission.toUpperCase());
      if (item.fuel) specs.push(item.fuel.toUpperCase());
    } else if (item.itemType === 'imovel') {
      if (item.areaUtil) specs.push(`${item.areaUtil} m²`);
      if (item.bedrooms) specs.push(`${item.bedrooms} quartos`);
      if (item.garageSpots) specs.push(`${item.garageSpots} vagas`);
      if (item.neighborhood) specs.push(item.neighborhood);
    } else if (item.itemType === 'produto') {
      if (item.condition) specs.push(`Condição: ${item.condition}`);
      if (item.brand) specs.push(item.brand);
      if (item.inStock) specs.push('Pronta Entrega');
    } else if (item.itemType === 'servico') {
      if (item.estimatedDuration) specs.push(`Tempo: ${item.estimatedDuration}`);
      if (item.category) specs.push(item.category);
    }
    return specs.slice(0, 4);
  };

  // Gerador de Legenda Inteligente baseada no Tom e Produto
  const generateCaption = (tone: CaptionTone): string => {
    const storeLink = `${window.location.origin}/loja/${store.slug}`;
    const priceFormatted = item.itemType === 'servico' && item.priceType === 'sob_consulta'
      ? 'Valor Sob Consulta'
      : formatCurrency(item.price);

    let intro = '';
    let callToAction = '';
    const hashtags = [
      `#${store.name.replace(/\s+/g, '')}`,
      '#3facil',
      '#novidade',
      `#${store.city.replace(/\s+/g, '')}`
    ];

    if (item.itemType === 'veiculo') {
      hashtags.push('#carros', '#seminovos', '#veiculos', `#${item.brand.replace(/\s+/g, '')}`, `#${item.model.replace(/\s+/g, '')}`);
      if (tone === 'vendedor') {
        intro = `🚗 Procurando o carro dos seus sonhos? Chegou esta incrível oportunidade na ${store.name}!\n\n✨ ${item.title}\n💰 Por apenas ${priceFormatted}`;
        callToAction = `📲 Financiamento facilitado e aceitamos seu usado na troca com a melhor avaliação! Fale conosco agora pelo WhatsApp: (${store.whatsapp.slice(0, 2)}) ${store.whatsapp.slice(2)}`;
      } else if (tone === 'premium') {
        intro = `💎 Conforto, procedência e alto padrão em cada detalhe.\n\nApresentamos o ${item.title}.\n💵 Investimento: ${priceFormatted}`;
        callToAction = `📍 Venha fazer um test drive exclusivo e tomar um café conosco. Atendimento personalizado no WhatsApp: (${store.whatsapp.slice(0, 2)}) ${store.whatsapp.slice(2)}`;
      } else {
        intro = `⚡ ATENÇÃO: Preço de oportunidade por tempo limitado!\n\n🔥 ${item.title}\n💥 APENAS ${priceFormatted}`;
        callToAction = `🏃‍♂️ Condição especial válida enquanto durar o estoque. Garanta agora chamando no WhatsApp: (${store.whatsapp.slice(0, 2)}) ${store.whatsapp.slice(2)}`;
      }
    } else if (item.itemType === 'imovel') {
      hashtags.push('#imoveis', '#imobiliaria', '#apartamento', '#casa', `#${item.neighborhood.replace(/\s+/g, '')}`);
      if (tone === 'vendedor') {
        intro = `🏡 Seu novo lar está te esperando!\n\n✨ ${item.title}\n📍 ${item.neighborhood}, ${store.city}\n💰 ${priceFormatted}`;
        callToAction = `📲 Agende uma visita com nossos corretores pelo WhatsApp: (${store.whatsapp.slice(0, 2)}) ${store.whatsapp.slice(2)}`;
      } else if (tone === 'premium') {
        intro = `✨ Viva com sofisticação, conforto e segurança.\n\n${item.title}\n🔑 Valor: ${priceFormatted}`;
        callToAction = `📅 Consultoria imobiliária dedicada. Fale com nosso especialista: (${store.whatsapp.slice(0, 2)}) ${store.whatsapp.slice(2)}`;
      } else {
        intro = `🚨 OPORTUNIDADE ÚNICA NO ${item.neighborhood.toUpperCase()}!\n\n${item.title}\n💵 Apenas: ${priceFormatted}`;
        callToAction = `⏳ Imóvel com grande procura! Envie mensagem agora para garantir a visita: (${store.whatsapp.slice(0, 2)}) ${store.whatsapp.slice(2)}`;
      }
    } else {
      hashtags.push('#lojaonline', '#oferta', '#promocao', '#compras');
      intro = `🛍️ Destaque na ${store.name}!\n\n${item.title}\n💰 Apenas ${priceFormatted}`;
      callToAction = `📲 Peça agora mesmo pelo WhatsApp ou acesse nossa vitrine completa: ${storeLink}`;
    }

    const specsText = getSpecsList().length > 0
      ? `\n\n📌 Principais Detalhes:\n${getSpecsList().map(s => `• ${s}`).join('\n')}`
      : '';

    const descriptionText = item.description ? `\n\n📝 ${item.description.slice(0, 200)}...` : '';

    return `${intro}${specsText}${descriptionText}\n\n${callToAction}\n\n🔗 Vitrine Completa: ${storeLink}\n\n${hashtags.join(' ')}`;
  };

  useEffect(() => {
    setCaptionText(generateCaption(captionTone));
  }, [captionTone, item, store]);

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(captionText);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 3000);
  };

  // Renderiza no Canvas em Alta Resolução (1080x1080 ou 1080x1920) e baixa o PNG
  const handleDownloadImage = async () => {
    setIsGenerating(true);
    try {
      const canvas = hiddenCanvasRef.current;
      if (!canvas) throw new Error('Canvas indisponível');

      const width = 1080;
      const height = format === 'feed' ? 1080 : 1920;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Contexto 2D indisponível');

      // 1. Fundo
      if (themeStyle === 'dark') {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#0f172a');
        bgGrad.addColorStop(1, '#020617');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
      } else if (themeStyle === 'light') {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#ffffff');
        bgGrad.addColorStop(1, '#f1f5f9');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
      } else {
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, store.themeColor || '#2563eb');
        bgGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Carrega a Imagem do Produto
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      const imageLoaded = await new Promise<boolean>((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = currentImage;
      });

      // Área onde a imagem do produto é desenhada
      const imgPadding = 60;
      const imgTop = format === 'feed' ? 170 : 340;
      const imgWidth = width - imgPadding * 2;
      const imgHeight = format === 'feed' ? 560 : 860;
      const cornerRadius = 36;

      // Desenha card arredondado para a imagem
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(imgPadding, imgTop, imgWidth, imgHeight, cornerRadius);
      ctx.clip();

      if (imageLoaded) {
        // Render com aspect-ratio cover
        const scale = Math.max(imgWidth / img.width, imgHeight / img.height);
        const nw = img.width * scale;
        const nh = img.height * scale;
        const nx = imgPadding + (imgWidth - nw) / 2;
        const ny = imgTop + (imgHeight - nh) / 2;
        ctx.drawImage(img, nx, ny, nw, nh);
      } else {
        ctx.fillStyle = '#334155';
        ctx.fillRect(imgPadding, imgTop, imgWidth, imgHeight);
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.title, width / 2, imgTop + imgHeight / 2);
      }
      ctx.restore();

      // Borda sutil na imagem
      ctx.strokeStyle = themeStyle === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(imgPadding, imgTop, imgWidth, imgHeight, cornerRadius);
      ctx.stroke();

      // 3. Header da Loja (Topo)
      const headerY = format === 'feed' ? 100 : 200;
      ctx.fillStyle = themeStyle === 'light' ? '#0f172a' : '#ffffff';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(store.name, imgPadding, headerY);

      ctx.fillStyle = themeStyle === 'light' ? '#64748b' : '#94a3b8';
      ctx.font = '500 26px sans-serif';
      ctx.fillText(store.city ? `${store.city} - ${store.state || 'BR'}` : '3facil.com', imgPadding, headerY + 40);

      // Badge no topo direito
      if (customBadge) {
        const badgeText = customBadge;
        ctx.font = 'bold 24px sans-serif';
        const badgeWidth = ctx.measureText(badgeText).width + 40;
        const badgeHeight = 48;
        const badgeX = width - imgPadding - badgeWidth;
        const badgeY = headerY - 34;

        ctx.fillStyle = store.themeColor || '#2563eb';
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 24);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + 33);
      }

      // 4. Detalhes Inferiores (Título, Preço e Especificações)
      const bottomStartY = format === 'feed' ? 760 : 1240;
      
      // Título do Produto
      ctx.fillStyle = themeStyle === 'light' ? '#0f172a' : '#ffffff';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'left';
      
      // Trunca título se for longo
      let displayTitle = item.title;
      if (ctx.measureText(displayTitle).width > width - imgPadding * 2) {
        while (ctx.measureText(displayTitle + '...').width > width - imgPadding * 2 && displayTitle.length > 0) {
          displayTitle = displayTitle.slice(0, -1);
        }
        displayTitle += '...';
      }
      ctx.fillText(displayTitle, imgPadding, bottomStartY);

      // Preço em destaque
      let nextY = bottomStartY + 65;
      if (showPrice) {
        const priceVal = item.itemType === 'servico' && item.priceType === 'sob_consulta'
          ? 'Sob Consulta'
          : formatCurrency(item.price);
        
        ctx.fillStyle = '#10b981'; // Verde de sucesso
        ctx.font = '900 52px sans-serif';
        ctx.fillText(priceVal, imgPadding, nextY);
        nextY += 60;
      }

      // Badges de especificações
      if (showSpecs) {
        const specs = getSpecsList();
        if (specs.length > 0) {
          let specX = imgPadding;
          const specY = nextY;
          ctx.font = 'bold 22px sans-serif';

          specs.forEach((spec) => {
            const textWidth = ctx.measureText(spec).width;
            const pillW = textWidth + 30;
            const pillH = 42;

            if (specX + pillW > width - imgPadding) return;

            ctx.fillStyle = themeStyle === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)';
            ctx.beginPath();
            ctx.roundRect(specX, specY - 30, pillW, pillH, 12);
            ctx.fill();

            ctx.fillStyle = themeStyle === 'light' ? '#334155' : '#cbd5e1';
            ctx.textAlign = 'left';
            ctx.fillText(spec, specX + 15, specY);

            specX += pillW + 14;
          });
        }
      }

      // 5. Rodapé com Contato
      if (showContact) {
        const footerY = format === 'feed' ? 1010 : 1820;
        
        // Linha divisória sutil
        ctx.strokeStyle = themeStyle === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(imgPadding, footerY - 50);
        ctx.lineTo(width - imgPadding, footerY - 50);
        ctx.stroke();

        ctx.fillStyle = themeStyle === 'light' ? '#0f172a' : '#ffffff';
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`WhatsApp: (${store.whatsapp.slice(0, 2)}) ${store.whatsapp.slice(2)}`, imgPadding, footerY);

        ctx.fillStyle = store.themeColor || '#2563eb';
        ctx.textAlign = 'right';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('3facil.com', width - imgPadding, footerY);
      }

      // Transforma em download
      const dataUrl = canvas.toDataURL('image/png');
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = dataUrl;
      downloadAnchor.download = `instagram-${format}-${item.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
      downloadAnchor.click();

    } catch (err: any) {
      alert('Erro ao gerar a imagem: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenInstagram = () => {
    // Copia a legenda para facilitar
    handleCopyCaption();
    window.open('https://www.instagram.com/', '_blank');
  };

  const handleShareWhatsApp = () => {
    const waText = encodeURIComponent(captionText);
    window.open(`https://api.whatsapp.com/send?text=${waText}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm overflow-y-auto">
      {/* Canvas invisível para renderização em alta resolução */}
      <canvas ref={hiddenCanvasRef} className="hidden" />

      <div className={`w-full max-w-5xl rounded-3xl border shadow-2xl overflow-hidden my-auto transition ${
        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* Topo do Modal */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between gap-3 ${
          isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-100 bg-slate-50'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
              <Instagram className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                Criador de Posts & Stories para Instagram
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  Etapa 1
                </span>
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Gere banners em alta definição prontos para Feed ou Stories e copie a legenda comercial com 1 clique.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo do Modal em 2 Colunas */}
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[82vh] overflow-y-auto">
          
          {/* COLUNA 1: PREVIEW VISUAL & CONTROLES DO BANNER (7 colunas) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Controles de Formato e Estilo */}
            <div className={`p-4 rounded-2xl border space-y-3 ${
              isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Formato do Banner:
                </span>

                <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs">
                  <button
                    onClick={() => setFormat('feed')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
                      format === 'feed'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Square className="h-3.5 w-3.5" />
                    <span>Feed (1:1)</span>
                  </button>

                  <button
                    onClick={() => setFormat('stories')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
                      format === 'stories'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>Stories / Status (9:16)</span>
                  </button>
                </div>
              </div>

              {/* Seletor de Tema Visual */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Tema da Arte:</span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setThemeStyle('dark')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                      themeStyle === 'dark'
                        ? 'bg-slate-900 text-white border-slate-600 shadow-sm'
                        : isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-600 border-slate-300'
                    }`}
                  >
                    Dark Luxury
                  </button>
                  <button
                    onClick={() => setThemeStyle('light')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                      themeStyle === 'light'
                        ? 'bg-white text-slate-900 border-slate-400 shadow-sm'
                        : isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-600 border-slate-300'
                    }`}
                  >
                    Clean White
                  </button>
                  <button
                    onClick={() => setThemeStyle('brand')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border text-white transition ${
                      themeStyle === 'brand' ? 'ring-2 ring-white/50 border-transparent shadow-sm' : 'opacity-80'
                    }`}
                    style={{ backgroundColor: store.themeColor || '#2563eb' }}
                  >
                    Cor da Loja
                  </button>
                </div>
              </div>

              {/* Badge Personalizado */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Selo / Destaque:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['🔥 OPORTUNIDADE', '⭐ NOVIDADE', '🏷️ OFERTA', '💎 EXCLUSIVO'].map((b) => (
                    <button
                      key={b}
                      onClick={() => setCustomBadge(b)}
                      className={`text-[11px] px-2 py-0.5 rounded-md font-semibold transition ${
                        customBadge === b
                          ? 'bg-rose-500 text-white'
                          : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Alternar Fotos caso tenha mais de uma */}
              {images.length > 1 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto pb-1">
                  <span className={`text-xs font-semibold whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Foto:</span>
                  {images.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border-2 transition ${
                        selectedImageIndex === idx ? 'border-rose-500 scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PREVIEW DO CARD EM TEMPO REAL */}
            <div className="flex justify-center p-3 rounded-2xl bg-slate-900/30 dark:bg-black/40 border border-slate-800">
              <div 
                className={`relative rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 flex flex-col justify-between ${
                  format === 'feed' ? 'w-[360px] h-[360px] p-4' : 'w-[280px] h-[497px] p-4'
                }`}
                style={{
                  background: themeStyle === 'dark'
                    ? 'linear-gradient(180deg, #0f172a 0%, #020617 100%)'
                    : themeStyle === 'light'
                    ? 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)'
                    : `linear-gradient(135deg, ${store.themeColor || '#2563eb'} 0%, #0f172a 100%)`,
                  color: themeStyle === 'light' ? '#0f172a' : '#ffffff'
                }}
              >
                {/* Topo do Banner Preview */}
                <div className="flex items-center justify-between z-10">
                  <div className="min-w-0 pr-2">
                    <h4 className="font-extrabold text-sm truncate leading-tight">{store.name}</h4>
                    <p className={`text-[10px] truncate ${themeStyle === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                      {store.city} - {store.state}
                    </p>
                  </div>
                  {customBadge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0 shadow-sm" style={{ backgroundColor: store.themeColor || '#2563eb' }}>
                      {customBadge}
                    </span>
                  )}
                </div>

                {/* Imagem do Produto no Preview */}
                <div className={`relative my-2 rounded-xl overflow-hidden border ${
                  themeStyle === 'light' ? 'border-slate-200' : 'border-white/10'
                } ${format === 'feed' ? 'h-[185px]' : 'h-[270px]'}`}>
                  <img
                    src={currentImage}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Dados Inferiores */}
                <div className="z-10 space-y-1">
                  <div className="font-bold text-xs truncate leading-tight">{item.title}</div>
                  
                  {showPrice && (
                    <div className="text-emerald-500 font-extrabold text-sm">
                      {item.itemType === 'servico' && item.priceType === 'sob_consulta'
                        ? 'Sob Consulta'
                        : formatCurrency(item.price)}
                    </div>
                  )}

                  {showSpecs && getSpecsList().length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {getSpecsList().slice(0, 3).map((spec, i) => (
                        <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          themeStyle === 'light' ? 'bg-slate-200 text-slate-700' : 'bg-white/10 text-slate-300'
                        }`}>
                          {spec}
                        </span>
                      ))}
                    </div>
                  )}

                  {showContact && (
                    <div className={`pt-1 border-t flex items-center justify-between text-[9px] font-semibold ${
                      themeStyle === 'light' ? 'border-slate-200 text-slate-600' : 'border-white/10 text-slate-400'
                    }`}>
                      <span>WhatsApp: ({store.whatsapp.slice(0, 2)}) {store.whatsapp.slice(2)}</span>
                      <span className="text-blue-400">3facil.com</span>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Botão de Download Principal do Banner */}
            <button
              onClick={handleDownloadImage}
              disabled={isGenerating}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-rose-600/25 flex items-center justify-center space-x-2 transition active:scale-[0.99] disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>{isGenerating ? 'Renderizando Imagem em Alta Resolução...' : `Baixar Imagem em Alta Resolução (PNG 1080p)`}</span>
            </button>

          </div>

          {/* COLUNA 2: GERADOR DE LEGENDA COMERCIAL & PUBLICAÇÃO (5 colunas) */}
          <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Tom da Legenda:
                </span>

                <div className="flex items-center space-x-1 text-xs">
                  <button
                    onClick={() => setCaptionTone('vendedor')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                      captionTone === 'vendedor'
                        ? 'bg-rose-500 text-white'
                        : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Vendedor
                  </button>
                  <button
                    onClick={() => setCaptionTone('premium')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                      captionTone === 'premium'
                        ? 'bg-rose-500 text-white'
                        : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Premium
                  </button>
                  <button
                    onClick={() => setCaptionTone('urgente')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                      captionTone === 'urgente'
                        ? 'bg-rose-500 text-white'
                        : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Urgente
                  </button>
                </div>
              </div>

              {/* Caixa de Texto da Legenda */}
              <div className="relative">
                <textarea
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  rows={11}
                  className={`w-full p-3.5 rounded-2xl border text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-500 font-sans resize-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                  placeholder="Sua legenda comercial estruturada aparecerá aqui..."
                />

                <button
                  onClick={handleCopyCaption}
                  className={`absolute top-2.5 right-2.5 flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                    copiedCaption
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-500 hover:bg-rose-600 text-white'
                  }`}
                >
                  {copiedCaption ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copiar Legenda</span>
                    </>
                  )}
                </button>
              </div>

              {/* Ações Rápidas de Compartilhamento */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleOpenInstagram}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200 shadow-sm'
                  }`}
                >
                  <Instagram className="h-4 w-4 text-rose-500" />
                  <span>Abrir Instagram</span>
                  <ExternalLink className="h-3 w-3 opacity-60 ml-0.5" />
                </button>

                <button
                  onClick={handleShareWhatsApp}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition shadow-sm"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Mandar no WhatsApp</span>
                </button>
              </div>
            </div>

            {/* CARD INFORMATIVO ETAPA 2 (META ADS / GRAPH API) */}
            <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
              isDark ? 'bg-gradient-to-br from-purple-950/40 to-slate-900 border-purple-900/40' : 'bg-gradient-to-br from-purple-50 to-pink-50/40 border-purple-200'
            }`}>
              <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400 font-bold">
                <Zap className="h-4 w-4" />
                <span>Etapa 2: Publicação Automática via Meta API</span>
              </div>
              <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                Quando desejar conectar diretamente com sua conta comercial do Facebook e Instagram, o 3facil poderá publicar estes posts e stories de forma 100% automática sem sair do painel!
              </p>
              <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Base pronta para conexão com a Meta Graph API</span>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
