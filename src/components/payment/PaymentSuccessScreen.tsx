import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Download, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import confetti from 'canvas-confetti';

interface PaymentSuccessScreenProps {
  amount: number;
  transactionId: string;
  date: Date;
  onClose: () => void;
  onViewReceipt: () => void;
}

export function PaymentSuccessScreen({ 
  amount, 
  transactionId, 
  date, 
  onClose,
  onViewReceipt 
}: PaymentSuccessScreenProps) {
  useEffect(() => {
    // Trigger confetti
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: ReturnType<typeof setInterval> = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults, 
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults, 
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="overflow-hidden">
          <div className="bg-green-500 p-8 text-center text-white">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </motion.div>
            <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
            <p className="text-green-100">Your transaction has been completed</p>
          </div>

          <CardContent className="p-6 space-y-6">
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">Amount Paid</p>
              <p className="text-4xl font-bold">QAR {amount}</p>
            </div>

            <div className="space-y-3 bg-muted p-4 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transaction ID</span>
                <span className="font-mono">{transactionId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date & Time</span>
                <span>{date.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="text-green-600 font-medium">Completed</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onViewReceipt}>
                <Receipt className="w-4 h-4 mr-2" />
                View Receipt
              </Button>
              <Button variant="outline" className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>

            <Button className="w-full" size="lg" onClick={onClose}>
              Continue
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
