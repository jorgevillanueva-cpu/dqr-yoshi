
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
      alert("Introduce el código");
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
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      alert("Permiso de cámara denegado.");
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
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{
          parts: [
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
            { text: "OCR Experto: Busca códigos alfanuméricos en el ticket. Devuelve solo los códigos detectados de más de 4 caracteres, uno por línea." }
          ]
        }]
      });
      const results = (response.text || "").split('\n').map(t => t.trim()).filter(t => t.length > 3);
      setExtractedTexts(results);
      if (results.length === 0) alert("No se detectaron códigos.");
    } catch (err) {
      alert("Error en el escaneo. Asegúrate de tener conexión y la API Key configurada.");
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
    const canvas = await html2canvas(ticketRef.current, { scale: 3, backgroundColor: '#F9FAFB' });
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
  };

  const handleShare = async () => {
    setIsProcessing(true);
    const blob = await getTicketBlob();
    if (blob) {
      const file = new File([blob], `Yoshi-${formData.codigo}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Ticket Yoshi Cash' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `Yoshi-${formData.codigo}.png`; a.click();
      }
    }
    setIsProcessing(false);
  };

  const handleSend = async () => {
    if (!formData.phone) { alert("Introduce un teléfono"); return; }
    setIsProcessing(true);
    setCopyStatus('copying');
    const blob = await getTicketBlob();
    if (blob && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopyStatus('success');
        setTimeout(() => {
          window.open(`https://wa.me/${formData.phone.replace(/\D/g, '')}`, '_blank');
          setCopyStatus('idle');
        }, 800);
      } catch { window.open(`https://wa.me/${formData.phone.replace(/\D/g, '')}`, '_blank'); }
    } else {
      window.open(`https://wa.me/${formData.phone.replace(/\D/g, '')}`, '_blank');
    }
    setIsProcessing(false);
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-10 px-4">
      <header className="py-10 text-center flex flex-col items-center">
        <YoshiLogo className="h-20 w-20 mb-2" />
        <h1 className="text-3xl font-extrabold text-gray-900 font-title">Digitalizador QR</h1>
        <p className="text-[#bd004d] font-bold">Yoshi Cash</p>
      </header>

      <div className="space-y-6">
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 ml-1">Saldo (Opcional)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                <input type="text" name="saldo" value={formData.saldo} onChange={handleInputChange} onBlur={formatSaldoOnComplete} className="w-full pl-8 pr-4 py-4 bg-gray-50 border rounded-2xl outline-none" placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 ml-1">Código del Ticket</label>
              <div className="relative flex items-center">
                <input type="text" name="codigo" value={formData.codigo} onChange={handleInputChange} className="w-full px-5 py-4 bg-gray-50 border rounded-2xl outline-none lowercase" placeholder="código" />
                <button onClick={startCamera} className="absolute right-3 p-2 text-gray-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleGenerate} className="flex-1 py-4 bg-[#bd004d] text-white font-bold rounded-2xl shadow-lg">Generar QR</button>
              <button onClick={handleClear} className="px-5 bg-gray-100 text-gray-400 rounded-2xl"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            </div>
          </div>
        </div>

        {isCameraOpen && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col">
            <video ref={videoRef} className="flex-1 object-cover" />
            <div className="absolute inset-0 border-[60px] border-black/40 pointer-events-none flex items-center justify-center"><div className="w-64 h-24 border-2 border-white/50 rounded-2xl"></div></div>
            <button onClick={stopCamera} className="absolute top-8 right-6 p-2 bg-white/20 rounded-full text-white"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            <div className="bg-white p-8 rounded-t-[40px] -mt-10 relative z-10 flex flex-col items-center min-h-[300px]">
              {!isScanning && extractedTexts.length === 0 && (
                <button onClick={captureAndExtract} className="w-20 h-20 rounded-full bg-[#bd004d] shadow-xl flex items-center justify-center text-white"><svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 9a3 3 0 100 6 3 3 0 000-6z" /><path fillRule="evenodd" d="M5.93 5.417C7.625 3.167 10.334 2 12 2c1.667 0 4.375 1.167 6.07 3.417.433.574.808 1.218 1.116 1.916.19.43.35.88.48 1.347h.334A2 2 0 0122 10.667v8a2 2 0 01-2 2H4a2 2 0 01-2-2v-8a2 2 0 012-2h.334c.13-.466.29-.917.48-1.347.308-.698.683-1.342 1.116-1.916zM17 13a5 5 0 11-10 0 5 5 0 0110 0z" clipRule="evenodd" /></svg></button>
              )}
              {isScanning && <p className="animate-pulse font-bold text-gray-500 py-10">Escaneando...</p>}
              {extractedTexts.length > 0 && (
                <div className="w-full flex flex-wrap gap-2 justify-center">
                  {extractedTexts.map((t, i) => <button key={i} onClick={() => selectCode(t)} className="px-5 py-3 bg-gray-50 border rounded-xl font-bold uppercase text-sm">{t}</button>)}
                  <button onClick={() => setExtractedTexts([])} className="w-full text-xs font-bold text-[#bd004d] mt-4">Reintentar</button>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </div>
        )}

        {showPreview && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-500">
            <TicketPreview data={formData} innerRef={ticketRef} />
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 space-y-4">
              <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-5 py-4 bg-gray-50 border rounded-2xl outline-none font-bold" placeholder="WhatsApp: 521..." />
              {copyStatus === 'success' && <p className="text-[10px] text-green-600 font-bold text-center">¡Copiado! Pega la imagen en el chat.</p>}
              <div className="flex flex-col gap-3">
                <button onClick={handleSend} disabled={isProcessing} className="w-full py-4 bg-[#bd004d] text-white font-bold rounded-2xl shadow-md">Enviar</button>
                <button onClick={handleShare} disabled={isProcessing} className="w-full py-4 bg-[#bd004d] text-white font-bold rounded-2xl shadow-md">Compartir</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
