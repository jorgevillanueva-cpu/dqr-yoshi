
import React, { useState, useRef, useEffect } from 'react';
import { TicketPreview, YoshiLogo } from './components/TicketPreview';
import { ScannerModule } from './components/ScannerModule';
import { TicketData } from './types';
import html2canvas from 'html2canvas';

const App: React.FC = () => {
  const [formData, setFormData] = useState<TicketData>({
    saldo: '',
    codigo: '',
    phone: ''
  });
  const [showPreview, setShowPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  const ticketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showPopMessage = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let processedValue = value;
    if (name === 'codigo') processedValue = value.toLowerCase();
    else if (name === 'saldo') {
      const clean = value.replace(/[^\d.]/g, '');
      const parts = clean.split('.');
      if (parts.length > 2) return;
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      processedValue = parts.join('.');
    }
    setFormData(prev => ({ ...prev, [name]: processedValue }));
  };

  const formatSaldoOnComplete = () => {
    let value = formData.saldo.trim();
    if (value === '') return;
    if (!value.includes('.')) value = value + '.00';
    else {
      const parts = value.split('.');
      if (parts[1].length === 0) value = value + '00';
      else if (parts[1].length === 1) value = value + '0';
      else if (parts[1].length > 2) value = parts[0] + '.' + parts[1].substring(0, 2);
    }
    setFormData(prev => ({ ...prev, saldo: value }));
  };

  const handleGenerate = () => {
    if (!formData.codigo.trim()) {
      showPopMessage("Ingresa Código de Ticket", 'info');
      return;
    }
    formatSaldoOnComplete();
    setShowPreview(true);
    showPopMessage("Ticket generado", 'success');
  };

  const handleClear = () => {
    setFormData({ saldo: '', codigo: '', phone: '' });
    setShowPreview(false);
    showPopMessage("Reseteado con éxito");
  };

  const getTicketBlob = async (): Promise<Blob | null> => {
    if (!ticketRef.current) return null;
    const canvas = await html2canvas(ticketRef.current, { 
      scale: 3, 
      backgroundColor: '#F9FAFB', 
      useCORS: true,
      logging: false
    });
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
  };

  const handleShare = async () => {
    setIsProcessing(true);
    try {
      const blob = await getTicketBlob();
      if (blob) {
        const file = new File([blob], `Yoshi-${formData.codigo || 'ticket'}.png`, { type: 'image/png' });
        
        // Intento de compartir nativo (iOS/Android)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ 
            files: [file], 
            title: 'Ticket Yoshi Cash',
            text: `Ticket generado: ${formData.codigo}`
          });
        } else {
          // Fallback descarga
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); 
          a.href = url; 
          a.download = `Yoshi-${formData.codigo}.png`; 
          a.click();
          URL.revokeObjectURL(url);
          showPopMessage("Imagen guardada", 'success');
        }
      }
    } catch (e) {
      console.error(e);
      showPopMessage("Error al compartir", 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = async () => {
    if (!formData.phone) { showPopMessage("Ingresa un número", 'info'); return; }
    const phoneToOpen = formData.phone.replace(/\D/g, '');
    setIsProcessing(true);
    try {
      const blob = await getTicketBlob();
      if (blob && navigator.clipboard?.write) {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        showPopMessage("Copiado. Pégalo en WhatsApp.", 'success');
        setTimeout(() => window.open(`https://wa.me/${phoneToOpen}`, '_blank'), 1000);
      } else {
        window.open(`https://wa.me/${phoneToOpen}`, '_blank');
      }
    } catch (e) {
      window.open(`https://wa.me/${phoneToOpen}`, '_blank');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-24 px-4 overflow-y-auto">
      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-sm pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md ${
            toast.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' : 
            toast.type === 'success' ? 'bg-[#bd004d]/90 border-[#bd004d]/30 text-white' : 
            'bg-gray-900/90 border-gray-700 text-white'
          }`}>
            <div className="flex-1 text-sm font-bold tracking-tight">{toast.message}</div>
          </div>
        </div>
      )}

      {isScannerOpen && (
        <ScannerModule 
          onClose={() => setIsScannerOpen(false)}
          showPopMessage={showPopMessage}
          onCodeSelected={(code) => {
            setFormData(prev => ({ ...prev, codigo: code.toLowerCase() }));
            setIsScannerOpen(false);
          }}
        />
      )}

      <header className="py-10 text-center flex flex-col items-center">
        <div className="bg-white p-4 rounded-3xl shadow-md mb-4 border border-gray-100/50">
          <YoshiLogo className="h-14 w-14" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 font-title tracking-tight">Yoshi Cash</h1>
        <p className="text-[#bd004d] font-black uppercase tracking-widest text-[10px] mt-1">Digitalizador de QR</p>
      </header>

      <div className="space-y-6">
        <div className="bg-white rounded-[2.5rem] p-7 shadow-xl border border-gray-100">
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-gray-400 ml-1 uppercase block mb-2 tracking-widest">Saldo (Opcional)</label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                <input 
                  type="text" name="saldo" value={formData.saldo} 
                  onChange={handleInputChange} onBlur={formatSaldoOnComplete} inputMode="decimal"
                  className="w-full pl-10 pr-5 py-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-[#bd004d]/10 font-bold text-gray-700 transition-all" 
                  placeholder="0.00" 
                />
              </div>
            </div>
            
            <div>
              <label className="text-[10px] font-black text-gray-400 ml-1 uppercase block mb-2 tracking-widest">Ticket</label>
              <div className="relative flex items-center">
                <input 
                  type="text" name="codigo" value={formData.codigo} onChange={handleInputChange} 
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl outline-none lowercase focus:ring-2 focus:ring-[#bd004d]/10 font-bold text-gray-700 transition-all pr-14" 
                  placeholder="Código o referencia" 
                />
                <button 
                  onClick={() => setIsScannerOpen(true)}
                  className="absolute right-2 p-2.5 text-[#bd004d] hover:bg-gray-100 rounded-xl transition-colors"
                  title="Escanear Ticket"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button 
                onClick={handleGenerate} 
                className="flex-1 py-4.5 bg-[#bd004d] text-white font-black rounded-2xl shadow-[0_10px_25px_rgba(189,0,77,0.3)] active:scale-95 transition-all text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm-3 0h2v3h-2v-3zm3 3h3v2h-3v-2zm-3 2h2v3h-2v-3zm3 1h3v2h-3v-2zm-3-3h3v2h-3v-2zm6-6h3v2h-3V7z" />
                </svg>
                Generar QR
              </button>
              <button 
                onClick={handleClear} 
                className="px-5 bg-gray-100 text-gray-400 rounded-2xl hover:bg-gray-200 transition-colors active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {showPreview && (
          <div className="space-y-6 pb-20 animate-in fade-in zoom-in-95 duration-500">
            <TicketPreview data={formData} innerRef={ticketRef} />
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 space-y-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2.5 ml-1">WhatsApp de Envío</label>
                <input 
                  type="tel" name="phone" value={formData.phone} onChange={handleInputChange} 
                  className="w-full px-6 py-4.5 bg-gray-50 border-none rounded-2xl outline-none font-black text-gray-700 focus:ring-2 focus:ring-[#bd004d]/10 transition-all" 
                  placeholder="521..." 
                />
              </div>
              <div className="flex flex-col gap-3.5">
                <button 
                  onClick={handleSend} disabled={isProcessing} 
                  className="w-full py-5 bg-[#bd004d] text-white font-black rounded-2xl shadow-[0_15px_35px_rgba(189,0,77,0.35)] active:scale-95 transition-all text-sm uppercase tracking-[0.25em] h-16 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.025 3.212l-.545 2.031 2.087-.54c.951.608 2.256.924 3.201.924 3.181 0 5.767-2.586 5.768-5.766.001-3.18-2.585-5.767-5.768-5.767zm3.349 8.232c-.185.518-1.078.938-1.568.997-.455.051-.9-.136-2.891-.959-1.992-.823-3.275-2.854-3.374-2.988-.1-.133-.806-1.072-.806-2.046 0-.974.506-1.453.687-1.651.182-.198.396-.248.528-.248.132 0 .264.001.379.006.121.005.286-.046.446.338.162.384.557 1.357.606 1.456.048.099.08.214.015.343-.065.13-.098.225-.197.34-.099.115-.208.256-.296.346-.099.101-.202.211-.087.408.115.197.51 1.341 1.097 1.863.588.522 1.085.683 1.284.782.199.099.314.083.43-.05.117-.133.504-.585.638-.784.133-.199.268-.166.448-.099.179.066 1.138.536 1.336.635.198.1.33.15.379.233.049.084.049.484-.136 1.002z"/>
                  </svg>
                  Enviar
                </button>
                <button 
                  onClick={handleShare} disabled={isProcessing} 
                  className="w-full py-5 bg-[#bd004d] text-white font-black rounded-2xl shadow-[0_15px_35px_rgba(189,0,77,0.3)] active:scale-95 transition-all text-sm uppercase tracking-[0.25em] h-16 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Compartir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
