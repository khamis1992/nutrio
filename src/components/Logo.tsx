import React from 'react';
import { assetPath } from '@/lib/asset-path';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  className?: string;
  variant?: 'light' | 'dark';
  animated?: boolean;
}

const sizeMap: Record<string, string> = {
  sm: 'h-8',
  md: 'h-12',
  lg: 'h-16',
  xl: 'h-24',
};

const pxMap: Record<string, number> = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

/**
 * Animated Nutrio logo mark.
 *
 * Two SVG paths: a green leaf outline and an amber lightning bolt inside.
 * On mount, the leaf draws itself first (stroke-dashoffset 315 -> 0),
 * then the bolt draws in 0.4s later (stroke-dashoffset 119 -> 0).
 * After the draw, the strokes fade out and the fills crossfade in,
 * leaving the solid logo visible. One-shot, plays once on mount.
 *
 * Tweak handles:
 *  - duration: change the `1.2s` in animation declarations
 *  - stagger:  change the `0.4s` delay on bolt elements
 *  - colors:   #0E9F6E (leaf), #F59E0B (bolt)
 */
const AnimatedLogoMark: React.FC<{ size: number; className?: string }> = ({
  size,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ overflow: 'visible' }}
  >
    <style>{`
      @keyframes nutrio-leaf-trace {
        0%   { stroke-dashoffset: 315; opacity: 1; }
        70%  { stroke-dashoffset: 0; opacity: 1; }
        100% { stroke-dashoffset: 0; opacity: 0; }
      }
      @keyframes nutrio-leaf-fill {
        0%   { opacity: 0; }
        50%  { opacity: 0; }
        100% { opacity: 1; }
      }
      @keyframes nutrio-bolt-trace {
        0%   { stroke-dashoffset: 119; opacity: 1; }
        70%  { stroke-dashoffset: 0; opacity: 1; }
        100% { stroke-dashoffset: 0; opacity: 0; }
      }
      @keyframes nutrio-bolt-fill {
        0%   { opacity: 0; }
        50%  { opacity: 0; }
        100% { opacity: 1; }
      }
    `}</style>

    {/* Leaf — fill renders under trace */}
    <path
      d="M50 16 C32 16 20 30 20 50 C20 64 28 76 40 82 L40 58 L32 58 L50 28 L68 58 L60 58 L60 82 C72 76 80 64 80 50 C80 30 68 16 50 16 Z"
      fill="#0E9F6E"
      style={{
        opacity: 0,
        animation: 'nutrio-leaf-fill 1.2s ease-in-out forwards',
      }}
    />
    <path
      d="M50 16 C32 16 20 30 20 50 C20 64 28 76 40 82 L40 58 L32 58 L50 28 L68 58 L60 58 L60 82 C72 76 80 64 80 50 C80 30 68 16 50 16 Z"
      fill="none"
      stroke="#0E9F6E"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        strokeDasharray: 315,
        strokeDashoffset: 315,
        animation: 'nutrio-leaf-trace 1.2s ease-in-out forwards',
      }}
    />

    {/* Bolt — fill renders under trace, staggered 0.4s after leaf */}
    <path
      d="M52 26 L40 52 L48 52 L44 74 L60 44 L52 44 L52 26 Z"
      fill="#F59E0B"
      style={{
        opacity: 0,
        animation: 'nutrio-bolt-fill 0.8s ease-in-out 0.4s forwards',
      }}
    />
    <path
      d="M52 26 L40 52 L48 52 L44 74 L60 44 L52 44 L52 26 Z"
      fill="none"
      stroke="#F59E0B"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        strokeDasharray: 119,
        strokeDashoffset: 119,
        animation: 'nutrio-bolt-trace 0.8s ease-in-out 0.4s forwards',
      }}
    />
  </svg>
);

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  className = '',
  animated = false,
}) => {
  const heightClass = sizeMap[size];
  const pxSize = pxMap[size];

  if (animated) {
    return (
      <div className={`${heightClass} w-auto flex items-center justify-center ${className}`}>
        <AnimatedLogoMark size={pxSize} />
      </div>
    );
  }

  return (
    <img
      src={assetPath('/logo.png')}
      alt="Nutrio Fuel"
      className={`${heightClass} w-auto object-contain ${className}`}
    />
  );
};

export default Logo;
