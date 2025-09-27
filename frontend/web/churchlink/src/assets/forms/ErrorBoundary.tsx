import React from "react";

type State = { hasError: boolean; error?: any };

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error("FormBuilder ErrorBoundary caught", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 border rounded text-red-600">
          <h3 className="font-semibold mb-2">Form Builder crashed</h3>
          <pre className="text-xs whitespace-pre-wrap mb-2">{String(this.state.error)}</pre>
          {this.state.error?.stack && (
            <details className="text-xs whitespace-pre-wrap">
              <summary className="cursor-pointer">Stack trace</summary>
              <pre>{this.state.error.stack}</pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
