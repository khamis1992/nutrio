import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  className?: string;
  variant?: 'light' | 'dark';
}

const sizeMap = {
  sm: 'h-8',
  md: 'h-12',
  lg: 'h-16',
  xl: 'h-24',
};

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  className = '',
}) => {
  const heightClass = sizeMap[size];

  return (
    <img
      src="/nutrio/logo.png"
      alt="Nutrio Fuel"
      className={`${heightClass} w-auto object-contain ${className}`}
    />
  );
};

export default Logo;
