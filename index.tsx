
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Registro simplificado y robusto de SW
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Usamos ruta relativa sin prefijos de protocolo para evitar errores de origen
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('✅ PWA lista. Ámbito:', reg.scope))
      .catch(err => console.warn('⚠️ Fallo SW (Esperado en dev):', err.message));
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
