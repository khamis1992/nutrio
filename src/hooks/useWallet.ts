import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';

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
  metadata: Record<string, unknown> | null;
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

const WALLET_KEY = "wallet";
const TX_KEY = "wallet-transactions";
const PACKAGES_KEY = "wallet-packages";

async function fetchWallet(userId: string): Promise<WalletData | null> {
  const { data, error } = await supabase
    .from('customer_wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const { data: newWallet, error: createError } = await supabase
      .from('customer_wallets')
      .insert({ user_id: userId })
      .select()
      .single();

    if (createError) throw createError;
    return newWallet;
  }

  return data;
}

async function fetchTransactions(userId: string, signal?: AbortSignal): Promise<WalletTransaction[]> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)
    .abortSignal(signal ?? null);

  if (error) throw error;
  return data || [];
}

async function fetchPackages(signal?: AbortSignal): Promise<TopUpPackage[]> {
  const { data, error } = await supabase
    .from('wallet_topup_packages')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .abortSignal(signal ?? null);

  if (error) throw error;
  return data || [];
}

export function useWallet() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data: wallet, isLoading: loading } = useQuery({
    queryKey: [WALLET_KEY, userId],
    queryFn: () => fetchWallet(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: [TX_KEY, userId],
    queryFn: ({ signal }) => fetchTransactions(userId!, signal),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const { data: topUpPackages = [] } = useQuery({
    queryKey: [PACKAGES_KEY],
    queryFn: ({ signal }) => fetchPackages(signal),
    staleTime: 10 * 60 * 1000,
  });

  useRealtimeTable("customer_wallets", {
    event: "*",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: !!userId,
    onChange: () => queryClient.invalidateQueries({ queryKey: [WALLET_KEY, userId] }),
  });

  useRealtimeTable("wallet_transactions", {
    event: "INSERT",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: !!userId,
    onChange: () => queryClient.invalidateQueries({ queryKey: [TX_KEY, userId] }),
  });

  const refetchWallet = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [WALLET_KEY, userId] });
  }, [queryClient, userId]);

  const refetchTransactions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [TX_KEY, userId] });
  }, [queryClient, userId]);

  const initiateTopUp = useCallback(async (
    packageId: string,
    paymentMethod: 'sadad' | 'card' = 'sadad'
  ): Promise<{ paymentId: string; paymentUrl: string } | null> => {
    if (!userId || !wallet) return null;

    try {
      const pkg = topUpPackages.find(p => p.id === packageId);
      if (!pkg) throw new Error('Package not found');

      const { data, error } = await supabase.functions.invoke('initiate-payment', {
        body: {
          user_id: userId,
          amount: pkg.amount,
          bonus_amount: pkg.bonus_amount,
          package_id: packageId,
          payment_method: paymentMethod,
          wallet_id: wallet.id,
        },
      });

      if (error) throw error;
      return data;
    } catch (err: unknown) {
      console.error('Error initiating top-up:', err);
      throw err;
    }
  }, [userId, wallet, topUpPackages]);

  const creditWallet = useCallback(async (
    amount: number,
    type: WalletTransaction['type'],
    referenceType?: string,
    referenceId?: string,
    description?: string,
    metadata?: Record<string, unknown>
  ) => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase.rpc('credit_wallet', {
        p_user_id: userId,
        p_amount: amount,
        p_type: type,
        p_reference_type: referenceType || null,
        p_reference_id: referenceId || null,
        p_description: description || null,
        p_metadata: metadata || null,
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: [WALLET_KEY, userId] });
      queryClient.invalidateQueries({ queryKey: [TX_KEY, userId] });

      return data;
    } catch (err: unknown) {
      console.error('Error crediting wallet:', err);
      throw err;
    }
  }, [userId, queryClient]);

  return {
    wallet,
    transactions,
    topUpPackages,
    loading,
    transactionsLoading,
    error: null,
    fetchWallet: refetchWallet,
    fetchTransactions: refetchTransactions,
    initiateTopUp,
    creditWallet,
    refresh: () => {
      refetchWallet();
      refetchTransactions();
    },
  };
}
