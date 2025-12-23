
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
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          
          videoRef.current.onloadedmetadata = () => {
            const track = mediaStream.getVideoTracks()[0];
            if (track) {
              const capabilities = track.getCapabilities() as any;
              if (capabilities.torch) {
                setHasFlash(true);
              }
            }
          };
        }
      } catch (err) {
        showPopMessage("Permiso de cámara requerido", "error");
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
      showPopMessage("No se pudo activar el flash", "info");
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const processLocalOcr = async (canvas: HTMLCanvasElement): Promise<string> => {
    try {
      const worker = await createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.floor(m.progress * 100));
          }
        }
      });
      
      // Optimizamos para una sola línea de texto (PSM 7) o bloque denso (PSM 6)
      // Esto evita que el motor separe caracteres si están en la misma línea
      await worker.setParameters({
        tessedit_pageseg_mode: '7' as any, // Tratar como una sola línea
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-', // Solo alfanuméricos y guión
      });

      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();
      return text;
    } catch (err) {
      console.error("OCR Error:", err);
      throw new Error("OCR_FAILED");
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

      // Calculamos las dimensiones del video real
      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;

      // El recuadro visual en CSS es w-[85%] y h-[20%]
      // Capturamos EXACTAMENTE esa área proporcional del video
      const cropW = vWidth * 0.85;
      const cropH = vHeight * 0.20;
      const cropX = (vWidth - cropW) / 2;
      const cropY = (vHeight - cropH) / 2;

      canvas.width = 1200; // Resolución fija de procesamiento para nitidez
      canvas.height = (cropH / cropW) * 1200;

      // Aplicar filtros de pre-procesamiento agresivos para OCR local
      ctx.filter = 'contrast(2.5) grayscale(1) brightness(1.1)';
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
      
      const text = await processLocalOcr(canvas);
      
      // Expresión regular que captura la cadena completa sin separarla por espacios internos
      // Buscamos cualquier bloque alfanumérico que pueda contener guiones
      // El .trim() y el regex aseguran que no se rompa la cadena
      const cleanText = text.replace(/\s+/g, '').trim(); // Eliminamos espacios intermedios detectados erróneamente
      
      const matches = cleanText.match(/[A-Z0-9-]{4,30}/gi) || [];
      const cleanMatches = Array.from(new Set(matches.map(m => m.toUpperCase())));

      if (cleanMatches.length > 0) {
        setResults(cleanMatches);
        showPopMessage("Código extraído", "success");
      } else {
        showPopMessage("No se pudo leer una cadena válida.", "info");
      }
    } catch (err) {
      showPopMessage("Error de lectura. Reintenta.", "error");
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
          className={`w-full h-full object-cover transition-all duration-700 ${isScanning ? 'opacity-30 blur-md' : 'opacity-100'}`} 
        />
        
        {/* Guía de Escaneo - Solo lo que está aquí adentro será leído */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-[85%] h-[20%] border-2 border-white/20 rounded-3xl relative shadow-[0_0_0_1000px_rgba(0,0,0,0.75)]">
            <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-[#bd004d] rounded-tl-2xl"></div>
            <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-[#bd004d] rounded-tr-2xl"></div>
            <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-[#bd004d] rounded-bl-2xl"></div>
            <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-[#bd004d] rounded-br-2xl"></div>
            
            {isScanning && (
              <div className="absolute top-0 left-0 w-full h-1 bg-[#bd004d] shadow-[0_0_25px_#bd004d] animate-[scan_1.5s_infinite]"></div>
            )}
          </div>
          
          <div className="mt-8 text-center px-10">
            <p className="text-white font-bold text-[10px] uppercase tracking-[0.4em] opacity-80">
              {isScanning ? `EXTRAYENDO CADENA: ${ocrProgress}%` : 'SÓLO SE LEERÁ EL ÁREA DEL CUADRO'}
            </p>
          </div>
        </div>

        <div className="absolute top-12 left-0 w-full px-6 flex justify-between items-center pointer-events-auto">
          {hasFlash && (
            <button 
              onClick={toggleFlash}
              className={`p-4 rounded-full backdrop-blur-xl border transition-all active:scale-90 ${
                isFlashOn ? 'bg-[#bd004d] text-white border-[#bd004d]/50 shadow-[0_0_20px_rgba(189,0,77,0.4)]' : 'bg-black/40 text-white border-white/10'
              }`}
            >
              <svg className="w-6 h-6" fill={isFlashOn ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          )}
          
          <button 
            onClick={handleClose}
            className="ml-auto p-4 bg-black/40 text-white rounded-full backdrop-blur-xl border border-white/10 active:scale-90"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-[#0A0A0A] p-8 pb-14 rounded-t-[3.5rem] -mt-12 relative z-10 border-t border-white/10">
        {results.length > 0 ? (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-10 h-1 bg-gray-800 rounded-full mx-auto mb-6"></div>
              <p className="text-[#bd004d] text-[10px] font-black uppercase tracking-[0.2em] mb-1">Cadena Identificada</p>
              <p className="text-white/40 text-[10px]">Toca para confirmar el valor</p>
            </div>
            
            <div className="grid gap-3 max-h-52 overflow-y-auto custom-scrollbar">
              {results.map((res, i) => (
                <button
                  key={i}
                  onClick={() => onCodeSelected(res)}
                  className="w-full py-5 bg-white/[0.03] border border-white/10 text-white font-mono text-xl uppercase tracking-widest rounded-2xl active:bg-[#bd004d] transition-all"
                >
                  {res}
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => { setResults([]); setIsScanning(false); }}
              className="w-full py-2 text-white/20 text-[9px] font-black uppercase tracking-[0.3em]"
            >
              Intentar otra captura
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8">
            <div className="w-10 h-1 bg-gray-800 rounded-full mb-2"></div>
            
            <button 
              onClick={captureAndRead}
              disabled={isScanning}
              className={`w-full h-20 rounded-3xl font-black text-[13px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-5 ${
                isScanning ? 'bg-gray-900 text-gray-700' : 'bg-[#bd004d] text-white shadow-[0_20px_45px_rgba(189,0,77,0.3)] active:scale-95'
              }`}
            >
              {isScanning ? (
                <>
                  <div className="w-6 h-6 border-3 border-white/10 border-t-white rounded-full animate-spin"></div>
                  <span>ANALIZANDO...</span>
                </>
              ) : (
                <>
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <circle cx="12" cy="13" r="3" strokeWidth="2.5" />
                  </svg>
                  <span>CAPTURAR AHORA</span>
                </>
              )}
            </button>
            <p className="text-white/10 text-[7px] font-bold tracking-[0.6em] uppercase">Recorte de Precisión Activado</p>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
      `}</style>
    </div>
  );
};
