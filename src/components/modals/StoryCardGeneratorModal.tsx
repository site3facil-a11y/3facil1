import React, { useRef, useEffect, useState } from 'react';
import { X, Download, Share2, Sparkles, Image, Check, Smartphone } from 'lucide-react';
import { StoreItem, StoreProfile } from '../../types/store';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { useStoreContext } from '../../context/StoreContext';

interface StoryCardGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: StoreItem | null;
  store: StoreProfile | null;
}

export const StoryCardGeneratorModal: React.FC<StoryCardGeneratorModalProps> = ({
  isOpen,
  onClose,
  item,
  store,
}) => {
  const { theme } = useStoreContext();
  const isDark = theme === 'dark';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [generating, setGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !item || !store) return;
    renderCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, item?.id, store?.id]);

  const renderCanvas = () => {
    if (!item || !store) return;
    setGenerating(true);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dimensões padrão para Stories / WhatsApp Status (9:16)
    canvas.width = 1080;
    canvas.height = 1920;

    // 1. Fundo Gradiente Elegante
    const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1920);
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(0.5, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Efeito de luz sutil no topo
    const glow = ctx.createRadialGradient(540, 300, 50, 540, 300, 600);
    glow.addColorStop(0, 'rgba(37, 99, 235, 0.25)');
    glow.addColorStop(1, 'rgba(37, 99, 235, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1080, 800);

    // 2. Cabeçalho da Loja
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(store.name.toUpperCase(), 540, 130);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '30px sans-serif';
    ctx.fillText(store.slogan || 'Vitrine Digital Oficial', 540, 180);

    // 3. Imagem Principal do Anúncio
    const mainImgSrc = item.images && item.images[0] ? item.images[0] : '/uploads/demo/photo-1560518883-ce09059eeffa.jpg';
    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    const drawContent = () => {
      // Moldura arredondada para a foto
      const imgX = 80;
      const imgY = 240;
      const imgW = 920;
      const imgH = 920;
      const radius = 40;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(imgX + radius, imgY);
      ctx.lineTo(imgX + imgW - radius, imgY);
      ctx.quadraticCurveTo(imgX + imgW, imgY, imgX + imgW, imgY + radius);
      ctx.lineTo(imgX + imgW, imgY + imgH - radius);
      ctx.quadraticCurveTo(imgX + imgW, imgY + imgH, imgX + imgW - radius, imgY + imgH);
      ctx.lineTo(imgX + radius, imgY + imgH);
      ctx.quadraticCurveTo(imgX, imgY + imgH, imgX, imgY + imgH - radius);
      ctx.lineTo(imgX, imgY + radius);
      ctx.quadraticCurveTo(imgX, imgY, imgX + radius, imgY);
      ctx.closePath();
      ctx.clip();

      try {
        ctx.drawImage(img, imgX, imgY, imgW, imgH);
      } catch {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(imgX, imgY, imgW, imgH);
      }
      ctx.restore();

      // Borda sutil na imagem
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 4;
      ctx.strokeRect(imgX, imgY, imgW, imgH);

      // 4. Tag de Tipo / Transação
      let tagText = 'DISPONÍVEL';
      if (item.itemType === 'veiculo') tagText = 'VEÍCULO';
      else if (item.itemType === 'imovel') tagText = item.transactionType === 'venda' ? 'IMÓVEL À VENDA' : 'IMÓVEL PARA LOCAÇÃO';
      else if (item.itemType === 'produto') tagText = 'PRODUTO ORIGINAL';
      else if (item.itemType === 'servico') tagText = 'SERVIÇO ESPECIALIZADO';

      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.roundRect(imgX + 30, imgY + 30, 320, 60, [16]);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tagText, imgX + 190, imgY + 70);

      // 5. Título do Item
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 54px sans-serif';
      ctx.textAlign = 'left';
      
      // Quebra de texto de até 2 linhas para o título
      const titleWords = item.title.split(' ');
      let line1 = '';
      let line2 = '';
      for (const word of titleWords) {
        if ((line1 + ' ' + word).length < 28) {
          line1 = line1 ? `${line1} ${word}` : word;
        } else {
          line2 = line2 ? `${line2} ${word}` : word;
        }
      }

      ctx.fillText(line1, 80, 1240);
      if (line2) {
        ctx.fillText(line2, 80, 1310);
      }

      // 6. Detalhes / Especificações
      let specText = '';
      if (item.itemType === 'veiculo') {
        specText = `Ano ${item.yearFab}/${item.yearModel} • ${formatNumber(item.mileage)} km • ${item.fuel || 'Flex'}`;
      } else if (item.itemType === 'imovel') {
        specText = `${item.neighborhood ? `${item.neighborhood}, ` : ''}${item.city} • ${item.areaUtil}m² • ${item.bedrooms} qtos`;
      } else if (item.itemType === 'produto') {
        specText = item.category ? `Categoria: ${item.category}` : 'Pronta Entrega';
      } else {
        const itemLocation = 'city' in item && item.city ? item.city : store.city;
        specText = itemLocation ? `Atendimento em ${itemLocation}` : 'Atendimento Especializado';
      }

      ctx.fillStyle = '#94a3b8';
      ctx.font = '34px sans-serif';
      ctx.fillText(specText, 80, 1380);

      // 7. Bloco de Preço em Destaque
      const priceGrad = ctx.createLinearGradient(80, 1440, 1000, 1560);
      priceGrad.addColorStop(0, '#059669');
      priceGrad.addColorStop(1, '#10b981');
      ctx.fillStyle = priceGrad;
      ctx.beginPath();
      ctx.roundRect(80, 1440, 920, 140, [28]);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(formatCurrency(item.price), 540, 1535);

      // 8. Call To Action (WhatsApp e Link)
      const waNumber = store.whatsapp ? store.whatsapp.replace(/\D/g, '') : '';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText('SOLICITE MAIS FOTOS E PROPOSTA:', 540, 1660);

      if (waNumber) {
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 46px sans-serif';
        ctx.fillText(`WhatsApp: (${waNumber.slice(0, 2)}) ${waNumber.slice(2)}`, 540, 1725);
      }

      // Rodapé Oficial
      ctx.fillStyle = '#64748b';
      ctx.font = '28px monospace';
      ctx.fillText(`3facil.com/${store.slug}`, 540, 1830);

      setGenerating(false);
      try {
        setDownloadUrl(canvas.toDataURL('image/png'));
      } catch {
        // Fallback
      }
    };

    img.onload = drawContent;
    img.onerror = () => {
      // Se falhar o carregamento remoto, desenha com fallback
      drawContent();
    };
    img.src = mainImgSrc;
  };

  if (!isOpen || !item || !store) return null;

  const handleDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `story-${item.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200 ${
      isDark ? 'bg-slate-950/80' : 'bg-slate-900/60'
    }`}>
      
      <div className={`border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col transition-all my-auto ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        
        {/* Cabeçalho */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50'
        }`}>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className={`font-bold text-base leading-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                Gerar Imagem para Status & Stories
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Formato vertical 9:16 perfeito para WhatsApp e Instagram
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

        {/* Preview do Canvas */}
        <div className="p-6 flex flex-col items-center space-y-4">
          
          <div className="relative rounded-2xl overflow-hidden shadow-xl border border-slate-700/60 bg-slate-950 max-h-[50vh] flex items-center justify-center aspect-[9/16]">
            <canvas
              ref={canvasRef}
              className="w-auto h-full max-h-[50vh] object-contain rounded-2xl"
            />
            {generating && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center text-white text-xs font-semibold gap-2">
                <Sparkles className="h-4 w-4 animate-spin text-purple-400" />
                <span>Renderizando Card em Alta Resolução...</span>
              </div>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="w-full flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={generating || !downloadUrl}
              className="flex-1 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition flex items-center justify-center gap-2 active:scale-95"
            >
              <Download className="h-4 w-4" />
              <span>Baixar Card para Status (PNG)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const text = `Olha esse anúncio incrível na vitrine ${store.name}: ${item.title} por ${formatCurrency(item.price)}! Veja mais em: https://www.3facil.com/${store.slug}?item=${item.id}`;
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 active:scale-95"
            >
              <Share2 className="h-4 w-4" />
              <span>Divulgar no WhatsApp</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
