import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { captureError } from '@/lib/sentry';

export interface SubscriptionPlan {
  id: string;
  tier: string;
  billing_interval: string;
  price_qar: number;
  meals_per_month: number;
  discount_percent: number;
  features: string[];
}

export interface WinBackOffer {
  offer_id: string;
  offer_code: string;
  offer_type: 'pause' | 'discount' | 'downgrade' | 'bonus';
  name: string;
  description: string;
  pause_duration_days?: number;
  discount_percent?: number;
  discount_duration_months?: number;
  target_tier?: string;
  bonus_credits?: number;
}

interface UseSubscriptionManagementReturn {
  plans: SubscriptionPlan[];
  currentPlan: SubscriptionPlan | null;
  billingInterval: 'monthly' | 'annual';
  setBillingInterval: (interval: 'monthly' | 'annual') => void;
  createSubscription: (tier: string, billingInterval: string) => Promise<{ success: boolean; error?: string }>;
  upgradeSubscription: (tier: string, billingInterval?: string) => Promise<{ success: boolean; error?: string }>;
  getWinBackOffers: (step: number) => Promise<WinBackOffer[]>;
  processCancellation: (step: number, reason?: string, reasonDetails?: string, offerCode?: string, acceptOffer?: boolean) => Promise<{ success: boolean; action?: string; error?: string }>;
  resumeSubscription: () => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  isProcessing: boolean;
}

/**
 * Hook for managing subscriptions with annual billing and win-back offers
 * Addresses: MW-001 (Annual Billing) and MW-002 (Win-Back Offers)
 */
