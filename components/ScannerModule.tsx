
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

  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isScanning) return;

    // Verificar API Key antes de procesar imagen para ahorrar recursos
    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        showPopMessage("Selecciona una API Key primero", "info");
        await window.aistudio.openSelectKey();
        return;
      }
    }

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      showPopMessage("Cámara cargando...", "info");
      return;
    }

    setIsScanning(true);
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    // Resolución optimizada para 4G/Conexiones lentas (640px es suficiente para OCR de texto claro)
    const MAX_DIMENSION = 640;
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > height) {
      if (width > MAX_DIMENSION) {
        height *= MAX_DIMENSION / width;
        width = MAX_DIMENSION;
      }
    } else {
      if (height > MAX_DIMENSION) {
        width *= MAX_DIMENSION / height;
        height = MAX_DIMENSION;
      }
    }

    canvas.width = width;
    canvas.height = height;

    try {
      context?.drawImage(video, 0, 0, width, height);
      // Calidad 0.5 para reducir peso del paquete de red al mínimo
      const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];

      // Initialize GoogleGenAI right before making the call using process.env.API_KEY directly
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
            { text: "OCR: Extract ticket ID or reference. List only codes separated by commas." }
          ]
        },
        config: {
          systemInstruction: "You are a specialized OCR tool for payment receipts. Only return the alphanumeric codes found. If none, return empty.",
          temperature: 0,
        }
      });

      const responseText = result.text || "";
      
      if (!responseText.trim() || responseText.toLowerCase().includes("unable")) {
        showPopMessage("No se leyó nada claro. Intenta otro ángulo.", "info");
      } else {
        const found = responseText.split(',')
          .map(s => s.trim().replace(/[^a-zA-Z0-9-]/g, ''))
          .filter(s => s.length >= 4);
        
        if (found.length > 0) {
          setResults(Array.from(new Set(found)));
          showPopMessage("¡Leído!", "success");
        } else {
          showPopMessage("Acerca más el ticket", "info");
        }
      }
    } catch (err: any) {
      console.error("Critical Scanner Error:", err);
      const msg = err.message || "";
      
      // Manejo granular de errores para guiar al usuario
      if (msg.includes("fetch") || msg.includes("NetworkError") || !navigator.onLine) {
        showPopMessage("Sin Internet o señal débil. Reintenta.", "error");
      } else if (msg.includes("Requested entity was not found") || msg.includes("403") || msg.includes("401")) {
        showPopMessage("Error de API Key. Selecciona una válida.", "error");
        window.aistudio?.openSelectKey();
      } else if (msg.includes("429")) {
        showPopMessage("Muchos intentos. Espera 5 segundos.", "error");
      } else {
        showPopMessage("Error de red. Intenta de nuevo.", "error");
      }
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300">
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-[75%] h-52 border-2 border-white/10 rounded-[2rem] relative backdrop-blur-[0.5px]">
            <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-[#bd004d] rounded-tl-[1.8rem]"></div>
            <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-[#bd004d] rounded-tr-[1.8rem]"></div>
            <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-[#bd004d] rounded-bl-[1.8rem]"></div>
            <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-[#bd004d] rounded-br-[1.8rem]"></div>
            
            {isScanning && (
              <div className="absolute top-0 left-0 w-full h-0.5 bg-[#bd004d] shadow-[0_0_15px_#bd004d] animate-[scan_1.2s_infinite]"></div>
            )}
          </div>
          <p className="text-white/50 font-bold text-[10px] uppercase tracking-[0.4em] mt-8 text-center px-12 leading-relaxed">
            Enfoca el código de barras o folio
          </p>
        </div>

        <button 
          onClick={onClose}
          className="absolute top-10 right-6 p-4 bg-black/50 text-white rounded-full backdrop-blur-xl border border-white/10 active:scale-90 transition-transform"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="bg-[#050505] p-8 pb-14 rounded-t-[3rem] -mt-10 relative z-10 border-t border-white/5 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">
        {results.length > 0 ? (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-[#bd004d] text-[10px] font-black uppercase tracking-widest mb-1">Detectado</p>
              <p className="text-white/30 text-[11px]">Toca el código para cargarlo</p>
            </div>
            <div className="flex flex-col gap-3 max-h-48 overflow-y-auto custom-scrollbar">
              {results.map((res, i) => (
                <button
                  key={i}
                  onClick={() => onCodeSelected(res)}
                  className="w-full px-6 py-5 bg-white/[0.03] border border-white/10 text-white font-mono uppercase text-center rounded-2xl active:bg-[#bd004d]/30 transition-all border-dashed"
                >
                  {res}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setResults([])}
              className="w-full py-2 text-white/20 text-[9px] font-black uppercase tracking-widest"
            >
              Volver a intentar
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <button 
              onClick={captureFrame}
              disabled={isScanning}
              className={`w-full py-6 rounded-2xl font-black text-xs uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 ${
                isScanning ? 'bg-gray-900 text-gray-700' : 'bg-[#bd004d] text-white shadow-lg active:scale-95'
              }`}
            >
              {isScanning ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin"></div>
                  Subiendo...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Capturar Ticket
                </>
              )}
            </button>
            <div className="text-center opacity-20">
              <p className="text-white text-[8px] font-bold tracking-[0.2em] uppercase">
                Análisis de imagen optimizado para datos móviles
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
