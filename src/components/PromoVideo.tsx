import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Volume2, VolumeX, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import promoVideo from "@/assets/promo.mp4";

export const PromoVideo = () => {
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black flex flex-col"
        >
          {/* Top Bar */}
          <div className="flex-none pt-safe-top px-4 py-3 flex items-center justify-between bg-black/50 backdrop-blur-sm z-20">
            <span className="text-white/60 text-sm font-medium">NUTRIO</span>
            <button
              onClick={handleClose}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Video Container */}
          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
            <video
              ref={videoRef}
              src={promoVideo}
              autoPlay
              muted={isMuted}
              playsInline
              preload="auto"
              onError={handleVideoError}
              className="w-full h-full max-w-full max-h-full object-contain"
              style={{ maxHeight: 'calc(100vh - 200px)' }}
            />

            {/* Loading State */}
            {isLoading && !hasError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-white/60 text-sm">Loading...</p>
              </div>
            )}

            {/* Play Button - When Autoplay Blocked */}
            {needsUserInteraction && !isLoading && !hasError && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={handleManualPlay}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/60"
              >
                <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/50 active:scale-95 transition-transform mb-4">
                  <Play className="w-8 h-8 text-white ml-1" />
                </div>
                <span className="text-white font-semibold text-lg">Tap to Play</span>
              </motion.button>
            )}

            {/* Error State */}
            {hasError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black px-6">
                <p className="text-white text-lg font-semibold mb-2">Video unavailable</p>
                <p className="text-white/60 text-sm text-center mb-6">Could not load the promotional video.</p>
                <Button onClick={handleClose} className="rounded-full px-8">
                  Continue to App
                </Button>
              </div>
            )}

            {/* Unmute Button - Prominent */}
            {isPlaying && isMuted && !hasError && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={toggleMute}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3 z-20"
              >
                <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
                  <VolumeX className="w-7 h-7 text-white" />
                </div>
                <span className="bg-black/60 text-white text-sm font-semibold px-4 py-2 rounded-full backdrop-blur-sm">
                  🔊 Tap for sound
                </span>
              </motion.button>
            )}

            {/* Sound Toggle (when unmuted) */}
            {isPlaying && !isMuted && !hasError && (
              <button
                onClick={toggleMute}
                className="absolute top-4 right-4 w-12 h-12 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform z-10"
              >
                <Volume2 className="w-5 h-5 text-white" />
              </button>
            )}
          </div>

          {/* Bottom Action Sheet */}
          {!hasError && (
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="flex-none bg-gradient-to-t from-black via-black/90 to-transparent pb-safe-bottom"
            >
              <div className="px-6 pt-6 pb-6">
                <div className="w-12 h-1 bg-white/30 rounded-full mx-auto mb-4" />

                <h2 className="text-xl font-bold text-white text-center mb-1">
                  Eat Smart, Live Better
                </h2>
                <p className="text-white/70 text-center text-sm mb-4">
                  Personalized meal plans delivered to your door
                </p>

                <div className="space-y-2">
                  <Button
                    onClick={handleClose}
                    className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-base shadow-lg shadow-primary/30"
                  >
                    Get Started
                  </Button>

                  <button
                    onClick={handleClose}
                    className="w-full h-10 text-white/60 font-medium text-sm active:text-white transition-colors"
                  >
                    Skip for now
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PromoVideo;
