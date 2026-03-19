import React from 'react';

interface ApiError {
  message?: string;
  status?: number;
  code?: string;
}

interface ApiErrorMessageProps {
  error: unknown;
  /** Context message shown before the error detail */
  context?: string;
  /** Called when the user clicks retry */
  onRetry?: () => void;
  /** If true renders compact inline version (no card wrapper) */
  inline?: boolean;
}

/**
 * Map HTTP status codes to user-friendly messages
 */
function getErrorMessage(error: unknown): { title: string; detail: string } {
  const err = error as ApiError & { response?: { status?: number; data?: ApiError } };
  const status = err?.response?.status ?? err?.status;
  const serverMessage =
    err?.response?.data?.message ?? err?.message ?? 'An unexpected error occurred.';

  switch (status) {
    case 400:
      return {
        title: 'Invalid request',
        detail: 'Please check your search query and try again.',
      };
    case 429:
      return {
        title: 'Too many requests',
        detail: 'You are sending too many requests. Please wait a moment and try again.',
      };
    case 500:
    case 502:
    case 503:
      return {
        title: 'Server error',
        detail: 'Our servers are having trouble. Please try again in a few seconds.',
      };
    case 404:
      return {
        title: 'Not found',
        detail: 'The requested resource could not be found.',
      };
    default:
      return {
        title: 'Something went wrong',
        detail: serverMessage,
      };
  }
}

/**
 * ApiErrorMessage — Task 14.1
 *
 * Displays user-friendly error messages with optional retry button.
 * Handles Axios errors, generic Error objects, and raw strings.
 */
const ApiErrorMessage: React.FC<ApiErrorMessageProps> = ({
  error,
  context,
  onRetry,
  inline = false,
}) => {
  const { title, detail } = getErrorMessage(error);

  if (inline) {
    return (
      <p className="text-sm text-red-600 flex items-center gap-1.5">
        <span aria-hidden="true">⚠</span>
        {context ? `${context}: ` : ''}
        {detail}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="ml-2 underline hover:opacity-70 font-medium"
          >
            Retry
          </button>
        )}
      </p>
    );
  }

  return (
    <div
      role="alert"
      className="rounded-xl bg-red-50 border border-red-100 p-5 text-center"
    >
      <p className="font-semibold text-red-700 mb-1">{title}</p>
      {context && (
        <p className="text-xs text-red-400 mb-1 opacity-80">{context}</p>
      )}
      <p className="text-sm text-red-600 opacity-80 mb-4">{detail}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium
                     rounded-lg transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
};

export default ApiErrorMessage;
