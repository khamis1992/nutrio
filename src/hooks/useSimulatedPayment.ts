import { useState, useEffect, useCallback } from 'react';
import { paymentSimulation } from '@/lib/payment-simulation';
import type { PaymentMethod } from '@/lib/payment-simulation-config';
import type { SimulatedPayment } from '@/lib/payment-simulation';

export type PaymentStep = 
  | 'idle' 
  | 'selecting_method' 
  | 'entering_details' 
  | 'processing' 
  | '3d_secure' 
  | 'success' 
  | 'failed';

interface UseSimulatedPaymentOptions {
  amount: number;
  orderId: string;
  onSuccess?: (payment: SimulatedPayment) => void;
  onFailure?: (error: string) => void;
}

export function useSimulatedPayment({ 
  amount, 
  orderId, 
  onSuccess, 
  onFailure 
}: UseSimulatedPaymentOptions) {
  const [step, setStep] = useState<PaymentStep>('idle');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [completedPayment, setCompletedPayment] = useState<SimulatedPayment | null>(null);

  // Subscribe to payment updates
  useEffect(() => {
    if (!paymentId) return undefined;

    const unsubscribe = paymentSimulation.subscribe((payment) => {
      if (payment.paymentId === paymentId) {
        if (payment.status === 'success') {
          setStep('success');
          setTransactionId(payment.transactionId || null);
          setCompletedPayment(payment);
          onSuccess?.(payment);
        } else if (payment.status === 'failed') {
          setStep('failed');
          setError(payment.failureReason || 'Payment failed');
          onFailure?.(payment.failureReason || 'Payment failed');
        } else if (payment.status === '3d_secure') {
          setStep('3d_secure');
        }
      }
    });

    return () => unsubscribe();
  }, [paymentId, onSuccess, onFailure]);

  // Simulate progress during processing
  useEffect(() => {
    if (step !== 'processing') return undefined;
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [step]);

  const initPayment = useCallback(async () => {
    setStep('selecting_method');
    setProgress(0);
    setError(null);
  }, []);

  const selectMethod = useCallback((method: PaymentMethod) => {
    setSelectedMethod(method);
    setStep('entering_details');
  }, []);

  const processCardPayment = useCallback(async (_cardData: {
    number: string;
    expiry: string;
    cvv: string;
    name: string;
  }) => {
    if (!selectedMethod) return;

    try {
      setStep('processing');
      setProgress(10);

      // Create payment
      const response = await paymentSimulation.createPayment({
        merchant_id: 'SIM_MERCHANT',
        amount,
        currency: 'QAR',
        order_id: orderId,
        customer_id: 'SIM_CUSTOMER',
        callback_url: '',
        success_url: '',
        failure_url: '',
      });

      setPaymentId(response.payment_id);
      setProgress(30);

      // Check for 3D Secure
      const { requires3D } = await paymentSimulation.initiate3DSecure(response.payment_id);
      
      if (requires3D) {
        setStep('3d_secure');
      } else {
        // Process directly
        const result = await paymentSimulation.processPayment(response.payment_id);
        setProgress(100);
        
        if (!result.success) {
          setError(result.failureReason || 'Payment failed');
          setStep('failed');
          onFailure?.(result.failureReason || 'Payment failed');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStep('failed');
      onFailure?.(err instanceof Error ? err.message : 'An error occurred');
    }
  }, [selectedMethod, amount, orderId, onFailure]);

  const verify3DSecure = useCallback(async (otp: string) => {
    if (!paymentId) return;

    try {
      const isValid = await paymentSimulation.verify3DSecure(paymentId, otp);
      
      if (isValid) {
        setStep('processing');
        setProgress(60);
        
        const result = await paymentSimulation.processPayment(paymentId);
        setProgress(100);
        
        if (!result.success) {
          setError(result.failureReason || 'Payment failed');
          setStep('failed');
        }
      } else {
        setError('Invalid OTP. Please try again.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
  }, [paymentId]);

  const retry = useCallback(() => {
    setStep('selecting_method');
    setError(null);
    setProgress(0);
  }, []);

  const cancel = useCallback(() => {
    if (paymentId) {
      paymentSimulation.cancelPayment(paymentId);
    }
    setStep('idle');
    setError(null);
    setProgress(0);
  }, [paymentId]);

  return {
    step,
    selectedMethod,
    progress: Math.min(progress, 100),
    error,
    transactionId,
    completedPayment,
    initPayment,
    selectMethod,
    processCardPayment,
    verify3DSecure,
    retry,
    cancel,
  };
}
