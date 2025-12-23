
import React, { useRef, useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";

interface ScannerModuleProps {
  onCodeSelected: (code: string) => void;
  onClose: () => void;
  showPopMessage: (msg: string, type?: 'error' | 'success' | 'info') => void;
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
        showPopMessage("Error al acceder a la cámara. Verifica los permisos.", "error");
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
  }, []);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const performOcrWithRetry = async (base64Image: string, retries = 2): Promise<string> => {
    let lastError: any;
    for (let i = 0; i <= retries; i++) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const result = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
              { text: "Analiza la imagen del ticket. Extrae únicamente el FOLIO, REFERENCIA, TICKET ID o cualquier identificador alfanumérico único. Ignora montos y fechas. Devuelve solo los códigos encontrados separados por comas." }
            ]
          },
          config: {
            systemInstruction: "Eres un asistente especializado en extracción de datos de tickets. Tu prioridad es la precisión. Devuelve solo los identificadores únicos, sin texto adicional.",
            temperature: 0,
          }
        });
        return result.text || "";
      } catch (err: any) {
        lastError = err;
        console.error(`Intento ${i + 1} fallido:`, err);
        if (i < retries) {
          // Backoff exponencial simple: 1s, 2s...
          await sleep(1000 * (i + 1));
          continue;
        }
      }
    }
    throw lastError;
  };

  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isScanning) return;

    const video = videoRef.current;
    if (video.videoWidth === 0) {
      showPopMessage("La cámara aún se está iniciando...", "info");
      return;
    }

    setIsScanning(true);
    
    try {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { willReadFrequently: true });

      // Resolución optimizada para balancear costo de tokens y precisión de lectura
      const TARGET_WIDTH = 800;
      const scale = TARGET_WIDTH / video.videoWidth;
      canvas.width = TARGET_WIDTH;
      canvas.height = video.videoHeight * scale;

      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Calidad reducida para mejorar la velocidad de carga sin sacrificar OCR
      const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];

      const responseText = await performOcrWithRetry(base64Image);
      
      if (!responseText.trim()) {
        showPopMessage("No se detectaron códigos claros. Intenta ajustar la iluminación.", "info");
      } else {
        const found = responseText.split(',')
          .map(s => s.trim())
          .filter(s => s.length >= 4 && !s.toLowerCase().includes("error") && !s.toLowerCase().includes("no se"));
        
        if (found.length > 0) {
          setResults(Array.from(new Set(found)));
          showPopMessage("Información extraída con éxito", "success");
        } else {
          showPopMessage("No se identificaron identificadores válidos en el ticket.", "info");
        }
      }
    } catch (err: any) {
      const isQuotaError = err?.message?.includes('429') || err?.status === 429;
      const errorMsg = isQuotaError 
        ? "Límite de peticiones alcanzado. Espera un momento." 
        : "Error al procesar imagen. Revisa tu conexión a internet.";
      showPopMessage(errorMsg, "error");
      console.error("Error completo de OCR:", err);
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
          <div className="w-[85%] h-[30%] max-h-56 border-2 border-white/20 rounded-[2rem] relative shadow-[0_0_0_1000px_rgba(0,0,0,0.6)]">
            <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-[#bd004d] rounded-tl-[1.5rem]"></div>
            <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-[#bd004d] rounded-tr-[1.5rem]"></div>
            <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-[#bd004d] rounded-bl-[1.5rem]"></div>
            <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-[#bd004d] rounded-br-[1.5rem]"></div>
            
            {isScanning && (
              <div className="absolute top-0 left-0 w-full h-1 bg-[#bd004d] shadow-[0_0_25px_#bd004d] animate-[scan_2s_infinite] opacity-100"></div>
            )}
            
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="bg-black/40 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20">
                  <p className="text-white text-[9px] font-black uppercase tracking-[0.3em]">Encuadra el código del ticket</p>
               </div>
            </div>
          </div>
          
          <p className="text-white/60 font-bold text-[11px] uppercase tracking-[0.2em] mt-12 text-center px-10 leading-relaxed max-w-xs">
            {isScanning ? 'IA Analizando...' : 'Coloca el ticket frente a la cámara'}
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
              <p className="text-[#bd004d] text-[11px] font-black uppercase tracking-[0.2em] mb-1">Resultados de Lectura</p>
              <p className="text-white/40 text-[11px] font-medium">Toca el folio para usarlo</p>
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
              Intentar nuevamente
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
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Escanear Ticket</span>
                </>
              )}
            </button>
            
            <div className="flex flex-col items-center gap-1.5 opacity-30">
              <span className="text-white text-[8px] font-black tracking-[0.4em] uppercase">IA de Extracción Digital</span>
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
