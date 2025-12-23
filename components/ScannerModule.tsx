
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createWorker } from 'tesseract.js';

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
  const [hasFlash, setHasFlash] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  // FUNCIÓN CRÍTICA: Apaga la cámara y libera el hardware por completo
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => {
        try {
          if (track.kind === 'video' && (track as any).applyConstraints) {
            (track as any).applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
          }
        } catch (e) {}
        track.stop();
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      // Eliminar el video del DOM virtualmente para asegurar que el buffer se limpie
      videoRef.current.load();
    }
    setIsFlashOn(false);
  }, []);

  useEffect(() => {
    const initCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 }, // 720p es ideal para OCR local (menos peso, mucha nitidez)
            height: { ideal: 720 }
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
                try {
                  await (track as any).applyConstraints({ advanced: [{ torch: true }] });
                  setIsFlashOn(true);
                } catch (e) {}
              }
            }
          };
        }
      } catch (err) {
        showPopMessage("Activa el permiso de cámara en ajustes", "error");
        onClose();
      }
    };

    initCamera();

    // Cleanup al desmontar: Garantiza que la cámara NO se quede encendida
    return () => {
      stopCamera();
    };
  }, [onClose, showPopMessage, stopCamera]);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const processLocalOcr = async (canvas: HTMLCanvasElement): Promise<string> => {
    try {
      // Usar un worker local (Tesseract.js)
      const worker = await createWorker('spa', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.floor(m.progress * 100));
          }
        }
      });
      
      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();
      return text;
    } catch (err) {
      console.error("Tesseract Error:", err);
      throw new Error("OCR_LOCAL_FAILED");
    }
  };

  const captureAndRead = async () => {
    if (!videoRef.current || !canvasRef.current || isScanning) return;

    setIsScanning(true);
    setOcrProgress(0);
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Capturar solo el área central del video (donde está la guía) para mayor precisión
      const width = video.videoWidth;
      const height = video.videoHeight;
      canvas.width = 800;
      canvas.height = 400;

      // Dibujar una porción ampliada del centro
      const sourceX = (width - 800) / 2;
      const sourceY = (height - 400) / 2;

      // FILTRO PRE-OCR LOCAL: Aumentar contraste y binarizar
      ctx.filter = 'contrast(2.5) grayscale(1) brightness(1.2)';
      ctx.drawImage(video, sourceX, sourceY, 800, 400, 0, 0, 800, 400);
      
      const text = await processLocalOcr(canvas);
      
      // Limpiar el texto buscando patrones comunes de folios (números y letras de más de 5 carac)
      const matches = text.match(/[A-Z0-9-]{5,20}/gi) || [];
      const cleanMatches = Array.from(new Set(matches.map(m => m.toUpperCase())))
        .filter(m => !/TICKET|FOLIO|VENTA|PAGO|CAJA/i.test(m));

      if (cleanMatches.length > 0) {
        setResults(cleanMatches);
        showPopMessage("Ticket leído", "success");
      } else {
        showPopMessage("No se detectó el código. Acércalo más.", "info");
      }
    } catch (err) {
      showPopMessage("Error al procesar localmente. Reintenta.", "error");
    } finally {
      setIsScanning(false);
      setOcrProgress(0);
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
          className={`w-full h-full object-cover transition-all duration-700 ${isScanning ? 'opacity-20 blur-sm' : 'opacity-100'}`} 
        />
        
        {/* Marcador de Guía */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-[85%] h-[25%] border-2 border-[#bd004d] rounded-3xl relative shadow-[0_0_0_1000px_rgba(0,0,0,0.8)]">
            <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-white rounded-tl-2xl"></div>
            <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-white rounded-tr-2xl"></div>
            <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-white rounded-bl-2xl"></div>
            <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-white rounded-br-2xl"></div>
            
            {isScanning && (
              <div className="absolute top-0 left-0 w-full h-1 bg-[#bd004d] shadow-[0_0_20px_#bd004d] animate-[scan_1s_infinite]"></div>
            )}
          </div>
          
          <div className="mt-8 text-center px-10">
            <p className="text-white font-bold text-[10px] uppercase tracking-[0.3em]">
              {isScanning ? `RECONOCIENDO: ${ocrProgress}%` : 'COLOCA EL FOLIO EN EL RECUADRO'}
            </p>
          </div>
        </div>

        <div className="absolute top-12 right-6 pointer-events-auto">
          <button 
            onClick={handleClose}
            className="p-4 bg-black/50 text-white rounded-full backdrop-blur-xl border border-white/10 active:scale-90 transition-transform"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-[#0A0A0A] p-8 pb-14 rounded-t-[3rem] -mt-10 relative z-10 border-t border-white/10">
        {results.length > 0 ? (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-[#bd004d] text-[10px] font-black uppercase tracking-widest mb-1">Folios Encontrados</p>
              <p className="text-white/40 text-[10px]">Confirma el código correcto</p>
            </div>
            
            <div className="grid gap-3 max-h-48 overflow-y-auto">
              {results.map((res, i) => (
                <button
                  key={i}
                  onClick={() => onCodeSelected(res)}
                  className="w-full py-4 bg-white/5 border border-white/10 text-white font-mono text-lg rounded-2xl active:bg-[#bd004d]"
                >
                  {res}
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => setResults([])}
              className="w-full text-white/30 text-[9px] uppercase tracking-widest font-black"
            >
              Escanear de nuevo
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <button 
              onClick={captureAndRead}
              disabled={isScanning}
              className={`w-full h-16 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-4 ${
                isScanning ? 'bg-gray-800 text-gray-500' : 'bg-[#bd004d] text-white shadow-lg active:scale-95'
              }`}
            >
              {isScanning ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <circle cx="12" cy="13" r="3" strokeWidth="2" />
                  </svg>
                  <span>ESCANEAR AHORA</span>
                </>
              )}
            </button>
            <p className="text-white/20 text-[7px] uppercase font-bold tracking-[0.5em]">Motor Offline v5.1</p>
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
      `}</style>
    </div>
  );
};
