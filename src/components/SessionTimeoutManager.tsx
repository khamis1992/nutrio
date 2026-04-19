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
import { toast } from "sonner";
import { Timer, LogOut, RefreshCw } from "lucide-react";
import { isNative } from "@/lib/capacitor";

const IDLE_TIMEOUT = 30 * 60 * 1000;
const WARNING_TIME = 2 * 60 * 1000;
const CHECK_INTERVAL = 1000;

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

export const sessionTimeoutControl = {
  pause: () => {},
  resume: () => {},
};

export function SessionTimeoutManager({ children }: SessionTimeoutManagerProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(IDLE_TIMEOUT);
  const [isExtended, setIsExtended] = useState(false);
  
  const lastActivityRef = useRef<number>(Date.now());
  const warningShownRef = useRef<boolean>(false);
  const showWarningRef = useRef<boolean>(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSubmittingRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "BroadcastChannel" in window && !isNative) {
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

  const broadcastActivity = useCallback(() => {
    broadcastChannelRef.current?.postMessage({ type: "ACTIVITY" });
  }, []);

  const handleLogout = useCallback(async (reason: string = "Session expired") => {
    broadcastChannelRef.current?.postMessage({ type: "LOGOUT" });
    
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    await signOut();
    
    toast.error("Session Expired", { description: reason });

    navigate("/auth");
  }, [signOut, navigate]);

  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    warningShownRef.current = false;
    showWarningRef.current = false;
    setShowWarning(false);
    setTimeRemaining(IDLE_TIMEOUT);
    setIsExtended(false);
  }, []);

  const extendSession = useCallback(() => {
    resetIdleTimer();
    broadcastActivity();
    setIsExtended(true);
    
    setTimeout(() => {
      setIsExtended(false);
    }, 2000);
  }, [resetIdleTimer, broadcastActivity]);

  const handleActivity = useCallback(() => {
    if (isSubmittingRef.current) {
      return;
    }
    
    lastActivityRef.current = Date.now();
    broadcastActivity();
    
    if (warningShownRef.current) {
      warningShownRef.current = false;
      showWarningRef.current = false;
      setShowWarning(false);
    }
  }, [broadcastActivity]);

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

  useEffect(() => {
    if (!user) return;

    resetIdleTimer();

    checkIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastActivityRef.current;
      const timeLeft = Math.max(0, IDLE_TIMEOUT - idleTime);

      if (timeLeft <= WARNING_TIME && !warningShownRef.current) {
        warningShownRef.current = true;
        showWarningRef.current = true;
        setShowWarning(true);
        setTimeRemaining(timeLeft);
      }

      if (idleTime >= IDLE_TIMEOUT) {
        handleLogout("You were logged out due to inactivity");
      }
    }, CHECK_INTERVAL);

    countdownIntervalRef.current = setInterval(() => {
      if (showWarningRef.current) {
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
  }, [user, resetIdleTimer, handleLogout]);

  // Expose control via module-level object instead of window global
  useEffect(() => {
    if (!user) return;

    sessionTimeoutControl.pause = () => {
      isSubmittingRef.current = true;
      lastActivityRef.current = Date.now();
    };
    sessionTimeoutControl.resume = () => {
      isSubmittingRef.current = false;
      lastActivityRef.current = Date.now();
    };

    return () => {
      sessionTimeoutControl.pause = () => {};
      sessionTimeoutControl.resume = () => {};
    };
  }, [user]);

  const formatTimeRemaining = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  if (!user) {
    return <>{children}</>;
  }

  return (
    <>
      {children}

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

export function useSessionTimeoutControl() {
  const pauseTimeout = useCallback(() => {
    sessionTimeoutControl.pause();
  }, []);

  const resumeTimeout = useCallback(() => {
    sessionTimeoutControl.resume();
  }, []);

  return { pauseTimeout, resumeTimeout };
}