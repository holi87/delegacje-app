import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 p-8">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center max-w-lg">
            <h1 className="text-2xl font-bold text-destructive mb-2">Wystąpił nieoczekiwany błąd</h1>
            <p className="text-muted-foreground mb-4">
              Przepraszamy, coś poszło nie tak. Spróbuj odświeżyć stronę.
            </p>
            {this.state.error && (
              <pre className="text-xs text-left bg-muted p-3 rounded overflow-auto max-h-32 mb-4">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Odśwież stronę
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
