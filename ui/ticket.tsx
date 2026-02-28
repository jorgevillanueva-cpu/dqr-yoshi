import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { TicketData } from '../types';
import { COLORS } from '../constants';
import { YoshiLogo, FullLogo } from './logos';

interface TicketPreviewProps {
  data: TicketData;
  innerRef: React.RefObject<HTMLDivElement>;
}

export const TicketPreview: React.FC<TicketPreviewProps> = ({ data, innerRef }) => {
  return (
    <div 
      ref={innerRef}
      className="relative w-full max-w-[390px] min-h-[600px] bg-white shadow-2xl rounded-[2.2rem] overflow-hidden mx-auto flex flex-col"
      style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#F9FAFB' 
      }}
    >
      {/* Cabecera optimizada */}
      <div className="relative w-full bg-white flex flex-col items-center justify-start border-b border-dashed border-gray-200 px-10 pt-4 pb-4">
        <FullLogo className="w-full h-auto max-h-[3.2rem]" />
        
        <div className="flex flex-col items-center mt-2 space-y-1">
          {data.isTokens && (
            <span className="text-[22px] font-black text-[#fa005a] uppercase tracking-[0.3em] leading-none">
              Tokens
            </span>
          )}
          {data.cortesia && (
            <span className="text-[22px] font-black text-[#fa005a] uppercase tracking-[0.3em] animate-in zoom-in-95 duration-500 leading-none">
              Cortesia
            </span>
          )}
        </div>
      </div>

      {/* Seccion de Saldo */}
      {data.saldo && data.saldo.trim() !== '' && !data.isTokens && (
        <div className="relative px-8 pt-0 pb-0 mt-6 z-20">
          <div 
            className="w-full h-16 rounded-[1.2rem] shadow-md flex flex-col items-center justify-center text-white overflow-hidden relative"
            style={{ backgroundColor: COLORS.PRIMARY }}
          >
            <div className="absolute inset-0 opacity-10 flex flex-wrap gap-2 p-1 overflow-hidden rotate-12 scale-150">
              {Array.from({ length: 20 }).map((_, i) => (
                <YoshiLogo key={i} className="h-4 w-4" color="#FFFFFF" />
              ))}
            </div>
            
            <div className="relative z-10 flex flex-col items-center justify-center transform -translate-y-[6px]">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-80 leading-none mb-1">
                Saldo Disponible
              </span>
              <span className="text-[34px] font-normal tracking-tighter leading-none">
                ${data.saldo}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Cuerpo del Ticket */}
      <div className="flex-1 flex flex-col items-center justify-start py-2 px-8 relative">
        <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gray-50 border border-gray-100 shadow-inner"></div>
        <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gray-50 border border-gray-100 shadow-inner"></div>

        <p className="text-[18px] font-medium text-gray-400 text-center mb-3 max-w-[85%] leading-tight tracking-tight mt-0">
          Presenta este codigo QR para pagar en el recinto
        </p>
        <div className="w-full aspect-square bg-white rounded-[2rem] shadow-lg border border-gray-100 px-4 flex items-center justify-center relative overflow-hidden">
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
              VALIDO EN RECINTO: <span className="text-[#fa005a]">{data.valido}</span>
            </p>
          </div>
        )}

        {data.showExtraData && data.extraData && data.extraData.trim() !== '' && (
          <div className="mt-6 mb-4">
            <span className="text-[22px] font-black text-gray-700 uppercase tracking-tight text-center max-w-full px-4 leading-tight italic opacity-80 block">
              {data.extraData}
            </span>
          </div>
        )}

        {/* Leyenda condicional */}
        {!data.cortesia && !data.isTokens && (
          <div className="mt-auto pt-1 pb-4 w-full border-t border-dashed border-gray-200/30">
            <p className="text-[19px] font-medium text-gray-400 text-center leading-snug tracking-tight">
              Solicita tu saldo remanente desde<br/>
              <span className="text-[18px] text-[#fa005a] font-normal lowercase tracking-widest block">
                yoshicash.com/refunds
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
