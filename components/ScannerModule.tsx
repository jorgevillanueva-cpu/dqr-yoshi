
import React, { useRef, useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";

interface ScannerModuleProps {
  onCodeSelected: (code: string) => void;
  onClose: () => void;
  showPopMessage: (msg: string, type?: 'error' | 'success' | 'info') => void;
}

// Fix: Match existing AIStudio type and handle potential global definition conflicts
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio: AIStudio;
  }
}

export const ScannerModule: React.FC<ScannerModuleProps> = ({ onCodeSelected, onClose, showPopMessage }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  useEffect(() => {
    const initCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        showPopMessage("Error al acceder a la cámara. Verifica los permisos del navegador.", "error");
        onClose();
      }
    };

    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [onClose, showPopMessage]);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const performOcrWithRetry = async (base64Image: string, retries = 2): Promise<string> => {
    let lastError: any;
    
    for (let i = 0; i <= retries; i++) {
      try {
        // Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key.
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const result = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
              { text: "Analiza el ticket. Extrae EXCLUSIVAMENTE el FOLIO o REFERENCIA alfanumérica. Devuelve solo el código o códigos separados por comas, sin nada de texto extra." }
            ]
          },
          config: {
            systemInstruction: "Eres un experto en extracción de datos. Extrae solo identificadores únicos alfanuméricos de tickets de pago. Si no hay códigos claros, devuelve una cadena vacía.",
            temperature: 0,
          }
        });
        // Correctly access .text property from GenerateContentResponse
        return result.text || "";
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || "";
        
        // If the request fails with an error message containing "Requested entity was not found.", 
        // prompt the user to select a key again via openSelectKey().
        if (errMsg.includes("Requested entity was not found") || errMsg.includes("API key not valid")) {
          showPopMessage("Configuración de API requerida", "info");
          if (window.aistudio) {
            await window.aistudio.openSelectKey();
            // Proceed assuming key selection was successful to avoid race condition
          }
        }

        if (i < retries) {
          await sleep(1500 * (i + 1)); // Backoff to allow reconnection
          continue;
        }
      }
    }
    throw lastError;
  };

  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isScanning) return;

    // Check for API key selection before processing
    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
        // Mandatory step: assume key selection success and proceed
      }
    }

    const video = videoRef.current;
    if (video.videoWidth === 0) {
      showPopMessage("Esperando a la cámara...", "info");
      return;
    }

    setIsScanning(true);
    
    try {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { willReadFrequently: true });

      // Resolution optimized for low latency
      const TARGET_WIDTH = 720;
      const scale = TARGET_WIDTH / video.videoWidth;
      canvas.width = TARGET_WIDTH;
      canvas.height = video.videoHeight * scale;

      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Balanced quality for payload size reduction
      const base64Image = canvas.toDataURL('image/jpeg', 0.4).split(',')[1];

      const responseText = await performOcrWithRetry(base64Image);
      
      if (!responseText.trim()) {
        showPopMessage("No se encontró texto. Intenta acercar el ticket y mejorar la luz.", "info");
      } else {
        const found = responseText.split(',')
          .map(s => s.trim())
          .filter(s => s.length >= 4 && !/error|sorry|unable/i.test(s));
        
        if (found.length > 0) {
          setResults(Array.from(new Set(found)));
          showPopMessage("Lectura exitosa", "success");
        } else {
          showPopMessage("No se identificaron folios válidos.", "info");
        }
      }
    } catch (err: any) {
      const status = err?.status;
      const msg = err?.message || "";
      
      if (status === 429) {
        showPopMessage("Demasiadas peticiones. Espera 5 segundos.", "error");
      } else if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed to fetch")) {
        showPopMessage("Error de conexión. Revisa tu internet.", "error");
      } else if (msg.includes("User location")) {
        showPopMessage("Error de ubicación/región.", "error");
      } else {
        showPopMessage("Error al procesar. Reintenta con más luz.", "error");
      }
      console.error("OCR Debug:", err);
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
          <div className="w-[85%] h-[30%] max-h-56 border-2 border-white/20 rounded-[2rem] relative shadow-[0_0_0_1000px_rgba(0,0,0,0.65)]">
            <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-[#bd004d] rounded-tl-[1.5rem]"></div>
            <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-[#bd004d] rounded-tr-[1.5rem]"></div>
            <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-[#bd004d] rounded-bl-[1.5rem]"></div>
            <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-[#bd004d] rounded-br-[1.5rem]"></div>
            
            {isScanning && (
              <div className="absolute top-0 left-0 w-full h-1 bg-[#bd004d] shadow-[0_0_30px_#bd004d] animate-[scan_2s_infinite] opacity-100"></div>
            )}
            
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="bg-black/40 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20">
                  <p className="text-white text-[9px] font-black uppercase tracking-[0.3em]">CÓDIGO DENTRO DEL RECUADRO</p>
               </div>
            </div>
          </div>
          
          <p className="text-white/60 font-bold text-[11px] uppercase tracking-[0.2em] mt-12 text-center px-10 leading-relaxed max-w-xs">
            {isScanning ? 'ANALIZANDO CON IA...' : 'ASEGÚRATE DE TENER BUENA ILUMINACIÓN'}
          </p>
        </div>

        <button 
          onClick={onClose}
          className="absolute top-12 right-6 p-4 bg-black/60 text-white rounded-full backdrop-blur-xl border border-white/10 active:scale-90 transition-transform shadow-2xl"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="bg-[#0A0A0A] p-8 pb-14 rounded-t-[3.5rem] -mt-16 relative z-10 border-t border-white/10">
        {results.length > 0 ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-500">
            <div className="text-center">
              <div className="w-12 h-1 bg-gray-800 rounded-full mx-auto mb-6"></div>
              <p className="text-[#bd004d] text-[11px] font-black uppercase tracking-[0.2em] mb-1">Folios Encontrados</p>
              <p className="text-white/40 text-[11px] font-medium">Selecciona el código de tu ticket</p>
            </div>
            
            <div className="flex flex-col gap-3 max-h-64 overflow-y-auto custom-scrollbar pr-1">
              {results.map((res, i) => (
                <button
                  key={i}
                  onClick={() => onCodeSelected(res)}
                  className="w-full px-6 py-5 bg-white/[0.03] border border-white/10 text-white font-mono text-xl uppercase text-center rounded-2xl active:bg-[#bd004d] active:border-[#bd004d] active:scale-[0.98] transition-all"
                >
                  {res}
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => { setResults([]); setIsScanning(false); }}
              className="w-full py-4 text-white/40 text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Escanear otro ticket
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8">
            <div className="w-12 h-1 bg-gray-800 rounded-full mb-2"></div>
            
            <button 
              onClick={captureFrame}
              disabled={isScanning}
              className={`w-full h-20 rounded-3xl font-black text-[13px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-5 shadow-2xl ${
                isScanning 
                  ? 'bg-gray-900 text-gray-700' 
                  : 'bg-[#bd004d] text-white shadow-[0_20px_40px_rgba(189,0,77,0.4)] active:scale-95'
              }`}
            >
              {isScanning ? (
                <>
                  <div className="w-6 h-6 border-3 border-gray-700 border-t-[#bd004d] rounded-full animate-spin"></div>
                  <span>PROCESANDO...</span>
                </>
              ) : (
                <>
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>CAPTURAR TICKET</span>
                </>
              )}
            </button>
            
            <div className="flex flex-col items-center gap-1.5 opacity-30">
              <span className="text-white text-[8px] font-black tracking-[0.4em] uppercase">Gemini AI Vision Enabled</span>
            </div>
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
