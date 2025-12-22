
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
        showPopMessage("Cámara no disponible. Revisa los permisos.", "error");
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

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      showPopMessage("Iniciando cámara...", "info");
      return;
    }

    setIsScanning(true);
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    // Reducimos a 800px para mayor velocidad en móviles y evitar cortes de conexión
    const MAX_DIMENSION = 800;
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
      const base64Image = canvas.toDataURL('image/jpeg', 0.75).split(',')[1];

      if (!process.env.API_KEY) {
        throw new Error("API_KEY_MISSING");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{
          parts: [
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
            { text: "Extract any ticket ID, folio, or reference code. List them separated by commas. Plain text only." }
          ]
        }],
        config: {
          systemInstruction: "You are an OCR tool. Detect alphanumeric reference codes on payment tickets. Be fast and precise.",
          temperature: 0,
        }
      });

      const responseText = result.text || "";
      
      if (!responseText.trim() || responseText.toLowerCase().includes("unable") || responseText.length < 3) {
        showPopMessage("No se detectó el código. Prueba con más luz.", "info");
      } else {
        const found = responseText.split(',')
          .map(s => s.trim().replace(/[^a-zA-Z0-9-]/g, ''))
          .filter(s => s.length >= 4);
        
        if (found.length > 0) {
          const uniqueFound = Array.from(new Set(found));
          setResults(uniqueFound);
          showPopMessage("Ticket leído", "success");
        } else {
          showPopMessage("Acerca más el ticket", "info");
        }
      }
    } catch (err: any) {
      console.error("OCR Failure:", err);
      const msg = err.message || "";
      
      if (msg.includes("429") || msg.includes("quota")) {
        showPopMessage("Demasiados intentos. Espera un momento.", "error");
      } else if (msg.includes("API_KEY_MISSING")) {
        showPopMessage("Error de configuración (API Key).", "error");
      } else if (msg.includes("400") || msg.includes("INVALID")) {
        showPopMessage("Error en el formato de imagen.", "error");
      } else {
        showPopMessage("Error de conexión. Reintenta ahora.", "error");
      }
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
          muted
          className="w-full h-full object-cover"
        />
        
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-[80%] h-56 border-2 border-white/20 rounded-[2.5rem] relative">
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-[#bd004d] rounded-tl-[2rem]"></div>
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-[#bd004d] rounded-tr-[2rem]"></div>
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-[#bd004d] rounded-bl-[2rem]"></div>
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-[#bd004d] rounded-br-[2rem]"></div>
            
            {isScanning && (
              <div className="absolute top-0 left-0 w-full h-1 bg-[#bd004d] shadow-[0_0_15px_#bd004d] animate-[scan_1.5s_infinite]"></div>
            )}
          </div>
          <p className="text-white/70 font-bold text-[11px] uppercase tracking-[0.3em] mt-8 text-center px-10">
            Alinea el código en el centro
          </p>
        </div>

        <button 
          onClick={onClose}
          className="absolute top-8 right-6 p-4 bg-black/40 text-white rounded-full backdrop-blur-md border border-white/10 active:scale-90 transition-transform"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="bg-[#080808] p-8 pb-12 rounded-t-[3rem] -mt-10 relative z-10 border-t border-white/5">
        {results.length > 0 ? (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-[#bd004d] text-[10px] font-black uppercase tracking-widest mb-1">Resultados</p>
              <p className="text-white/40 text-xs">Selecciona el código correcto</p>
            </div>
            <div className="flex flex-col gap-3 max-h-56 overflow-y-auto custom-scrollbar pr-1">
              {results.map((res, i) => (
                <button
                  key={i}
                  onClick={() => onCodeSelected(res)}
                  className="w-full px-6 py-5 bg-white/5 border border-white/10 text-white font-mono uppercase tracking-wider text-left rounded-2xl active:bg-[#bd004d]/20 transition-all"
                >
                  {res}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setResults([])}
              className="w-full py-4 text-white/30 text-[10px] font-black uppercase tracking-widest"
            >
              Escanear de nuevo
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <button 
              onClick={captureFrame}
              disabled={isScanning}
              className={`w-full py-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-4 ${
                isScanning ? 'bg-gray-900 text-gray-600 cursor-not-allowed' : 'bg-white text-black active:scale-95'
              }`}
            >
              {isScanning ? (
                <>
                  <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                  Procesando
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Capturar Código
                </>
              )}
            </button>
            <p className="text-white/20 text-[9px] font-bold tracking-widest uppercase text-center">
              Tecnología de escaneo visual asistido
            </p>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          30% { opacity: 1; }
          70% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};
