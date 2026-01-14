
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { TicketPreview, YoshiLogo } from './components/TicketPreview';
import { PromoPreview } from './components/PromoPreview';
import { ScannerModule } from './components/ScannerModule';
import { TicketData, PromoData } from './types';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cash' | 'promo'>('cash');
  
  // Estado para Tickets de Efectivo
  const [formData, setFormData] = useState<TicketData>({
    saldo: '',
    codigo: '',
    phone: ''
  });
  const [showPreview, setShowPreview] = useState(false);

  // Estado para Promociones
  const [promoForm, setPromoForm] = useState<{ tipo: string; customTipo: string; producto: string; promo: string; phone: string }>({
    tipo: '',
    customTipo: '',
    producto: '',
    promo: '',
    phone: ''
  });
  const [generatedPromos, setGeneratedPromos] = useState<PromoData[]>([]);
  const [envioPersonalizado, setEnvioPersonalizado] = useState(false);
  const [showPromoResults, setShowPromoResults] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'saldo' | 'codigo'>('codigo');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const ticketRef = useRef<HTMLDivElement>(null);
  const promoRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const discountOptions = useMemo(() => {
    const options = ["2x1", "3x1", "3x2"];
    for (let i = 10; i <= 25; i += 5) options.push(`${i}% Descuento`);
    options.push("Personalizar");
    return options;
  }, []);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);
    const handler = (e: Event) => { e.preventDefault(); setShowInstallBanner(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showPopMessage = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (activeTab === 'cash') {
      let processed = value;
      if (name === 'saldo') processed = value.replace(/[^\d.]/g, '');
      if (name === 'codigo') processed = value.toLowerCase();
      setFormData(prev => ({ ...prev, [name]: processed }));
    } else {
      setPromoForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      const codes = data.map(row => row[0]).filter(c => c != null && c.toString().trim() !== "");
      
      const tipoFinal = promoForm.tipo === 'Personalizar' ? promoForm.customTipo : promoForm.tipo;
      if (codes.length > 0) {
        setGeneratedPromos(codes.map((code, i) => ({
          tipo: tipoFinal || "Promoción",
          promo: code.toString(),
          producto: promoForm.producto,
          phone: '',
          index: i + 1
        })));
        showPopMessage(`${codes.length} códigos cargados`, 'success');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleGenerate = () => {
    if (activeTab === 'cash') {
      if (!formData.codigo.trim()) return showPopMessage("Ticket requerido", "error");
      setShowPreview(true);
    } else {
      const tipoFinal = promoForm.tipo === 'Personalizar' ? promoForm.customTipo : promoForm.tipo;
      if (!tipoFinal) return showPopMessage("Define la promoción", "error");
      if (generatedPromos.length === 0 && !promoForm.promo.trim()) return showPopMessage("Ingresa código o Excel", "error");
      
      if (generatedPromos.length === 0) {
        setGeneratedPromos([{ tipo: tipoFinal, promo: promoForm.promo, producto: promoForm.producto, phone: promoForm.phone, index: 1 }]);
      }
      setShowPromoResults(true);
    }
  };

  const handleClear = () => {
    if (activeTab === 'cash') {
      setFormData({ saldo: '', codigo: '', phone: '' });
      setShowPreview(false);
    } else {
      setPromoForm({ tipo: '', customTipo: '', producto: '', promo: '', phone: '' });
      setGeneratedPromos([]);
      setShowPromoResults(false);
      setEnvioPersonalizado(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const processAndShareBulk = async () => {
    setIsProcessing(true);
    try {
      const files: File[] = [];
      for (let i = 0; i < generatedPromos.length; i++) {
        const el = promoRefs.current[i];
        if (el) {
          const canvas = await html2canvas(el, { scale: 2 });
          const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
          if (blob) files.push(new File([blob], `Promo-${i}.png`, { type: 'image/png' }));
        }
      }
      if (navigator.share) await navigator.share({ files, title: 'Promociones Yoshi' });
    } catch (e) { showPopMessage("Error al procesar", "error"); }
    finally { setIsProcessing(false); }
  };

  const handleSendSingle = async (idx: number) => {
    const el = activeTab === 'cash' ? ticketRef.current : promoRefs.current[idx];
    const phone = activeTab === 'cash' ? formData.phone : generatedPromos[idx].phone;
    if (!phone) return showPopMessage("Teléfono requerido", "error");
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2 });
    canvas.toBlob(async blob => {
      if (blob && navigator.clipboard) {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        showPopMessage("Copiado. Pégalo en WhatsApp", "success");
        window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
      }
    });
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-24 px-4 overflow-y-auto relative">
      <div className="text-center pt-6"><span className="text-[10px] text-gray-400 font-medium tracking-tight">V 2.7 Developed JV®</span></div>

      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-sm">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-[#d6045b] text-white'}`}>
            <div className="flex-1 text-xs font-bold">{toast.message}</div>
          </div>
        </div>
      )}

      {isScannerOpen && (
        <ScannerModule onClose={() => setIsScannerOpen(false)} showPopMessage={showPopMessage} onCodeSelected={(c) => {
          if (scannerTarget === 'codigo') setFormData(prev => ({ ...prev, codigo: c.toLowerCase() }));
          else setFormData(prev => ({ ...prev, saldo: c.replace(/[^\d.]/g, '') }));
          setIsScannerOpen(false);
        }} />
      )}

      <header className="py-8 text-center flex flex-col items-center">
        <div className="bg-white p-4 rounded-[2rem] shadow-sm mb-4 border border-gray-100">
          <YoshiLogo className="h-12 w-12" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Yoshi Cash</h1>
        <div className="mt-6 flex bg-white p-1 rounded-2xl border shadow-sm w-full">
          <button onClick={() => setActiveTab('cash')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'cash' ? 'bg-[#d6045b] text-white shadow-md' : 'text-gray-400'}`}>Ticket QR</button>
          <button onClick={() => setActiveTab('promo')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'promo' ? 'bg-[#d6045b] text-white shadow-md' : 'text-gray-400'}`}>Promos</button>
        </div>
      </header>

      <div className="space-y-6">
        {activeTab === 'cash' ? (
          <div className="bg-white rounded-[2.5rem] p-7 shadow-xl border border-gray-100 space-y-6">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase block mb-2 tracking-widest">Saldo (Opcional)</label>
              <div className="relative"><span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
              <input type="text" name="saldo" value={formData.saldo} onChange={handleInputChange} className="w-full pl-10 pr-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700" placeholder="0.00" /></div>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase block mb-2 tracking-widest">Código Ticket</label>
              <div className="relative">
                <input type="text" name="codigo" value={formData.codigo} onChange={handleInputChange} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 pr-14" placeholder="tick-..." />
                <button onClick={() => openScanner('codigo')} className="absolute right-2 p-2.5 text-[#d6045b]"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg></button>
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={handleGenerate} className="flex-1 bg-[#d6045b] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#d6045b]/20">GENERAR</button>
              <button onClick={handleClear} className="px-6 py-4 bg-gray-100 text-gray-400 rounded-2xl"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] p-7 shadow-xl border border-gray-100 space-y-6">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase block mb-2 tracking-widest">Tipo Promoción</label>
              <select name="tipo" value={promoForm.tipo} onChange={handleInputChange} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700">
                <option value="">Selecciona</option>
                {discountOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {promoForm.tipo === 'Personalizar' && <input type="text" name="customTipo" value={promoForm.customTipo} onChange={handleInputChange} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 mt-3 animate-in fade-in" placeholder="Escribe la promo" />}
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase block mb-2 tracking-widest">Código o Excel</label>
              <div className="relative">
                <input type="text" name="promo" value={promoForm.promo} onChange={handleInputChange} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 pr-14" placeholder="PROMO-..." disabled={generatedPromos.length > 0} />
                <button onClick={() => fileInputRef.current?.click()} className="absolute right-2 p-2.5 text-[#d6045b]"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg></button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xls,.xlsx" className="hidden" />
              </div>
            </div>
            {generatedPromos.length > 0 && (
              <div className="flex items-center gap-3 px-1 animate-in slide-in-from-top-2">
                <input type="checkbox" id="envioPers" checked={envioPersonalizado} onChange={(e) => setEnvioPersonalizado(e.target.checked)} className="w-5 h-5 accent-[#d6045b]" />
                <label htmlFor="envioPers" className="text-[11px] font-bold text-gray-600 uppercase">Envío personalizado</label>
              </div>
            )}
            <div className="flex gap-4">
              <button onClick={handleGenerate} className="flex-1 bg-[#d6045b] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#d6045b]/20 uppercase text-xs">GENERAR</button>
              <button onClick={handleClear} className="px-6 py-4 bg-gray-100 text-gray-400 rounded-2xl"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            </div>
          </div>
        )}

        {showPreview && activeTab === 'cash' && (
          <div className="space-y-6">
            <TicketPreview data={formData} innerRef={ticketRef} />
            <div className="bg-white rounded-[2.5rem] p-7 shadow-xl space-y-4">
              <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700" placeholder="WhatsApp 521..." />
              <button onClick={() => handleSendSingle(0)} className="w-full bg-[#d6045b] text-white py-4 rounded-2xl font-bold uppercase text-xs tracking-widest">Enviar WhatsApp</button>
            </div>
          </div>
        )}

        {showPromoResults && activeTab === 'promo' && (
          <div className="space-y-10">
            {generatedPromos.map((p, idx) => (
              <div key={idx} className="space-y-6">
                <PromoPreview data={p} innerRef={(el) => (promoRefs.current[idx] = el)} />
                {envioPersonalizado && (
                  <div className="bg-white rounded-[2.5rem] p-7 shadow-xl space-y-4">
                    <input type="tel" value={p.phone} onChange={(e) => { const n = [...generatedPromos]; n[idx].phone = e.target.value; setGeneratedPromos(n); }} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700" placeholder="WhatsApp 521..." />
                    <button onClick={() => handleSendSingle(idx)} className="w-full bg-[#d6045b] text-white py-4 rounded-2xl font-bold text-[10px] uppercase">Enviar Individual</button>
                  </div>
                )}
              </div>
            ))}
            {!envioPersonalizado && (
              <div className="bg-white rounded-[2.5rem] p-7 shadow-xl border border-gray-100 space-y-6 sticky bottom-4 z-50">
                <input type="tel" name="phone" value={promoForm.phone} onChange={handleInputChange} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700" placeholder="WhatsApp 521..." />
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handleSendSingle(0)} className="bg-[#d6045b] text-white font-black rounded-2xl h-20 text-[10px] uppercase flex flex-col items-center justify-center gap-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg><span>Enviar</span>
                  </button>
                  <button onClick={processAndShareBulk} className="bg-[#d6045b] text-white font-black rounded-2xl h-20 text-[10px] uppercase flex flex-col items-center justify-center gap-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg><span>Compartir</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
