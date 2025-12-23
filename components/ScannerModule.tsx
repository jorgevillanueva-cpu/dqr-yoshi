
import React, { useRef, useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";

interface ScannerModuleProps {
  onCodeSelected: (code: string) => void;
  onClose: () => void;
  showPopMessage: (msg: string, type?: 'error' | 'success' | 'info') => void;
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

export const ScannerModule: React.FC<ScannerModuleProps> = ({ onCodeSelected, onClose, showPopMessage }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [hasFlash, setHasFlash] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);

  useEffect(() => {
    const initCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        const track = mediaStream.getVideoTracks()[0];
        if (track) {
          const capabilities = track.getCapabilities() as any;
          if (capabilities.torch) {
            setHasFlash(true);
          }
        }
      } catch (err) {
        showPopMessage("Error al acceder a la cámara. Verifica los permisos.", "error");
        onClose();
      }
    };

    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          if (track.kind === 'video' && (track as any).applyConstraints) {
             (track as any).applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
          }
          track.stop();
        });
        streamRef.current = null;
      }
    };
  }, [onClose, showPopMessage]);

  const toggleFlash = async () => {
    if (!streamRef.current || !hasFlash) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const newState = !isFlashOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: newState }]
      });
      setIsFlashOn(newState);
    } catch (err) {
      showPopMessage("No se pudo activar el flash", "info");
    }
  };

  const performOcrWithRetry = async (base64Image: string, retries = 2): Promise<string> => {
    let lastError: any;
    
    for (let i = 0; i <= retries; i++) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
              { text: "Busca y extrae el FOLIO o CÓDIGO de este ticket. Es una cadena alfanumérica (ej. ABC-1234, 098765). Devuelve SOLO los códigos separados por comas. Si no estás seguro, intenta leer los caracteres más claros." }
            ]
          },
          config: {
            systemInstruction: "Eres un sistema OCR de alta fidelidad. Tu prioridad es encontrar códigos de folio en tickets de compra. Ignora logotipos, montos y fechas. Responde exclusivamente con los códigos encontrados.",
            temperature: 0,
          }
        });
        
        return response.text || "";
      } catch (err: any) {
        lastError = err;
        // Si es error de API Key, abrir selector
        if (err?.status === 401 || err?.status === 403 || err?.message?.includes("API key")) {
          if (window.aistudio) await window.aistudio.openSelectKey();
          break;
        }
        // Esperar antes de reintentar
        if (i < retries) await new Promise(r => setTimeout(r, 1500));
      }
    }
    throw lastError;
  };

  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isScanning) return;

    const video = videoRef.current;
    if (video.videoWidth === 0) return;

    setIsScanning(true);
    
    try {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;

      // Aumento de resolución a 1280 para mayor detalle en fuentes pequeñas
      const TARGET_WIDTH = 1280; 
      const scale = TARGET_WIDTH / video.videoWidth;
      canvas.width = TARGET_WIDTH;
      canvas.height = video.videoHeight * scale;

      // Filtros optimizados para tickets térmicos (contraste alto)
      context.filter = 'contrast(1.6) brightness(1.05) saturate(0)';
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const base64Image = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

      const responseText = await performOcrWithRetry(base64Image);
      
      if (!responseText || !responseText.trim()) {
        showPopMessage("No se detectó el folio. Intenta acercar o alejar un poco.", "info");
      } else {
        // Limpieza robusta de la respuesta
        const found = responseText.split(/[\s,]+/)
          .map(s => s.replace(/[^a-zA-Z0-9-]/g, '').trim())
          .filter(s => s.length >= 4 && !/error|sorry|unable|safety|blocked|folio|ticket|referencia|id/i.test(s));
        
        if (found.length > 0) {
          setResults(Array.from(new Set(found)));
          showPopMessage("Ticket leído correctamente", "success");
        } else {
          showPopMessage("Folio no reconocido. Asegúrate que esté enfocado.", "info");
        }
      }
    } catch (err: any) {
      console.error("OCR Error:", err);
      if (err?.message?.includes("fetch")) {
        showPopMessage("Revisa tu conexión a internet.", "error");
      } else {
        showPopMessage("Error al procesar. Reintenta con más luz.", "error");
      }
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300">
      <div className="flex-1 relative overflow-hidden bg-black">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className={`w-full h-full object-cover transition-opacity duration-700 ${isScanning ? 'opacity-30' : 'opacity-80'}`} 
        />
        
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-[88%] h-[35%] max-h-64 border-2 border-white/20 rounded-[2.5rem] relative shadow-[0_0_0_1000px_rgba(0,0,0,0.7)]">
            <div className="absolute -top-1 -left-1 w-14 h-14 border-t-4 border-l-4 border-[#bd004d] rounded-tl-[1.8rem]"></div>
            <div className="absolute -top-1 -right-1 w-14 h-14 border-t-4 border-r-4 border-[#bd004d] rounded-tr-[1.8rem]"></div>
            <div className="absolute -bottom-1 -left-1 w-14 h-14 border-b-4 border-l-4 border-[#bd004d] rounded-bl-[1.8rem]"></div>
            <div className="absolute -bottom-1 -right-1 w-14 h-14 border-b-4 border-r-4 border-[#bd004d] rounded-br-[1.8rem]"></div>
            
            {isScanning && (
              <div className="absolute top-0 left-0 w-full h-1 bg-[#bd004d] shadow-[0_0_40px_#bd004d] animate-[scan_2s_infinite] opacity-100"></div>
            )}
            
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="bg-black/40 backdrop-blur-xl px-6 py-3 rounded-full border border-white/20 shadow-2xl">
                  <p className="text-white text-[10px] font-black uppercase tracking-[0.4em]">ENCUADRA EL TICKET</p>
               </div>
            </div>
          </div>
          
          <div className="mt-12 flex flex-col items-center gap-2">
            <p className="text-white/80 font-bold text-[11px] uppercase tracking-[0.2em] text-center px-10 leading-relaxed">
              {isScanning ? 'LEYENDO TICKET...' : 'COLOCA EL CÓDIGO DENTRO DEL RECUADRO'}
            </p>
          </div>
        </div>

        <div className="absolute top-12 left-0 w-full px-6 flex justify-between items-center">
          {hasFlash && (
            <button 
              onClick={toggleFlash}
              className={`p-4 rounded-full backdrop-blur-xl border transition-all active:scale-90 shadow-2xl ${
                isFlashOn ? 'bg-[#bd004d] text-white border-[#bd004d]/50' : 'bg-black/60 text-white border-white/10'
              }`}
            >
              <svg className="w-6 h-6" fill={isFlashOn ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          )}
          
          <button 
            onClick={onClose}
            className="ml-auto p-4 bg-black/60 text-white rounded-full backdrop-blur-xl border border-white/10 active:scale-90 transition-transform shadow-2xl"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-[#0A0A0A] p-8 pb-14 rounded-t-[3.5rem] -mt-16 relative z-10 border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        {results.length > 0 ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-500">
            <div className="text-center">
              <div className="w-12 h-1 bg-gray-800 rounded-full mx-auto mb-6"></div>
              <p className="text-[#bd004d] text-[11px] font-black uppercase tracking-[0.2em] mb-1">Folios Encontrados</p>
              <p className="text-white/40 text-[11px] font-medium">Toca el folio correcto</p>
            </div>
            
            <div className="flex flex-col gap-3 max-h-64 overflow-y-auto custom-scrollbar pr-1">
              {results.map((res, i) => (
                <button
                  key={i}
                  onClick={() => onCodeSelected(res)}
                  className="w-full px-6 py-5 bg-white/[0.04] border border-white/10 text-white font-mono text-xl uppercase text-center rounded-2xl active:bg-[#bd004d] active:border-[#bd004d] active:scale-[0.98] transition-all"
                >
                  {res}
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => { setResults([]); setIsScanning(false); }}
              className="w-full py-4 text-white/40 text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 hover:text-white"
            >
              Volver a intentar
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8">
            <div className="w-12 h-1 bg-gray-800 rounded-full mb-2"></div>
            
            <button 
              onClick={captureFrame}
              disabled={isScanning}
              className={`w-full h-20 rounded-3xl font-black text-[14px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-5 shadow-2xl ${
                isScanning ? 'bg-gray-900 text-gray-700 cursor-wait' : 'bg-[#bd004d] text-white shadow-[0_20px_45px_rgba(189,0,77,0.45)] active:scale-95'
              }`}
            >
              {isScanning ? (
                <>
                  <div className="w-6 h-6 border-3 border-gray-700 border-t-[#bd004d] rounded-full animate-spin"></div>
                  <span>ANALIZANDO...</span>
                </>
              ) : (
                <>
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                  <span>ESCANEAR TICKET</span>
                </>
              )}
            </button>
            <span className="text-white/20 text-[8px] font-bold tracking-[0.5em] uppercase">Gemini Vision AI Core</span>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};
