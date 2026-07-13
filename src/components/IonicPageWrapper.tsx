import type { ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface IonicPageWrapperProps {
  children: ReactNode;
  title?: string;
  showBackButton?: boolean;
  showCloseButton?: boolean;
  onClose?: () => void;
  rightButtons?: ReactNode;
  hideHeader?: boolean;
  className?: string;
  fullscreen?: boolean;
}

export function IonicPageWrapper({
  children,
  title,
  showBackButton = false,
  showCloseButton = false,
  onClose,
  rightButtons,
  hideHeader = false,
  className = "",
  fullscreen = false,
}: IonicPageWrapperProps) {
  const navigate = useNavigate();

  return (
    <div className={`min-h-screen bg-background ${className}`}>
      {!hideHeader && (
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="mx-auto grid min-h-14 max-w-md grid-cols-[1fr_auto_1fr] items-center px-3">
            <div className="flex items-center">
              {showBackButton && (
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              {showCloseButton && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            {title ? <h1 className="text-base font-bold">{title}</h1> : <span />}
            <div className="flex items-center justify-end">{rightButtons}</div>
          </div>
        </header>
      )}

      <main
        className={`mx-auto w-full max-w-md pb-[calc(5rem+env(safe-area-inset-bottom))] ${
          fullscreen ? "" : "px-4 py-4"
        }`}
      >
        {children}
      </main>
    </div>
  );
}

export default IonicPageWrapper;
