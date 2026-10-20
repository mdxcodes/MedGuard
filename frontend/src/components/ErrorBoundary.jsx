import React, { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[MedGuard ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const fallback = this.props.fallback || (
        <div className="max-w-5xl mx-auto py-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-error-bg flex items-center justify-center">
            <span className="text-[32px]">💥</span>
          </div>
          <h3 className="text-lg font-semibold text-error mt-4">Something went wrong</h3>
          <p className="text-sm text-muted mt-2 max-w-md mx-auto">
            {this.state.error?.message || 'An unexpected error occurred while rendering this page.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline font-mono"
          >
            Refresh page
          </button>
        </div>
      );
      return <div className="min-h-[400px] flex items-center justify-center">{fallback}</div>;
    }
    return this.props.children;
  }
}
