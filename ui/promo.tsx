
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { PromoData } from '../types';
import { YoshiLogo } from './logos';
import { COLORS } from '../constants';

interface PromoPreviewProps {
  data: PromoData;
  innerRef: (el: HTMLDivElement | null) => void;
}

export const PromoPreview: React.FC<PromoPreviewProps> = ({ data, innerRef }) => {
  return (
    <div 
      ref={innerRef}
      className="relative w-full max-w-[450px] aspect-[707/1100] bg-white shadow-2xl rounded-3xl overflow-hidden mx-auto flex flex-col border border-gray-100"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div className="bg-[#d6045b] p-8 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 flex flex-wrap gap-8 p-4 rotate-12 scale-150 pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <YoshiLogo key={i} className="h-10 w-10" color="#FFFFFF" />
          ))}
        </div>
        <YoshiLogo className="h-16 w-16 mb-2 relative z-10" color="#FFFFFF" />
        <h2 className="text-white text-3xl font-black uppercase tracking-tighter relative z-10">¡PROMOCIÓN!</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
        <div className="mb-6">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] block mb-1">Válido para</span>
          <h3 className="text-4xl font-black text-gray-900 leading-none">{data.tipo}</h3>
          {data.producto && (
            <p className="text-xl font-bold text-[#d6045b] mt-2 uppercase tracking-tight">{data.producto}</p>
          )}
        </div>

        <div className="w-full aspect-square max-w-[240px] bg-white rounded-3xl shadow-xl border-4 border-gray-50 p-4 mb-6 flex items-center justify-center relative">
          <QRCodeSVG value={data.promo} size={200} level="H" />
        </div>

        <div className="bg-gray-50 px-6 py-3 rounded-2xl border border-gray-100">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Código de Canje</p>
          <p className="text-xl font-mono font-bold text-gray-800 tracking-wider">{data.promo}</p>
        </div>
      </div>

      <div className="p-6 bg-gray-50 border-t border-dashed border-gray-200 text-center">
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Presenta este QR en sucursal</p>
      </div>
    </div>
  );
};
