import React, { useState, useEffect } from 'react';
import { X, Save, Store, Trash2 } from 'lucide-react';
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

  const [name, setName] = useState(store.name);
  const [slogan, setSlogan] = useState(store.slogan);
  const [description, setDescription] = useState(store.description);
  const [phone, setPhone] = useState(store.phone);
  const [whatsapp, setWhatsapp] = useState(store.whatsapp);
  const [email, setEmail] = useState(store.email);
  const [neighborhood, setNeighborhood] = useState(store.neighborhood || '');
  const [city, setCity] = useState(store.city);
  const [state, setState] = useState(store.state);
  const [instagram, setInstagram] = useState(store.instagram || '');
  const [logoUrl, setLogoUrl] = useState(store.logoUrl || '');
  const [bannerUrl, setBannerUrl] = useState(store.bannerUrl || '');
  const [password, setPassword] = useState(store.password || '123456');

  useEffect(() => {
    if (store) {
      setName(store.name);
      setSlogan(store.slogan);
      setDescription(store.description);
      setPhone(store.phone);
      setWhatsapp(store.whatsapp);
      setEmail(store.email);
      setNeighborhood(store.neighborhood || '');
      setCity(store.city);
      setState(store.state);
      setInstagram(store.instagram || '');
      setLogoUrl(store.logoUrl || '');
      setBannerUrl(store.bannerUrl || '');
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
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim(),
      instagram: instagram.trim(),
      logoUrl: logoUrl.trim(),
      bannerUrl: bannerUrl.trim(),
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
                Configurações da Loja
              </h3>
              <p className="text-xs text-slate-400">
                Personalize os dados de contato e identidade visual
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Nome da Loja *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Slogan</label>
              <input
                type="text"
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">WhatsApp de Vendas *</label>
              <input
                type="text"
                required
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">E-mail Comercial *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Bairro</label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Cidade / UF</label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="col-span-2 bg-slate-950 text-slate-200 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-800"
                />
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="col-span-1 bg-slate-950 text-slate-200 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-800"
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
                className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">URL da Imagem de Banner</label>
              <input
                type="text"
                placeholder="https://images.unsplash.com/..."
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Senha de Acesso do Lojista</label>
              <input
                type="password"
                placeholder="Senha de acesso ao painel"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Sobre a Empresa / Bio</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm p-3 rounded-xl border border-slate-800"
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
