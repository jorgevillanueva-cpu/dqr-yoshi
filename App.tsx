
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
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  const ticketRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

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
    setIsScanning(false);
    setExtractedTexts([]);
    setIsCameraOpen(true);
    
    const constraints: MediaStreamConstraints = {
      video: { 
        facingMode: 'environment', 
        width: { ideal: 3840, min: 1280 }, 
        height: { ideal: 2160, min: 720 } 
      }
    };

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (innerErr) {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        
        const capabilities = track.getCapabilities() as any;
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }

        try {
          const adv: any = {};
          if (capabilities.focusMode?.includes('continuous')) adv.focusMode = 'continuous';
          if (capabilities.exposureMode?.includes('continuous')) adv.exposureMode = 'continuous';
          
          if (Object.keys(adv).length > 0) {
            await track.applyConstraints({ advanced: [adv] } as any);
          }
        } catch (e) {}
      }
    } catch (err) {
      alert("Error de cámara: Asegúrate de permitir el acceso.");
      setIsCameraOpen(false);
    }
  };

  const toggleTorch = async () => {
    if (trackRef.current && hasTorch) {
      try {
        const newState = !isTorchOn;
        await trackRef.current.applyConstraints({ advanced: [{ torch: newState }] } as any);
        setIsTorchOn(newState);
      } catch (err) {}
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
    setIsScanning(false);
    setHasTorch(false);
    setIsTorchOn(false);
    trackRef.current = null;
  };

  const captureAndExtract = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      alert("Error: API Key no disponible.");
      return;
    }

    setIsScanning(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    if (context) {
      context.filter = 'contrast(1.6) brightness(1.1) sharp';
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      context.filter = 'none';
    }
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.98).split(',')[1];

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            parts: [
              { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
              { text: "SCAN THE ENTIRE IMAGE. Identify any character strings, alphanumeric codes, or reference IDs (e.g. 'yoshi-83j-22', 'ABC123XYZ', 'TICKET-99'). Return ALL potential unique codes found, separated by commas. Focus on the most distinct strings." }
            ]
          }
        ],
        config: {
          systemInstruction: "Eres un sistema OCR de alta fidelidad. Tu misión es extraer cadenas de texto y códigos alfanuméricos de tickets. Identifica secuencias de letras y números mezclados con precisión. Solo devuelve los códigos encontrados.",
          thinkingConfig: { thinkingBudget: 0 } 
        },
      });

      const textOutput = (response.text || "").trim();
      const results = textOutput
        .split(/[\s\n,]+/)
        .map(t => t.trim().replace(/[^a-zA-Z0-9-]/g, ''))
        .filter(t => t.length >= 3 && t.length <= 50);

      if (results.length > 0) {
        setExtractedTexts(results);
      } else {
        alert("No se detectaron códigos. Intenta centrar mejor el ticket.");
      }
    } catch (err: any) {
      console.error("Gemini OCR Error:", err);
      alert("Error en el procesado: " + (err.message || "Fallo de conexión."));
    } finally {
      setIsScanning(false);
    }
  };

  const selectCode = (text: string) => {
    setFormData(prev => ({ ...prev, codigo: text.toLowerCase() }));
    stopCamera();
  };

  const handleGenerate = () => {
    if (!formData.codigo.trim()) {
      alert("Por favor, introduce o escanea un código");
      return;
    }
    formatSaldoOnComplete();
    setShowPreview(true);
  };

  const handleClear = () => {
    setFormData({ saldo: '', codigo: '', phone: '' });
    setShowPreview(false);
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
        }
      }
    } catch (e) {
      alert("Error al compartir.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = async () => {
    if (!formData.phone) { alert("Número de WhatsApp requerido"); return; }
    const phoneToOpen = formData.phone.replace(/\D/g, '');
    setIsProcessing(true);
    setCopyStatus('copying');
    try {
      const blob = await getTicketBlob();
      if (blob && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopyStatus('success');
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
      <header className="py-10 text-center flex flex-col items-center">
        <div className="bg-white p-4 rounded-3xl shadow-md mb-4 border border-gray-100/50">
          <YoshiLogo className="h-14 w-14" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 font-title tracking-tight">Yoshi Digitalizer</h1>
        <p className="text-[#bd004d] font-black uppercase tracking-widest text-[10px] mt-1">Scanner Pro v3.2</p>
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
              <label className="text-[10px] font-black text-gray-400 ml-1 uppercase block mb-2 tracking-widest">Código Referencia</label>
              <div className="relative flex items-center">
                <input 
                  type="text" 
                  name="codigo" 
                  value={formData.codigo} 
                  onChange={handleInputChange} 
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl outline-none lowercase focus:ring-2 focus:ring-[#bd004d]/10 font-bold text-gray-700 pr-14 transition-all" 
                  placeholder="ej: ticket123" 
                />
                <button 
                  onClick={startCamera} 
                  className="absolute right-2 p-2.5 text-[#bd004d] bg-white rounded-xl shadow-sm active:scale-90 transition-all border border-gray-100"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
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

        {isCameraOpen && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col">
            <div className="relative flex-1 overflow-hidden">
              <video 
                ref={videoRef} 
                className="w-full h-full object-cover" 
                playsInline 
              />
              
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[88%] h-72 border-2 border-white/40 rounded-[2.5rem] relative shadow-[0_0_80px_rgba(189,0,77,0.3)] bg-black/10">
                  <div className="absolute -top-1.5 -left-1.5 w-16 h-16 border-t-8 border-l-8 border-[#bd004d] rounded-tl-3xl"></div>
                  <div className="absolute -top-1.5 -right-1.5 w-16 h-16 border-t-8 border-r-8 border-[#bd004d] rounded-tr-3xl"></div>
                  <div className="absolute -bottom-1.5 -left-1.5 w-16 h-16 border-b-8 border-l-8 border-[#bd004d] rounded-bl-3xl"></div>
                  <div className="absolute -bottom-1.5 -right-1.5 w-16 h-16 border-b-8 border-r-8 border-[#bd004d] rounded-br-3xl"></div>
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#bd004d] to-transparent opacity-90 shadow-[0_0_25px_#bd004d] animate-[scan_2.8s_infinite]"></div>
                </div>
              </div>

              <div className="absolute top-12 left-0 right-0 px-6 flex justify-between items-center">
                <button 
                  onClick={stopCamera} 
                  className="p-3.5 bg-black/40 backdrop-blur-xl rounded-full text-white active:scale-90 border border-white/10"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                
                {hasTorch && (
                  <button 
                    onClick={toggleTorch} 
                    className={`p-3.5 rounded-full transition-all border active:scale-90 ${isTorchOn ? 'bg-[#bd004d] border-[#bd004d] text-white shadow-[0_0_20px_#bd004d]' : 'bg-black/40 border-white/10 text-white'}`}
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 10V3L4 14H11V21L20 10H13Z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white p-10 rounded-t-[3rem] flex flex-col items-center min-h-[340px] relative shadow-[0_-15px_40px_rgba(0,0,0,0.3)]">
              <div className="w-12 h-1.5 bg-gray-100 rounded-full mb-8"></div>
              
              {!isScanning && extractedTexts.length === 0 && (
                <div className="flex flex-col items-center gap-6">
                  <div className="text-center px-4">
                    <p className="text-gray-900 font-extrabold text-sm uppercase tracking-[0.25em]">Escaneo Multirango</p>
                    <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-1">Detectando cadenas alfanuméricas</p>
                  </div>
                  <button 
                    onClick={captureAndExtract} 
                    className="w-24 h-24 rounded-full bg-[#bd004d] shadow-[0_15px_40px_rgba(189,0,77,0.4)] flex items-center justify-center text-white active:scale-90 transition-transform border-4 border-white"
                  >
                    <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 9a3 3 0 100 6 3 3 0 000-6z" />
                      <path fillRule="evenodd" d="M5.93C7.625 3.167 10.334 2 12 2c1.667 0 4.375 1.167 6.07 3.417.433.574.808 1.218 1.116 1.916.19.43.35.88.48 1.347h.334A2 2 0 0122 10.667v8a2 2 0 01-2 2H4a2 2 0 01-2-2v-8a2 2 0 012-2h.334c.13-.466.29-.917.48-1.347.308-.698.683-1.342 1.116-1.916zM17 13a5 5 0 11-10 0 5 5 0 0110 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              )}

              {isScanning && (
                <div className="flex flex-col items-center py-10">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-[#bd004d]/20 rounded-full"></div>
                    <div className="absolute inset-0 w-20 h-20 border-4 border-[#bd004d] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-[11px] font-black text-[#bd004d] uppercase tracking-[0.4em] mt-8">Decodificando rango...</p>
                </div>
              )}

              {extractedTexts.length > 0 && (
                <div className="w-full animate-in fade-in slide-in-from-bottom-6 duration-300">
                  <p className="text-[10px] font-black text-gray-400 uppercase text-center mb-5 tracking-widest">Textos Detectados</p>
                  <div className="flex flex-wrap gap-2.5 justify-center max-h-[160px] overflow-y-auto px-2 pb-2">
                    {extractedTexts.map((t, i) => (
                      <button 
                        key={i} 
                        onClick={() => selectCode(t)} 
                        className="px-6 py-4 bg-gray-50 border border-gray-100 hover:border-[#bd004d] hover:bg-[#bd004d]/5 rounded-2xl font-black uppercase text-[11px] shadow-sm transition-all active:scale-95"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setExtractedTexts([])} className="w-full text-[10px] font-black text-[#bd004d] uppercase mt-8 tracking-[0.4em] active:opacity-50">Limpiar y Reintentar</button>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
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
      <style>{`
        @keyframes scan {
          0% { top: 0; }
          50% { top: 100%; }
          100% { top: 0; }
        }
      `}</style>
    </div>
  );
};

export default App;
