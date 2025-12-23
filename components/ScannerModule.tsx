
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
  
  // Controles manuales de imagen
  const [brightness, setBrightness] = useState(1.1); // Default 1.1
  const [contrast, setContrast] = useState(2.8);    // Default 2.8
  const [showSettings, setShowSettings] = useState(false);

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
      
      await worker.setParameters({
        tessedit_pageseg_mode: '7' as any, // Single line mode
        tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-', 
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

      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;

      // "Wider scanning range": Aumentamos el ancho al 92% y alto al 25% para códigos largos
      const cropW = vWidth * 0.92;
      const cropH = vHeight * 0.25;
      const cropX = (vWidth - cropW) / 2;
      const cropY = (vHeight - cropH) / 2;

      canvas.width = 1800; // Mayor resolución horizontal para UUIDs largos
      canvas.height = (cropH / cropW) * 1800;

      // Filtros dinámicos basados en controles manuales
      ctx.filter = `contrast(${contrast}) grayscale(1) brightness(${brightness}) sharp(5px)`;
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
      
      const text = await processLocalOcr(canvas);
      const cleanRaw = text.replace(/\s+/g, '').trim();
      
      const regex = /tick-[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}|[a-z0-9-]{10,64}/gi;
      const matches = cleanRaw.match(regex) || [];
      const cleanMatches = Array.from(new Set(matches.map(m => m.toLowerCase())));

      if (cleanMatches.length > 0) {
        setResults(cleanMatches);
        showPopMessage("Código detectado", "success");
      } else {
        if (cleanRaw.length >= 8) {
           setResults([cleanRaw.toLowerCase()]);
           showPopMessage("Cadena extraída", "success");
        } else {
           showPopMessage("Ajusta el brillo/contraste si no se lee", "info");
        }
      }
    } catch (err) {
      showPopMessage("Error de lectura local", "error");
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
        
        {/* Guía Visual Ampliada */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-[92%] h-[25%] border-2 border-white/10 rounded-3xl relative shadow-[0_0_0_1000px_rgba(0,0,0,0.8)]">
            <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-[#bd004d] rounded-tl-2xl"></div>
            <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-[#bd004d] rounded-tr-2xl"></div>
            <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-[#bd004d] rounded-bl-2xl"></div>
            <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-[#bd004d] rounded-br-2xl"></div>
            
            {isScanning && (
              <div className="absolute top-0 left-0 w-full h-1 bg-[#bd004d] shadow-[0_0_25px_#bd004d] animate-[scan_1.5s_infinite]"></div>
            )}
          </div>
          
          <div className="mt-8 text-center px-10">
            <p className="text-white font-bold text-[9px] uppercase tracking-[0.5em] opacity-60">
              {isScanning ? `ANALIZANDO: ${ocrProgress}%` : 'UBICA EL CÓDIGO EN EL RECUADRO'}
            </p>
          </div>
        </div>

        {/* Controles Superiores */}
        <div className="absolute top-12 left-0 w-full px-6 flex justify-between items-center pointer-events-auto">
          <div className="flex gap-3">
            {hasFlash && (
              <button 
                onClick={toggleFlash}
                className={`p-4 rounded-full backdrop-blur-xl border transition-all active:scale-90 ${
                  isFlashOn ? 'bg-[#bd004d] text-white border-[#bd004d]/50 shadow-[0_0_30px_rgba(189,0,77,0.5)]' : 'bg-black/40 text-white border-white/10'
                }`}
              >
                <svg className="w-6 h-6" fill={isFlashOn ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            )}
            
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-4 rounded-full backdrop-blur-xl border transition-all active:scale-90 ${
                showSettings ? 'bg-white text-black border-white' : 'bg-black/40 text-white border-white/10'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          </div>
          
          <button 
            onClick={handleClose}
            className="p-4 bg-black/40 text-white rounded-full backdrop-blur-xl border border-white/10 active:scale-90"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Panel de Ajustes Manuales */}
        {showSettings && (
          <div className="absolute top-32 left-6 right-6 p-6 bg-black/80 backdrop-blur-2xl rounded-[2rem] border border-white/10 space-y-6 animate-in slide-in-from-top-4 duration-300">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-white text-[10px] font-black uppercase tracking-widest">Brillo</span>
                <span className="text-[#bd004d] font-mono text-xs">{brightness.toFixed(1)}x</span>
              </div>
              <input 
                type="range" min="0.5" max="2.5" step="0.1" 
                value={brightness} onChange={(e) => setBrightness(parseFloat(e.target.value))}
                className="w-full accent-[#bd004d] h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-white text-[10px] font-black uppercase tracking-widest">Contraste</span>
                <span className="text-[#bd004d] font-mono text-xs">{contrast.toFixed(1)}x</span>
              </div>
              <input 
                type="range" min="1.0" max="5.0" step="0.2" 
                value={contrast} onChange={(e) => setContrast(parseFloat(e.target.value))}
                className="w-full accent-[#bd004d] h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <button 
              onClick={() => { setBrightness(1.1); setContrast(2.8); }}
              className="w-full py-2 text-white/40 text-[9px] font-black uppercase tracking-widest border border-white/5 rounded-xl"
            >
              Restablecer Valores
            </button>
          </div>
        )}
      </div>

      <div className="bg-[#0A0A0A] p-8 pb-14 rounded-t-[3.5rem] -mt-12 relative z-10 border-t border-white/10 shadow-[0_-20px_60px_rgba(0,0,0,0.8)]">
        {results.length > 0 ? (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-1.5 bg-gray-800 rounded-full mx-auto mb-6"></div>
              <p className="text-[#bd004d] text-[10px] font-black uppercase tracking-[0.3em] mb-1">Resultado de Escaneo</p>
              <p className="text-white/40 text-[10px]">Toca para seleccionar el código correcto</p>
            </div>
            
            <div className="grid gap-3 max-h-52 overflow-y-auto custom-scrollbar px-1">
              {results.map((res, i) => (
                <button
                  key={i}
                  onClick={() => onCodeSelected(res)}
                  className="w-full py-5 px-4 bg-white/[0.03] border border-white/10 text-white font-mono text-sm break-all rounded-2xl active:bg-[#bd004d] transition-all flex items-center justify-center text-center"
                >
                  {res}
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => { setResults([]); setIsScanning(false); }}
              className="w-full py-2 text-white/20 text-[9px] font-black uppercase tracking-[0.4em]"
            >
              Nueva Captura
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8">
            <div className="w-12 h-1.5 bg-gray-800 rounded-full mb-2"></div>
            
            <button 
              onClick={captureAndRead}
              disabled={isScanning}
              className={`w-full h-20 rounded-3xl font-black text-[13px] uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-5 ${
                isScanning ? 'bg-gray-900 text-gray-700' : 'bg-[#bd004d] text-white shadow-[0_20px_50px_rgba(189,0,77,0.4)] active:scale-95'
              }`}
            >
              {isScanning ? (
                <>
                  <div className="w-6 h-6 border-3 border-white/10 border-t-white rounded-full animate-spin"></div>
                  <span>PROCESANDO...</span>
                </>
              ) : (
                <>
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <circle cx="12" cy="13" r="3" strokeWidth="2.5" />
                  </svg>
                  <span>ESCANEAR CÓDIGO</span>
                </>
              )}
            </button>
            <p className="text-white/10 text-[7px] font-bold tracking-[0.7em] uppercase">Control Manual de Imagen Activado</p>
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
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          background: #bd004d;
          border: 3px solid white;
          border-radius: 50%;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};
