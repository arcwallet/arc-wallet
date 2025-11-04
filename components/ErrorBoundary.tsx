import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          color: 'red',
          fontFamily: 'monospace',
          background: 'white',
          minHeight: '100vh'
        }}>
          <h2>🚨 React Error</h2>
          <pre style={{ color: 'black', background: '#f5f5f5', padding: '10px' }}>
            {this.state.error?.message}
          </pre>
          <pre style={{ color: 'black', background: '#f5f5f5', padding: '10px', fontSize: '12px' }}>
            {this.state.error?.stack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ padding: '10px', marginTop: '10px' }}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;