
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { TicketData } from '../types';
import { COLORS } from '../constants';

interface TicketPreviewProps {
  data: TicketData;
  innerRef: React.RefObject<HTMLDivElement>;
}

// Logo SVG updated with the new branding provided
export const YoshiLogo: React.FC<{ className?: string; color?: string }> = ({ className, color = COLORS.PRIMARY }) => (
  <svg 
    className={className} 
    viewBox="0 0 288 337" 
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid meet"
  >
    <g transform="translate(0.000000,337.000000) scale(0.100000,-0.100000)" fill={color} stroke="none">
      <path d="M610 3210 c0 -41 -4 -60 -12 -60 -7 -1 -140 0 -296 0 l-282 1 3 -758 c2 -417 6 -776 10 -798 16 -88 62 -211 109 -288 61 -102 246 -287 286 -287 6 0 12 -3 14 -8 4 -10 134 -67 183 -80 22 -6 59 -15 81 -21 26 -7 169 -11 378 -11 l336 0 0 221 0 221 33 -7 c17 -4 42 -11 55 -16 l22 -9 0 -333 0 -334 178 0 c294 -1 380 10 500 64 29 12 55 23 58 23 3 0 26 14 52 32 140 96 239 233 286 398 26 91 36 266 36 630 0 386 -11 518 -56 675 -40 136 -129 302 -219 404 -62 72 -138 142 -199 185 -61 44 -231 137 -271 148 -217 61 -291 67 -862 68 l-423 0 0 -60z m1060 -257 c291 -70 496 -247 611 -528 41 -102 58 -335 59 -820 0 -342 -22 -434 -132 -544 -77 -77 -211 -126 -323 -119 l-50 3 -3 161 c-3 184 -7 175 87 167 64 -5 154 11 186 34 54 40 73 141 36 197 -39 59 -62 66 -215 66 -159 0 -339 26 -421 60 -223 94 -363 203 -474 370 -137 207 -171 353 -171 740 l0 230 383 -3 c224 -2 401 -8 427 -14z m-1109 -323 c8 -268 22 -363 76 -520 80 -234 215 -413 446 -594 l37 -28 0 -144 0 -144 -171 0 c-186 0 -240 9 -338 58 -76 38 -188 151 -229 232 -60 119 -62 144 -62 776 0 314 3 574 7 578 4 3 57 5 117 4 l111 -3 6 -215z"/>
      <path d="M1905 2163 c-90 -47 -118 -157 -62 -242 88 -133 298 -69 301 93 3 120 -133 205 -239 149z"/>
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
          <YoshiLogo className="h-16 w-16" />
          <h2 className="text-[20px] font-extrabold text-gray-900 font-title -mt-1 tracking-tight">
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
              <span className="text-[11px] font-bold uppercase tracking-[0.3em] opacity-80 mt-0 -mb-1 transform -translate-y-[5px]">
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

        <p className="text-[18px] font-medium text-gray-400 text-center mb-8 max-w-[90%] leading-snug tracking-tight">
          Usa este ticket para pagar presentando el código QR
        </p>

        {/* Contenedor del QR */}
        <div className="w-full aspect-square bg-white rounded-[40px] shadow-2xl border-2 border-gray-50 p-4 flex items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 opacity-[0.03] flex items-center justify-center rotate-12">
             <YoshiLogo className="w-[120%]" />
          </div>
          
          <QRCodeSVG 
            value={data.codigo || 'yoshi'} 
            size={340}
            level="H"
            fgColor="#000000"
            bgColor="transparent"
            includeMargin={false}
          />
        </div>

        <p className="text-[18px] font-medium text-gray-400 text-center mt-10 max-w-[95%] leading-tight tracking-tight">
          Solicita tu saldo remanente desde<br/>
          <span className="text-[16px] text-[#d6045b] font-bold lowercase tracking-wider">https://yoshicash.com/refunds</span>
        </p>
      </div>

      {/* Pie de Ticket */}
      <div className="h-[22%] bg-white flex flex-col items-center justify-start pt-10 px-8 border-t-2 border-dashed border-gray-100">
        <div className="text-center w-full mb-6">
          <p className="text-lg font-medium text-black break-all lowercase leading-tight tracking-[0.25em] font-mono">
            {data.codigo || '---'}
          </p>
        </div>
        <div className="flex gap-1.5 h-6 opacity-20 w-full justify-center">
           {Array.from({ length: 60 }).map((_, i) => (
             <div key={i} className="bg-black" style={{ width: `${Math.random() * 4 + 1}px` }}></div>
           ))}
        </div>
        <div className="flex-1 w-full"></div>
      </div>
    </div>
  );
};
