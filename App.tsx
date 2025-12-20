
import React, { useState, useRef, useEffect } from 'react';
import { TicketPreview, YoshiLogo } from './components/TicketPreview';
import { TicketData } from './types';
import { COLORS } from './constants';
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
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [extractedTexts, setExtractedTexts] = useState<string[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const ticketRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const formatWithCommas = (value: string) => {
    const cleanValue = value.replace(/[^\d.]/g, '');
    const parts = cleanValue.split('.');
    if (parts.length > 2) return formData.saldo;
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join('.');
  };

  const handleGenerate = () => {
    if (!formData.codigo.trim()) {
      alert("Introduce el código del ticket");
      return;
    }
    formatSaldoOnComplete();
    setShowPreview(true);
    setTimeout(() => {
      document.getElementById('root')?.scrollTo({ top: document.getElementById('root')?.scrollHeight, behavior: 'smooth' });
    }, 300);
  };

  const handleClear = () => {
    setFormData({ saldo: '', codigo: '', phone: '' });
    setShowPreview(false);
    document.getElementById('root')?.scrollTo({ top: 0, behavior: 'smooth' });
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
    setExtractedTexts([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      alert("No se pudo activar la cámara. Revisa los permisos.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const captureAndExtract = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsScanning(true);
    const context = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context?.drawImage(videoRef.current, 0, 0);
    
    const base64Image = canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];

    try {
      // Inicialización dinámica para captar la API_KEY inyectada por Vercel
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
            { text: "OCR: Extrae únicamente el código alfanumérico largo del ticket. Devuelve solo los códigos encontrados, uno por línea, sin texto extra." }
          ]
        }
      });

      const text = response.text || "";
      const results = text.split('\n').map(t => t.trim()).filter(t => t.length > 3 && t.length < 32);

      setExtractedTexts(results);
      if (results.length === 0) {
        alert("No se encontró texto legible. Intenta acercar más la cámara.");
      }
    } catch (err: any) {
      console.error("Error OCR:", err);
      // Si el error es de autenticación, damos una pista clara
      if (err.message?.includes('API_KEY')) {
        alert("Error de API Key: Asegúrate de haber REDESPLEGADO en Vercel tras agregar la variable API_KEY.");
      } else {
        alert("Error de conexión. Revisa tu internet.");
      }
    } finally {
      setIsScanning(false);
    }
  };

  const selectCode = (text: string) => {
    setFormData(prev => ({ ...prev, codigo: text.toLowerCase() }));
    stopCamera();
  };

  const getTicketBlob = async (): Promise<Blob | null> => {
    if (!ticketRef.current) return null;
    const canvas = await html2canvas(ticketRef.current, { scale: 3, backgroundColor: '#F9FAFB', useCORS: true });
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
  };

  const handleShare = async () => {
    setIsProcessing(true);
    try {
      const blob = await getTicketBlob();
      if (blob) {
        const file = new File([blob], `Yoshi-${formData.codigo || 'ticket'}.png`, { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Ticket Yoshi Cash' });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); 
          a.href = url; 
          a.download = `Yoshi-${formData.codigo || 'ticket'}.png`; 
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = async () => {
    if (!formData.phone) { alert("Introduce un número de teléfono"); return; }
    setIsProcessing(true);
    setCopyStatus('copying');
    try {
      const blob = await getTicketBlob();
      if (blob && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopyStatus('success');
        setTimeout(() => {
          window.open(`https://wa.me/${formData.phone.replace(/\D/g, '')}`, '_blank');
          setCopyStatus('idle');
        }, 1200);
      } else {
        window.open(`https://wa.me/${formData.phone.replace(/\D/g, '')}`, '_blank');
      }
    } catch (e) {
      window.open(`https://wa.me/${formData.phone.replace(/\D/g, '')}`, '_blank');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20 px-4">
      <header className="py-12 text-center flex flex-col items-center">
        <div className="bg-white p-4 rounded-[2rem] shadow-lg mb-4">
          <YoshiLogo className="h-16 w-16" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 font-title">Digitalizador QR</h1>
        <p className="text-[#bd004d] font-black uppercase tracking-widest text-xs mt-1">Yoshi Cash Premium</p>
      </header>

      <div className="space-y-6">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-100">
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-gray-400 ml-1 uppercase block mb-2">Saldo (Opcional)</label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                <input 
                  type="text" 
                  name="saldo" 
                  value={formData.saldo} 
                  onChange={handleInputChange} 
                  onBlur={formatSaldoOnComplete} 
                  inputMode="decimal"
                  className="w-full pl-10 pr-5 py-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-[#bd004d]/20 transition-all font-bold text-gray-700" 
                  placeholder="0.00" 
                />
              </div>
            </div>
            
            <div>
              <label className="text-[10px] font-black text-gray-400 ml-1 uppercase block mb-2">Código del Ticket</label>
              <div className="relative flex items-center">
                <input 
                  type="text" 
                  name="codigo" 
                  value={formData.codigo} 
                  onChange={handleInputChange} 
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl outline-none lowercase focus:ring-2 focus:ring-[#bd004d]/20 transition-all font-bold text-gray-700 pr-14" 
                  placeholder="introduce el código" 
                />
                <button 
                  onClick={startCamera} 
                  className="absolute right-3 p-2.5 text-[#bd004d] bg-white rounded-xl shadow-sm active:scale-90 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={handleGenerate} 
                className="flex-1 py-4 bg-[#bd004d] text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all text-sm uppercase tracking-widest"
              >
                Generar QR
              </button>
              <button 
                onClick={handleClear} 
                className="px-5 bg-gray-100 text-gray-400 rounded-2xl hover:bg-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {isCameraOpen && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col">
            <div className="relative flex-1">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-72 h-32 border-2 border-white/60 rounded-3xl relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#bd004d] -mt-1 -ml-1 rounded-tl-lg"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#bd004d] -mt-1 -mr-1 rounded-tr-lg"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#bd004d] -mb-1 -ml-1 rounded-bl-lg"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#bd004d] -mb-1 -mr-1 rounded-br-lg"></div>
                </div>
              </div>
              <button onClick={stopCamera} className="absolute top-10 right-6 p-3 bg-black/50 rounded-full text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="bg-white p-10 rounded-t-[3rem] -mt-12 relative z-10 flex flex-col items-center min-h-[340px]">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-10"></div>
              {!isScanning && extractedTexts.length === 0 && (
                <button 
                  onClick={captureAndExtract} 
                  className="w-24 h-24 rounded-full bg-[#bd004d] shadow-2xl flex items-center justify-center text-white active:scale-90 transition-all"
                >
                  <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 9a3 3 0 100 6 3 3 0 000-6z" /><path fillRule="evenodd" d="M5.93 5.417C7.625 3.167 10.334 2 12 2c1.667 0 4.375 1.167 6.07 3.417.433.574.808 1.218 1.116 1.916.19.43.35.88.48 1.347h.334A2 2 0 0122 10.667v8a2 2 0 01-2 2H4a2 2 0 01-2-2v-8a2 2 0 012-2h.334c.13-.466.29-.917.48-1.347.308-.698.683-1.342 1.116-1.916zM17 13a5 5 0 11-10 0 5 5 0 0110 0z" clipRule="evenodd" /></svg>
                </button>
              )}
              {isScanning && <div className="animate-spin w-16 h-16 border-4 border-[#bd004d] border-t-transparent rounded-full my-10"></div>}
              {extractedTexts.length > 0 && (
                <div className="w-full space-y-4">
                  <div className="flex flex-wrap gap-2 justify-center">
                    {extractedTexts.map((t, i) => <button key={i} onClick={() => selectCode(t)} className="px-6 py-4 bg-gray-50 border-2 border-transparent hover:border-[#bd004d] rounded-2xl font-black uppercase text-sm">{t}</button>)}
                  </div>
                  <button onClick={() => setExtractedTexts([])} className="w-full text-xs font-black text-[#bd004d] uppercase mt-4">Reintentar</button>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </div>
        )}

        {showPreview && (
          <div className="space-y-8 pb-20">
            <TicketPreview data={formData} innerRef={ticketRef} />
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 space-y-4">
              <input 
                type="tel" 
                name="phone" 
                value={formData.phone} 
                onChange={handleInputChange} 
                className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl outline-none font-black text-gray-700" 
                placeholder="521..." 
              />
              <button onClick={handleSend} disabled={isProcessing} className="w-full py-5 bg-[#bd004d] text-white font-black rounded-2xl shadow-xl">Enviar</button>
              <button onClick={handleShare} disabled={isProcessing} className="w-full py-5 bg-gray-900 text-white font-black rounded-2xl shadow-xl">Compartir</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
