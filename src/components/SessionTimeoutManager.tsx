import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Timer, LogOut, RefreshCw } from "lucide-react";

// Constants
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_TIME = 2 * 60 * 1000; // Show warning 2 minutes before logout
const CHECK_INTERVAL = 1000; // Check every second

// Events that reset idle timer
const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keypress",
  "scroll",
  "touchstart",
  "click",
  "keydown",
  "wheel",
];

interface SessionTimeoutManagerProps {
  children: React.ReactNode;
}

/**
 * Session Timeout Manager Component
 * 
 * Monitors user activity and:
 * 1. Shows warning 2 minutes before timeout
 * 2. Auto-logs out user after 30 minutes of inactivity
 * 3. Syncs across browser tabs using BroadcastChannel
 * 4. Extends timeout during form submissions or API calls
 */
export function SessionTimeoutManager({ children }: SessionTimeoutManagerProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(IDLE_TIMEOUT);
  const [isExtended, setIsExtended] = useState(false);
  
  const lastActivityRef = useRef<number>(Date.now());
  const warningShownRef = useRef<boolean>(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSubmittingRef = useRef<boolean>(false);

  // Initialize BroadcastChannel for cross-tab sync
  useEffect(() => {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      broadcastChannelRef.current = new BroadcastChannel("session_timeout");
      
      broadcastChannelRef.current.onmessage = (event) => {
        if (event.data.type === "ACTIVITY") {
          resetIdleTimer();
        } else if (event.data.type === "LOGOUT") {
          handleLogout("Session expired in another tab");
        }
      };
    }

    return () => {
      broadcastChannelRef.current?.close();
    };
  }, []);

  // Broadcast activity to other tabs
  const broadcastActivity = useCallback(() => {
    broadcastChannelRef.current?.postMessage({ type: "ACTIVITY" });
  }, []);

  // Handle logout
  const handleLogout = useCallback(async (reason: string = "Session expired") => {
    // Broadcast logout to other tabs
    broadcastChannelRef.current?.postMessage({ type: "LOGOUT" });
    
    // Clear intervals
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    // Sign out
    await signOut();
    
    // Show toast
    toast({
      title: "Session Expired",
      description: reason,
      variant: "destructive",
    });

    // Navigate to login
    navigate("/auth");
  }, [signOut, navigate, toast]);

  // Reset idle timer
  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    warningShownRef.current = false;
    setShowWarning(false);
    setTimeRemaining(IDLE_TIMEOUT);
    setIsExtended(false);
  }, []);

  // Extend session (user clicked "Stay Logged In")
  const extendSession = useCallback(() => {
    resetIdleTimer();
    broadcastActivity();
    setIsExtended(true);
    
    // Show confirmation
    setTimeout(() => {
      setIsExtended(false);
    }, 2000);
  }, [resetIdleTimer, broadcastActivity]);

  // Activity handler
  const handleActivity = useCallback(() => {
    // Don't reset if form is being submitted
    if (isSubmittingRef.current) {
      return;
    }
    
    lastActivityRef.current = Date.now();
    broadcastActivity();
    
    if (warningShownRef.current) {
      warningShownRef.current = false;
      setShowWarning(false);
    }
  }, [broadcastActivity]);

  // Set up activity listeners
  useEffect(() => {
    if (!user) return;

    const eventListeners: Array<() => void> = [];

    ACTIVITY_EVENTS.forEach((eventName) => {
      const handler = () => handleActivity();
      window.addEventListener(eventName, handler, { passive: true });
      eventListeners.push(() => window.removeEventListener(eventName, handler));
    });

    return () => {
      eventListeners.forEach((remove) => remove());
    };
  }, [user, handleActivity]);

  // Main timeout checker
  useEffect(() => {
    if (!user) return;

    // Reset timer on mount
    resetIdleTimer();

    // Set up check interval
    checkIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastActivityRef.current;
      const timeLeft = Math.max(0, IDLE_TIMEOUT - idleTime);

      // Show warning when 2 minutes remaining
      if (timeLeft <= WARNING_TIME && !warningShownRef.current) {
        warningShownRef.current = true;
        setShowWarning(true);
        setTimeRemaining(timeLeft);
      }

      // Logout when time expires
      if (idleTime >= IDLE_TIMEOUT) {
        handleLogout("You were logged out due to inactivity");
      }
    }, CHECK_INTERVAL);

    // Set up countdown interval for warning dialog
    countdownIntervalRef.current = setInterval(() => {
      if (showWarning) {
        const now = Date.now();
        const idleTime = now - lastActivityRef.current;
        const timeLeft = Math.max(0, IDLE_TIMEOUT - idleTime);
        setTimeRemaining(timeLeft);
        
        if (timeLeft <= 0) {
          handleLogout("You were logged out due to inactivity");
        }
      }
    }, 1000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [user, showWarning, resetIdleTimer, handleLogout]);

  // Format time remaining for display
  const formatTimeRemaining = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // API to allow other components to temporarily disable timeout
  // (e.g., during file uploads or long API calls)
  useEffect(() => {
    if (!user) return;

    // Expose global function for form submission tracking
    (window as any).__sessionTimeout = {
      pause: () => {
        isSubmittingRef.current = true;
        // Extend timeout while submitting
        lastActivityRef.current = Date.now();
      },
      resume: () => {
        isSubmittingRef.current = false;
        lastActivityRef.current = Date.now();
      },
    };

    return () => {
      delete (window as any).__sessionTimeout;
    };
  }, [user]);

  // Don't render if no user
  if (!user) {
    return <>{children}</>;
  }

  return (
    <>
      {children}

      {/* Warning Dialog */}
      <Dialog open={showWarning} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-amber-500" />
              Session Timeout Warning
            </DialogTitle>
            <DialogDescription className="pt-4">
              You have been inactive for a while. For security reasons, you will be
              automatically logged out in{" "}
              <span className="font-bold text-amber-600">
                {formatTimeRemaining(timeRemaining)}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>Tip:</strong> Click "Stay Logged In" to continue your session,
                or you will be automatically redirected to the login page.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => handleLogout("You chose to log out")}
              className="w-full sm:w-auto"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log Out Now
            </Button>
            <Button
              onClick={extendSession}
              className="w-full sm:w-auto"
              variant={isExtended ? "secondary" : "default"}
            >
              {isExtended ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Session Extended
                </>
              ) : (
                <>
                  <Timer className="h-4 w-4 mr-2" />
                  Stay Logged In
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Hook to temporarily disable session timeout during long operations
 * Usage:
 * const { pauseTimeout, resumeTimeout } = useSessionTimeoutControl();
 * 
 * useEffect(() => {
 *   pauseTimeout();
 *   uploadLargeFile().then(() => resumeTimeout());
 * }, []);
 */
export function useSessionTimeoutControl() {
  const pauseTimeout = useCallback(() => {
    if ((window as any).__sessionTimeout) {
      (window as any).__sessionTimeout.pause();
    }
  }, []);

  const resumeTimeout = useCallback(() => {
    if ((window as any).__sessionTimeout) {
      (window as any).__sessionTimeout.resume();
    }
  }, []);

  return { pauseTimeout, resumeTimeout };
}