export function useSubscriptionManagement(): UseSubscriptionManagementReturn {
  const { user } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch subscription plans
  useEffect(() => {
    const fetchPlans = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .order('price_qar', { ascending: true });

        if (error) throw error;
        setPlans(data || []);
      } catch (err) {
        captureError(err instanceof Error ? err : new Error('Failed to fetch plans'), {
          context: 'useSubscriptionManagement.fetchPlans'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlans();
  }, []);

  // Fetch current user's subscription
  useEffect(() => {
    if (!user) return;

    const fetchCurrentSubscription = async () => {
      try {
        const { data: subscription, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (error) throw error;

        if (subscription) {
          setBillingInterval(subscription.billing_interval as 'monthly' | 'annual');
          
          // Find matching plan
          const plan = plans.find(
            p => p.tier === subscription.tier && p.billing_interval === subscription.billing_interval
          );
          if (plan) {
            setCurrentPlan(plan);
          }
        }
      } catch (err) {
        console.error('Error fetching subscription:', err);
      }
    };

    if (plans.length > 0) {
      fetchCurrentSubscription();
    }
  }, [user, plans]);

  const createSubscription = useCallback(async (
    tier: string,
    interval: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.rpc('create_subscription', {
        p_user_id: user.id,
        p_tier: tier,
        p_billing_interval: interval,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; subscription_id?: string };

      if (result.success) {
        toast({
          title: 'Subscription Created! 🎉',
          description: `Your ${tier} plan is now active.`,
        });
        return { success: true };
      } else {
        throw new Error(result.error || 'Failed to create subscription');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create subscription';
      captureError(err instanceof Error ? err : new Error(message), {
        context: 'useSubscriptionManagement.createSubscription',
        tier,
        interval,
      });
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return { success: false, error: message };
    } finally {
      setIsProcessing(false);
    }
  }, [user, toast]);

  const upgradeSubscription = useCallback(async (
    tier: string,
    interval?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsProcessing(true);
    try {
      // First get current subscription ID
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (!subscription) {
        return { success: false, error: 'No active subscription found' };
      }

      const { data, error } = await supabase.rpc('upgrade_subscription', {
        p_subscription_id: subscription.id,
        p_new_tier: tier,
        p_new_billing_interval: interval,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; amount_due?: number };

      if (result.success) {
        toast({
          title: 'Subscription Updated!',
          description: interval 
            ? `Upgraded to ${tier} (${interval})`
            : `Upgraded to ${tier}`,
        });
        return { success: true };
      } else {
        throw new Error(result.error || 'Failed to upgrade subscription');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upgrade subscription';
      captureError(err instanceof Error ? err : new Error(message), {
        context: 'useSubscriptionManagement.upgradeSubscription',
        tier,
        interval,
      });
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return { success: false, error: message };
    } finally {
      setIsProcessing(false);
    }
  }, [user, toast]);

  const getWinBackOffers = useCallback(async (step: number): Promise<WinBackOffer[]> => {
    if (!user) return [];

    try {
      // Get current subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (!subscription) return [];

      const { data, error } = await supabase.rpc('get_win_back_offers', {
        p_user_id: user.id,
        p_subscription_id: subscription.id,
        p_step: step,
      });

      if (error) throw error;
      return (data || []) as WinBackOffer[];
    } catch (err) {
      console.error('Error fetching win-back offers:', err);
      return [];
    }
  }, [user]);

  const processCancellation = useCallback(async (
    step: number,
    reason?: string,
    reasonDetails?: string,
    offerCode?: string,
    acceptOffer?: boolean
  ): Promise<{ success: boolean; action?: string; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsProcessing(true);
    try {
      // Get current subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (!subscription) {
        return { success: false, error: 'No active subscription found' };
      }

      const { data, error } = await supabase.rpc('process_cancellation', {
        p_subscription_id: subscription.id,
        p_step: step,
        p_reason: reason,
        p_reason_details: reasonDetails,
        p_offer_code: offerCode,
        p_accept_offer: acceptOffer,
      });

      if (error) throw error;

      const result = data as { success: boolean; action?: string; error?: string; message?: string };

      if (result.success) {
        if (result.action === 'continue') {
          // More steps to show
          return { success: true, action: 'continue' };
        } else if (result.action === 'cancelled') {
          toast({
            title: 'Subscription Cancelled',
            description: result.message || 'Your subscription has been cancelled.',
          });
          return { success: true, action: 'cancelled' };
        } else if (result.action === 'paused') {
          toast({
            title: 'Subscription Paused',
            description: result.message || 'Your subscription has been paused.',
          });
          return { success: true, action: 'paused' };
        } else if (result.action === 'discounted') {
          toast({
            title: 'Discount Applied! 🎉',
            description: result.message || 'A discount has been applied to your subscription.',
          });
          return { success: true, action: 'discounted' };
        } else {
          return { success: true, action: result.action };
        }
      } else {
        throw new Error(result.error || 'Failed to process cancellation');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process cancellation';
      captureError(err instanceof Error ? err : new Error(message), {
        context: 'useSubscriptionManagement.processCancellation',
        step,
        offerCode,
      });
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return { success: false, error: message };
    } finally {
      setIsProcessing(false);
    }
  }, [user, toast]);

  const resumeSubscription = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };

    setIsProcessing(true);
    try {
      // Get paused subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'paused')
        .single();

      if (!subscription) {
        return { success: false, error: 'No paused subscription found' };
      }

      const { data, error } = await supabase.rpc('resume_subscription', {
        p_subscription_id: subscription.id,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };

      if (result.success) {
        toast({
          title: 'Subscription Resumed! 🎉',
          description: result.message || 'Your subscription has been resumed.',
        });
        return { success: true };
      } else {
        throw new Error(result.error || 'Failed to resume subscription');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resume subscription';
      captureError(err instanceof Error ? err : new Error(message), {
        context: 'useSubscriptionManagement.resumeSubscription',
      });
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return { success: false, error: message };
    } finally {
      setIsProcessing(false);
    }
  }, [user, toast]);

  return {
    plans,
    currentPlan,
    billingInterval,
    setBillingInterval,
    createSubscription,
    upgradeSubscription,
    getWinBackOffers,
    processCancellation,
    resumeSubscription,
    isLoading,
    isProcessing,
  };
}
