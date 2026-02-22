import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  className?: string;
  variant?: 'light' | 'dark';
}

const sizeMap = {
  sm: { container: 'h-8', icon: 'w-6 h-6', text: 'text-lg', tagline: 'text-[10px]' },
  md: { container: 'h-10', icon: 'w-8 h-8', text: 'text-xl', tagline: 'text-xs' },
  lg: { container: 'h-12', icon: 'w-10 h-10', text: 'text-2xl', tagline: 'text-sm' },
  xl: { container: 'h-16', icon: 'w-12 h-12', text: 'text-3xl', tagline: 'text-base' },
};

export const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showTagline = false,
  className = '',
  variant = 'dark'
}) => {
  const sizes = sizeMap[size];
  const textColor = variant === 'dark' ? 'text-[#1A3A2F]' : 'text-white';
  const taglineColor = variant === 'dark' ? 'text-[#4A6355]' : 'text-white/80';

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className={`flex items-center gap-2 ${sizes.container}`}>
        {/* Logo Icon - Stylized N with leaves */}
        <svg 
          className={sizes.icon}
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="darkGreen" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0D5C3F"/>
              <stop offset="100%" stopColor="#0A4A33"/>
            </linearGradient>
            <linearGradient id="lightGreen" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A4D94E"/>
              <stop offset="100%" stopColor="#8BC34A"/>
            </linearGradient>
          </defs>
          
          {/* Main dark green leaf */}
          <path 
            d="M28 75 C25 65 28 45 40 30 C42 28 45 26 48 25 C50 24 52 25 52 27 C53 35 50 50 42 60 C38 66 33 71 28 75 Z" 
            fill="url(#darkGreen)"
          />
          
          {/* Light green accent leaf */}
          <path 
            d="M52 25 C55 22 60 20 65 22 C72 24 76 32 74 42 C72 52 65 62 55 68 C52 70 50 69 50 67 C49 55 54 40 60 32 C58 35 55 38 52 40 C50 42 48 41 48 39 C47 32 49 28 52 25 Z" 
            fill="url(#lightGreen)"
          />
          
          {/* Connecting stem */}
          <path 
            d="M35 68 L52 32" 
            stroke="#0D5C3F" 
            strokeWidth="3" 
            strokeLinecap="round" 
            opacity="0.8"
          />
        </svg>
        
        {/* NUTRIO Text */}
        <span className={`font-bold tracking-tight ${sizes.text} ${textColor}`}>
          NUTRIO
        </span>
      </div>
      
      {/* Tagline */}
      {showTagline && (
        <div className={`mt-0.5 flex items-center gap-1 ${sizes.tagline} ${taglineColor} font-medium tracking-wide`}>
          <span className="text-[#0D5C3F]">FUEL</span>
          <span>Your</span>
          <span className="text-[#A4D94E]">Body</span>
          <span>Smart</span>
        </div>
      )}
    </div>
  );
};

export default Logo;
