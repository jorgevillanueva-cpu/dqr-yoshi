
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
  const [scannerTarget, setScannerTarget] = useState<'saldo' | 'codigo'>('codigo');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  const ticketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
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

  const openScanner = (target: 'saldo' | 'codigo') => {
    setScannerTarget(target);
    setIsScannerOpen(true);
  };

  const handleGenerate = () => {
    if (!formData.codigo.trim()) {
      showPopMessage("Ingresa el Ticket", 'info');
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

  const processAndShareTicket = async (isGeneralShare: boolean = true) => {
    if (!ticketRef.current) return;
    setIsProcessing(true);
    try {
      const canvas = await html2canvas(ticketRef.current, { 
        scale: 3, 
        backgroundColor: '#F9FAFB', 
        useCORS: true,
        logging: false
      });

      canvas.toBlob(async (blob) => {
        if (blob) {
          const fileName = `Yoshi-${formData.codigo || 'Ticket'}.png`;
          const file = new File([blob], fileName, { type: 'image/png' });
          
          const shareText = isGeneralShare 
            ? `Ticket Yoshi Cash - Ticket: ${formData.codigo}`
            : `Ticket para el número: ${formData.phone}\nTicket: ${formData.codigo}`;

          const shareData: ShareData = {
            files: [file],
            title: 'Yoshi Cash Ticket',
            text: shareText
          };

          if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share(shareData);
          } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
            showPopMessage("Descargado correctamente", 'success');
          }
        }
      }, 'image/png', 1.0);
    } catch (e) {
      showPopMessage("Error al procesar ticket", 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = async () => {
    if (!formData.phone || formData.phone.trim().length < 10) {
      showPopMessage("Ingresa un teléfono válido de 10 dígitos", 'error');
      return;
    }

    if (!ticketRef.current) return;
    setIsProcessing(true);

    try {
      const canvas = await html2canvas(ticketRef.current, { 
        scale: 3, 
        backgroundColor: '#F9FAFB', 
        useCORS: true,
        logging: false
      });

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
      
      if (blob) {
        try {
          if (navigator.clipboard && navigator.clipboard.write) {
            const data = [new ClipboardItem({ [blob.type]: blob })];
            await navigator.clipboard.write(data);
            showPopMessage("¡Ticket copiado! Pégalo en WhatsApp", 'success');
          } else {
            showPopMessage("Imagen generada. Abriendo WhatsApp...", 'info');
          }
        } catch (clipboardErr) {
          console.warn("Clipboard error, continuing to WhatsApp:", clipboardErr);
        }

        const cleanPhone = formData.phone.replace(/\D/g, '');
        const waUrl = `https://wa.me/${cleanPhone}`;
        window.open(waUrl, '_blank');
      }
    } catch (e) {
      showPopMessage("Error al procesar el ticket", 'error');
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-24 px-4 overflow-y-auto relative">
      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-sm pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md ${
            toast.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' : 
            toast.type === 'success' ? 'bg-[#bd004d]/90 border-[#bd004d]/30 text-white' : 
            'bg-gray-900/90 border-gray-700 text-white'
          }`}>
            <div className="flex-1 text-xs font-bold tracking-tight leading-relaxed">{toast.message}</div>
          </div>
        </div>
      )}

      {isScannerOpen && (
        <ScannerModule 
          onClose={() => setIsScannerOpen(false)}
          showPopMessage={showPopMessage}
          onCodeSelected={(code) => {
            if (scannerTarget === 'codigo') {
              setFormData(prev => ({ ...prev, codigo: code.toLowerCase() }));
            } else {
              const cleanValue = code.replace(/[^\d.]/g, '');
              setFormData(prev => ({ ...prev, saldo: cleanValue }));
            }
            setIsScannerOpen(false);
          }}
        />
      )}

      <header className="py-12 text-center flex flex-col items-center relative">
        <div className="bg-white p-5 rounded-[2rem] shadow-sm mb-4 border border-gray-100/50">
          <YoshiLogo className="h-14 w-14" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 font-title tracking-tight">Yoshi Cash</h1>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
          <p className="text-[#bd004d] font-black uppercase tracking-widest text-[9px]">Generador de Tickets Digitales</p>
        </div>
      </header>

      <div className="space-y-6">
        <div className="bg-white rounded-[2.5rem] p-7 shadow-xl border border-gray-100">
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-gray-400 ml-1 uppercase block mb-2 tracking-widest">SALDO (OPCIONAL)</label>
              <div className="relative flex items-center">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                <input 
                  type="text" name="saldo" value={formData.saldo} 
                  onChange={handleInputChange} onBlur={formatSaldoOnComplete} inputMode="decimal"
                  className="w-full pl-10 pr-5 py-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-[#bd004d]/10 font-bold text-gray-700 transition-all placeholder:font-normal" 
                  placeholder="0.00" 
                />
              </div>
            </div>
            
            <div>
              <label className="text-[10px] font-black text-gray-400 ml-1 uppercase block mb-2 tracking-widest">TICKET</label>
              <div className="relative flex items-center">
                <input 
                  type="text" name="codigo" value={formData.codigo} onChange={handleInputChange} 
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl outline-none lowercase focus:ring-2 focus:ring-[#bd004d]/10 font-bold text-gray-700 transition-all pr-14 placeholder:font-normal" 
                  placeholder="Número de ticket" 
                />
                <button 
                  onClick={() => openScanner('codigo')}
                  className="absolute right-2 p-2.5 text-[#bd004d] hover:bg-[#bd004d]/5 rounded-xl transition-colors"
                  title="Escanear Ticket"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={handleGenerate}
                className="flex-1 bg-[#bd004d] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#bd004d]/20 active:scale-95 transition-transform uppercase flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                GENERAR TICKET
              </button>
              <button 
                onClick={handleClear}
                className="px-6 py-4 bg-gray-100 text-gray-400 rounded-2xl active:scale-95 transition-transform flex items-center justify-center hover:bg-gray-200"
                title="Limpiar campos"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {showPreview && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <TicketPreview data={formData} innerRef={ticketRef} />
            
            <div className="bg-white rounded-[2.5rem] p-7 shadow-xl border border-gray-100 space-y-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 ml-1 uppercase block mb-2 tracking-widest">WhatsApp de Envío (Teléfono)</label>
                <input 
                  type="tel" name="phone" value={formData.phone} onChange={handleInputChange}
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl outline-none font-bold text-gray-700 focus:ring-2 focus:ring-[#bd004d]/10 transition-all placeholder:font-normal" 
                  placeholder="Ej: 521..." 
                />
              </div>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleSend}
                  disabled={isProcessing}
                  className="w-full h-16 bg-[#bd004d] text-white font-black rounded-2xl shadow-[0_15px_35px_rgba(189,0,77,0.35)] active:scale-95 transition-all text-sm uppercase tracking-[0.25em] flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      Enviar a WhatsApp
                    </>
                  )}
                </button>
                <button 
                  onClick={() => processAndShareTicket(true)}
                  disabled={isProcessing}
                  className="w-full h-16 bg-[#bd004d] text-white font-black rounded-2xl shadow-[0_15px_35px_rgba(189,0,77,0.35)] active:scale-95 transition-all text-sm uppercase tracking-[0.25em] flex items-center justify-center gap-3 disabled:opacity-50"
                >
                   {isProcessing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      COMPARTIR
                    </>
                  )}
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
