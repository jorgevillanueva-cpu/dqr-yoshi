
import React, { useRef, useState, useEffect, useCallback } from 'react';
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

  // Función para detener la cámara y liberar el hardware completamente
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        // Intentar apagar la linterna explícitamente
        if (track.kind === 'video' && (track as any).applyConstraints) {
          (track as any).applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
        }
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsFlashOn(false);
  }, []);

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
          
          videoRef.current.onloadedmetadata = async () => {
            const track = mediaStream.getVideoTracks()[0];
            if (track) {
              const capabilities = track.getCapabilities() as any;
              if (capabilities.torch) {
                setHasFlash(true);
                // Encendido automático para mejorar el contraste inicial
                try {
                  await (track as any).applyConstraints({
                    advanced: [{ torch: true }]
                  });
                  setIsFlashOn(true);
                } catch (e) {}
              }
            }
          };
        }
      } catch (err) {
        showPopMessage("Cámara bloqueada. Activa los permisos.", "error");
        onClose();
      }
    };

    initCamera();

    return () => {
      stopCamera();
    };
  }, [onClose, showPopMessage, stopCamera]);

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
      showPopMessage("No se pudo controlar la linterna", "info");
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const performOcr = async (base64Image: string): Promise<string> => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
            { text: "Analiza la imagen de este ticket. Localiza el Folio, Referencia o ID de ticket. Extrae únicamente los códigos alfanuméricos identificadores. Si el folio es difícil de leer, búscalo cerca de la palabra 'TICKET', 'FOLIO' o al final del recibo. Responde solo con los códigos encontrados separados por comas." }
          ]
        },
        config: {
          systemInstruction: "Actúa como un escáner industrial de alta precisión. Tu único objetivo es extraer folios de tickets. Responde exclusivamente con los códigos sin ningún texto adicional.",
          temperature: 0,
        }
      });
      return response.text || "";
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 403) {
        if (window.aistudio) await window.aistudio.openSelectKey();
      }
      throw err;
    }
  };

  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isScanning) return;

    setIsScanning(true);
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;

      // Resolución optimizada para OCR móvil
      const TARGET_WIDTH = 1600; 
      const scale = TARGET_WIDTH / video.videoWidth;
      canvas.width = TARGET_WIDTH;
      canvas.height = video.videoHeight * scale;

      // Filtros de nitidez agresiva para tickets térmicos
      context.filter = 'contrast(2.0) brightness(1.05) grayscale(1) blur(0px)';
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const base64Image = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
      const responseText = await performOcr(base64Image);
      
      if (!responseText || !responseText.trim()) {
        showPopMessage("Folio no visible. Mantén el ticket quieto.", "info");
      } else {
        const found = responseText.split(/[\s,]+/)
          .map(s => s.replace(/[^a-zA-Z0-9-]/g, '').trim())
          .filter(s => s.length >= 4 && !/error|sorry|unable|safety|blocked|folio|ticket|referencia|id/i.test(s));
        
        if (found.length > 0) {
          setResults(Array.from(new Set(found)));
          showPopMessage("Lectura completada", "success");
        } else {
          showPopMessage("No se encontró un folio válido. Mejora la luz.", "info");
        }
      }
    } catch (err: any) {
      console.error(err);
      showPopMessage("Error de red o procesamiento. Reintenta.", "error");
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
        
        {/* Guía Visual */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-[85%] h-[30%] max-h-56 border-2 border-white/20 rounded-[2.5rem] relative shadow-[0_0_0_1000px_rgba(0,0,0,0.75)]">
            <div className="absolute -top-1 -left-1 w-14 h-14 border-t-4 border-l-4 border-[#bd004d] rounded-tl-[1.8rem]"></div>
            <div className="absolute -top-1 -right-1 w-14 h-14 border-t-4 border-r-4 border-[#bd004d] rounded-tr-[1.8rem]"></div>
            <div className="absolute -bottom-1 -left-1 w-14 h-14 border-b-4 border-l-4 border-[#bd004d] rounded-bl-[1.8rem]"></div>
            <div className="absolute -bottom-1 -right-1 w-14 h-14 border-b-4 border-r-4 border-[#bd004d] rounded-br-[1.8rem]"></div>
            
            {isScanning && (
              <div className="absolute top-0 left-0 w-full h-1 bg-[#bd004d] shadow-[0_0_30px_#bd004d] animate-[scan_1.5s_infinite]"></div>
            )}
            
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="bg-black/30 backdrop-blur-md px-5 py-2 rounded-full border border-white/10">
                  <p className="text-white text-[9px] font-black uppercase tracking-[0.3em]">Encuadra el folio</p>
               </div>
            </div>
          </div>
          
          <div className="mt-10 px-12 text-center">
            <p className="text-white/70 font-bold text-[10px] uppercase tracking-[0.2em] leading-relaxed">
              {isScanning ? 'Digitalizando con IA...' : 'Evita sombras y reflejos para una mejor lectura'}
            </p>
          </div>
        </div>

        {/* Botones de control superior */}
        <div className="absolute top-12 left-0 w-full px-6 flex justify-between items-center pointer-events-auto">
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
            onClick={handleClose}
            className="ml-auto p-4 bg-black/60 text-white rounded-full backdrop-blur-xl border border-white/10 active:scale-90 transition-transform"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Panel Inferior de Resultados / Disparo */}
      <div className="bg-[#0A0A0A] p-8 pb-14 rounded-t-[3.5rem] -mt-16 relative z-10 border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        {results.length > 0 ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-500">
            <div className="text-center">
              <div className="w-12 h-1 bg-gray-800 rounded-full mx-auto mb-6"></div>
              <p className="text-[#bd004d] text-[11px] font-black uppercase tracking-[0.2em] mb-1">Folios Detectados</p>
              <p className="text-white/40 text-[10px] font-medium">Selecciona el código que aparece en tu ticket</p>
            </div>
            
            <div className="flex flex-col gap-3 max-h-60 overflow-y-auto custom-scrollbar pr-1">
              {results.map((res, i) => (
                <button
                  key={i}
                  onClick={() => onCodeSelected(res)}
                  className="w-full px-6 py-5 bg-white/[0.04] border border-white/10 text-white font-mono text-xl uppercase tracking-widest rounded-2xl active:bg-[#bd004d] active:scale-[0.98] transition-all"
                >
                  {res}
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => { setResults([]); setIsScanning(false); }}
              className="w-full py-2 text-white/30 text-[9px] font-black uppercase tracking-[0.3em] hover:text-white"
            >
              Intentar de nuevo
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8">
            <div className="w-12 h-1 bg-gray-800 rounded-full mb-2"></div>
            
            <button 
              onClick={captureFrame}
              disabled={isScanning}
              className={`w-full h-20 rounded-3xl font-black text-[13px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-5 shadow-2xl ${
                isScanning ? 'bg-gray-900 text-gray-700 cursor-wait' : 'bg-[#bd004d] text-white shadow-[0_20px_45px_rgba(189,0,77,0.4)] active:scale-95'
              }`}
            >
              {isScanning ? (
                <>
                  <div className="w-6 h-6 border-3 border-gray-700 border-t-[#bd004d] rounded-full animate-spin"></div>
                  <span>PROCESANDO...</span>
                </>
              ) : (
                <>
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <circle cx="12" cy="13" r="3" strokeWidth="2" />
                  </svg>
                  <span>ESCANEAR TICKET</span>
                </>
              )}
            </button>
            <div className="flex flex-col items-center gap-1 opacity-20">
               <span className="text-white text-[7px] font-black tracking-[0.6em] uppercase">High Fidelity Vision v3.0</span>
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};
