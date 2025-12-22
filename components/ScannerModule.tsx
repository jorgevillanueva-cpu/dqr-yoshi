
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
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        showPopMessage("Error al acceder a la cámara.", "error");
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

    setIsScanning(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    // Resolución óptima para lectura de párrafos
    const maxWidth = 1280;
    const scale = maxWidth / video.videoWidth;
    canvas.width = maxWidth;
    canvas.height = video.videoHeight * scale;

    try {
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
            { text: "Read and extract ALL text from this image. Include alphanumeric codes, reference numbers, full names, addresses, and paragraphs. Return the found items as a comma-separated list. If there is a large block of text, treat it as one item in the list." }
          ]
        },
        config: {
          systemInstruction: "You are a high-precision OCR system. Your goal is to extract every piece of legible text, whether it's a short code, a long sentence, or a full paragraph. Do not filter out anything unless it is completely unreadable. Separate distinct blocks of text with commas.",
          temperature: 0.1,
        }
      });

      const text = response.text || "";
      
      if (!text.trim() || text.toUpperCase().includes("EMPTY") || text.toUpperCase().includes("SORRY")) {
        showPopMessage("No se detectó texto", "info");
      } else {
        // PROCESAMIENTO: Ahora permitimos espacios y párrafos
        const found = text.split(',')
          .map(s => s.trim())
          .filter(s => s.length >= 2); // Solo filtramos cosas extremadamente cortas como ruidos
        
        if (found.length > 0) {
          const uniqueFound = Array.from(new Set(found));
          setResults(uniqueFound);
          showPopMessage("Texto leído correctamente", "success");
        } else {
          showPopMessage("Intenta capturar de nuevo", "info");
        }
      }
    } catch (err) {
      console.error(err);
      showPopMessage("Error al procesar imagen", "error");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300">
      <div className="flex-1 relative overflow-hidden">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="w-full h-full object-cover"
        />
        
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-[90%] h-64 border-2 border-white/20 rounded-[2.5rem] relative backdrop-blur-[1px]">
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-[#bd004d] rounded-tl-[2rem]"></div>
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-[#bd004d] rounded-tr-[2rem]"></div>
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-[#bd004d] rounded-bl-[2rem]"></div>
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-[#bd004d] rounded-br-[2rem]"></div>
            
            {isScanning && (
              <div className="absolute top-0 left-0 w-full h-1.5 bg-[#bd004d] shadow-[0_0_30px_#bd004d] animate-[scan_2s_infinite]"></div>
            )}
            
            <div className="absolute inset-0 flex flex-col justify-center items-center opacity-10">
              <svg className="w-24 h-24 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <p className="text-white font-black text-[11px] uppercase tracking-[0.5em] mt-10 opacity-80 drop-shadow-2xl">
            Lector Completo de Texto
          </p>
        </div>

        <button 
          onClick={onClose}
          className="absolute top-10 right-8 p-4 bg-black/50 text-white rounded-full backdrop-blur-3xl active:scale-90 transition-transform border border-white/10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="bg-[#050505] p-8 pb-14 rounded-t-[3.5rem] -mt-14 relative z-10 shadow-[0_-30px_80px_rgba(0,0,0,1)] border-t border-white/10">
        {results.length > 0 ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-10">
            <div className="text-center">
              <p className="text-[#bd004d] text-[10px] font-black uppercase tracking-widest mb-1">Contenido Detectado</p>
              <p className="text-gray-500 text-xs">Toca el bloque de texto que quieras usar</p>
            </div>
            <div className="flex flex-col gap-3 max-h-64 overflow-y-auto p-1 custom-scrollbar">
              {results.map((res, i) => (
                <button
                  key={i}
                  onClick={() => onCodeSelected(res)}
                  className="w-full px-6 py-5 bg-white/5 border border-white/10 text-white text-left font-medium rounded-2xl active:scale-[0.98] transition-all hover:bg-[#bd004d]/20 hover:border-[#bd004d]/50 shadow-xl"
                >
                  <span className="block text-xs text-[#bd004d] font-black uppercase tracking-tighter mb-1 opacity-50">Texto Encontrado</span>
                  <p className="text-sm leading-relaxed break-words">{res}</p>
                </button>
              ))}
            </div>
            <button 
              onClick={() => setResults([])}
              className="w-full py-4 text-white/30 text-[10px] font-black uppercase tracking-widest border border-white/5 rounded-2xl"
            >
              Nueva Captura
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-7">
            <button 
              onClick={captureFrame}
              disabled={isScanning}
              className={`w-full py-6 rounded-[2.2rem] font-black text-sm uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-5 ${
                isScanning ? 'bg-gray-900 text-gray-700' : 'bg-white text-black shadow-2xl active:scale-95'
              }`}
            >
              {isScanning ? (
                <>
                  <div className="w-5 h-5 border-3 border-gray-700 border-t-transparent rounded-full animate-spin"></div>
                  Analizando...
                </>
              ) : "Leer Contenido"}
            </button>
            <div className="text-center">
               <p className="text-white/30 text-[10px] font-bold tracking-[0.2em] uppercase leading-loose">
                 Detecta párrafos, números y<br/>cadenas de texto completas
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
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};
