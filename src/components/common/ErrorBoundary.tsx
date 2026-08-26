import React from 'react';
import i18n from '../../i18n';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Unhandled render error:', error, errorInfo.componentStack);
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="app-shell flex items-center justify-center min-h-screen">
        <div className="workspace-page ui-container py-12 text-center space-y-4">
          <h1 className="text-base font-bold text-[var(--ui-danger)]">
            {i18n.t('errorBoundary.title')}
          </h1>
          <p className="text-sm">{i18n.t('errorBoundary.description')}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ui-button ui-button-secondary"
          >
            {i18n.t('errorBoundary.reload')}
          </button>
        </div>
      </div>
    );
  }
}
