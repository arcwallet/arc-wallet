import React from 'react';
import ReactDOM from 'react-dom/client';

try {
  const App = React.lazy(() => import('./App'));

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <React.StrictMode>
      <React.Suspense fallback={<div style={{padding: '20px', fontSize: '18px'}}>🔄 Loading Arc Wallet...</div>}>
        <App />
      </React.Suspense>
    </React.StrictMode>
  );

} catch (error) {
  console.error('❌ App startup error:', error);

  // Fallback UI
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; color: red; font-family: monospace;">
        <h2>🚨 App Startup Error</h2>
        <p>Error: ${error.message}</p>
        <p>Check console for details</p>
      </div>
    `;
  }
}
