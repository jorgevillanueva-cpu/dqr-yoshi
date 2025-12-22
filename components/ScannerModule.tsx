
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
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'uploading' | 'retrying'>('idle');
  const [results, setResults] = useState<string[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);

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
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        showPopMessage("Permiso de cámara denegado.", "error");
        onClose();
      }
    };

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isScanning) return;

    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        showPopMessage("Configura tu API Key primero", "info");
        await window.aistudio.openSelectKey();
        return;
      }
    }

    const video = videoRef.current;
    if (video.videoWidth === 0) {
      showPopMessage("Esperando cámara...", "info");
      return;
    }

    setIsScanning(true);
    setScanStatus('uploading');
    
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    const MAX_DIMENSION = 640;
    let width = video.videoWidth;
    let height = video.videoHeight;
    const ratio = width / height;

    if (width > height) {
      width = Math.min(width, MAX_DIMENSION);
      height = width / ratio;
    } else {
      height = Math.min(height, MAX_DIMENSION);
      width = height * ratio;
    }

    canvas.width = width;
    canvas.height = height;
    context?.drawImage(video, 0, 0, width, height);
    const base64Image = canvas.toDataURL('image/jpeg', 0.4).split(',')[1];

    const maxRetries = 2;
    let attempt = 0;

    const performOcr = async (): Promise<string> => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
            { text: "OCR: Extract ticket ID/folio. List codes separated by commas only." }
          ]
        },
        config: {
          systemInstruction: "You are a fast payment receipt OCR. Return ONLY the alphanumeric codes found. No conversation.",
          temperature: 0,
        }
      });
      return result.text || "";
    };

    while (attempt <= maxRetries) {
      try {
        if (attempt > 0) setScanStatus('retrying');
        
        const responseText = await performOcr();
        
        if (!responseText.trim() || responseText.toLowerCase().includes("unable")) {
          showPopMessage("Imagen borrosa. Intenta de nuevo.", "info");
        } else {
          const found = responseText.split(',')
            .map(s => s.trim().replace(/[^a-zA-Z0-9-]/g, ''))
            .filter(s => s.length >= 4);
          
          if (found.length > 0) {
            setResults(Array.from(new Set(found)));
            showPopMessage("Ticket procesado", "success");
          } else {
            showPopMessage("No se encontró el folio", "info");
          }
        }
        break; // Éxito, salimos del bucle de reintentos
      } catch (err: any) {
        attempt++;
        const msg = err.message || "";
        console.warn(`Intento ${attempt} fallido:`, msg);

        const isNetworkError = msg.includes("fetch") || msg.includes("Network") || msg.includes("503") || msg.includes("500");

        if (isNetworkError && attempt <= maxRetries) {
          // Esperar antes del siguiente intento (backoff exponencial ligero)
          await wait(500 * attempt);
          continue;
        }

        // Si llegamos aquí, es un error fatal o agotamos reintentos
        if (msg.includes("429")) {
          showPopMessage("Límite de la API excedido. Espera.", "error");
        } else if (msg.includes("403") || msg.includes("401") || msg.includes("entity was not found")) {
          showPopMessage("API Key inválida. Configúrala.", "error");
          window.aistudio?.openSelectKey();
        } else {
          showPopMessage("Falla de red. Revisa tu conexión.", "error");
        }
        break;
      }
    }

    setIsScanning(false);
    setScanStatus('idle');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300">
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-60" />
        
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-[70%] h-48 border-2 border-white/5 rounded-[2.5rem] relative">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#bd004d] rounded-tl-[1.8rem]"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#bd004d] rounded-tr-[1.8rem]"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#bd004d] rounded-bl-[1.8rem]"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#bd004d] rounded-br-[1.8rem]"></div>
            
            {isScanning && (
              <div className="absolute top-0 left-0 w-full h-1 bg-[#bd004d] shadow-[0_0_20px_#bd004d] animate-[scan_1s_infinite]"></div>
            )}
          </div>
          <p className="text-white/40 font-bold text-[9px] uppercase tracking-[0.4em] mt-10 text-center px-12 leading-relaxed">
            Busca un lugar con buena iluminación
          </p>
        </div>

        <button 
          onClick={onClose}
          className="absolute top-12 right-6 p-4 bg-black/40 text-white rounded-full backdrop-blur-md border border-white/5 active:scale-90 transition-transform"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="bg-[#050505] p-8 pb-14 rounded-t-[3.5rem] -mt-12 relative z-10 border-t border-white/5 shadow-[0_-30px_60px_rgba(0,0,0,0.9)]">
        {results.length > 0 ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
            <div className="text-center">
              <p className="text-[#bd004d] text-[10px] font-black uppercase tracking-widest mb-1">Resultado del Análisis</p>
              <p className="text-white/30 text-[11px]">Selecciona el folio del ticket</p>
            </div>
            <div className="flex flex-col gap-3 max-h-48 overflow-y-auto custom-scrollbar">
              {results.map((res, i) => (
                <button
                  key={i}
                  onClick={() => onCodeSelected(res)}
                  className="w-full px-6 py-5 bg-white/[0.03] border border-white/10 text-white font-mono uppercase text-center rounded-2xl active:bg-[#bd004d]/20 transition-all border-dashed"
                >
                  {res}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setResults([])}
              className="w-full py-2 text-white/20 text-[9px] font-black uppercase tracking-widest"
            >
              Capturar otro ticket
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-7">
            <button 
              onClick={captureFrame}
              disabled={isScanning}
              className={`w-full py-6 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 ${
                isScanning ? 'bg-gray-900 text-gray-600' : 'bg-[#bd004d] text-white shadow-[0_15px_30px_rgba(189,0,77,0.3)] active:scale-95'
              }`}
            >
              {isScanning ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-700 border-t-[#bd004d] rounded-full animate-spin"></div>
                  {scanStatus === 'retrying' ? 'Reintentando...' : 'Analizando...'}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Escanear Ticket
                </>
              )}
            </button>
            <div className="text-center">
              <p className="text-white/10 text-[8px] font-bold tracking-[0.2em] uppercase max-w-[200px] mx-auto">
                OCR optimizado para conexiones inestables (reintentos habilitados)
              </p>
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
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
      `}</style>
    </div>
  );
};
