
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
  
  // Ajustes de imagen optimizados para sensibilidad extrema
  const [brightness, setBrightness] = useState(1.1);
  const [contrast, setContrast] = useState(2.2);
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
      showPopMessage("Error con el flash", "info");
    }
  };

  // Función de nitidez mediante convolución para caracteres pequeños
  const sharpen = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const weights = [
       0, -1,  0,
      -1,  5, -1,
       0, -1,  0
    ];
    const side = Math.round(Math.sqrt(weights.length));
    const halfSide = Math.floor(side / 2);
    const src = ctx.getImageData(0, 0, w, h);
    const sw = src.width;
    const sh = src.height;
    const s = src.data;
    const output = ctx.createImageData(w, h);
    const dst = output.data;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const sy = y;
        const sx = x;
        const dstOff = (y * sw + x) * 4;
        let r = 0, g = 0, b = 0;
        for (let cy = 0; cy < side; cy++) {
          for (let cx = 0; cx < side; cx++) {
            const scy = sy + cy - halfSide;
            const scx = sx + cx - halfSide;
            if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
              const srcOff = (scy * sw + scx) * 4;
              const wt = weights[cy * side + cx];
              r += s[srcOff] * wt;
              g += s[srcOff + 1] * wt;
              b += s[srcOff + 2] * wt;
            }
          }
        }
        dst[dstOff] = r;
        dst[dstOff + 1] = g;
        dst[dstOff + 2] = b;
        dst[dstOff + 3] = s[dstOff + 3];
      }
    }
    ctx.putImageData(output, 0, 0);
  };

  const applyThreshold = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      // Umbral ligeramente más bajo para rescatar trazos finos de letras pequeñas
      const val = avg < 115 ? 0 : 255;
      data[i] = data[i + 1] = data[i + 2] = val;
    }
    ctx.putImageData(imageData, 0, 0);
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
        tessedit_pageseg_mode: '6' as any, // Sparse text block
        tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-,$ ',
        tessedit_ocr_engine_mode: '1' as any, // LSTM only for better speed/precision
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
    setResults([]);
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;

      const cropW = vWidth * 0.94;
      const cropH = vHeight * 0.35;
      const cropX = (vWidth - cropW) / 2;
      const cropY = (vHeight - cropH) / 2;

      // RESOLUCIÓN MÁXIMA para rescatar detalles mínimos
      canvas.width = 3200;
      canvas.height = (cropH / cropW) * 3200;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.filter = `contrast(${contrast}) grayscale(1) brightness(${brightness})`;
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
      
      // PASO CRÍTICO: Sharpening antes del umbral
      sharpen(ctx, canvas.width, canvas.height);
      
      // PASO 2: Umbralización
      applyThreshold(ctx, canvas.width, canvas.height);
      
      const text = await processLocalOcr(canvas);
      
      const lines = text.split('\n')
        .map(l => l.trim())
        .filter(l => l.length >= 2);

      const foundItems: string[] = [];
      
      lines.forEach(line => {
        // Capturar importes
        const moneyMatches = line.match(/\d{1,3}(,\d{3})*(\.\d{2})?|\d+(\.\d+)?/g);
        if (moneyMatches) moneyMatches.forEach(m => {
          if (m.length > 1) foundItems.push(m);
        });

        // Capturar folios/IDs (ahora más flexible)
        const alphaMatches = line.match(/[a-z0-9-]{4,64}/gi);
        if (alphaMatches) alphaMatches.forEach(m => foundItems.push(m));
        
        if (line.length >= 4 && line.length < 50) {
          foundItems.push(line);
        }
      });

      const cleanResults = Array.from(new Set(foundItems))
        .map(item => item.replace(/[^a-z0-9.-]/gi, ''))
        .filter(item => item.length >= 2 && !/^[.-]+$/.test(item));

      if (cleanResults.length > 0) {
        setResults(cleanResults);
        showPopMessage("Alta sensibilidad: Éxito", "success");
      } else {
        showPopMessage("Sin resultados. Acerca más el dispositivo.", "info");
      }
    } catch (err) {
      showPopMessage("Error en motor de visión", "error");
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
        
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-[92%] h-[35%] border-2 border-white/20 rounded-3xl relative shadow-[0_0_0_2000px_rgba(0,0,0,0.85)]">
            <div className="absolute -top-1 -left-1 w-14 h-14 border-t-4 border-l-4 border-[#bd004d] rounded-tl-3xl"></div>
            <div className="absolute -top-1 -right-1 w-14 h-14 border-t-4 border-r-4 border-[#bd004d] rounded-tr-3xl"></div>
            <div className="absolute -bottom-1 -left-1 w-14 h-14 border-b-4 border-l-4 border-[#bd004d] rounded-bl-3xl"></div>
            <div className="absolute -bottom-1 -right-1 w-14 h-14 border-b-4 border-r-4 border-[#bd004d] rounded-br-3xl"></div>
            
            {isScanning && (
              <div className="absolute top-0 left-0 w-full h-1 bg-[#bd004d] shadow-[0_0_35px_#bd004d] animate-[scan_1s_infinite]"></div>
            )}
          </div>
          
          <div className="mt-12 text-center px-10">
            <p className="text-white font-black text-[11px] uppercase tracking-[0.6em] opacity-80 animate-pulse">
              {isScanning ? `MODO SENSIBLE: ${ocrProgress}%` : 'TEXTO PEQUEÑO Y NÚMEROS'}
            </p>
          </div>
        </div>

        <div className="absolute top-12 left-0 w-full px-6 flex justify-between items-center pointer-events-auto">
          <div className="flex gap-3">
            {hasFlash && (
              <button 
                onClick={toggleFlash}
                className={`p-4 rounded-full backdrop-blur-2xl border transition-all active:scale-90 ${
                  isFlashOn ? 'bg-[#bd004d] text-white border-[#bd004d]/50 shadow-[0_0_40px_rgba(189,0,77,0.6)]' : 'bg-black/50 text-white border-white/10'
                }`}
              >
                <svg className="w-6 h-6" fill={isFlashOn ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            )}
            
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-4 rounded-full backdrop-blur-2xl border transition-all active:scale-90 ${
                showSettings ? 'bg-white text-black border-white' : 'bg-black/50 text-white border-white/10'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          </div>
          
          <button 
            onClick={() => { stopCamera(); onClose(); }}
            className="p-4 bg-black/50 text-white rounded-full backdrop-blur-2xl border border-white/10 active:scale-90"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {showSettings && (
          <div className="absolute top-32 left-6 right-6 p-8 bg-black/90 backdrop-blur-3xl rounded-[3rem] border border-white/10 space-y-8 animate-in slide-in-from-top-6 duration-300">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-white text-[11px] font-black uppercase tracking-widest opacity-40">Compensación Brillo</span>
                <span className="text-[#bd004d] font-mono text-sm font-bold">{brightness.toFixed(1)}</span>
              </div>
              <input 
                type="range" min="0.5" max="2.0" step="0.1" 
                value={brightness} onChange={(e) => setBrightness(parseFloat(e.target.value))}
                className="w-full accent-[#bd004d] h-2 bg-white/5 rounded-full appearance-none cursor-pointer"
              />
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-white text-[11px] font-black uppercase tracking-widest opacity-40">Factor Contraste</span>
                <span className="text-[#bd004d] font-mono text-sm font-bold">{contrast.toFixed(1)}</span>
              </div>
              <input 
                type="range" min="1.0" max="4.0" step="0.2" 
                value={contrast} onChange={(e) => setContrast(parseFloat(e.target.value))}
                className="w-full accent-[#bd004d] h-2 bg-white/5 rounded-full appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#0A0A0A] p-10 pb-16 rounded-t-[4rem] -mt-16 relative z-10 border-t border-white/10">
        {results.length > 0 ? (
          <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-300">
            <div className="text-center">
              <div className="w-14 h-1.5 bg-gray-800 rounded-full mx-auto mb-8"></div>
              <p className="text-[#bd004d] text-[11px] font-black uppercase tracking-[0.4em] mb-2">Lectura de Precisión</p>
              <p className="text-white/30 text-[10px]">Toca el valor que deseas capturar</p>
            </div>
            
            <div className="grid gap-4 max-h-60 overflow-y-auto custom-scrollbar px-2">
              {results.map((res, i) => (
                <button
                  key={i}
                  onClick={() => onCodeSelected(res)}
                  className="w-full py-6 px-6 bg-white/[0.04] border border-white/10 text-white font-mono text-base break-all rounded-[2rem] active:bg-[#bd004d] transition-all flex items-center justify-center text-center shadow-2xl"
                >
                  {res}
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => setResults([])}
              className="w-full py-3 text-white/20 text-[10px] font-black uppercase tracking-[0.5em] hover:text-white transition-colors"
            >
              Capturar de nuevo
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-10">
            <div className="w-14 h-1.5 bg-gray-800 rounded-full mb-2"></div>
            
            <button 
              onClick={captureAndRead}
              disabled={isScanning}
              className={`w-full h-24 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.5em] transition-all flex items-center justify-center gap-6 ${
                isScanning ? 'bg-gray-900 text-gray-700' : 'bg-[#bd004d] text-white shadow-[0_25px_60px_rgba(189,0,77,0.5)] active:scale-95'
              }`}
            >
              {isScanning ? (
                <>
                  <div className="w-7 h-7 border-4 border-white/10 border-t-white rounded-full animate-spin"></div>
                  <span>ANALIZANDO...</span>
                </>
              ) : (
                <>
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <circle cx="12" cy="13" r="3" strokeWidth="2.5" />
                  </svg>
                  <span>ESCANEAR AHORA</span>
                </>
              )}
            </button>
            <p className="text-white/5 text-[8px] font-bold tracking-[0.8em] uppercase">High Sensitivity Reader 8.5</p>
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
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 26px;
          height: 26px;
          background: #bd004d;
          border: 5px solid white;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(0,0,0,0.4);
        }
      `}</style>
    </div>
  );
};
