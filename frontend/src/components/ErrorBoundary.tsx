import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI. Receives error and resetErrorBoundary function. */
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Optional key to reset the boundary programmatically */
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — Task 14.1
 *
 * Catches rendering errors in the component tree, shows a user-friendly
 * fallback UI, and provides a reset mechanism.
 *
 * Features:
 * - Generic `fallback` prop for custom UI
 * - Built-in fallback with error message + retry button
 * - `resetKeys` prop to auto-recover when dependencies change
 * - `onError` callback for error logging
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    console.error('[ErrorBoundary] caught:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { resetKeys } = this.props;
    if (this.state.hasError && resetKeys && prevProps.resetKeys) {
      const changed = resetKeys.some((k, i) => k !== prevProps.resetKeys![i]);
      if (changed) this.reset();
    }
  }

  reset(): void {
    this.setState({ hasError: false, error: null });
  }

  render(): ReactNode {
    const { hasError, error } = this.state;

    if (!hasError || !error) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback({ error, reset: this.reset });
    }

    // Default fallback UI
    return (
      <div
        role="alert"
        className="rounded-2xl bg-red-50 border border-red-200 p-8 text-center max-w-lg mx-auto my-8"
      >
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-semibold text-red-700 mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-red-600 mb-1 opacity-80">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <p className="text-xs text-red-400 mb-6">
          If this persists, try refreshing the page.
        </p>
        <button
          type="button"
          onClick={this.reset}
          className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium
                     rounded-xl transition-colors shadow-sm"
        >
          Try again
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
