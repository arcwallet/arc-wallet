import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../services/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the whole app
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to structured logger (which can send to Sentry if configured)
    logger.error('React Error Boundary caught an error', error, {
      component: 'ErrorBoundary',
      componentStack: errorInfo.componentStack,
    });

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // TODO: Send error to logging service in production
    // Example: Sentry, LogRocket, etc.
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#091325] p-4">
          <div className="w-full max-w-md rounded-xl border border-[#2B3440] bg-[#151A22] p-6 text-center">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-red-500/10 p-3">
                <svg
                  className="h-8 w-8 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            <h2 className="mb-2 text-xl font-bold text-[#E6EEF3]">
              An Error Occurred
            </h2>

            <p className="mb-6 text-sm text-[#A7B4C8]">
              Sorry, an unexpected error occurred. Please refresh the page or try again.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4 rounded-lg bg-[#091325] p-3 text-left">
                <summary className="cursor-pointer text-sm font-medium text-[#E6EEF3]">
                  Error Details (Development Only)
                </summary>
                <pre className="mt-2 overflow-auto text-xs text-red-400">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
              >
                Tekrar Dene
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 rounded-lg border border-[#2B3440] bg-transparent px-4 py-2 text-sm font-medium text-[#E6EEF3] transition-colors hover:bg-white/5"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;