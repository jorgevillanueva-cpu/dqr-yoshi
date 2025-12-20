
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { TicketData } from '../types';
import { COLORS } from '../constants';

interface TicketPreviewProps {
  data: TicketData;
  innerRef: React.RefObject<HTMLDivElement>;
}

// Logo SVG restaurado a la versión original de tres trazos
export const YoshiLogo: React.FC<{ className?: string; color?: string }> = ({ className, color = COLORS.PRIMARY }) => (
  <svg className={className} viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" stroke={color} strokeWidth="38" strokeLinecap="round" strokeLinejoin="round">
      <path d="M 125 80 L 125 375 C 125 375 125 420 170 420 L 245 420 L 245 350" />
      <path d="M 245 350 C 245 350 245 420 310 420 C 375 420 425 375 425 250 C 425 125 350 80 250 80 L 125 80" />
      <path d="M 250 80 C 250 80 180 80 180 220 C 180 350 300 370 300 330" />
      <circle cx="335" cy="235" r="22" fill={color} stroke="none" />
    </g>
  </svg>
);

export const TicketPreview: React.FC<TicketPreviewProps> = ({ data, innerRef }) => {
  return (
    <div 
      ref={innerRef}
      className="relative w-full max-w-[450px] aspect-[707/1800] bg-white shadow-2xl rounded-xl overflow-hidden mx-auto flex flex-col"
      style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#F9FAFB' 
      }}
    >
      {/* Cabecera con Logo */}
      <div className="relative h-[11%] w-full bg-white flex flex-col items-center justify-center border-b-2 border-dashed border-gray-100">
        <div className="flex flex-col items-center">
          <YoshiLogo className="h-20 w-20" />
          <h2 className="text-[20px] font-extrabold text-gray-900 font-title -mt-2 tracking-tight">
            Yoshi Cash
          </h2>
        </div>
      </div>

      {/* Sección de Saldo */}
      {data.saldo && data.saldo.trim() !== '' && (
        <div className="relative px-8 pt-8 pb-4">
          <div 
            className="w-full h-24 rounded-3xl shadow-lg flex flex-col items-center justify-center text-white overflow-hidden relative"
            style={{ backgroundColor: COLORS.PRIMARY }}
          >
            <div className="absolute inset-0 opacity-10 flex flex-wrap gap-6 p-4 overflow-hidden rotate-12 scale-150">
              {Array.from({ length: 12 }).map((_, i) => (
                <YoshiLogo key={i} className="h-6 w-6" color="#FFFFFF" />
              ))}
            </div>
            
            <div className="relative z-10 flex flex-col items-center justify-center">
              <span className="text-[11px] font-bold uppercase tracking-[0.3em] opacity-80 mt-0 -mb-1">
                Saldo Disponible
              </span>
              <span className="text-[42px] font-medium tracking-tighter -mt-5">
                ${data.saldo}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Cuerpo del Ticket con Código QR */}
      <div className="flex-1 flex flex-col items-center justify-center pt-4 pb-12 px-10 relative">
        <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gray-50 border border-gray-100 shadow-inner"></div>
        <div className="absolute -right-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gray-50 border border-gray-100 shadow-inner"></div>

        <p className="text-[20px] font-medium text-gray-400 text-center mb-8 max-w-[90%] leading-snug tracking-tight">
          Usa este ticket para pagar presentando el código QR
        </p>

        <div className="w-full aspect-square bg-white rounded-[50px] shadow-2xl border-2 border-gray-50 p-10 flex items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 opacity-[0.03] flex items-center justify-center rotate-12">
             <YoshiLogo className="w-[120%]" />
          </div>
          
          <QRCodeSVG 
            value={data.codigo || 'yoshi'} 
            size={400}
            level="H"
            fgColor="#000000"
            bgColor="transparent"
            includeMargin={false}
          />
        </div>

        <p className="text-[20px] font-medium text-gray-400 text-center mt-10 max-w-[95%] leading-tight tracking-tight">
          Solicita tu saldo remanente desde<br/>
          <span className="text-[20px] text-[#bd004d] font-bold lowercase tracking-wider">https://yoshicash.com/refunds</span>
        </p>
      </div>

      {/* Pie de Ticket alaragado (Sección blanca final) */}
      <div className="h-[22%] bg-white flex flex-col items-center justify-start pt-10 px-8 border-t-2 border-dashed border-gray-100">
        <div className="text-center w-full mb-6">
          <p className="text-lg font-medium text-Black-500 break-all lowercase leading-tight tracking-[0.25em] font-mono">
            {data.codigo || '---'}
          </p>
        </div>
        <div className="flex gap-1.5 h-6 opacity-20 w-full justify-center">
           {Array.from({ length: 60 }).map((_, i) => (
             <div key={i} className="bg-black" style={{ width: `${Math.random() * 4 + 1}px` }}></div>
           ))}
        </div>
        {/* Espacio blanco extra al final para simular el corte del ticket */}
        <div className="flex-1 w-full"></div>
      </div>
    </div>
  );
};
