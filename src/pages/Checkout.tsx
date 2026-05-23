import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useSimulatedPayment } from '@/hooks/useSimulatedPayment';
import { useSubscription } from '@/hooks/useSubscription';
import { PaymentMethodSelector } from '@/components/payment/PaymentMethodSelector';
import { SimulatedCardForm } from '@/components/payment/SimulatedCardForm';
import { PaymentProcessingModal } from '@/components/payment/PaymentProcessingModal';
import { Simulated3DSecure } from '@/components/payment/Simulated3DSecure';
import { PaymentSuccessScreen } from '@/components/payment/PaymentSuccessScreen';
import { PaymentFailureScreen } from '@/components/payment/PaymentFailureScreen';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Lock, Flame, CheckCircle2, AlertCircle, Utensils, ShoppingBag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { PaymentMethod } from '@/lib/payment-simulation-config';
import { useCheckoutFlowVariant } from '@/hooks/useExperiments';
import { useProfile } from '@/hooks/useProfile';
import { useState, useEffect } from 'react';

interface CartItem {
  meal_id: string;
  meal_name: string;
  quantity: number;
  price: number;
  image_url?: string;
  restaurant_id?: string;
  restaurant_name?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const checkoutVariant = useCheckoutFlowVariant();
  const { profile } = useProfile();
  const { hasActiveSubscription, remainingMeals, isUnlimited, subscription } = useSubscription();

  // Parse query params for amount and type
  const params = new URLSearchParams(location.search);
  const amount = parseFloat(params.get('amount') || '0');
  const type = params.get('type') || 'wallet'; // wallet, subscription, order
  const packageId = params.get('packageId');

  // Cart state for order type
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(type === 'order');
  const [nutritionTotals, setNutritionTotals] = useState<NutritionTotals>({ calories: 0, protein: 0, carbs: 0, fat: 0 });

  const orderId = `ORD-${Date.now()}`;

