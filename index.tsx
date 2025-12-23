
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Registro robusto del Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Intentamos registrar el SW usando una ruta relativa al origen actual
    // Esto evita que el navegador intente cargarlo desde dominios externos como ai.studio
    const swUrl = `${window.location.origin}/sw.js`;
    
    // Solo registramos si estamos en HTTPS (requerido para PWA) o localhost
    if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
      navigator.serviceWorker.register('sw.js', { scope: './' })
        .then(registration => {
          console.log('✅ PWA: Service Worker registrado con éxito:', registration.scope);
        })
        .catch(error => {
          // Si falla por origen o no existencia, fallamos silenciosamente para no interrumpir la app
          console.warn('⚠️ PWA: El Service Worker no se pudo registrar (esto es común en entornos de desarrollo):', error.message);
        });
    }
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
