
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { TicketData } from '../types';
import { COLORS } from '../constants';

interface TicketPreviewProps {
  data: TicketData;
  innerRef: React.RefObject<HTMLDivElement>;
}

// Logo SVG Inline para máxima compatibilidad con html2canvas
const YoshiLogo: React.FC<{ className?: string; color?: string }> = ({ className, color = COLORS.PRIMARY }) => (
  <svg className={className} viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" stroke={color} strokeWidth="35" strokeLinecap="round" strokeLinejoin="round">
      <path d="M 125 80 L 125 375 C 125 375 125 420 170 420 L 245 420 L 245 350" />
      <path d="M 245 350 C 245 350 245 420 310 420 C 375 420 425 375 425 250 C 425 125 350 80 250 80 L 125 80" />
      <path d="M 250 80 C 250 80 180 80 180 220 C 180 350 300 370 300 330" />
      <circle cx="330" cy="235" r="20" fill={color} stroke="none" />
    </g>
  </svg>
);

export const TicketPreview: React.FC<TicketPreviewProps> = ({ data, innerRef }) => {
  return (
    <div 
      ref={innerRef}
      className="relative w-full max-w-[450px] aspect-[707/1560] bg-white shadow-2xl rounded-xl overflow-hidden mx-auto flex flex-col"
      style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#F9FAFB' 
      }}
    >
      {/* --- CABECERA PREMIUM --- */}
      <div className="relative h-[10%] w-full bg-white flex flex-col items-center justify-center border-b-2 border-dashed border-gray-100">
        <div className="flex flex-col items-center">
          <YoshiLogo className="h-16 w-16" />
          <h2 className="text-[18px] font-extrabold text-gray-900 font-title -mt-1 tracking-tight">
            Yoshi Cash
          </h2>
        </div>
        <div className="absolute top-2 right-2 opacity-5">
           <YoshiLogo className="h-16 w-16 rotate-12" />
        </div>
      </div>

      {/* --- SECCIÓN SALDO --- */}
      {data.saldo && data.saldo.trim() !== '' && (
        <div className="relative px-8 pt-6 pb-4">
          <div 
            className="w-full h-20 rounded-2xl shadow-md flex flex-col items-center justify-center text-white overflow-hidden relative"
            style={{ backgroundColor: COLORS.PRIMARY }}
          >
            <div className="absolute inset-0 opacity-10 pointer-events-none flex flex-wrap gap-4 p-2 overflow-hidden">
              {Array.from({ length: 15 }).map((_, i) => (
                <YoshiLogo key={i} className="h-5 w-5" color="#FFFFFF" />
              ))}
            </div>
            
            {/* Contenedor de texto con desplazamiento vertical hacia arriba (10px) */}
            <div className="relative z-10 flex flex-col items-center" style={{ transform: 'translateY(-10px)' }}>
              <span className="text-[10px] font-normal uppercase tracking-widest opacity-80">
                Saldo Disponible
              </span>
              <span className="text-4xl font-normal tracking-tighter drop-shadow-sm">
                ${data.saldo}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* --- SECCIÓN QR --- */}
      <div className="flex-1 flex flex-col items-center justify-center pt-2 pb-10 px-10 relative">
        <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gray-50 border border-gray-100 shadow-inner"></div>
        <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gray-50 border border-gray-100 shadow-inner"></div>

        <p className="text-[20px] font-semibold text-gray-500 text-center mb-6 max-w-[90%] leading-snug tracking-tight">
          Usa este ticket para pagar presentando el código QR
        </p>

        <div className="w-full aspect-square bg-white rounded-3xl shadow-lg border-2 border-gray-50 p-8 flex items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 opacity-[0.03] flex items-center justify-center">
             <YoshiLogo className="w-[80%]" />
          </div>
          
          <QRCodeSVG 
            value={data.codigo || 'yoshi'} 
            size={240}
            level="H"
            fgColor={COLORS.SECONDARY}
            bgColor="transparent"
            includeMargin={false}
          />
        </div>

        <p className="text-[20px] font-semibold text-gray-500 text-center mt-8 max-w-[95%] leading-tight tracking-tight">
          Solicita tu saldo remanente desde:<br/>
          <span className="text-[18px] text-gray-400 font-medium">yoshicash.com/refunds</span>
        </p>
      </div>

      {/* --- PIE DE TICKET --- */}
      <div className="h-[12%] bg-white flex flex-col items-center justify-center px-8 border-t-2 border-dashed border-gray-100">
        <div className="text-center w-full">
          <p className="text-2xl font-normal text-gray-900 break-all lowercase leading-tight tracking-widest">
            {data.codigo || '---'}
          </p>
        </div>
        <div className="mt-6 flex gap-1 h-4 opacity-15 w-full justify-center">
           {Array.from({ length: 50 }).map((_, i) => (
             <div key={i} className="bg-black" style={{ width: `${Math.random() * 3 + 1}px` }}></div>
           ))}
        </div>
      </div>
    </div>
  );
};
