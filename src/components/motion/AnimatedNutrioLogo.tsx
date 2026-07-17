import { Logo } from "@/components/Logo";
import { LottieAnimation } from "@/components/motion/LottieAnimation";
import nutrioOrbit from "@/assets/lottie/nutrio-orbit.json";
import { cn } from "@/lib/utils";

interface AnimatedNutrioLogoProps {
  className?: string;
  logoClassName?: string;
}

export function AnimatedNutrioLogo({ className, logoClassName }: AnimatedNutrioLogoProps) {
  return (
    <div className={cn("relative flex aspect-square items-center justify-center", className)}>
      <LottieAnimation
        animationData={nutrioOrbit}
        className="absolute inset-0 h-full w-full"
      />
      <Logo
        size="xl"
        className={cn("relative z-[1] !h-[62%] w-[62%] object-contain", logoClassName)}
      />
    </div>
  );
}

