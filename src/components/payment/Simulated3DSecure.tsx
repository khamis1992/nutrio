import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield, Lock, Landmark } from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';

interface Simulated3DSecureProps {
  isOpen: boolean;
  onVerify: (otp: string) => void;
  onCancel: () => void;
  bankName?: string;
  cardLast4?: string;
}

export function Simulated3DSecure({ 
  isOpen, 
  onVerify, 
  onCancel,
  bankName = 'Your Bank',
  cardLast4 = '****'
}: Simulated3DSecureProps) {
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setVerifying(true);
    await onVerify(otp);
    setVerifying(false);
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <DialogTitle className="text-center">3D Secure Verification</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{bankName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="w-4 h-4" />
              <span>Card ending in {cardLast4}</span>
            </div>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm">
              Enter the 6-digit OTP sent to your mobile number
            </p>
            <p className="text-xs text-muted-foreground">
              (Simulation: Enter any 6 digits)
            </p>
          </div>

          <div className="flex justify-center">
            <Input
              type="text"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-2xl tracking-widest w-40"
              maxLength={6}
            />
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Time remaining: <CountdownTimer initialSeconds={180} onExpire={onCancel} />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              className="flex-1" 
              onClick={handleVerify}
              disabled={otp.length !== 6 || verifying}
            >
              {verifying ? 'Verifying...' : 'Verify'}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Didn't receive the code?{' '}
            <button className="text-primary hover:underline" onClick={() => setOtp('')}>
              Resend OTP
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
