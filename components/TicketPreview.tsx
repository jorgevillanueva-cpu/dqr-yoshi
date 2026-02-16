
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { TicketData } from '../types';
import { COLORS } from '../constants';

interface TicketPreviewProps {
  data: TicketData;
  innerRef: React.RefObject<HTMLDivElement>;
}

const FullLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className}
    viewBox="0 0 600 218" 
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid meet"
  >
    <g transform="translate(0.000000,218.000000) scale(0.100000,-0.100000)">
      <g fill="#d7035a">
        <path d="M450 1906 l0 -36 -160 0 -161 0 3 -437 c3 -427 4 -439 25 -493 51 -124 150 -223 271 -271 51 -21 77 -24 260 -27 l202 -3 0 120 c0 109 2 121 18 121 43 -1 45 -9 43 -200 l-2 -182 153 4 c184 5 238 22 322 99 117 107 136 176 136 504 0 247 -8 333 -40 422 -63 180 -222 330 -409 386 -58 18 -104 21 -363 24 l-298 5 0 -36z m595 -150 c168 -45 300 -180 334 -344 15 -72 15 -542 0 -593 -26 -87 -113 -149 -207 -149 l-52 0 0 90 0 90 65 0 c57 0 69 3 90 25 33 32 33 78 0 110 -22 23 -32 25 -112 25 -176 1 -294 43 -403 146 -79 75 -134 170 -155 271 -9 40 -15 125 -15 206 l0 137 203 0 c137 0 218 -5 252 -14z m-613 -213 c5 -136 9 -168 31 -230 43 -125 119 -234 213 -306 l54 -42 0 -84 0 -84 -106 6 c-118 8 -168 24 -227 77 -95 83 -106 142 -107 543 l0 277 69 0 69 0 4 -157z"/>
        <path d="M1135 1315 c-34 -33 -34 -92 0 -129 68 -73 191 18 143 107 -18 34 -39 46 -81 47 -27 0 -45 -7 -62 -25z"/>
      </g>
      <g fill="#333333">
        <path d="M1943 1628 c28 -67 339 -877 343 -894 8 -33 -41 -163 -79 -209 -41 -50 -81 -65 -176 -65 l-79 0 -17 -95 c-10 -53 -14 -99 -10 -103 3 -4 56 -9 117 -10 145 -5 225 19 301 88 76 70 109 132 203 386 165 443 316 847 330 880 l14 34 -133 0 -133 0 -94 -310 c-51 -171 -96 -310 -100 -310 -4 0 -54 139 -111 310 l-104 310 -139 0 c-107 0 -137 -3 -133 -12z"/>
        <path d="M3186 1609 c-65 -15 -155 -70 -204 -124 -173 -189 -174 -527 -3 -708 87 -92 198 -137 341 -137 278 0 470 202 470 495 0 231 -132 417 -334 471 -57 15 -210 17 -270 3z m213 -193 c42 -22 88 -80 103 -128 8 -25 13 -94 13 -168 0 -115 -2 -130 -27 -182 -30 -65 -68 -94 -136 -104 -138 -21 -221 77 -230 271 -7 163 21 251 97 302 40 27 135 32 180 9z"/>
        <path d="M4045 1606 c-156 -49 -237 -179 -205 -330 22 -106 93 -170 275 -247 164 -69 197 -108 141 -164 -29 -29 -78 -39 -165 -33 -60 5 -104 20 -193 66 -8 4 -88 -150 -88 -168 0 -6 24 -22 53 -35 138 -65 356 -74 474 -20 119 53 182 158 170 285 -12 131 -81 196 -299 281 -56 22 -113 50 -125 61 -43 41 -20 108 42 124 50 12 168 -2 217 -26 26 -13 49 -22 52 -19 2 2 22 41 45 87 l42 83 -53 23 c-29 13 -77 28 -106 35 -70 15 -226 13 -277 -3z"/>
        <path d="M4590 1335 l0 -695 129 0 130 0 -6 305 c-7 348 -10 335 75 396 91 64 193 63 230 -4 15 -29 17 -68 17 -364 l0 -333 128 0 128 0 -3 378 c-4 426 -6 438 -80 512 -103 103 -309 92 -445 -25 -23 -19 -44 -35 -48 -35 -4 0 -3 126 1 280 l7 280 -132 0 -131 0 0 -695z"/>
        <path d="M5674 1998 c-26 -5 -53 -21 -74 -43 -27 -28 -34 -44 -38 -89 -5 -68 21 -117 79 -146 106 -54 229 18 229 135 0 97 -92 164 -196 143z"/>
        <path d="M5590 1110 l0 -470 125 0 125 0 0 470 0 470 -125 0 -125 0 0 -470z"/>
        <path d="M4681 443 c-48 -24 -71 -67 -71 -131 0 -74 22 -116 74 -142 79 -38 165 -16 198 49 21 43 16 51 -30 51 -26 0 -41 -6 -50 -20 -17 -27 -77 -28 -92 -1 -17 33 -12 106 8 124 25 23 59 21 79 -3 12 -14 30 -20 60 -20 42 0 42 0 32 29 -6 16 -21 39 -35 52 -33 31 -124 37 -173 12z"/>
        <path d="M4998 445 c-27 -15 -48 -43 -48 -64 0 -17 68 -13 96 5 31 21 74 6 74 -26 0 -17 -6 -20 -50 -20 -92 0 -140 -34 -140 -99 0 -72 88 -112 163 -73 29 16 37 17 37 6 0 -10 13 -14 41 -14 l41 0 -3 120 c-4 115 -5 121 -31 147 -23 23 -38 28 -90 30 -43 2 -72 -2 -90 -12z m122 -185 c0 -23 -41 -53 -66 -48 -22 4 -39 31 -31 52 5 11 19 16 52 16 38 0 45 -3 45 -20z"/>
        <path d="M5308 445 c-34 -19 -48 -44 -48 -84 0 -39 35 -67 103 -81 64 -13 82 -23 74 -44 -9 -22 -85 -22 -93 -1 -9 22 -94 21 -94 -1 0 -28 54 -71 98 -79 92 -15 166 19 178 82 5 27 1 37 -23 62 -18 18 -45 32 -69 36 -91 15 -116 35 -70 56 20 10 30 9 50 -5 32 -20 96 -22 96 -2 0 8 -11 27 -24 42 -20 24 -32 28 -87 31 -44 2 -72 -1 -91 -12z"/>
        <path d="M5570 355 l0 -195 45 0 45 0 0 105 c0 93 2 105 19 115 28 14 57 12 75 -6 12 -12 16 -38 16 -115 l0 -99 43 0 43 0 -3 118 c-3 64 -9 127 -15 138 -21 43 -94 57 -148 29 l-30 -16 0 61 0 60 -45 0 -45 0 0 -195z"/>
      </g>
    </g>
  </svg>
);

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
      className="relative w-full max-w-[390px] aspect-[707/1340] bg-white shadow-2xl rounded-[2.2rem] overflow-hidden mx-auto flex flex-col"
      style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#F9FAFB' 
      }}
    >
      {/* Cabecera compactada */}
      <div className="relative h-[18%] w-full bg-white flex flex-col items-center justify-start border-b border-dashed border-gray-200 px-10 pt-8">
        <FullLogo className="w-full h-auto max-h-[3.2rem]" />
        
        <div className="flex flex-col items-center mt-3 space-y-1">
          {data.cortesia && (
            <span className="text-[20px] font-normal text-[#d6045b] uppercase tracking-[0.2em] animate-in zoom-in-95 duration-500 leading-none">
              Cortesía
            </span>
          )}
          
          {data.showExtraData && data.extraData && data.extraData.trim() !== '' && (
            <span className="text-[14px] font-semibold text-gray-500 uppercase tracking-tight text-center max-w-full px-4 leading-tight italic opacity-70">
              {data.extraData}
            </span>
          )}
        </div>
      </div>

      {/* Sección de Saldo reducida */}
      {data.saldo && data.saldo.trim() !== '' && (
        <div className="relative px-8 pt-2 pb-0">
          <div 
            className="w-full h-16 rounded-[1.2rem] shadow-md flex flex-col items-center justify-center text-white overflow-hidden relative"
            style={{ backgroundColor: COLORS.PRIMARY }}
          >
            <div className="absolute inset-0 opacity-10 flex flex-wrap gap-2 p-1 overflow-hidden rotate-12 scale-150">
              {Array.from({ length: 20 }).map((_, i) => (
                <YoshiLogo key={i} className="h-4 w-4" color="#FFFFFF" />
              ))}
            </div>
            
            <div className="relative z-10 flex flex-col items-center justify-center">
              <span className="text-[7px] font-bold uppercase tracking-[0.2em] opacity-80 -mb-0.5 transform -translate-y-[1px]">
                Saldo Disponible
              </span>
              <span className="text-[34px] font-normal tracking-tighter leading-none py-1">
                ${data.saldo}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Cuerpo del Ticket optimizado */}
      <div className="flex-1 flex flex-col items-center justify-start py-2 px-8 relative">
        <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gray-50 border border-gray-100 shadow-inner"></div>
        <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gray-50 border border-gray-100 shadow-inner"></div>

        <p className="text-[18px] font-medium text-gray-400 text-center mb-3 max-w-[85%] leading-tight tracking-tight">
          Presenta este código QR para pagar en el recinto
        </p>

        <div className="w-full aspect-square bg-white rounded-[2rem] shadow-lg border border-gray-100 p-4 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.01] flex items-center justify-center rotate-12 scale-110">
             <YoshiLogo className="w-full" />
          </div>
          
          <QRCodeSVG 
            value={data.codigo || 'yoshi'} 
            size={265}
            level="H"
            fgColor="#000000"
            bgColor="transparent"
            includeMargin={false}
          />
        </div>

        {data.valido && data.valido.trim() !== '' && (
          <div className="mt-3 px-3 py-1.5 rounded-md bg-gray-100/20 border border-gray-100/50 backdrop-blur-sm">
            <p className="text-[14px] font-bold text-gray-700 text-center uppercase tracking-widest">
              VÁLIDO EN RECINTO: <span className="text-[#d6045b]">{data.valido}</span>
            </p>
          </div>
        )}

        {/* Pie de página compacto y elevado (pb-4 para recortar abajo, pt-1 para subir el texto) */}
        <div className="mt-auto pt-1 pb-4 w-full border-t border-dashed border-gray-200/30">
          <p className="text-[19px] font-medium text-gray-400 text-center leading-snug tracking-tight">
            Solicita tu saldo remanente desde<br/>
            <span className="text-[18px] text-[#d6045b] font-normal lowercase tracking-widest block">
              yoshicash.com/refunds
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
