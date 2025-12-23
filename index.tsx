
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Registro de Service Worker optimizado para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Usamos una ruta relativa directa para evitar errores de "Origin Mismatch"
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(reg => {
        console.log('✅ PWA: Service Worker activo. Ámbito:', reg.scope);
      })
      .catch(err => {
        console.warn('⚠️ PWA: Error de registro (común en previsualización):', err.message);
      });
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
