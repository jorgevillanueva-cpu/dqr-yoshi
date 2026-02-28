
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Registro de Service Worker optimizado con scope absoluto
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Registramos en la raíz para que controle todo el dominio dqr-yoshi.vercel.app
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('✅ PWA: Service Worker activo en scope:', reg.scope);
      })
      .catch(err => {
        console.warn('⚠️ PWA: Error de registro:', err.message);
      });
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
