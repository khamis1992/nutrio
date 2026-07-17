import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type { AnimationConfigWithData, AnimationItem } from "lottie-web";

import { cn } from "@/lib/utils";

interface LottieAnimationProps {
  animationData: AnimationConfigWithData<"svg">["animationData"];
  className?: string;
  loop?: boolean;
  ariaLabel?: string;
}

export function LottieAnimation({
  animationData,
  className,
  loop = true,
  ariaLabel,
}: LottieAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<AnimationItem | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;

    void import("lottie-web/build/player/lottie_light").then(({ default: lottie }) => {
      if (cancelled || !containerRef.current) return;

      animationRef.current = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop: reduceMotion ? false : loop,
        autoplay: !reduceMotion,
        animationData,
        rendererSettings: {
          preserveAspectRatio: "xMidYMid meet",
          progressiveLoad: true,
        },
      });

      if (reduceMotion) {
        animationRef.current.goToAndStop(animationRef.current.totalFrames - 1, true);
      }
    });

    return () => {
      cancelled = true;
      animationRef.current?.destroy();
      animationRef.current = null;
    };
  }, [animationData, loop, reduceMotion]);

  return (
    <div
      ref={containerRef}
      className={cn("pointer-events-none", className)}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    />
  );
}
