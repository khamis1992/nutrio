import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSimulatedPayment } from '@/hooks/useSimulatedPayment';
import { PaymentMethodSelector } from '@/components/payment/PaymentMethodSelector';
import { SimulatedCardForm } from '@/components/payment/SimulatedCardForm';
import { PaymentProcessingModal } from '@/components/payment/PaymentProcessingModal';
import { Simulated3DSecure } from '@/components/payment/Simulated3DSecure';
import { PaymentSuccessScreen } from '@/components/payment/PaymentSuccessScreen';
import { PaymentFailureScreen } from '@/components/payment/PaymentFailureScreen';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { PaymentMethod } from '@/lib/payment-simulation-config';

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Parse query params for amount and type
  const params = new URLSearchParams(location.search);
  const amount = parseFloat(params.get('amount') || '0');
  const type = params.get('type') || 'wallet'; // wallet, subscription, order
  const packageId = params.get('packageId');

  const orderId = `ORD-${Date.now()}`;

  const handlePaymentSuccess = async () => {
    try {
      if (!user) throw new Error('User not authenticated');
      
      // Use atomic payment processing for wallet top-ups
      if (type === 'wallet' && packageId) {
        const paymentId = crypto.randomUUID();
        
        const { data, error } = await (supabase.rpc as any)('process_payment_atomic', {
          p_payment_id: paymentId,
          p_user_id: user.id,
          p_amount: amount,
          p_payment_method: selectedMethod || 'credit_card',
          p_gateway_reference: orderId,
          p_description: 'Wallet top-up via payment gateway',
        });
        
        if (error) throw error;
        
        const result = data as { success: boolean; error?: string; new_balance?: number };
        
        if (!result.success) {
          throw new Error(result.error || 'Payment processing failed');
        }
        
        toast({
          title: 'Payment Successful! 🎉',
          description: `QAR ${amount} has been added to your wallet. New balance: QAR ${result.new_balance || amount}`,
        });
      }
      
      // Navigate to appropriate success page
      navigate(type === 'wallet' ? '/wallet' : '/subscription', { 
        replace: true,
        state: { paymentSuccess: true }
      });
    } catch (err: any) {
      console.error('Payment processing error:', err);
      toast({
        title: 'Payment Processing Error',
        description: err.message || 'Failed to process payment. Please try again or contact support.',
        variant: 'destructive',
      });
      // Navigate to failure state
      handlePaymentFailure(err.message || 'Payment processing failed');
    }
  };

  const handlePaymentFailure = (error: string) => {
    toast({
      title: 'Payment Failed',
      description: error,
      variant: 'destructive',
    });
  };

  const {
    step,
    selectedMethod,
    progress,
    error,
    transactionId,
    selectMethod,
    processCardPayment,
    verify3DSecure,
    retry,
    cancel,
  } = useSimulatedPayment({
    amount,
    orderId,
    onSuccess: handlePaymentSuccess,
    onFailure: handlePaymentFailure,
  });

  // Security badge for production
  const SecurityBadge = () => (
    <div className="bg-emerald-50 border-b border-emerald-200 p-2 text-center">
      <div className="flex items-center justify-center gap-2 text-emerald-800">
        <span className="text-sm font-medium">
          🔒 Secure Payment - Your payment information is encrypted
        </span>
      </div>
    </div>
  );

  // Quick payment for testing (remove in production)
  const isDevelopment = process.env.NODE_ENV === 'development';
  const handleQuickSimulate = (method: PaymentMethod) => {
    if (!isDevelopment) return;
    selectMethod(method);
    processCardPayment({
      number: '4111111111111111',
      expiry: '12/25',
      cvv: '123',
      name: 'Test User'
    });
  };

  // Render different steps
  if (step === 'success') {
    return (
      <>
        <SecurityBadge />
        <PaymentSuccessScreen
          amount={amount}
          transactionId={transactionId || 'N/A'}
          date={new Date()}
          onClose={() => navigate('/dashboard')}
          onViewReceipt={() => navigate('/invoices')}
        />
      </>
    );
  }

  if (step === 'failed') {
    return (
      <>
        <SecurityBadge />
        <PaymentFailureScreen
          amount={amount}
          errorMessage={error || 'Payment could not be completed'}
          onRetry={retry}
          onBack={() => navigate(-1)}
          onContactSupport={() => navigate('/support')}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SecurityBadge />
      
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Checkout</h1>
        </div>

        {/* Order Summary */}
        <div className="bg-muted p-4 rounded-lg mb-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Paying for</p>
              <p className="font-medium capitalize">{type.replace('_', ' ')}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-2xl font-bold">QAR {amount}</p>
            </div>
          </div>
        </div>

        {/* Payment Steps */}
        {(step === 'idle' || step === 'selecting_method') && (
          <div className="space-y-4">
            <PaymentMethodSelector
              selectedMethod={selectedMethod}
              onSelect={selectMethod}
              amount={amount}
            />
            
            {/* Quick Simulation Buttons - Development Only */}
            {isDevelopment && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-sm font-medium text-blue-800 mb-2">Development Testing:</p>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => handleQuickSimulate('credit_card')}>
                    Test Card
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleQuickSimulate('sadad')}>
                    Test Sadad
                  </Button>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  These buttons are only visible in development mode
                </p>
              </div>
            )}
          </div>
        )}

        {(step === 'entering_details' || step === 'processing') && selectedMethod && (
          <div className="space-y-4">
            <Button 
              variant="ghost" 
              className="mb-4" 
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Change Payment Method
            </Button>

            {(selectedMethod === 'credit_card' || selectedMethod === 'debit_card') && (
              <SimulatedCardForm
                amount={amount}
                onSubmit={processCardPayment}
                loading={step === 'processing'}
              />
            )}

            {selectedMethod === 'sadad' && (
              <div className="bg-muted p-8 text-center rounded-lg">
                <p className="text-muted-foreground mb-4">
                  Sadad payment form would appear here
                </p>
                <Button onClick={() => processCardPayment({
                  number: 'sadad',
                  expiry: '12/25',
                  cvv: '123',
                  name: 'Test User'
                })}>
                  Simulate Sadad Payment
                </Button>
              </div>
            )}

            {(selectedMethod === 'apple_pay' || selectedMethod === 'google_pay') && (
              <div className="bg-muted p-8 text-center rounded-lg">
                <p className="text-muted-foreground mb-4">
                  {selectedMethod === 'apple_pay' ? 'Apple' : 'Google'} Pay button would appear here
                </p>
                <Button onClick={() => processCardPayment({
                  number: selectedMethod,
                  expiry: '12/25',
                  cvv: '123',
                  name: 'Test User'
                })}>
                  Simulate {selectedMethod === 'apple_pay' ? 'Apple' : 'Google'} Pay
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Processing Modal */}
      <PaymentProcessingModal
        isOpen={step === 'processing'}
        step="processing"
        progress={progress}
        message="Please don't close this window"
      />

      {/* 3D Secure Modal */}
      <Simulated3DSecure
        isOpen={step === '3d_secure'}
        onVerify={verify3DSecure}
        onCancel={cancel}
      />
    </div>
  );
}
