import { Component, type ErrorInfo, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  remountKey: number;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, remountKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void invoke("cmd_log_frontend_error", {
      componentStack: info.componentStack,
      message: error.message,
      stack: error.stack ?? null,
      url: window.location.href,
    }).catch(() => {});
  }

  render() {
    if (!this.state.error) {
      return <div key={this.state.remountKey}>{this.props.children}</div>;
    }
    return (
      <div
        className="flex h-full min-h-[360px] flex-col items-center justify-center gap-3 px-6 text-center"
        style={{ color: "var(--text-secondary)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Something went wrong
        </h2>
        <p className="max-w-md text-xs" style={{ color: "var(--text-muted)" }}>
          {this.state.error.message}
        </p>
        <button
          type="button"
          data-remount-key={this.state.remountKey}
          onClick={() =>
            this.setState((state) => ({ error: null, remountKey: state.remountKey + 1 }))
          }
          className="rounded-md px-3 py-1.5 text-sm font-medium"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            border: "1px solid var(--border-default)",
            color: "var(--text-secondary)",
          }}
        >
          Retry
        </button>
      </div>
    );
  }
}
