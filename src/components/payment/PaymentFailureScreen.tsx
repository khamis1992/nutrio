import { motion } from 'framer-motion';
import { XCircle, RefreshCw, ArrowLeft, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface PaymentFailureScreenProps {
  amount: number;
  errorMessage: string;
  onRetry: () => void;
  onBack: () => void;
  onContactSupport: () => void;
}

export function PaymentFailureScreen({ 
  amount, 
  errorMessage, 
  onRetry, 
  onBack,
  onContactSupport 
}: PaymentFailureScreenProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card>
          <div className="bg-red-500 p-8 text-center text-white">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <XCircle className="w-12 h-12 text-red-500" />
            </motion.div>
            <h2 className="text-2xl font-bold mb-2">Payment Failed</h2>
            <p className="text-red-100">We couldn't process your payment</p>
          </div>

          <CardContent className="p-6 space-y-6">
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">Amount</p>
              <p className="text-3xl font-bold text-muted-foreground">QAR {amount}</p>
            </div>

            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <p className="text-sm font-medium text-red-800 mb-1">Error</p>
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>

            <div className="space-y-3">
              <Button className="w-full" size="lg" onClick={onRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              
              <Button variant="outline" className="w-full" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Payment
              </Button>
              
              <Button variant="ghost" className="w-full" onClick={onContactSupport}>
                <HelpCircle className="w-4 h-4 mr-2" />
                Contact Support
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              No money has been deducted from your account
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
