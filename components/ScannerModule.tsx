
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
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        showPopMessage("Permiso de cámara denegado. Actívalo en ajustes.", "error");
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

    const video = videoRef.current;
    if (video.videoWidth === 0) {
      showPopMessage("Iniciando cámara...", "info");
      return;
    }

    setIsScanning(true);
    setScanStatus('uploading');
    
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    // Optimizar resolución para OCR sin exceder límites de tokens
    const MAX_DIMENSION = 1024;
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
    
    // Calidad media para balancear velocidad y detalle
    const base64Image = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];

    const performOcr = async (): Promise<string> => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
            { text: "Lee el ticket y extrae exclusivamente cadenas de texto importantes, números de folio, ID de transacción o códigos alfanuméricos únicos. Devuelve los resultados separados por comas, sin explicaciones." }
          ]
        },
        config: {
          systemInstruction: "Eres un experto en OCR para tickets de pago. Tu objetivo es identificar cualquier cadena de caracteres o números que parezcan un identificador único (Folio, Ticket ID, Referencia). Ignora precios totales o fechas a menos que contengan letras.",
          temperature: 0.1,
        }
      });
      return result.text || "";
    };

    try {
      const responseText = await performOcr();
      
      if (!responseText.trim() || responseText.toLowerCase().includes("unable") || responseText.toLowerCase().includes("no se")) {
        showPopMessage("No se detectó texto claro. Intenta acercar más el ticket.", "info");
      } else {
        const found = responseText.split(',')
          .map(s => s.trim())
          .filter(s => s.length >= 3);
        
        if (found.length > 0) {
          setResults(Array.from(new Set(found)));
          showPopMessage("Lectura completada", "success");
        } else {
          showPopMessage("No se encontraron códigos válidos", "info");
        }
      }
    } catch (err: any) {
      console.error(err);
      showPopMessage("Error al procesar. Verifica tu conexión.", "error");
    } finally {
      setIsScanning(false);
      setScanStatus('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300">
      {/* Área de Video */}
      <div className="flex-1 relative overflow-hidden bg-black">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className={`w-full h-full object-cover transition-opacity duration-700 ${isScanning ? 'opacity-40' : 'opacity-80'}`} 
        />
        
        {/* Overlay de Guía Visual */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-[85%] h-[30%] max-h-56 border-2 border-white/10 rounded-[2rem] relative shadow-[0_0_0_1000px_rgba(0,0,0,0.5)]">
            {/* Esquinas del Escáner */}
            <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-[#bd004d] rounded-tl-[1.5rem]"></div>
            <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-[#bd004d] rounded-tr-[1.5rem]"></div>
            <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-[#bd004d] rounded-bl-[1.5rem]"></div>
            <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-[#bd004d] rounded-br-[1.5rem]"></div>
            
            {/* Línea de Escaneo Animada */}
            {isScanning && (
              <div className="absolute top-0 left-0 w-full h-1 bg-[#bd004d] shadow-[0_0_25px_#bd004d] animate-[scan_2s_infinite] opacity-80"></div>
            )}
            
            {/* Feedback Central */}
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="bg-black/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
                  <p className="text-white/60 text-[8px] font-black uppercase tracking-[0.3em]">Alinea el código aquí</p>
               </div>
            </div>
          </div>
          
          <p className="text-white/40 font-bold text-[10px] uppercase tracking-[0.2em] mt-12 text-center px-10 leading-relaxed max-w-xs">
            {isScanning ? 'Procesando imagen con IA...' : 'Captura el ticket para extraer el folio automáticamente'}
          </p>
        </div>

        {/* Botón Cerrar */}
        <button 
          onClick={onClose}
          className="absolute top-12 right-6 p-4 bg-black/50 text-white rounded-full backdrop-blur-xl border border-white/10 active:scale-90 transition-transform shadow-2xl"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Panel Inferior de Resultados y Acción */}
      <div className="bg-[#0A0A0A] p-8 pb-14 rounded-t-[3.5rem] -mt-16 relative z-10 border-t border-white/10 shadow-[0_-40px_80px_rgba(0,0,0,0.9)]">
        {results.length > 0 ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-500">
            <div className="text-center">
              <div className="w-12 h-1.5 bg-gray-800 rounded-full mx-auto mb-6"></div>
              <p className="text-[#bd004d] text-[11px] font-black uppercase tracking-[0.2em] mb-1">Texto Detectado</p>
              <p className="text-white/40 text-[11px] font-medium">Toca el folio correcto para seleccionarlo</p>
            </div>
            
            <div className="flex flex-col gap-3 max-h-56 overflow-y-auto custom-scrollbar pr-2">
              {results.map((res, i) => (
                <button
                  key={i}
                  onClick={() => onCodeSelected(res)}
                  className="w-full px-6 py-5 bg-white/[0.04] border border-white/10 text-white font-mono text-lg uppercase text-center rounded-2xl active:bg-[#bd004d] active:border-[#bd004d] active:scale-[0.98] transition-all hover:border-[#bd004d]/50"
                >
                  {res}
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => { setResults([]); setIsScanning(false); }}
              className="w-full py-4 text-white/30 text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 hover:text-[#bd004d] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Escanear de nuevo
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8">
            <div className="w-12 h-1.5 bg-gray-800 rounded-full mb-2"></div>
            
            <button 
              onClick={captureFrame}
              disabled={isScanning}
              className={`w-full h-20 rounded-3xl font-black text-xs uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-5 shadow-2xl ${
                isScanning 
                  ? 'bg-gray-900 text-gray-600' 
                  : 'bg-[#bd004d] text-white shadow-[0_20px_40px_rgba(189,0,77,0.3)] active:scale-95'
              }`}
            >
              {isScanning ? (
                <>
                  <div className="w-6 h-6 border-3 border-gray-700 border-t-[#bd004d] rounded-full animate-spin"></div>
                  <span>Analizando Ticket...</span>
                </>
              ) : (
                <>
                  <div className="p-3 bg-white/10 rounded-xl">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span>Extraer Datos</span>
                </>
              )}
            </button>
            
            <div className="flex flex-col items-center gap-2">
              <span className="text-white/10 text-[8px] font-black tracking-[0.4em] uppercase">Powered by Gemini AI</span>
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="w-1 h-1 rounded-full bg-[#bd004d]/20"></div>
                ))}
              </div>
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
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #bd004d; }
      `}</style>
    </div>
  );
};
