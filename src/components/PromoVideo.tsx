import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Volume2, VolumeX, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import promoVideo from "@/assets/promo.mp4";

export const PromoVideo = () => {
  const navigate = useNavigate();
  const [showPromo, setShowPromo] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasAttemptedPlay = useRef(false);

  // Check auth status
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      
      if (!session) {
        timer = setTimeout(() => {
          setShowPromo(true);
        }, 300);
      }
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      if (session) {
        setShowPromo(false);
      }
    });
    
    return () => {
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  // Attempt to play video when shown
  useEffect(() => {
    if (showPromo && videoRef.current && !hasAttemptedPlay.current) {
      hasAttemptedPlay.current = true;
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.play()
            .then(() => {
              console.log("[PromoVideo] Autoplay started (muted)");
              setIsPlaying(true);
              setIsLoading(false);
              // Note: We cannot auto-unmute due to browser restrictions
              // User must tap the unmute button
            })
            .catch((err) => {
              console.log("[PromoVideo] Autoplay blocked:", err);
              setNeedsUserInteraction(true);
              setIsLoading(false);
            });
        }
      }, 100);
    }
  }, [showPromo]);

  const handleClose = useCallback(() => {
    setShowPromo(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const newMutedState = !isMuted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
    }
  }, [isMuted]);

  const handleManualPlay = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setNeedsUserInteraction(false);
          setIsLoading(false);
          // Still muted - user needs to tap unmute button
        })
        .catch((err) => {
          console.error("[PromoVideo] Play failed:", err);
        });
    }
  }, []);

  const handleVideoError = useCallback(() => {
    console.error("[PromoVideo] Video failed to load");
    setHasError(true);
    setIsLoading(false);
  }, []);

  // Don't render until we know auth status
  if (isAuthenticated === null) return null;
  
  // Don't show if authenticated
  if (isAuthenticated) return null;
  
  if (!showPromo) return null;

  return (
    <AnimatePresence>
      {showPromo && (
        /* Dark backdrop */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/60 flex items-end justify-center"
          onClick={handleClose}
        >
          {/* Card — stops click propagation so tapping inside doesn't close */}
          <motion.div
            initial={{ y: 300 }}
            animate={{ y: 0 }}
            exit={{ y: 300 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white rounded-t-3xl overflow-hidden"
            style={{ maxHeight: "80dvh" }}
          >
            {/* Drag handle + close */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <div className="w-8 h-1 bg-black/20 rounded-full mx-auto absolute left-1/2 -translate-x-1/2" />
              <span className="text-black/50 text-xs font-semibold tracking-widest">NUTRIO</span>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center active:scale-95 transition-transform"
              >
                <X className="w-4 h-4 text-black" />
              </button>
            </div>

            {/* Video — fixed height, never expands */}
            <div className="relative w-full bg-white overflow-hidden" style={{ height: 220 }}>
              <video
                ref={videoRef}
                src={promoVideo}
                autoPlay
                muted={isMuted}
                playsInline
                preload="auto"
                onError={handleVideoError}
                className="w-full h-full object-contain"
              />

              {/* Loading State */}
              {isLoading && !hasError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80">
                  <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-black/60 text-xs">Loading...</p>
                </div>
              )}

              {/* Play Button - When Autoplay Blocked */}
              {needsUserInteraction && !isLoading && !hasError && (
                <motion.button
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  onClick={handleManualPlay}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-white/70"
                >
                  <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 active:scale-95 transition-transform mb-2">
                    <Play className="w-6 h-6 text-white ml-1" />
                  </div>
                  <span className="text-black font-semibold text-sm">Tap to Play</span>
                </motion.button>
              )}

              {/* Error State */}
              {hasError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white px-6">
                  <p className="text-black text-sm font-semibold mb-1">Video unavailable</p>
                  <p className="text-black/50 text-xs text-center">Could not load the promotional video.</p>
                </div>
              )}

              {/* Unmute Button */}
              {isPlaying && isMuted && !hasError && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={toggleMute}
                  className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-full z-20"
                >
                  <VolumeX className="w-4 h-4 text-black" />
                  <span className="text-black text-xs font-semibold">Tap for sound</span>
                </motion.button>
              )}

              {/* Sound Toggle (when unmuted) */}
              {isPlaying && !isMuted && !hasError && (
                <button
                  onClick={toggleMute}
                  className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform z-10"
                >
                  <Volume2 className="w-4 h-4 text-black" />
                </button>
              )}
            </div>

            {/* Bottom content */}
            <div className="px-5 pt-3" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
              <h2 className="text-base font-bold text-black text-center mb-1">
                Eat Smart, Live Better
              </h2>
              <p className="text-black/60 text-center text-xs mb-4">
                Personalized meal plans delivered to your door
              </p>

              <div className="space-y-2">
                <Button
                  onClick={() => { handleClose(); navigate("/walkthrough"); }}
                  className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm shadow-lg shadow-primary/30"
                >
                  Get Started
                </Button>
                <button
                  onClick={() => { handleClose(); navigate("/walkthrough"); }}
                  className="w-full h-8 text-black/50 font-medium text-xs active:text-black transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PromoVideo;
