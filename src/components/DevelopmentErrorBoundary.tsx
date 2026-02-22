import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Development Error Boundary
 * Catches HMR-related errors and provides a way to recover without full page reload
 */
class DevelopmentErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Development error caught:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Force a re-render by updating the key or navigating
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // Check if this is a hook/HMR error
      const isHookError = this.state.error?.message?.includes("Invalid hook call") ||
                         this.state.error?.message?.includes("useContext");

      if (isHookError) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="max-w-md w-full text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto" />
              <h2 className="text-xl font-semibold">Development Hot Reload Error</h2>
              <p className="text-muted-foreground text-sm">
                This is a known issue with React Fast Refresh during development. 
                The component hot-reloaded but React hooks got out of sync.
              </p>
              <div className="bg-muted p-3 rounded text-left text-xs font-mono overflow-auto max-h-32">
                {this.state.error?.message}
              </div>
              <Button 
                onClick={this.handleReset} 
                className="gap-2"
                variant="default"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Page (Fixes It)
              </Button>
              <p className="text-xs text-muted-foreground">
                Tip: You can also press Ctrl+R or Cmd+R to refresh
              </p>
            </div>
          </div>
        );
      }

      // Regular error fallback
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <Button onClick={this.handleReset} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default DevelopmentErrorBoundary;
