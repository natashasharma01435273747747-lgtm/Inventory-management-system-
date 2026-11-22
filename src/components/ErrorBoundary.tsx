import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { clearAllAppStorage } from '../api/client.ts';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected error interrupted the display.';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown): void {
    console.error('SmartStock AI render error:', error);
  }

  handleResetAndReload = (): void => {
    clearAllAppStorage();
    window.location.href = '/';
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-[#EDF3FF] to-[#F8FAFC] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border border-[#DCE6FA] shadow-xl p-6 sm:p-8 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-[#0B1736]">
                SmartStock AI encountered a display error
              </h1>
              <p className="mt-1.5 text-xs text-slate-600">
                {this.state.message || 'Clearing cached session data usually resolves this immediately.'}
              </p>
            </div>
            <button
              type="button"
              onClick={this.handleResetAndReload}
              className="w-full py-3 px-4 rounded-xl bg-[#0052FF] hover:bg-[#0044D6] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset Session &amp; Reload</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
