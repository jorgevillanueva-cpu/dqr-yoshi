
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Registro de Service Worker optimizado para evitar errores 404 post-instalación
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Usamos sw.js directamente para que se registre en la raíz del scope actual
    navigator.serviceWorker.register('sw.js', { scope: './' })
      .then(reg => {
        console.log('✅ YoshiCash PWA: Service Worker listo.', reg.scope);
      })
      .catch(err => {
        console.warn('⚠️ YoshiCash PWA: Error de registro:', err.message);
      });
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
