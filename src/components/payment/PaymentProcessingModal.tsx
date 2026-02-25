import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Loader2, Shield, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

interface PaymentProcessingModalProps {
  isOpen: boolean;
  step: 'initializing' | 'processing' | '3d_secure' | 'verifying' | 'finalizing';
  progress: number;
  message: string;
}

const stepMessages = {
  initializing: 'Initializing secure connection...',
  processing: 'Processing your payment...',
  '3d_secure': 'Redirecting to 3D Secure...',
  verifying: 'Verifying transaction...',
  finalizing: 'Finalizing payment...',
};

export function PaymentProcessingModal({ 
  isOpen, 
  step, 
  progress, 
  message 
}: PaymentProcessingModalProps) {
  const [dots, setDots] = useState('');

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md text-center" onInteractOutside={(e) => e.preventDefault()}>
        <div className="space-y-6 py-4">
          {/* Security Badge */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <Shield className="w-8 h-8 text-green-600" />
            </div>
          </div>

          {/* Loading Animation */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-lg font-medium">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{stepMessages[step]}{dots}</span>
            </div>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">{Math.round(progress)}% complete</p>
          </div>

          {/* Security Note */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Lock className="w-3 h-3" />
            <span>256-bit SSL encryption</span>
          </div>

          {/* Payment Method Icons (decorative) */}
          <div className="flex justify-center gap-2 opacity-50">
            <div className="w-8 h-5 bg-muted rounded" />
            <div className="w-8 h-5 bg-muted rounded" />
            <div className="w-8 h-5 bg-muted rounded" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
