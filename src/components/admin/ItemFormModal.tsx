import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Image as ImageIcon, 
  Sparkles, 
  DollarSign, 
  Check, 
  Car, 
  Home, 
  ShoppingBag, 
  Briefcase,
  Shield,
  Calendar,
  Upload,
  Building2,
  KeyRound,
  Tag,
  Bath,
  Coins
} from 'lucide-react';
import { StoreItem, StoreProfile, StoreType } from '../../types/store';
import { useStoreContext } from '../../context/StoreContext';
import { sanitizeImageUrl, getDefaultImageForItem } from '../../utils/formatters';

interface ItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemToEdit: StoreItem | null;
  store: StoreProfile;
}

export const ItemFormModal: React.FC<ItemFormModalProps> = ({
  isOpen,
  onClose,
  itemToEdit,
  store,
}) => {
  const { addItem, updateItem } = useStoreContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Campos Básicos Comuns
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [featured, setFeatured] = useState(false);
  const [imagesList, setImagesList] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');

  // 1. Veículo (Venda)
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [version, setVersion] = useState('');
  const [yearFab, setYearFab] = useState<number>(2023);
  const [yearModel, setYearModel] = useState<number>(2024);
  const [mileage, setMileage] = useState<number>(0);
  const [transmission, setTransmission] = useState<'automatico' | 'manual' | 'cvt'>('automatico');
  const [fuel, setFuel] = useState<'flex' | 'gasolina' | 'diesel' | 'hibrido' | 'eletrico'>('flex');
  const [color, setColor] = useState('Preto');
  const [plateEnd, setPlateEnd] = useState('Final 8');
  const [priceCar, setPriceCar] = useState<number>(0);
  const [fipePrice, setFipePrice] = useState<number>(0);
  const [uniqueOwner, setUniqueOwner] = useState(true);
  const [inspectionsDone, setInspectionsDone] = useState(true);
  const [accessoriesText, setAccessoriesText] = useState('');

  // 2. Imóvel
  const [transactionType, setTransactionType] = useState<'venda' | 'aluguel'>('venda');
  const [propertyType, setPropertyType] = useState<'apartamento' | 'casa' | 'ponto_comercial' | 'terreno' | 'cobertura'>('apartamento');
  const [priceProperty, setPriceProperty] = useState<number>(0);
  const [condoFee, setCondoFee] = useState<number>(0);
  const [iptu, setIptu] = useState<number>(0);
  const [areaUtil, setAreaUtil] = useState<number>(80);
  const [bedrooms, setBedrooms] = useState<number>(2);
  const [bathrooms, setBathrooms] = useState<number>(2);
  const [garageSpots, setGarageSpots] = useState<number>(1);
  const [neighborhood, setNeighborhood] = useState('');
  const [cityProperty, setCityProperty] = useState(store.city || 'São Paulo');
  const [amenitiesText, setAmenitiesText] = useState('');

  // 3. Produto
  const [categoryProduct, setCategoryProduct] = useState('Geral');
  const [priceProduct, setPriceProduct] = useState<number>(0);
  const [promotionalPrice, setPromotionalPrice] = useState<number>(0);
  const [sku, setSku] = useState('');
  const [brandProduct, setBrandProduct] = useState('');
  const [inStock, setInStock] = useState(true);
  const [stockQuantity, setStockQuantity] = useState<number>(10);
  const [conditionProduct, setConditionProduct] = useState<'novo' | 'usado'>('novo');
  const [colorsText, setColorsText] = useState('');

  // 4. Serviço
  const [categoryService, setCategoryService] = useState('Consultoria');
  const [priceService, setPriceService] = useState<number>(0);
  const [priceType, setPriceType] = useState<'fixo' | 'a_partir_de' | 'sob_consulta'>('a_partir_de');
  const [estimatedDuration, setEstimatedDuration] = useState('5 a 10 dias úteis');
  const [includedText, setIncludedText] = useState('');

  useEffect(() => {
    if (itemToEdit) {
      setTitle(itemToEdit.title);
      setDescription(itemToEdit.description);
      setFeatured(itemToEdit.featured);
      setImagesList(itemToEdit.images && itemToEdit.images.length > 0 ? itemToEdit.images : []);

      if (itemToEdit.itemType === 'veiculo') {
        setBrand(itemToEdit.brand);
        setModel(itemToEdit.model);
        setVersion(itemToEdit.version || '');
        setYearFab(itemToEdit.yearFab);
        setYearModel(itemToEdit.yearModel);
        setMileage(itemToEdit.mileage);
        setTransmission(itemToEdit.transmission as any);
        setFuel(itemToEdit.fuel as any);
        setColor(itemToEdit.color);
        setPlateEnd(itemToEdit.plateEnd || '');
        setPriceCar(itemToEdit.price);
        setFipePrice(itemToEdit.fipePrice || 0);
        setUniqueOwner(!!itemToEdit.uniqueOwner);
        setInspectionsDone(!!itemToEdit.inspectionsDone);
        setAccessoriesText((itemToEdit.accessories || []).join('\n'));
      } else if (itemToEdit.itemType === 'imovel') {
        const rawPropType = (itemToEdit.propertyType as any) === 'comercial' ? 'ponto_comercial' : itemToEdit.propertyType;
        setPropertyType(rawPropType as any);
        setTransactionType(itemToEdit.transactionType || 'venda');
        setPriceProperty(itemToEdit.price);
        setCondoFee(itemToEdit.condoFee || 0);
        setIptu(itemToEdit.iptu || 0);
        setAreaUtil(itemToEdit.areaUtil || 80);
        setBedrooms(itemToEdit.bedrooms || 0);
        setBathrooms(itemToEdit.bathrooms || 1);
        setGarageSpots(itemToEdit.garageSpots || 0);
        setNeighborhood(itemToEdit.neighborhood || '');
        setCityProperty(itemToEdit.city || store.city || 'São Paulo');
        setAmenitiesText((itemToEdit.amenities || []).join('\n'));
      } else if (itemToEdit.itemType === 'produto') {
        setCategoryProduct(itemToEdit.category);
        setPriceProduct(itemToEdit.price);
        setPromotionalPrice(itemToEdit.promotionalPrice || 0);
        setSku(itemToEdit.sku || '');
        setBrandProduct(itemToEdit.brand || '');
        setInStock(itemToEdit.inStock);
        setStockQuantity(itemToEdit.stockQuantity || 0);
        setConditionProduct(itemToEdit.condition as any);
        setColorsText((itemToEdit.colors || []).join('\n'));
      } else if (itemToEdit.itemType === 'servico') {
        setCategoryService(itemToEdit.category);
        setPriceService(itemToEdit.price);
        setPriceType(itemToEdit.priceType);
        setEstimatedDuration(itemToEdit.estimatedDuration || '');
        setIncludedText((itemToEdit.includedItems || []).join('\n'));
      }
    } else {
      // Defaults para novo item
      setTitle('');
      setDescription('');
      setFeatured(false);
      setImagesList([]);
      setNewImageUrl('');
      setPriceCar(0);
      setPriceProperty(0);
      setCondoFee(0);
      setIptu(0);
      setBedrooms(2);
      setBathrooms(1);
      setGarageSpots(1);
      setAreaUtil(80);
      setTransactionType('venda');
      setPropertyType('apartamento');
      setPriceProduct(0);
      setPriceService(0);
      setNeighborhood('');
      setAmenitiesText('');
      setAccessoriesText('');
      setIncludedText('');
    }
  }, [itemToEdit, isOpen, store]);

  if (!isOpen) return null;

  // Manipular upload de imagens da galeria local
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result;
        if (typeof result === 'string') {
          setImagesList((prev) => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddImageUrl = () => {
    if (newImageUrl.trim()) {
      setImagesList((prev) => [...prev, newImageUrl.trim()]);
      setNewImageUrl('');
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImagesList((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const fallbackImg = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&auto=format&fit=crop&q=80';
    const finalImages = imagesList.length > 0 ? imagesList : [fallbackImg];

    if (store.type === 'veiculo') {
      const vehiclePayload = {
        itemType: 'veiculo' as const,
        title: title.trim() || `${brand} ${model} ${version}`.trim(),
        description: description.trim(),
        images: finalImages,
        featured,
        brand: brand.trim(),
        model: model.trim(),
        version: version.trim(),
        yearFab: Number(yearFab) || 2023,
        yearModel: Number(yearModel) || 2024,
        mileage: Number(mileage) || 0,
        transmission,
        fuel,
        color: color.trim(),
        plateEnd: plateEnd.trim(),
        price: Number(priceCar) || 0,
        fipePrice: Number(fipePrice) > 0 ? Number(fipePrice) : undefined,
        uniqueOwner,
        inspectionsDone,
        accessories: accessoriesText.split('\n').map((s) => s.trim()).filter(Boolean),
        status: (itemToEdit?.status as any) || 'disponivel',
      };

      if (itemToEdit) {
        updateItem({ ...itemToEdit, ...vehiclePayload });
      } else {
        addItem(vehiclePayload);
      }
    } else if (store.type === 'imovel') {
      const propertyPayload = {
        itemType: 'imovel' as const,
        title: title.trim() || `${propertyType === 'apartamento' ? 'Apartamento' : propertyType === 'casa' ? 'Casa' : propertyType === 'ponto_comercial' ? 'Ponto Comercial' : propertyType === 'terreno' ? 'Terreno' : 'Cobertura'} para ${transactionType === 'venda' ? 'Venda' : 'Aluguel'}${neighborhood ? ` em ${neighborhood}` : ''}`,
        description: description.trim(),
        images: finalImages,
        featured,
        propertyType: (propertyType === 'ponto_comercial' ? 'comercial' : propertyType) as any,
        transactionType,
        price: Number(priceProperty) || 0,
        condoFee: Number(condoFee) > 0 ? Number(condoFee) : undefined,
        iptu: Number(iptu) > 0 ? Number(iptu) : undefined,
        areaUtil: Number(areaUtil) || 50,
        bedrooms: Number(bedrooms) || 0,
        suites: 0,
        bathrooms: Number(bathrooms) || 1,
        garageSpots: Number(garageSpots) || 0,
        neighborhood: neighborhood.trim() || 'Centro',
        city: cityProperty.trim() || store.city || 'São Paulo',
        state: store.state || 'SP',
        amenities: amenitiesText.split('\n').map((s) => s.trim()).filter(Boolean),
        status: (itemToEdit?.status as any) || 'disponivel',
      };

      if (itemToEdit) {
        updateItem({ ...itemToEdit, ...propertyPayload });
      } else {
        addItem(propertyPayload);
      }
    } else if (store.type === 'produto') {
      const productPayload = {
        itemType: 'produto' as const,
        title: title.trim(),
        description: description.trim(),
        images: finalImages,
        featured,
        category: categoryProduct.trim() || 'Geral',
        price: Number(priceProduct) || 0,
        promotionalPrice: Number(promotionalPrice) > 0 ? Number(promotionalPrice) : undefined,
        sku: sku.trim(),
        brand: brandProduct.trim(),
        inStock,
        stockQuantity: Number(stockQuantity) || 0,
        condition: conditionProduct,
        colors: colorsText.split('\n').map((s) => s.trim()).filter(Boolean),
        status: (itemToEdit?.status as any) || 'ativo',
      };

      if (itemToEdit) {
        updateItem({ ...itemToEdit, ...productPayload });
      } else {
        addItem(productPayload);
      }
    } else if (store.type === 'servico') {
      const servicePayload = {
        itemType: 'servico' as const,
        title: title.trim(),
        description: description.trim(),
        images: finalImages,
        featured,
        category: categoryService.trim() || 'Geral',
        price: Number(priceService) || 0,
        priceType,
        estimatedDuration: estimatedDuration.trim(),
        includedItems: includedText.split('\n').map((s) => s.trim()).filter(Boolean),
        status: (itemToEdit?.status as any) || 'ativo',
      };

      if (itemToEdit) {
        updateItem({ ...itemToEdit, ...servicePayload });
      } else {
        addItem(servicePayload);
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {store.type === 'veiculo' && <Car className="h-4 w-4" />}
              {store.type === 'imovel' && <Home className="h-4 w-4 text-emerald-400" />}
              {store.type === 'produto' && <ShoppingBag className="h-4 w-4" />}
              {store.type === 'servico' && <Briefcase className="h-4 w-4" />}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-white">
                {itemToEdit ? 'Editar Anúncio' : 'Publicar Novo Item'}
              </h3>
              <p className="text-xs text-slate-400">
                Modelo: <span className="text-slate-200 font-medium capitalize">{store.type}</span> ({store.name})
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

        {/* Formulário com Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* ========================================================================= */}
          {/* CASO SEJA IMÓVEL: INICIA DIRETO COM TIPO DE NEGÓCIO E TIPO DO IMÓVEL */}
          {/* ========================================================================= */}
          {store.type === 'imovel' && (
            <div className="space-y-4 bg-slate-950/60 p-4 sm:p-5 rounded-2xl border border-slate-800/80">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                1. Tipo de Negócio & Tipo do Imóvel
              </h4>

              {/* TIPO DE NEGÓCIO: VENDA OU ALUGUEL */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Tipo de Negócio (Finalidade) *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTransactionType('venda')}
                    className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border text-xs sm:text-sm font-bold transition-all ${
                      transactionType === 'venda'
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-950/50'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <Tag className="h-4 w-4" />
                    <span>Venda</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransactionType('aluguel')}
                    className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border text-xs sm:text-sm font-bold transition-all ${
                      transactionType === 'aluguel'
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-950/50'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>Aluguel / Locação</span>
                  </button>
                </div>
              </div>

              {/* TIPO DO IMÓVEL: APARTAMENTO, CASA, PONTO COMERCIAL, TERRENO */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Tipo do Imóvel *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'apartamento', label: 'Apartamento', icon: '🏢' },
                    { id: 'casa', label: 'Casa', icon: '🏡' },
                    { id: 'ponto_comercial', label: 'Ponto Comercial', icon: '🏬' },
                    { id: 'terreno', label: 'Terreno', icon: '📐' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPropertyType(t.id as any)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                        propertyType === t.id
                          ? 'bg-slate-800 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-xl mb-1">{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* VALORES: PREÇO DO IMÓVEL + CONDOMÍNIO + IPTU */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-medium">
                    {transactionType === 'venda' ? 'Valor de Venda (R$) *' : 'Valor do Aluguel (R$) *'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-500">R$</span>
                    <input
                      type="number"
                      required
                      placeholder="0,00"
                      value={priceProperty || ''}
                      onChange={(e) => setPriceProperty(Number(e.target.value))}
                      className="w-full bg-slate-950 text-slate-100 text-sm pl-9 pr-3 py-2.5 rounded-xl border border-slate-800 font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-medium">
                    Valor do Condomínio (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-500">R$</span>
                    <input
                      type="number"
                      placeholder="Ex: 650"
                      value={condoFee || ''}
                      onChange={(e) => setCondoFee(Number(e.target.value))}
                      className="w-full bg-slate-950 text-slate-100 text-sm pl-9 pr-3 py-2.5 rounded-xl border border-slate-800 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-medium">
                    IPTU Mensal (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-500">R$</span>
                    <input
                      type="number"
                      placeholder="Ex: 120"
                      value={iptu || ''}
                      onChange={(e) => setIptu(Number(e.target.value))}
                      className="w-full bg-slate-950 text-slate-100 text-sm pl-9 pr-3 py-2.5 rounded-xl border border-slate-800 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* DETALHES: ÁREA, QUARTOS, BANHEIROS, VAGAS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Área Útil (m²)</label>
                  <input
                    type="number"
                    value={areaUtil || ''}
                    onChange={(e) => setAreaUtil(Number(e.target.value))}
                    className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Quartos</label>
                  <input
                    type="number"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(Number(e.target.value))}
                    className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1 flex items-center gap-1">
                    <Bath className="h-3 w-3 text-emerald-400" />
                    <span>Nº Banheiros</span>
                  </label>
                  <input
                    type="number"
                    value={bathrooms}
                    onChange={(e) => setBathrooms(Number(e.target.value))}
                    className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Vagas de Garagem</label>
                  <input
                    type="number"
                    value={garageSpots}
                    onChange={(e) => setGarageSpots(Number(e.target.value))}
                    className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-800"
                  />
                </div>
              </div>

              {/* LOCALIZAÇÃO: BAIRRO E CIDADE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Bairro *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Morumbi, Jardins, Centro"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Cidade</label>
                  <input
                    type="text"
                    value={cityProperty}
                    onChange={(e) => setCityProperty(e.target.value)}
                    className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Comodidades & Lazer (um por linha)
                </label>
                <textarea
                  rows={2}
                  placeholder="Piscina Aquecida&#10;Varanda Gourmet&#10;Academia&#10;Portaria 24h"
                  value={amenitiesText}
                  onChange={(e) => setAmenitiesText(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-3 rounded-xl border border-slate-800 resize-none"
                />
              </div>
            </div>
          )}

          {/* Informações Principais (Título e Descrição) */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {store.type === 'imovel' ? '2. Título & Descrição do Anúncio' : '1. Título & Descrição Geral'}
            </h4>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Título do Anúncio *</label>
              <input
                type="text"
                required
                placeholder={
                  store.type === 'veiculo'
                    ? 'Ex: Toyota Corolla 2.0 XEi Flex Automático'
                    : store.type === 'imovel'
                    ? 'Ex: Apartamento 3 Quartos com Varanda Gourmet no Morumbi'
                    : store.type === 'produto'
                    ? 'Ex: Headphone Bluetooth Pro 850 ANC'
                    : 'Ex: Projeto Completo de Arquitetura de Interiores'
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Descrição Completa</label>
              <textarea
                rows={3}
                placeholder="Detalhes, diferenciais, histórico, condições de entrega ou documentação..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm p-3 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* ========================================================================= */}
            {/* UPLOAD DE IMAGENS ATRAVÉS DA GALERIA DO DISPOSITIVO + URL */}
            {/* ========================================================================= */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-blue-400" />
                  <span>Fotos do Item ({imagesList.length})</span>
                </label>

                {/* Input Invisível para Galeria do Dispositivo */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  multiple
                  accept="image/*"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 text-xs font-semibold transition"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Subir da Galeria</span>
                </button>
              </div>

              {/* Pré-visualização das fotos com remoção */}
              {imagesList.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  {imagesList.map((imgUrl, idx) => {
                    const cleanUrl = sanitizeImageUrl(imgUrl, store.type);
                    const fallback = getDefaultImageForItem(store.type);
                    return (
                      <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                        <img
                          src={cleanUrl}
                          alt={`Foto ${idx + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (target.src !== fallback) {
                              target.src = fallback;
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500 transition shadow-md"
                            title="Remover foto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {idx === 0 && (
                          <span className="absolute bottom-1 left-1 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                            Capa
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Alternativa: Adicionar por Link de Imagem */}
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="Ou cole o link direto de uma imagem (https://...)"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddImageUrl();
                    }
                  }}
                  className="flex-1 bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  disabled={!newImageUrl.trim()}
                  className="px-3 py-2 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40 rounded-xl text-xs font-medium transition"
                >
                  Adicionar Link
                </button>
              </div>
            </div>

            <div className="flex items-center pt-1">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0"
                />
                <span className="text-xs text-slate-300 font-medium">
                  ⭐ Destacar este item na página inicial
                </span>
              </label>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CAMPOS ESPECÍFICOS: MODELO VEÍCULO (VENDA) */}
          {/* ========================================================================= */}
          {store.type === 'veiculo' && (
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-red-400">
                2. Ficha Técnica do Veículo
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Marca *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Toyota, Honda, BMW"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Modelo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Corolla, Civic, 320i"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Versão / Motor</label>
                  <input
                    type="text"
                    placeholder="Ex: 2.0 XEi Flex Aut."
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Ano Fab.</label>
                  <input
                    type="number"
                    value={yearFab}
                    onChange={(e) => setYearFab(Number(e.target.value))}
                    className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Ano Mod.</label>
                  <input
                    type="number"
                    value={yearModel}
                    onChange={(e) => setYearModel(Number(e.target.value))}
                    className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Quilometragem (KM)</label>
                  <input
                    type="number"
                    value={mileage}
                    onChange={(e) => setMileage(Number(e.target.value))}
                    className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Preço de Venda (R$) *</label>
                  <input
                    type="number"
                    required
                    value={priceCar || ''}
                    onChange={(e) => setPriceCar(Number(e.target.value))}
                    className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-800 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Opcionais e Acessórios (um por linha)
                </label>
                <textarea
                  rows={3}
                  placeholder="Ar Condicionado Digital&#10;Bancos de Couro&#10;Teto Solar&#10;Câmera de Ré"
                  value={accessoriesText}
                  onChange={(e) => setAccessoriesText(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-3 rounded-xl border border-slate-800 resize-none"
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CAMPOS ESPECÍFICOS: MODELO PRODUTO */}
          {/* ========================================================================= */}
          {store.type === 'produto' && (
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                2. Detalhes do Produto
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Categoria *</label>
                  <input
                    type="text"
                    required
                    value={categoryProduct}
                    onChange={(e) => setCategoryProduct(e.target.value)}
                    className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Preço Normal (R$) *</label>
                  <input
                    type="number"
                    required
                    value={priceProduct || ''}
                    onChange={(e) => setPriceProduct(Number(e.target.value))}
                    className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-800 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Preço Promocional (R$)</label>
                  <input
                    type="number"
                    value={promotionalPrice || ''}
                    onChange={(e) => setPromotionalPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-800 text-emerald-400 font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CAMPOS ESPECÍFICOS: MODELO SERVIÇO */}
          {/* ========================================================================= */}
          {store.type === 'servico' && (
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                2. Detalhes do Serviço
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Categoria *</label>
                  <input
                    type="text"
                    required
                    value={categoryService}
                    onChange={(e) => setCategoryService(e.target.value)}
                    className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Tipo de Preço</label>
                  <select
                    value={priceType}
                    onChange={(e) => setPriceType(e.target.value as any)}
                    className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-800"
                  >
                    <option value="fixo">Preço Fixo</option>
                    <option value="a_partir_de">A partir de</option>
                    <option value="sob_consulta">Sob Consulta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    value={priceService || ''}
                    onChange={(e) => setPriceService(Number(e.target.value))}
                    className="w-full bg-slate-950 text-slate-200 text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-800 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Itens Inclusos no Pacote (um por linha)
                </label>
                <textarea
                  rows={3}
                  placeholder="Briefing inicial&#10;Plantas Baixas e 3D&#10;Lista de Fornecedores"
                  value={includedText}
                  onChange={(e) => setIncludedText(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-3 rounded-xl border border-slate-800 resize-none"
                />
              </div>
            </div>
          )}

          {/* Footer com Botões */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md transition"
            >
              <Check className="h-4 w-4" />
              <span>{itemToEdit ? 'Salvar Alterações' : 'Publicar Anúncio'}</span>
            </button>
          </div>

        </form>

      </div>

    </div>
  );
};

