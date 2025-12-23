
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Registro del Service Worker para PWA (Instalación nativa)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Registramos sw.js directamente desde la raíz
    navigator.serviceWorker.register('sw.js', { scope: './' })
      .then(registration => {
        console.log('SW registrado con éxito:', registration.scope);
      })
      .catch(error => {
        console.error('Fallo en el registro de SW:', error);
      });
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