  // Fetch cart items for order checkout
  useEffect(() => {
    if (type !== 'order' || !user) {
      setCartLoading(false);
      return;
    }

    const fetchCart = async () => {
      try {
        const { data: cart, error } = await supabase
          .from('carts')
          .select('items')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        const items = (cart?.items || []) as CartItem[];
        setCartItems(items);

        // Calculate nutrition totals
        if (items.length > 0) {
          const mealIds = items.map(item => item.meal_id).filter(Boolean);
          if (mealIds.length > 0) {
            const { data: meals } = await supabase
              .from('meals')
              .select('id, calories, protein, carbs, fats')
              .in('id', mealIds);

            if (meals) {
              const totals = items.reduce((acc, item) => {
                const meal = meals.find(m => m.id === item.meal_id);
                if (meal) {
                  acc.calories += (meal.calories || 0) * item.quantity;
                  acc.protein += (meal.protein || 0) * item.quantity;
                  acc.carbs += (meal.carbs || 0) * item.quantity;
                  acc.fat += (meal.fats || 0) * item.quantity;
                }
                return acc;
              }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
              setNutritionTotals(totals);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching cart:', err);
      } finally {
        setCartLoading(false);
      }
    };

    fetchCart();
  }, [type, user]);

  // Calculate credit coverage
  const isCoveredBySubscription = type === 'order' && hasActiveSubscription && (isUnlimited || remainingMeals > 0);
  const requiredAmount = isCoveredBySubscription ? 0 : amount;

  const handlePaymentSuccess = async () => {
    try {
      if (!user) throw new Error('User not authenticated');

      // Use atomic payment processing for wallet top-ups
      if (type === 'wallet' && packageId) {
        const paymentId = crypto.randomUUID();

        const { data, error } = await supabase.rpc('process_payment_atomic', {
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
          title: t('payment_successful'),
          description: `QAR ${amount} has been added to your wallet. New balance: QAR ${result.new_balance || amount}`,
        });
      }

      // Navigate to appropriate success page
      navigate(type === 'wallet' ? '/wallet' : '/subscription', {
        replace: true,
        state: { paymentSuccess: true }
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment processing failed';
      console.error('Payment processing error:', err);
      toast({
        title: t('payment_processing_error'),
        description: errorMessage,
        variant: 'destructive',
      });
      // Navigate to failure state
      handlePaymentFailure(errorMessage);
    }
  };

  const handlePaymentFailure = (error: string) => {
    toast({
      title: t('payment_failed_title'),
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
    amount: requiredAmount,
    orderId,
    onSuccess: handlePaymentSuccess,
    onFailure: handlePaymentFailure,
  });

  // Security badge for production
  const SecurityBadge = () => (
    <div className="bg-primary/10 border-b border-primary/20 p-2 text-center">
      <div className="flex items-center justify-center gap-2 text-primary">
        <Lock className="h-4 w-4" />
        <span className="text-sm font-medium">
          {t('secure_payment_badge')}
        </span>
      </div>
    </div>
  );

  // Quick payment for testing (development only)
  const handleQuickSimulate = (method: PaymentMethod) => {
    if (!import.meta.env.DEV) return;
    selectMethod(method);
    processCardPayment({
      number: '4111111111111111',
      expiry: '12/25',
      cvv: '123',
      name: 'Test User'
    });
  };

  // Nutrition Summary Component
  const NutritionSummary = () => {
    if (type !== 'order' || cartLoading || cartItems.length === 0) return null;

    const dailyCalories = profile?.daily_calorie_target || 2000;
    const dailyProtein = profile?.protein_target_g || 150;
    const dailyCarbs = profile?.carbs_target_g || 200;

    return (
      <Card className="mb-4 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Utensils className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">{t('nutrition_summary') || 'Nutrition Summary'}</h3>
          </div>

          <div className="space-y-3">
            {/* Calories */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{t('calories') || 'Calories'}</span>
                <span className="font-medium">
                  {Math.round(nutritionTotals.calories)} / {dailyCalories}
                </span>
              </div>
              <Progress
                value={Math.min((nutritionTotals.calories / dailyCalories) * 100, 100)}
                className="h-1.5"
              />
            </div>

            {/* Protein */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{t('protein') || 'Protein'}</span>
                <span className="font-medium">
                  {Math.round(nutritionTotals.protein)}g / {dailyProtein}g
                </span>
              </div>
              <Progress
                value={Math.min((nutritionTotals.protein / dailyProtein) * 100, 100)}
                className="h-1.5"
              />
            </div>

            {/* Carbs */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{t('carbs') || 'Carbs'}</span>
                <span className="font-medium">
                  {Math.round(nutritionTotals.carbs)}g / {dailyCarbs}g
                </span>
              </div>
              <Progress
                value={Math.min((nutritionTotals.carbs / dailyCarbs) * 100, 100)}
                className="h-1.5"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Credit Usage Banner Component
  const CreditUsageBanner = () => {
    if (type !== 'order') return null;

    if (isCoveredBySubscription) {
      return (
        <Card className="mb-4 border-success/30 bg-success/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="font-semibold text-sm text-success">
                  {t('covered_by_subscription') || 'Covered by subscription'} ✅
                </p>
                <p className="text-xs text-success/70">
                  {isUnlimited
                    ? t('unlimited_plan_active') || 'Unlimited plan active'
                    : `${remainingMeals} ${t('meals_remaining') || 'meals remaining'}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="mb-4 border-warning/30 bg-warning/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="font-semibold text-sm text-warning">
                {t('payment_required') || 'Payment required'}
              </p>
              <p className="text-xs text-warning/70">
                {t('required_amount') || 'Required'}: <span className="font-bold">{amount.toFixed(2)} QAR</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Simplified Order Button
  const OrderButton = () => {
    const getButtonText = () => {
      if (isCoveredBySubscription) {
        return t('place_order_free') || 'Place Order (Free)';
      }
      return `${t('pay') || 'Pay'} ${requiredAmount.toFixed(2)} QAR`;
    };

    const getButtonIcon = () => {
      if (isCoveredBySubscription) {
        return <ShoppingBag className="w-5 h-5 mr-2" />;
      }
      return <Lock className="w-5 h-5 mr-2" />;
    };

    return (
      <Button
        size="lg"
        className="w-full h-14 text-base font-semibold mt-6"
        disabled={step === 'processing' || (!selectedMethod && !isCoveredBySubscription)}
        onClick={() => {
          if (isCoveredBySubscription) {
            // Direct order without payment
            handlePaymentSuccess();
          } else if (selectedMethod) {
            processCardPayment({
              number: '4111111111111111',
              expiry: '12/25',
              cvv: '123',
              name: 'Test User'
            });
          }
        }}
      >
        {getButtonIcon()}
        {getButtonText()}
      </Button>
    );
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
        {checkoutVariant === "progress_bar" && (
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-1.5 rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        <div className="flex items-center gap-4 mb-8 rtl:flex-row-reverse">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">{t('checkout_title')}</h1>
        </div>

        {/* Nutrition Summary - for order type */}
        <NutritionSummary />

        {/* Credit Usage Banner - for order type */}
        <CreditUsageBanner />

        {/* Order Summary */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">{t('paying_for')}</p>
                <p className="font-medium capitalize">{type.replace('_', ' ')}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t('total_amount')}</p>
                <p className="text-2xl font-bold">QAR {amount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Steps */}
        {(step === 'idle' || step === 'selecting_method') && (
          <div className="space-y-4">
            {!isCoveredBySubscription && (
              <PaymentMethodSelector
                selectedMethod={selectedMethod}
                onSelect={selectMethod}
                amount={amount}
              />
            )}

            {/* Simplified Order Button */}
            <OrderButton />

            {/* Quick Simulation Buttons — Development Only */}
            {import.meta.env.DEV && (
              <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg">
                <p className="text-sm font-medium text-primary mb-2">Development Testing:</p>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => handleQuickSimulate('credit_card')}>
                    Test Card
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleQuickSimulate('sadad')}>
                    Test Sadad
                  </Button>
                </div>
                <p className="text-xs text-primary/70 mt-2">
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
              {t('change_payment_method')}
            </Button>

            {(selectedMethod === 'credit_card' || selectedMethod === 'debit_card') && (
              <SimulatedCardForm
                amount={requiredAmount}
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
        message={t('please_dont_close')}
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
