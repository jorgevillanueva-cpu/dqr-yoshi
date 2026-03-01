
import React, { useState, useRef, useEffect } from 'react';
import { TicketPreview } from '@/ui/ticket';
import { YoshiLogo, ChivasLogo } from '@/ui/logos';
import { TicketData } from './types';
import html2canvas from 'html2canvas';

const initialFormData: TicketData = {
  saldo: '',
  codigo: '',
  phone: '',
  valido: '',
  cortesia: false,
  isTokens: false,
  showExtraData: false,
  extraData: ''
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'yoshi' | 'chivas'>('yoshi');
  
  // Estados para Yoshi
  const [formDataYoshi, setFormDataYoshi] = useState<TicketData>({ ...initialFormData });
  const [showPreviewYoshi, setShowPreviewYoshi] = useState(false);
  
  // Estados para Chivas
  const [formDataChivas, setFormDataChivas] = useState<TicketData>({ ...initialFormData, isTokens: true });
  const [showPreviewChivas, setShowPreviewChivas] = useState(false);

  const formData = activeTab === 'yoshi' ? formDataYoshi : formDataChivas;
  const setFormData = activeTab === 'yoshi' ? setFormDataYoshi : setFormDataChivas;
  const showPreview = activeTab === 'yoshi' ? showPreviewYoshi : showPreviewChivas;
  const setShowPreview = activeTab === 'yoshi' ? setShowPreviewYoshi : setShowPreviewChivas;

  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showHeaderMsg, setShowHeaderMsg] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const ticketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(standalone);

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!standalone) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (ios && !standalone) {
      const timer = setTimeout(() => setShowInstallBanner(true), 2000);
      return () => clearTimeout(timer);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    setShowPreviewYoshi(!!formDataYoshi.codigo.trim());
  }, [formDataYoshi.codigo]);

  useEffect(() => {
    setShowPreviewChivas(!!formDataChivas.codigo.trim());
  }, [formDataChivas.codigo]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    }
  };

  const showPopMessage = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToast({ message, type });
  };

  // Función para formatear con comas mientras se escribe
  const formatCommas = (val: string) => {
    const parts = val.replace(/,/g, '').split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join('.');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    let processed: any = value;
    
    if (type === 'checkbox') {
      processed = checked;
      if (name === 'cortesia' && !checked) {
        setFormData(prev => ({ 
          ...prev, 
          cortesia: false, 
          showExtraData: false 
        }));
        return;
      }
      if (name === 'isTokens' && !checked) {
        setFormData(prev => ({ 
          ...prev, 
          isTokens: false, 
          codigo: prev.codigo.toLowerCase() 
        }));
        return;
      }
    } else {
      if (name === 'saldo') {
        const isValidoPor = activeTab === 'chivas' || (activeTab === 'yoshi' && formData.isTokens);
        if (!isValidoPor) {
          // Permitir solo números y un punto
          const clean = value.replace(/[^0-9.]/g, '');
          const dots = clean.split('.');
          let finalClean = clean;
          if (dots.length > 2) {
            finalClean = dots[0] + '.' + dots.slice(1).join('');
          }
          processed = formatCommas(finalClean);
        } else {
          processed = value;
        }
      }
      if (name === 'codigo') {
        const isChivas = activeTab === 'chivas';
        processed = (formData.isTokens || isChivas) ? value : value.toLowerCase();
      }
    }
    setFormData(prev => ({ ...prev, [name]: processed }));
  };

  const formatSaldoOnComplete = () => {
    const isValidoPor = activeTab === 'chivas' || (activeTab === 'yoshi' && formData.isTokens);
    if (isValidoPor) return;

    let value = formData.saldo.replace(/,/g, '').trim();
    if (value === '') return;
    
    const num = parseFloat(value);
    if (isNaN(num)) return;

    // Formateo final estándar con 2 decimales y comas
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);

    setFormData(prev => ({ ...prev, saldo: formatted }));
  };

  const handleClear = () => {
    const clearData = { ...initialFormData };
    if (activeTab === 'chivas') clearData.isTokens = true;
    setFormData(clearData);
    setShowPreview(false);
    showPopMessage("Campos limpiados");
  };

  const handleCopyToClipboard = async () => {
    const el = ticketRef.current;
    if (!el) return;

    setIsProcessing(true);
    try {
      const canvas = await html2canvas(el, { scale: 3, useCORS: true });
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
      if (blob && navigator.clipboard) {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        showPopMessage("¡Copiado al portapapeles!", "success");
      } else {
        showPopMessage("Tu navegador no soporta copiar imágenes", "error");
      }
    } catch (e) {
      showPopMessage("Error al copiar imagen", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendSingle = async () => {
    const el = ticketRef.current;
    const phone = formData.phone;
    if (!phone || phone.length < 10) return showPopMessage("Ingresa un WhatsApp válido", "error");
    if (!el) return;

    setIsProcessing(true);
    try {
      const canvas = await html2canvas(el, { scale: 3, useCORS: true });
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
      if (blob && navigator.clipboard) {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        showPopMessage("¡Copiado! Pégalo en WhatsApp", "success");
        window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
      }
    } catch (e) {
      showPopMessage("Error al procesar imagen", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    const el = ticketRef.current;
    if (!el) return;
    setIsProcessing(true);
    try {
      const canvas = await html2canvas(el, { scale: 3, useCORS: true });
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
      if (blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${activeTab === 'yoshi' ? 'Yoshi' : 'Chivas'}-${formData.codigo || 'ticket'}.png`;
        a.click();
        showPopMessage("Imagen descargada", "success");
      }
    } catch (e) {
      showPopMessage("Error al descargar", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShare = async () => {
    const el = ticketRef.current;
    if (!el) return;
    setIsProcessing(true);
    try {
      const canvas = await html2canvas(el, { scale: 3, useCORS: true });
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
      if (blob) {
        const file = new File([blob], `${activeTab === 'yoshi' ? 'Yoshi' : 'Chivas'}-${formData.codigo || 'ticket'}.png`, { type: 'image/png' });
        if (navigator.share) {
          await navigator.share({ files: [file], title: `${activeTab === 'yoshi' ? 'Yoshi' : 'Chivas'} Cash Ticket` });
        } else {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${activeTab === 'yoshi' ? 'Yoshi' : 'Chivas'}-${formData.codigo}.png`;
          a.click();
        }
      }
    } catch (e) {
      showPopMessage("Error al compartir", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`mx-auto min-h-screen bg-gray-50 pb-40 px-4 overflow-y-auto relative transition-all duration-700 ${showPreview ? 'max-w-7xl' : 'max-w-md'}`}>
      {/* Banner de Instalación PWA - Rediseñado como POP en la parte superior izquierda */}
      {showInstallBanner && (
        <div className="fixed top-6 left-6 z-[250] w-[260px] animate-in slide-in-from-left duration-500">
          <div className="bg-white rounded-3xl p-4 shadow-[0_15px_40px_rgba(0,0,0,0.15)] border border-gray-100 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className={`p-1.5 rounded-xl shrink-0 ${activeTab === 'yoshi' ? 'bg-[#fa005a]/10' : 'bg-white shadow-sm'}`}>
                {activeTab === 'yoshi' ? (
                  <YoshiLogo className="w-6 h-6" />
                ) : (
                  <ChivasLogo className="w-10 h-10 object-contain" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-[11px] font-black text-gray-900 leading-tight uppercase tracking-wider">Instalar Yoshi Cash</h3>
                <p className="text-[9px] text-gray-500 font-medium leading-tight mt-1">Acceso rápido desde tu pantalla de inicio.</p>
              </div>
              <button 
                onClick={() => setShowInstallBanner(false)}
                className="text-gray-300 hover:text-gray-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            {isIOS ? (
              <div className="bg-gray-50 rounded-xl p-2.5 flex items-center justify-center">
                <span className="text-[9px] font-bold text-gray-600 text-center leading-normal">
                  Toca <svg className="w-3.5 h-3.5 inline mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg> y <span className="text-[#fa005a]">"Añadir a pantalla"</span>
                </span>
              </div>
            ) : (
              <button 
                onClick={handleInstallClick}
                className={`w-full text-white py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all ${activeTab === 'yoshi' ? 'bg-[#fa005a] shadow-[#fa005a]/20' : 'bg-[#ee2e24] shadow-[#ee2e24]/20'}`}
              >
                Instalar App
              </button>
            )}
          </div>
        </div>
      )}

      <div className="text-center pt-4">
        <span className="text-[9px] text-gray-400 font-medium tracking-tight uppercase">Yoshi Cash v3.5 JV®</span>
      </div>

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border ${toast.type === 'error' ? 'bg-red-500 text-white border-red-400' : (activeTab === 'yoshi' ? 'bg-[#fa005a] text-white border-[#fa005a]/30' : 'bg-[#ee2e24] text-white border-[#ee2e24]/30')}`}>
            <div className="flex-1 text-[11px] font-bold tracking-tight">{toast.message}</div>
          </div>
        </div>
      )}

      <header className="py-6 text-center flex flex-col items-center relative">
        <div className="relative">
          <div className="bg-white p-2 rounded-[1.8rem] shadow-sm border border-gray-100/50 flex items-center justify-center">
            {activeTab === 'yoshi' ? (
              <YoshiLogo className="h-10 w-10" />
            ) : (
              <ChivasLogo className="h-20 w-20 object-contain" />
            )}
          </div>
          
          {/* Mensaje informativo tipo GLOBO DE COMIC */}
          {showHeaderMsg && activeTab === 'yoshi' && (
            <div className="hidden md:block absolute left-full ml-6 top-1/2 -translate-y-1/2 z-50 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className={`${activeTab === 'yoshi' ? 'bg-[#fa005a]' : 'bg-[#ee2e24]'} text-white text-[10px] font-black px-5 py-7 rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(250,0,90,0.4)] relative pr-12 max-w-[160px] border-2 border-white/20`}>
                <span className="block leading-relaxed uppercase tracking-wider text-center">
                  Para generar QR de tokens primero activa el Checkbox Tokens
                </span>
                <button 
                  onClick={() => setShowHeaderMsg(false)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/20 rounded-full transition-all active:scale-90"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {/* Rabillo del globo (Comic Tail) */}
                <div className={`absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-6 ${activeTab === 'yoshi' ? 'bg-[#fa005a]' : 'bg-[#ee2e24]'} rotate-45 rounded-sm border-l-2 border-b-2 border-white/10`}></div>
              </div>
            </div>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-black text-gray-900 tracking-tighter">
          {activeTab === 'yoshi' ? 'Yoshi Cash' : 'Chivas Tokens'}
        </h1>
        
        {/* Versión móvil del mensaje (debajo del título) */}
        {showHeaderMsg && activeTab === 'yoshi' && (
          <div className="md:hidden mt-4 px-6 w-full max-w-xs animate-in slide-in-from-top-4 duration-500">
            <div className={`${activeTab === 'yoshi' ? 'bg-[#fa005a]' : 'bg-[#ee2e24]'} text-white text-[9px] font-black px-6 py-6 rounded-3xl uppercase tracking-widest relative pr-12 shadow-lg shadow-[#fa005a]/20 border border-white/10 text-center`}>
              Para generar QR de tokens primero activa el Checkbox Tokens
              <button 
                onClick={() => setShowHeaderMsg(false)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </header>

      <div className={`flex flex-col ${showPreview ? 'lg:flex-row lg:items-start lg:justify-center lg:gap-12' : 'items-center'} space-y-6 lg:space-y-0 transition-all duration-700 w-full`}>
        <div className="w-full max-w-md space-y-0">
          {/* Tabs estilo folder */}
          <div className="flex px-4 gap-1">
            <button
              onClick={() => setActiveTab('yoshi')}
              className={`px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-t-2xl transition-all duration-300 relative ${
                activeTab === 'yoshi'
                  ? 'bg-white text-[#fa005a] shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.1)] z-10'
                  : 'bg-gray-200/50 text-gray-400 hover:bg-gray-200/80 mt-1'
              }`}
            >
              Yoshi
              {activeTab === 'yoshi' && <div className="absolute -bottom-px left-0 right-0 h-1 bg-white z-20"></div>}
            </button>
            <button
              onClick={() => setActiveTab('chivas')}
              className={`px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-t-2xl transition-all duration-300 relative ${
                activeTab === 'chivas'
                  ? 'bg-white text-[#fa005a] shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.1)] z-10'
                  : 'bg-gray-200/50 text-gray-400 hover:bg-gray-200/80 mt-1'
              }`}
            >
              Chivas
              {activeTab === 'chivas' && <div className="absolute -bottom-px left-0 right-0 h-1 bg-white z-20"></div>}
            </button>
          </div>

          <div className="bg-white rounded-[2rem] rounded-tl-none p-6 shadow-xl border border-gray-100 space-y-4 h-fit relative z-0">
            {/* Checkboxes enmarcados en la parte superior con botón de limpiar al lado */}
          {activeTab === 'yoshi' && (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 rounded-2xl p-3 border border-gray-200 shadow-inner">
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="cortesia"
                      name="cortesia" 
                      checked={formData.cortesia} 
                      onChange={handleInputChange} 
                      disabled={formData.isTokens}
                      className={`w-5 h-5 rounded-md ${activeTab === 'yoshi' ? 'accent-[#fa005a]' : 'accent-[#ee2e24]'} ${formData.isTokens ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}`}
                    />
                    <label 
                      htmlFor="cortesia" 
                      className={`text-[10px] font-black uppercase tracking-widest select-none transition-opacity ${formData.isTokens ? 'text-gray-300 cursor-not-allowed opacity-50' : 'text-gray-700 cursor-pointer'}`}
                    >
                      Cortesía
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="isTokens"
                      name="isTokens" 
                      checked={formData.isTokens} 
                      onChange={handleInputChange} 
                      disabled={formData.cortesia}
                      className={`w-5 h-5 rounded-md ${activeTab === 'yoshi' ? 'accent-[#fa005a]' : 'accent-[#ee2e24]'} ${formData.cortesia ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}`}
                    />
                    <label 
                      htmlFor="isTokens" 
                      className={`text-[10px] font-black uppercase tracking-widest select-none transition-opacity ${formData.cortesia ? 'text-gray-300 cursor-not-allowed opacity-50' : 'text-gray-700 cursor-pointer'}`}
                    >
                      Tokens
                    </label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="showExtraData"
                      name="showExtraData" 
                      checked={formData.showExtraData} 
                      onChange={handleInputChange} 
                      disabled={!formData.cortesia}
                      className={`w-5 h-5 rounded-md ${activeTab === 'yoshi' ? 'accent-[#fa005a]' : 'accent-[#ee2e24]'} ${formData.cortesia ? 'cursor-pointer' : 'cursor-not-allowed opacity-30'}`}
                    />
                    <label 
                      htmlFor="showExtraData" 
                      className={`text-[10px] font-black uppercase tracking-widest select-none transition-opacity ${formData.cortesia ? 'text-gray-700 cursor-pointer' : 'text-gray-300 cursor-not-allowed opacity-50'}`}
                    >
                      Personalizar
                    </label>
                  </div>
                </div>

                {formData.showExtraData && formData.cortesia && (
                  <div className="mt-3 pt-3 border-t border-gray-200 animate-in slide-in-from-top-2 duration-300">
                    <input 
                      type="text" 
                      name="extraData" 
                      value={formData.extraData} 
                      onChange={handleInputChange} 
                      className={`w-full px-4 py-2 bg-white border border-gray-200 rounded-lg font-bold text-gray-700 outline-none transition-all text-xs text-center ${activeTab === 'yoshi' ? 'focus:border-[#fa005a]' : 'focus:border-[#ee2e24]'}`}
                      placeholder="Nombre o característica extra..." 
                    />
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleClear} 
                  className={`p-3 bg-gray-100 text-gray-400 rounded-xl active:scale-95 transition-all border border-gray-200 shadow-sm flex items-center justify-center ${activeTab === 'yoshi' ? 'hover:bg-gray-200' : 'hover:bg-[#ee2e24]/10 hover:text-[#ee2e24]'}`}
                  title="Limpiar campos"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'chivas' && (
            <div className="flex items-center justify-end">
              <button 
                onClick={handleClear} 
                className="p-3 bg-gray-100 text-gray-400 rounded-xl active:scale-95 transition-all border border-gray-200 shadow-sm flex items-center justify-center hover:bg-[#ee2e24]/10 hover:text-[#ee2e24]"
                title="Limpiar campos"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}

        <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1.5 ml-1 tracking-[0.2em]">
              {(activeTab === 'chivas' || (activeTab === 'yoshi' && formData.isTokens)) ? 'Valido para: (opcional)' : 'Saldo (Opcional)'}
            </label>
            <div className="relative flex items-center">
              {!(activeTab === 'chivas' || (activeTab === 'yoshi' && formData.isTokens)) && (
                <span className="absolute left-4 text-gray-400 font-bold text-sm">$</span>
              )}
              <input 
                type="text" 
                name="saldo" 
                value={formData.saldo} 
                onChange={handleInputChange} 
                onBlur={formatSaldoOnComplete}
                className={`w-full pr-4 py-3 border-none rounded-xl font-black outline-none transition-all text-sm ${!(activeTab === 'chivas' || (activeTab === 'yoshi' && formData.isTokens)) ? 'pl-8' : 'px-4'} ${(activeTab === 'yoshi' ? 'bg-gray-50 text-gray-700 focus:ring-2 focus:ring-[#fa005a]/10' : 'bg-gray-50 text-gray-700 focus:ring-2 focus:ring-[#ee2e24]/10')}`} 
                placeholder={(activeTab === 'chivas' || (activeTab === 'yoshi' && formData.isTokens)) ? "2 comidas, 1 Bebida" : "0.00"} 
                inputMode={(activeTab === 'chivas' || (activeTab === 'yoshi' && formData.isTokens)) ? "text" : "decimal"}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5 ml-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">
                {activeTab === 'chivas' ? 'Codigo de Tokens' : 'Código del Ticket'}
              </label>
              <div className="group relative">
                <button className={`text-gray-300 transition-colors ${activeTab === 'yoshi' ? 'hover:text-[#fa005a]' : 'hover:text-[#ee2e24]'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                {/* Tooltip */}
                <div className={`absolute bottom-full right-0 mb-2 w-48 p-2 text-white text-[8px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-50 text-center uppercase tracking-wider leading-relaxed ${activeTab === 'yoshi' ? 'bg-gray-900' : 'bg-[#ee2e24]'}`}>
                  Tu QR se genera en automático al ingresar un valor en este campo
                  <div className={`absolute top-full right-1.5 w-2 h-2 rotate-45 -translate-y-1 ${activeTab === 'yoshi' ? 'bg-gray-900' : 'bg-[#ee2e24]'}`}></div>
                </div>
              </div>
            </div>
            <div className="relative flex items-center">
              <input 
                type="text" 
                name="codigo" 
                value={formData.codigo} 
                onChange={handleInputChange} 
                className={`w-full px-4 py-3 bg-gray-50 border-none rounded-xl font-black text-gray-700 outline-none transition-all text-sm pr-10 ${activeTab === 'yoshi' ? 'focus:ring-2 focus:ring-[#fa005a]/10' : 'focus:ring-2 focus:ring-[#ee2e24]/10'}`} 
                placeholder="tick-..." 
              />
              {formData.codigo && (
                <button 
                  onClick={() => setFormData(prev => ({ ...prev, codigo: '' }))}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 transition-colors ${activeTab === 'yoshi' ? 'hover:text-[#fa005a]' : 'hover:text-[#ee2e24]'}`}
                  title="Limpiar código"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-3" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1.5 ml-1 tracking-[0.2em]">Válido en Recinto</label>
            <div className="relative flex items-center">
              <input 
                type="text" 
                name="valido" 
                value={formData.valido} 
                onChange={handleInputChange} 
                className={`w-full px-4 py-3 bg-gray-50 border-none rounded-xl font-black text-gray-700 outline-none transition-all text-sm ${activeTab === 'yoshi' ? 'focus:ring-2 focus:ring-[#fa005a]/10' : 'focus:ring-2 focus:ring-[#ee2e24]/10'}`} 
                placeholder="Ej. Auditorio Nacional" 
              />
            </div>
          </div>

          {showPreview && (
            <div className="mt-6 pt-6 border-t border-gray-100 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="relative group">
                <input 
                  type="tel" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleInputChange} 
                  className={`w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-black text-gray-800 outline-none transition-all text-xs text-center ${activeTab === 'yoshi' ? 'focus:ring-2 focus:ring-[#fa005a]/20' : 'focus:ring-2 focus:ring-[#ee2e24]/20'}`} 
                  placeholder="WhatsApp (Ej: 521...)" 
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={handleSendSingle} 
                  disabled={isProcessing}
                  className={`${activeTab === 'yoshi' ? 'bg-[#fa005a]/90' : 'bg-[#ee2e24]/90'} text-white font-black rounded-2xl h-14 shadow-lg active:scale-95 transition-all disabled:opacity-50 flex flex-col items-center justify-center gap-1 overflow-hidden group relative`}
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-active:translate-y-0 transition-transform duration-300"></div>
                  <svg className="w-4 h-4 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span className="text-[7px] uppercase tracking-[0.1em] relative z-10">WhatsApp</span>
                </button>

                <button 
                  onClick={handleCopyToClipboard} 
                  disabled={isProcessing}
                  className={`bg-gray-100/80 text-gray-800 font-black rounded-2xl h-14 shadow-lg active:scale-95 transition-all disabled:opacity-50 flex flex-col items-center justify-center gap-1 overflow-hidden group relative border ${activeTab === 'yoshi' ? 'border-gray-200/50' : 'border-[#ee2e24]/20'}`}
                >
                  <div className="absolute inset-0 bg-gray-200 translate-y-full group-active:translate-y-0 transition-transform duration-300"></div>
                  <svg className="w-4 h-4 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[7px] uppercase tracking-[0.1em] relative z-10">Copiar</span>
                </button>
                
                <button 
                  onClick={handleShare} 
                  disabled={isProcessing}
                  className={`${activeTab === 'yoshi' ? 'bg-gray-900/80' : 'bg-[#ee2e24]/80'} text-white font-black rounded-2xl h-14 shadow-lg active:scale-95 transition-all disabled:opacity-50 flex flex-col items-center justify-center gap-1 overflow-hidden group relative`}
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-active:translate-y-0 transition-transform duration-300"></div>
                  <svg className="w-4 h-4 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span className="text-[7px] uppercase tracking-[0.1em] relative z-10">Compartir</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPreview && (
          <div className="w-full max-w-md animate-in fade-in slide-in-from-right-10 duration-700 pb-20">
            <TicketPreview data={formData} innerRef={ticketRef} activeTab={activeTab} />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
