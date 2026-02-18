import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface WalletData {
  id: string;
  user_id: string;
  balance: number;
  total_credits: number;
  total_debits: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  user_id: string;
  type: 'credit' | 'debit' | 'refund' | 'bonus' | 'cashback';
  amount: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface TopUpPackage {
  id: string;
  amount: number;
  bonus_amount: number;
  bonus_percentage: number;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
}

export interface PaymentRecord {
  id: string;
  user_id: string | null;
  payment_type: 'wallet_topup' | 'subscription' | 'order';
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  payment_method: 'sadad' | 'wallet' | 'card' | null;
  gateway: string;
  gateway_reference: string | null;
  gateway_response: Record<string, any> | null;
  created_at: string;
  completed_at: string | null;
}

export function useWallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [topUpPackages, setTopUpPackages] = useState<TopUpPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWallet = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: walletError } = await (supabase as any)
        .from('customer_wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (walletError) throw walletError;

      if (!data) {
        const { data: newWallet, error: createError } = await (supabase as any)
          .from('customer_wallets')
          .insert({ user_id: user.id })
          .select()
          .single();

        if (createError) throw createError;
        setWallet(newWallet);
      } else {
        setWallet(data);
      }
    } catch (err: any) {
      console.error('Error fetching wallet:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchTransactions = useCallback(async (limit = 20, offset = 0) => {
    if (!user) return;

    try {
      setTransactionsLoading(true);

      const { data, error: txError } = await (supabase as any)
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (txError) throw txError;
      setTransactions(data || []);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
    } finally {
      setTransactionsLoading(false);
    }
  }, [user]);

  const fetchTopUpPackages = useCallback(async () => {
    try {
      const { data, error: pkgError } = await (supabase as any)
        .from('wallet_topup_packages')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (pkgError) throw pkgError;
      setTopUpPackages(data || []);
    } catch (err: any) {
      console.error('Error fetching top-up packages:', err);
    }
  }, []);

  const initiateTopUp = useCallback(async (
    packageId: string,
    paymentMethod: 'sadad' | 'card' = 'sadad'
  ): Promise<{ paymentId: string; paymentUrl: string } | null> => {
    if (!user || !wallet) return null;

    try {
      const pkg = topUpPackages.find(p => p.id === packageId);
      if (!pkg) throw new Error('Package not found');

      const totalAmount = pkg.amount + pkg.bonus_amount;

      const { data, error } = await supabase.functions.invoke('initiate-payment', {
        body: {
          user_id: user.id,
          amount: pkg.amount,
          bonus_amount: pkg.bonus_amount,
          package_id: packageId,
          payment_method: paymentMethod,
          wallet_id: wallet.id,
        },
      });

      if (error) throw error;

      return data;
    } catch (err: any) {
      console.error('Error initiating top-up:', err);
      throw err;
    }
  }, [user, wallet, topUpPackages]);

  const creditWallet = useCallback(async (
    amount: number,
    type: WalletTransaction['type'],
    referenceType?: string,
    referenceId?: string,
    description?: string,
    metadata?: Record<string, any>
  ) => {
    if (!user) return null;

    try {
      const { data, error } = await (supabase as any).rpc('credit_wallet', {
        p_user_id: user.id,
        p_amount: amount,
        p_type: type,
        p_reference_type: referenceType || null,
        p_reference_id: referenceId || null,
        p_description: description || null,
        p_metadata: metadata || null,
      });

      if (error) throw error;
      
      await fetchWallet();
      await fetchTransactions();
      
      return data;
    } catch (err: any) {
      console.error('Error crediting wallet:', err);
      throw err;
    }
  }, [user, fetchWallet, fetchTransactions]);

  useEffect(() => {
    if (user) {
      fetchWallet();
      fetchTopUpPackages();
      fetchTransactions();
    }
  }, [user, fetchWallet, fetchTopUpPackages, fetchTransactions]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('wallet-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_wallets',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchWallet();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wallet_transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchWallet, fetchTransactions]);

  return {
    wallet,
    transactions,
    topUpPackages,
    loading,
    transactionsLoading,
    error,
    fetchWallet,
    fetchTransactions,
    initiateTopUp,
    creditWallet,
    refresh: () => {
      fetchWallet();
      fetchTransactions();
    },
  };
}
