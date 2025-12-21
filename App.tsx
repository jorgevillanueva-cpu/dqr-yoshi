
import React, { useState, useRef, useEffect } from 'react';
import { TicketPreview, YoshiLogo } from './components/TicketPreview';
import { TicketData } from './types';
import html2canvas from 'html2canvas';
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  const [formData, setFormData] = useState<TicketData>({
    saldo: '',
    codigo: '',
    phone: ''
  });
  const [showPreview, setShowPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'success' | 'error'>('idle');
  
  // Estado para Notificaciones Pop (Toasts)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  // Estados para Cámara y OCR
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [extractedCodes, setExtractedCodes] = useState<string[]>([]);

  const ticketRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Efecto para desvanecer el toast automáticamente
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showPopMessage = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const formatWithCommas = (value: string) => {
    const cleanValue = value.replace(/[^\d.]/g, '');
    const parts = cleanValue.split('.');
    if (parts.length > 2) return formData.saldo;
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join('.');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let processedValue = value;
    if (name === 'codigo') processedValue = value.toLowerCase();
    else if (name === 'saldo') processedValue = formatWithCommas(value);
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

  const startCamera = async () => {
    setIsCameraOpen(true);
    setExtractedCodes([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      showPopMessage("No se pudo acceder a la cámara. Revisa los permisos.", 'error');
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
    setIsScanning(false);
  };

  const captureAndExtract = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsScanning(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context?.drawImage(video, 0, 0);
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{
          parts: [
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
            { text: "Extract any alphanumeric reference codes or IDs from this image. Return them as a simple comma-separated list. Only return the codes." }
          ]
        }]
      });

      const text = response.text || "";
      const results = text.split(',')
        .map(s => s.trim())
        .filter(s => s.length > 3);
      
      if (results.length > 0) {
        setExtractedCodes(results);
        showPopMessage("Códigos detectados con éxito", 'success');
      } else {
        showPopMessage("No se detectaron códigos claros. Intenta de nuevo.", 'info');
      }
    } catch (err) {
      console.error(err);
      showPopMessage("Error al procesar la imagen.", 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const selectCode = (code: string) => {
    setFormData(prev => ({ ...prev, codigo: code.toLowerCase() }));
    stopCamera();
    showPopMessage("Código seleccionado", 'success');
  };

  const handleGenerate = () => {
    if (!formData.codigo.trim()) {
      showPopMessage("Por favor, introduce un código", 'info');
      return;
    }
    formatSaldoOnComplete();
    setShowPreview(true);
    showPopMessage("Ticket generado", 'success');
  };

  const handleClear = () => {
    setFormData({ saldo: '', codigo: '', phone: '' });
    setShowPreview(false);
    showPopMessage("Datos limpiados");
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
        const file = new File([blob], `Yoshi-${formData.codigo}.png`, { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Ticket Yoshi Cash' });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); 
          a.href = url; 
          a.download = `Yoshi-${formData.codigo}.png`; 
          a.click();
          URL.revokeObjectURL(url);
          showPopMessage("Descarga iniciada", 'success');
        }
      }
<<<<<<< HEAD
    } catch (e) {
      console.log("Acción de compartir cancelada u omitida.");
    } finally {
      setIsProcessing(false);
    }
=======
    } 
>>>>>>> 52c720916d8b7d0509bed2f2bf4261545d6525c7
  };

  const handleSend = async () => {
    if (!formData.phone) { 
      showPopMessage("Número de WhatsApp requerido", 'info'); 
      return; 
    }
    const phoneToOpen = formData.phone.replace(/\D/g, '');
    setIsProcessing(true);
    setCopyStatus('copying');
    try {
      const blob = await getTicketBlob();
      if (blob && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopyStatus('success');
        showPopMessage("Imagen copiada, abriendo WhatsApp", 'success');
        setTimeout(() => {
          window.open(`https://wa.me/${phoneToOpen}`, '_blank');
          setCopyStatus('idle');
          setFormData(prev => ({ ...prev, phone: '' }));
        }, 800);
      } else {
        window.open(`https://wa.me/${phoneToOpen}`, '_blank');
        setFormData(prev => ({ ...prev, phone: '' }));
      }
    } catch (e) {
      window.open(`https://wa.me/${phoneToOpen}`, '_blank');
      setFormData(prev => ({ ...prev, phone: '' }));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-24 px-4 overflow-y-auto">
      {/* Toast Notification Layer */}
      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-sm pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md ${
            toast.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' : 
            toast.type === 'success' ? 'bg-[#bd004d]/90 border-[#bd004d]/30 text-white' : 
            'bg-gray-900/90 border-gray-700 text-white'
          }`}>
            <div className="flex-1 text-sm font-bold tracking-tight">
              {toast.message}
            </div>
          </div>
        </div>
      )}

      <header className="py-10 text-center flex flex-col items-center">
        <div className="bg-white p-4 rounded-3xl shadow-md mb-4 border border-gray-100/50">
          <YoshiLogo className="h-14 w-14" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 font-title tracking-tight">Digitalizador QR</h1>
        <p className="text-[#bd004d] font-black uppercase tracking-widest text-[10px] mt-1">Yoshi Cash</p>
      </header>

      <div className="space-y-6">
        <div className="bg-white rounded-[2.5rem] p-7 shadow-xl border border-gray-100">
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-gray-400 ml-1 uppercase block mb-2 tracking-widest">Saldo Actual (Opcional)</label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                <input 
                  type="text" 
                  name="saldo" 
                  value={formData.saldo} 
                  onChange={handleInputChange} 
                  onBlur={formatSaldoOnComplete} 
                  inputMode="decimal"
                  className="w-full pl-10 pr-5 py-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-[#bd004d]/10 font-bold text-gray-700 transition-all" 
                  placeholder="0.00" 
                />
              </div>
            </div>
            
            <div>
              <label className="text-[10px] font-black text-gray-400 ml-1 uppercase block mb-2 tracking-widest">Ingresa Código de Ticket</label>
              <div className="relative flex items-center">
                <input 
                  type="text" 
                  name="codigo" 
                  value={formData.codigo} 
                  onChange={handleInputChange} 
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl outline-none lowercase focus:ring-2 focus:ring-[#bd004d]/10 font-bold text-gray-700 transition-all pr-14" 
                  placeholder="ej: ticket123" 
                />
                <button 
                  onClick={startCamera}
                  className="absolute right-2 p-2.5 text-[#bd004d] hover:bg-gray-100 rounded-xl transition-colors"
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
                className="flex-1 py-3.5 bg-[#bd004d] text-white font-black rounded-2xl shadow-[0_10px_25px_rgba(189,0,77,0.3)] active:scale-95 transition-all text-xs uppercase tracking-[0.2em]"
              >
                Generar Ticket
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

        {/* Modal de Cámara */}
        {isCameraOpen && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
            <div className="relative w-full max-w-sm aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline />
              {isScanning && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-[#bd004d] border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            
            <div className="w-full max-w-sm mt-6 flex flex-col gap-4">
              {extractedCodes.length > 0 ? (
                <div className="bg-white rounded-2xl p-4 max-h-48 overflow-y-auto shadow-lg">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Resultados detectados:</p>
                  <div className="flex flex-wrap gap-2">
                    {extractedCodes.map((code, idx) => (
                      <button 
                        key={idx}
                        onClick={() => selectCode(code)}
                        className="px-4 py-2 bg-[#bd004d]/5 border border-[#bd004d]/20 rounded-lg text-[#bd004d] font-bold text-sm"
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button 
                  onClick={captureAndExtract}
                  disabled={isScanning}
                  className="w-full py-4 bg-white text-[#bd004d] font-black rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-sm"
                >
                  {isScanning ? "Escaneando..." : "Capturar Código"}
                </button>
              )}
              
              <button 
                onClick={stopCamera}
                className="w-full py-3 text-white/60 font-bold uppercase tracking-widest text-xs"
              >
                Cancelar
              </button>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {showPreview && (
          <div className="space-y-6 pb-20 animate-in fade-in zoom-in-95 duration-500">
            <TicketPreview data={formData} innerRef={ticketRef} />
            
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 space-y-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2.5 ml-1">WhatsApp del Cliente</label>
                <input 
                  type="tel" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleInputChange} 
                  className="w-full px-6 py-4.5 bg-gray-50 border-none rounded-2xl outline-none font-black text-gray-700 focus:ring-2 focus:ring-[#bd004d]/10 transition-all" 
                  placeholder="Ej: 521..." 
                />
              </div>
              
              <div className="flex flex-col gap-3.5">
                <button 
                  onClick={handleSend} 
                  disabled={isProcessing} 
                  className="w-full py-4 bg-[#bd004d] text-white font-black rounded-2xl shadow-[0_15px_35px_rgba(189,0,77,0.35)] active:scale-95 transition-all text-sm uppercase tracking-[0.25em] disabled:opacity-50 h-16"
                >
                  {isProcessing ? "Procesando..." : "Enviar"}
                </button>
                
                <button 
                  onClick={handleShare} 
                  disabled={isProcessing} 
                  className="w-full py-4 bg-[#bd004d] text-white font-black rounded-2xl shadow-[0_15px_35px_rgba(189,0,77,0.35)] active:scale-95 transition-all text-sm uppercase tracking-[0.25em] disabled:opacity-50 h-16"
                >
                  Compartir
                </button>
              </div>
              
              {copyStatus === 'success' && (
                <div className="flex items-center justify-center gap-2.5 py-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                  <p className="text-[10px] text-green-600 font-black uppercase tracking-widest">¡Listo para compartir!</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
