import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { captureError } from "@/lib/sentry";

interface Props {
  children: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class DashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[DashboardErrorBoundary${this.props.name ? `:${this.props.name}` : ""}]`, error, errorInfo);
    captureError(error, { component: this.props.name || "dashboard-widget", errorInfo: errorInfo.componentStack || undefined });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-100 bg-red-50/50 p-4 text-center" role="alert">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-400 mb-2" />
          <p className="text-sm font-medium text-red-700">
            Something went wrong{this.props.name ? ` loading ${this.props.name}` : ""}.
          </p>
          <button
            onClick={this.handleRetry}
            className="mt-2 text-sm font-semibold text-red-600 hover:text-red-800 underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}