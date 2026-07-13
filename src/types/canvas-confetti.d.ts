declare module "canvas-confetti" {
  export interface Options {
    particleCount?: number;
    spread?: number;
    origin?: { x?: number; y?: number };
    colors?: string[];
    startVelocity?: number;
    gravity?: number;
    ticks?: number;
    scalar?: number;
    angle?: number;
  }

  export default function confetti(options?: Options): Promise<null> | null;
}
