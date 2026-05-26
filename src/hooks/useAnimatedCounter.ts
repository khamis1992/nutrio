import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

export function useAnimatedCounter(
  end: number,
  duration: number = 600,
  start: number = 0
): number {
  const [count, setCount] = useState(start);
  const prefersReducedMotion = useReducedMotion();
  const frameRef = useRef<number>();
  const startRef = useRef<number>(start);

  useEffect(() => {
    if (prefersReducedMotion) {
      setCount(end);
      return;
    }

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Ease out quart - fast start, slow finish
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = startRef.current + (end - startRef.current) * eased;
      
      setCount(Math.round(current));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    frameRef.current = animationFrame;

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration, prefersReducedMotion]);

  useEffect(() => {
    startRef.current = start;
  }, [start]);

  return count;
}