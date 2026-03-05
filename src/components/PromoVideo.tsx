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
              setIsPlaying(true);
              setIsLoading(false);
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
          className="fixed inset-0 z-[100] bg-white flex flex-col"
        >
          {/* Top Bar — white background */}
          <div className="flex-none px-4 py-3 flex items-center justify-between bg-white border-b border-gray-100">
            <span className="text-gray-400 text-sm font-medium">NUTRIO</span>
            <button
              onClick={handleClose}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* White area with centered small video */}
          <div className="flex-1 flex flex-col items-center justify-center bg-white px-6">

            {/* Video box — fixed small size, centered */}
            <div className="relative w-full rounded-2xl overflow-hidden bg-black shadow-lg"
              style={{ maxWidth: 320, aspectRatio: "16/9" }}
            >
              <video
                ref={videoRef}
                src={promoVideo}
                autoPlay
                muted={isMuted}
                playsInline
                preload="auto"
                onError={handleVideoError}
                className="w-full h-full object-contain bg-black"
              />

              {/* Loading State */}
              {isLoading && !hasError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                  <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-white/60 text-xs">Loading...</p>
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
                  <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg active:scale-95 transition-transform mb-2">
                    <Play className="w-6 h-6 text-white ml-1" />
                  </div>
                  <span className="text-white font-semibold text-sm">Tap to Play</span>
                </motion.button>
              )}

              {/* Mute/Unmute overlay button */}
              {isPlaying && !hasError && (
                <button
                  onClick={toggleMute}
                  className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center active:scale-95 transition-transform z-10"
                >
                  {isMuted
                    ? <VolumeX className="w-4 h-4 text-white" />
                    : <Volume2 className="w-4 h-4 text-white" />
                  }
                </button>
              )}

              {/* Error State */}
              {hasError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black px-4">
                  <p className="text-white text-sm font-semibold mb-1">Video unavailable</p>
                  <p className="text-white/60 text-xs text-center">Could not load the promotional video.</p>
                </div>
              )}
            </div>

            {/* Tap for sound hint below video */}
            {isPlaying && isMuted && !hasError && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={toggleMute}
                className="mt-3 flex items-center gap-2 bg-gray-100 text-gray-600 text-xs font-medium px-4 py-2 rounded-full active:scale-95 transition-transform"
              >
                <VolumeX className="w-3.5 h-3.5" />
                Tap for sound
              </motion.button>
            )}
          </div>

          {/* Bottom Action Sheet — white background */}
          {!hasError && (
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="flex-none bg-white border-t border-gray-100 pb-safe-bottom"
            >
              <div className="px-5 pt-4 pb-4">
                <h2 className="text-base font-bold text-gray-900 text-center mb-1">
                  Eat Smart, Live Better
                </h2>
                <p className="text-gray-500 text-center text-xs mb-4">
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
                    className="w-full h-8 text-gray-400 font-medium text-xs active:text-gray-600 transition-colors"
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
