import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface BadgeProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  className?: string;
}

export default function Badge({ children, variant = 'secondary', className = '' }: BadgeProps) {
  const variantClasses = {
    primary: 'badge-primary',
    secondary: 'badge-secondary',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger'
  };

  return (
    <span className={clsx('badge', variantClasses[variant], className)}>
      {children}
    </span>
  );
}
