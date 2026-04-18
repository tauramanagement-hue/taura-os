/**
 * ChatErrorBoundary — React class Error Boundary for AIChatPanel.
 *
 * Catches render-time errors inside the chat panel so they never
 * crash the full DashboardLayout. Shows an inline "Ricarica la chat"
 * button that resets state and re-mounts the panel.
 *
 * Must be a class component: React Error Boundaries require
 * componentDidCatch / getDerivedStateFromError lifecycle methods,
 * which are not available in function components.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  errorKey: number; // increment to force re-mount of children
}

export class ChatErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "", errorKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      errorMessage: error?.message ?? "Errore sconosciuto",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface diagnostics in the console without logging PII.
    // Stack trace is safe; we avoid logging message content.
    console.error("[ChatErrorBoundary] Chat panel crashed:", {
      name: error.name,
      stack: info.componentStack?.slice(0, 600) ?? "(no stack)",
    });
  }

  private handleReset = () => {
    this.setState(prev => ({
      hasError: false,
      errorMessage: "",
      errorKey: prev.errorKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            width: 340,
            flexShrink: 0,
            background: "hsl(var(--background))",
            borderLeft: "1px solid hsl(var(--border) / 0.6)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
          }}
        >
          <AlertTriangle
            size={24}
            style={{ color: "hsl(var(--destructive))", opacity: 0.8 }}
          />
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              color: "hsl(var(--foreground))",
              textAlign: "center",
              letterSpacing: "-0.01em",
            }}
          >
            La chat ha incontrato un problema
          </p>
          <p
            style={{
              fontSize: "var(--text-xs)",
              color: "hsl(var(--muted-foreground))",
              textAlign: "center",
              lineHeight: "var(--leading-normal)",
            }}
          >
            {this.state.errorMessage}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 32,
              padding: "0 14px",
              borderRadius: 6,
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              cursor: "pointer",
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              border: "none",
            }}
          >
            <RotateCcw size={12} />
            Ricarica la chat
          </button>
        </div>
      );
    }

    // Key forces a full re-mount after reset, clearing any bad state.
    return (
      <div key={this.state.errorKey} style={{ display: "contents" }}>
        {this.props.children}
      </div>
    );
  }
}
