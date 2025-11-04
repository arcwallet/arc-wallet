import React from 'react';
import ReactDOM from 'react-dom/client';

function TestApp() {
  return (
    <div style={{ padding: '20px', fontSize: '20px' }}>
      <h1>🔥 Test App Working!</h1>
      <p>Frontend çalışıyor - beyaz ekran sorunu yok!</p>
      <button onClick={() => console.log('Button clicked!')}>
        Test Button
      </button>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<TestApp />);