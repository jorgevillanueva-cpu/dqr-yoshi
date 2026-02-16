
import React, { useState, useRef, useEffect } from 'react';
import { TicketPreview, YoshiLogo } from './components/TicketPreview';
import { ScannerModule } from './components/ScannerModule';
import { TicketData } from './types';
import html2canvas from 'html2canvas';

const App: React.FC = () => {
  // Estado para Tickets de Efectivo
  const [formData, setFormData] = useState<TicketData>({
    saldo: '',
    codigo: '',
    phone: '',
    valido: '',
    cortesia: false,
    showExtraData: false,
    extraData: ''
  });
  const [showPreview, setShowPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'saldo' | 'codigo'>('codigo');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
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

  const openScanner = (target: 'saldo' | 'codigo') => {
    setScannerTarget(target);
    setIsScannerOpen(true);
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
    } else {
      if (name === 'saldo') {
        // Permitir solo números y un punto
        const clean = value.replace(/[^0-9.]/g, '');
        const dots = clean.split('.');
        let finalClean = clean;
        if (dots.length > 2) {
          finalClean = dots[0] + '.' + dots.slice(1).join('');
        }
        processed = formatCommas(finalClean);
      }
      if (name === 'codigo') processed = value.toLowerCase();
    }
    setFormData(prev => ({ ...prev, [name]: processed }));
  };

  const formatSaldoOnComplete = () => {
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

  const handleGenerate = () => {
    if (!formData.codigo.trim()) return showPopMessage("Código de ticket requerido", "error");
    formatSaldoOnComplete();
    setShowPreview(true);
    showPopMessage("Ticket generado con éxito", "success");
    setTimeout(() => {
      ticketRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleClear = () => {
    setFormData({ 
      saldo: '', 
      codigo: '', 
      phone: '', 
      valido: '', 
      cortesia: false, 
      showExtraData: false, 
      extraData: '' 
    });
    setShowPreview(false);
    showPopMessage("Campos limpiados");
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

  const handleShare = async () => {
    const el = ticketRef.current;
    if (!el) return;
    setIsProcessing(true);
    try {
      const canvas = await html2canvas(el, { scale: 3, useCORS: true });
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
      if (blob) {
        const file = new File([blob], `Yoshi-${formData.codigo || 'ticket'}.png`, { type: 'image/png' });
        if (navigator.share) {
          await navigator.share({ files: [file], title: 'Yoshi Cash Ticket' });
        } else {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `Yoshi-${formData.codigo}.png`;
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
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-40 px-4 overflow-y-auto relative">
      {/* Banner de Instalación PWA */}
      {showInstallBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-[150] p-4 animate-in slide-in-from-bottom duration-500">
          <div className="bg-white rounded-[2rem] p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border border-gray-100 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-[#d6045b]/10 p-2.5 rounded-2xl">
                <YoshiLogo className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-gray-900 leading-tight">Instalar Yoshi Cash</h3>
                <p className="text-[10px] text-gray-500 font-medium leading-tight">Acceso rápido y offline desde tu pantalla de inicio.</p>
              </div>
              <button 
                onClick={() => setShowInstallBanner(false)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            {isIOS ? (
              <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-center gap-2">
                <span className="text-[10px] font-bold text-gray-600 text-center">
                  Toca <svg className="w-4 h-4 inline mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg> y luego <span className="text-[#d6045b]">"Añadir a pantalla de inicio"</span>
                </span>
              </div>
            ) : (
              <button 
                onClick={handleInstallClick}
                className="w-full bg-[#d6045b] text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-[#d6045b]/20 active:scale-[0.98] transition-all"
              >
                Instalar Ahora
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
          <div className={`px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border ${toast.type === 'error' ? 'bg-red-500 text-white border-red-400' : 'bg-[#d6045b] text-white border-[#d6045b]/30'}`}>
            <div className="flex-1 text-[11px] font-bold tracking-tight">{toast.message}</div>
          </div>
        </div>
      )}

      {isScannerOpen && (
        <ScannerModule 
          onClose={() => setIsScannerOpen(false)} 
          showPopMessage={showPopMessage} 
          onCodeSelected={(c) => {
            if (scannerTarget === 'codigo') setFormData(prev => ({ ...prev, codigo: c.toLowerCase() }));
            else {
               const clean = c.replace(/[^\d.]/g, '');
               setFormData(prev => ({ ...prev, saldo: formatCommas(clean) }));
            }
            setIsScannerOpen(false);
          }} 
        />
      )}

      <header className="py-6 text-center flex flex-col items-center">
        <div className="bg-white p-3 rounded-[1.8rem] shadow-sm mb-2 border border-gray-100/50">
          <YoshiLogo className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tighter">Yoshi Cash</h1>
      </header>

      <div className="space-y-4">
        <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-gray-100 space-y-4">
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1.5 ml-1 tracking-[0.2em]">Saldo (Opcional)</label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-gray-400 font-bold text-sm">$</span>
              <input 
                type="text" 
                name="saldo" 
                value={formData.saldo} 
                onChange={handleInputChange} 
                onBlur={formatSaldoOnComplete}
                className="w-full pl-8 pr-4 py-3 bg-gray-50 border-none rounded-xl font-black text-gray-700 outline-none focus:ring-2 focus:ring-[#d6045b]/10 transition-all text-sm" 
                placeholder="0.00" 
                inputMode="decimal"
              />
            </div>
          </div>

          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1.5 ml-1 tracking-[0.2em]">Código del Ticket</label>
            <div className="relative flex items-center">
              <input 
                type="text" 
                name="codigo" 
                value={formData.codigo} 
                onChange={handleInputChange} 
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl font-black text-gray-700 outline-none focus:ring-2 focus:ring-[#d6045b]/10 transition-all pr-12 text-sm" 
                placeholder="tick-..." 
              />
              <button 
                onClick={() => openScanner('codigo')} 
                className="absolute right-2 p-2 text-[#d6045b] hover:bg-[#d6045b]/5 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <circle cx="12" cy="13" r="3" strokeWidth="2.5" />
                </svg>
              </button>
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
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl font-black text-gray-700 outline-none focus:ring-2 focus:ring-[#d6045b]/10 transition-all text-sm" 
                placeholder="Ej. Auditorio Nacional" 
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-1">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="cortesia"
                name="cortesia" 
                checked={formData.cortesia} 
                onChange={handleInputChange} 
                className="w-5 h-5 rounded-md accent-[#d6045b] cursor-pointer"
              />
              <label htmlFor="cortesia" className="text-[9px] font-black text-gray-600 uppercase tracking-widest cursor-pointer select-none">
                Cortesía
              </label>
            </div>
            
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="showExtraData"
                name="showExtraData" 
                checked={formData.showExtraData} 
                onChange={handleInputChange} 
                className="w-5 h-5 rounded-md accent-[#d6045b] cursor-pointer"
              />
              <label htmlFor="showExtraData" className="text-[9px] font-black text-gray-600 uppercase tracking-widest cursor-pointer select-none">
                Personalizar
              </label>
            </div>
          </div>

          {formData.showExtraData && (
            <div className="animate-in slide-in-from-top-2 duration-300">
              <input 
                type="text" 
                name="extraData" 
                value={formData.extraData} 
                onChange={handleInputChange} 
                className="w-full px-4 py-2 bg-gray-50 border-b-2 border-[#d6045b]/20 rounded-lg font-bold text-gray-700 outline-none focus:border-[#d6045b] transition-all text-xs text-center" 
                placeholder="Nombre o característica extra..." 
              />
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button 
              onClick={handleGenerate} 
              className="flex-1 bg-[#d6045b] text-white py-3.5 rounded-xl font-black shadow-lg shadow-[#d6045b]/20 active:scale-95 transition-transform uppercase tracking-widest text-[11px]"
            >
              GENERAR TICKET
            </button>
            <button 
              onClick={handleClear} 
              className="px-5 py-3.5 bg-gray-100 text-gray-400 rounded-xl active:scale-95 transition-all hover:bg-gray-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {showPreview && (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 pb-20">
            <TicketPreview data={formData} innerRef={ticketRef} />
          </div>
        )}
      </div>

      {showPreview && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-[400px] z-50 animate-in slide-in-from-bottom-10 duration-700 ease-out">
          <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-4 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white/40 space-y-3">
            <div className="relative group">
              <input 
                type="tel" 
                name="phone" 
                value={formData.phone} 
                onChange={handleInputChange} 
                className="w-full px-5 py-3 bg-gray-50/50 border border-gray-100 rounded-2xl font-black text-gray-800 outline-none focus:ring-2 focus:ring-[#d6045b]/20 transition-all text-xs text-center" 
                placeholder="Introducir WhatsApp (Ej: 521...)" 
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={handleSendSingle} 
                disabled={isProcessing}
                className="bg-[#d6045b] text-white font-black rounded-2xl h-14 shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 overflow-hidden group relative"
              >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-active:translate-y-0 transition-transform duration-300"></div>
                <svg className="w-5 h-5 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span className="text-[10px] uppercase tracking-[0.2em] relative z-10">Enviar a WA</span>
              </button>
              
              <button 
                onClick={handleShare} 
                disabled={isProcessing}
                className="bg-gray-900 text-white font-black rounded-2xl h-14 shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 overflow-hidden group relative"
              >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-active:translate-y-0 transition-transform duration-300"></div>
                <svg className="w-5 h-5 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span className="text-[10px] uppercase tracking-[0.2em] relative z-10">Compartir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
