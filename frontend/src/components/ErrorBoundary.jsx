import { Component } from 'react';
import api from '../api/index.js';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    api.post('/errors', {
      level:   'error',
      source:  'frontend',
      message: error.message,
      stack:   error.stack,
      url:     window.location.pathname,
    }).catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
          <div className="max-w-md w-full mx-4 p-8 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--severity-critical-bg)] flex items-center justify-center mx-auto mb-4">
              <span className="text-[var(--severity-critical)] text-xl">!</span>
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Something went wrong</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-[var(--brand)] text-white rounded-md text-sm font-medium hover:bg-[var(--brand-hover)] transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
