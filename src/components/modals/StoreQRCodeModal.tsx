import React, { useState } from 'react';
import { X, QrCode, Copy, Check, Download, Printer, ExternalLink, Sparkles } from 'lucide-react';
import { StoreProfile } from '../../types/store';
import { useStoreContext } from '../../context/StoreContext';

interface StoreQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: StoreProfile | null;
}

export const StoreQRCodeModal: React.FC<StoreQRCodeModalProps> = ({
  isOpen,
  onClose,
  store,
}) => {
  const { theme } = useStoreContext();
  const isDark = theme === 'dark';
  const [copied, setCopied] = useState(false);

  if (!isOpen || !store) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.3facil.com';
  const storeUrl = `${origin}/${store.slug}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=450x450&data=${encodeURIComponent(storeUrl)}&margin=10`;

  const handleCopy = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qrcode-${store.slug}-3facil.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(qrCodeUrl, '_blank');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200 ${
      isDark ? 'bg-slate-950/80' : 'bg-slate-900/60'
    }`}>
      
      <div className={`border rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col transition-all ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        
        {/* Cabeçalho */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50'
        }`}>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className={`font-bold text-base leading-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                QR Code da Vitrine
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Acesso direto pelo celular
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

        {/* Conteúdo Imprimível */}
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          
          {/* Plaquinha estilizada */}
          <div className={`p-5 rounded-2xl border flex flex-col items-center max-w-xs w-full shadow-sm ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}>
            {store.logoUrl && (
              <img 
                src={store.logoUrl} 
                alt={store.name} 
                className="h-12 w-12 rounded-xl object-contain mb-2 bg-white p-1 border shadow-xs" 
              />
            )}
            <h4 className={`font-bold text-sm leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {store.name}
            </h4>
            <p className={`text-[11px] font-medium line-clamp-1 mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {store.slogan || 'Aponte a câmera para ver o catálogo'}
            </p>

            <div className="bg-white p-3 rounded-2xl shadow-inner border border-slate-200">
              <img
                src={qrCodeUrl}
                alt={`QR Code ${store.name}`}
                className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
              />
            </div>

            <div className="mt-3 flex items-center justify-center gap-1 text-[11px] text-slate-500 font-mono">
              <Sparkles className="h-3 w-3 text-emerald-500" />
              <span>3facil.com/{store.slug}</span>
            </div>
          </div>

          {/* Link direto */}
          <div className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono text-left ${
            isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
          }`}>
            <span className="truncate mr-2">{storeUrl}</span>
            <button
              onClick={handleCopy}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>

          {/* Botões de Ação */}
          <div className="grid grid-cols-2 gap-2 w-full pt-1">
            <button
              type="button"
              onClick={handleDownload}
              className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                isDark
                  ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
                  : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <Download className="h-4 w-4 text-blue-500" />
              <span>Baixar Imagem</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                isDark
                  ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
                  : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <Printer className="h-4 w-4 text-emerald-500" />
              <span>Imprimir</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
