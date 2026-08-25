import React, { useState, useEffect } from 'react';
import { X, Save, Store, Trash2, Eye, EyeOff, ShieldCheck, Phone, Mail, MapPin, Palette } from 'lucide-react';
import { StoreProfile } from '../../types/store';
import { useStoreContext } from '../../context/StoreContext';

interface StoreSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: StoreProfile;
}

export const StoreSettingsModal: React.FC<StoreSettingsModalProps> = ({
  isOpen,
  onClose,
  store,
}) => {
  const { updateStore, deleteStore, stores } = useStoreContext();

  const [name, setName] = useState(store.name || '');
  const [slogan, setSlogan] = useState(store.slogan || '');
  const [description, setDescription] = useState(store.description || '');
  const [phone, setPhone] = useState(store.phone || '');
  const [whatsapp, setWhatsapp] = useState(store.whatsapp || '');
  const [email, setEmail] = useState(store.email || '');
  const [address, setAddress] = useState(store.address || '');
  const [neighborhood, setNeighborhood] = useState(store.neighborhood || '');
  const [city, setCity] = useState(store.city || '');
  const [state, setState] = useState(store.state || '');
  const [instagram, setInstagram] = useState(store.instagram || '');
  const [logoUrl, setLogoUrl] = useState(store.logoUrl || '');
  const [bannerUrl, setBannerUrl] = useState(store.bannerUrl || '');
  const [themeColor, setThemeColor] = useState(store.themeColor || '#2563eb');
  const [ownerName, setOwnerName] = useState(store.ownerName || '');
  const [ownerDocument, setOwnerDocument] = useState(store.ownerDocument || '');
  const [password, setPassword] = useState(store.password || '123456');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (store) {
      setName(store.name || '');
      setSlogan(store.slogan || '');
      setDescription(store.description || '');
      setPhone(store.phone || '');
      setWhatsapp(store.whatsapp || '');
      setEmail(store.email || '');
      setAddress(store.address || '');
      setNeighborhood(store.neighborhood || '');
      setCity(store.city || '');
      setState(store.state || '');
      setInstagram(store.instagram || '');
      setLogoUrl(store.logoUrl || '');
      setBannerUrl(store.bannerUrl || '');
      setThemeColor(store.themeColor || '#2563eb');
      setOwnerName(store.ownerName || '');
      setOwnerDocument(store.ownerDocument || '');
      setPassword(store.password || '123456');
    }
  }, [store, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateStore({
      ...store,
      name: name.trim(),
      slogan: slogan.trim(),
      description: description.trim(),
      phone: phone.trim(),
      whatsapp: whatsapp.replace(/\D/g, ''),
      email: email.trim(),
      address: address.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim(),
      instagram: instagram.trim(),
      logoUrl: logoUrl.trim(),
      bannerUrl: bannerUrl.trim(),
      themeColor: themeColor,
      ownerName: ownerName.trim(),
      ownerDocument: ownerDocument.trim(),
      password: password.trim() || '123456',
    });
    onClose();
  };

  const handleDelete = () => {
    if (confirm(`Tem certeza que deseja excluir a loja "${store.name}" e todos os seus itens cadastrados?`)) {
      deleteStore(store.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Store className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-white">
                Configurações da Loja, Contatos & Senha
              </h3>
              <p className="text-xs text-slate-400">
                Altere a senha de login, WhatsApp, e-mail comercial e dados cadastrais
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Senha e Acesso */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
              <ShieldCheck className="h-4 w-4" />
              <span>Acesso & Senha da Loja</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">E-mail de Login da Loja *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 text-slate-200 text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Senha de Acesso ao Painel *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900 text-slate-200 text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-800 pr-16 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded-lg"
                  >
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Dados Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Nome da Empresa / Loja *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Slogan / Subtítulo</label>
              <input
                type="text"
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">WhatsApp de Vendas *</label>
              <input
                type="text"
                required
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Ex: 91985931012"
                className="w-full bg-slate-950 text-slate-200 text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Telefone Fixo / Adicional</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Responsável / Corretor</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Ex: Moises Coutinho"
                className="w-full bg-slate-950 text-slate-200 text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">CRECI / CPF / CNPJ</label>
              <input
                type="text"
                value={ownerDocument}
                onChange={(e) => setOwnerDocument(e.target.value)}
                placeholder="Ex: CRECI 10016"
                className="w-full bg-slate-950 text-slate-200 text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Bairro</label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Cidade / UF</label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="col-span-2 bg-slate-950 text-slate-200 text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  maxLength={2}
                  className="col-span-1 bg-slate-950 text-slate-200 text-xs uppercase text-center px-2 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Instagram (@)</label>
              <input
                type="text"
                placeholder="@sua_loja"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs px-3.5 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Cor Primária</label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-9 h-9 rounded-xl cursor-pointer border-0 bg-transparent p-0"
                />
                <input
                  type="text"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="flex-1 bg-slate-950 text-slate-200 text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Seção de Identidade Visual: Logo e Banner */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs">
              <Palette className="h-4 w-4" />
              <span>Identidade Visual: Banner e Logomarca</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Logo */}
              <div className="space-y-2">
                <label className="block text-xs text-slate-300 font-medium">Logotipo da Loja / Avatar</label>
                <div className="flex items-center space-x-3">
                  <div className="w-14 h-14 rounded-xl border border-slate-700 bg-slate-900 overflow-hidden flex items-center justify-center shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-xs text-slate-500 font-bold">Sem Logo</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      placeholder="URL da imagem (https://...)"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="w-full bg-slate-900 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500"
                    />
                    <label className="inline-block cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium px-2.5 py-1 rounded-md transition">
                      <span>📁 Subir Arquivo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              if (typeof ev.target?.result === 'string') {
                                setLogoUrl(ev.target.result);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Banner */}
              <div className="space-y-2">
                <label className="block text-xs text-slate-300 font-medium">Banner de Fundo do Topo</label>
                <div className="space-y-1.5">
                  <div className="h-14 rounded-xl border border-slate-700 bg-slate-900 overflow-hidden relative">
                    {bannerUrl ? (
                      <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                        Banner Padrão Ativo
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="URL do banner (https://...)"
                      value={bannerUrl}
                      onChange={(e) => setBannerUrl(e.target.value)}
                      className="flex-1 bg-slate-900 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500"
                    />
                    <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium px-2.5 py-1.5 rounded-md transition shrink-0">
                      <span>📁 Subir</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              if (typeof ev.target?.result === 'string') {
                                setBannerUrl(ev.target.result);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Sobre a Empresa / Bio</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 text-slate-200 text-xs p-3 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            {stores.length > 1 ? (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium border border-rose-500/20 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Excluir Loja</span>
              </button>
            ) : <div />}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition"
              >
                <Save className="h-4 w-4" />
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>

        </form>

      </div>

    </div>
  );
};
