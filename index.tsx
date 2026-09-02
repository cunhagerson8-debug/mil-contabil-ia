
import React from 'react';
import './index.css';
import ReactDOM from 'react-dom/client';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Não foi possível encontrar o elemento root para montar a aplicação.");
}

// Helper to show runtime errors directly in the page instead of a white screen.
function renderErrorToDOM(err: any) {
  const root = document.getElementById('root');
  const message = err && err.stack ? err.stack : String(err);
  if (root) {
    root.innerHTML = `
      <div style="padding:24px;background:#fff7f7;color:#7f1d1d;font-family:system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;">
        <h2 style="margin:0 0 8px; font-size:18px;">Erro de execução</h2>
        <pre style="white-space:pre-wrap;margin:0;font-size:13px">${message}</pre>
      </div>`;
  } else {
    console.error(err);
  }
}

// Global handlers to catch uncaught errors and promise rejections
window.addEventListener('error', (e) => {
  try {
    e.preventDefault();
  } catch {}
  // @ts-ignore
  renderErrorToDOM(e.error || e.message || e);
});
window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  try { e.preventDefault(); } catch {}
  // @ts-ignore
  renderErrorToDOM(e.reason || e);
});

const root = ReactDOM.createRoot(rootElement);

// Load the application after error handlers are installed so module evaluation
// failures cannot leave the root silently empty.
import('./App')
  .then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  })
  .catch(renderErrorToDOM);
