import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Sparkles, ShoppingBag, Info, Clock, Lock, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { differenceInDays, format, isBefore, parseISO } from 'date-fns';
import { toast } from 'sonner';

interface RolloverCredit {
  id: string;
  rollover_credits: number;
  expiry_date: string;
  status: 'active' | 'consumed' | 'expired';
}

interface Props {
  hasActiveSubscription: boolean;
  subscriptionEndDate?: string | null;
}

export function RolloverCreditsWidget({ hasActiveSubscription, subscriptionEndDate }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [rollovers, setRollovers] = useState<RolloverCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRollover, setTotalRollover] = useState(0);
  const storageKey = `rollover_activated_${user?.id}`;
  const [activated, setActivated] = useState(() => {
    try { return sessionStorage.getItem(`rollover_activated_${user?.id}`) === 'true'; }
    catch { return false; }
  });

  useEffect(() => {
    if (!user) return;
    fetchRolloverCredits();
  }, [user]);

  // When subscription end date is known, sync expiry dates in DB if they exceed plan end
  useEffect(() => {
    if (!user || !subscriptionEndDate) return;
    syncExpiryWithPlan();
  }, [user, subscriptionEndDate]);

  const syncExpiryWithPlan = async () => {
    if (!subscriptionEndDate) return;
    // Update any rollover records whose expiry_date is after the plan's end_date
    await (supabase as any)
      .from('subscription_rollovers')
      .update({ expiry_date: subscriptionEndDate })
      .eq('user_id', user?.id)
      .eq('status', 'active')
      .gt('expiry_date', subscriptionEndDate);
  };

  const fetchRolloverCredits = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await (supabase as any)
        .from('subscription_rollovers')
        .select('id, rollover_credits, expiry_date, status')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .gte('expiry_date', today)
        .order('expiry_date', { ascending: true });

      if (error) {
        console.warn('Rollover credits not available:', error.message);
        setLoading(false);
        return;
      }

      const mapped = (data || []) as RolloverCredit[];
      const total = mapped.reduce((sum, r) => sum + (r.rollover_credits || 0), 0);
      setRollovers(mapped);
      setTotalRollover(total);
      // Clear activated flag once all credits are actually consumed
      if (total === 0) {
        try { sessionStorage.removeItem(storageKey); } catch { /* noop */ }
        setActivated(false);
      }
    } catch (err) {
      console.error('Error fetching rollover credits:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUseCredits = () => {
    try { sessionStorage.setItem(storageKey, 'true'); } catch { /* noop */ }
    setActivated(true);
    toast.success(`${totalRollover} rollover meal${totalRollover > 1 ? 's' : ''} ready to use!`, {
      description: 'Browse meals and schedule — credits are applied automatically.',
      duration: 4000,
    });
    setTimeout(() => navigate('/meals'), 800);
  };

  if (loading) return null;

  // ── No active plan — credits locked ───────────────────────────────────────
  if (!hasActiveSubscription) {
    return (
      <Card className="bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200/60">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-700">{t('rollover_credits_title')}</h3>
              <p className="text-gray-500 text-sm mt-1">An active subscription is required to earn and use rollover credits.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── No credits left (all used or never earned) ────────────────────────────
  if (totalRollover === 0) {
    return (
      <Card className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border-emerald-200/50">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-emerald-900">{t('rollover_credits_title')}</h3>
              <p className="text-emerald-600 text-sm mt-1">{t('rollover_carry_forward_desc')}</p>
            </div>
          </div>

          {/* Disabled "all used" button */}
          <Button
            disabled
            className="w-full rounded-xl opacity-60 cursor-not-allowed"
            style={{ height: 48 }}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            All credits used
          </Button>

          <p className="text-emerald-500 text-xs flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            New credits are granted automatically at renewal
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Has credits ───────────────────────────────────────────────────────────
  const nextExpiry = rollovers[0];
  // Use the earlier of: credit expiry or plan end date
  const effectiveExpiry = subscriptionEndDate && isBefore(parseISO(subscriptionEndDate), parseISO(nextExpiry.expiry_date))
    ? subscriptionEndDate
    : nextExpiry.expiry_date;
  const daysLeft = differenceInDays(parseISO(effectiveExpiry), new Date());
  const isExpiringSoon = daysLeft <= 7;

  return (
    <Card className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border-emerald-200/50">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-emerald-900">{t('rollover_credits_title')}</h3>
            <p className="text-emerald-600 text-sm">{t('rollover_credits_subtitle')}</p>
          </div>
        </div>

        {/* Credit count + expiry */}
        <div className="bg-white/60 rounded-2xl px-4 py-3 border border-emerald-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-600 mb-0.5">{t('rollover_available_credits')}</p>
            <p className="text-3xl font-black text-emerald-700">
              {totalRollover}
              <span className="text-base font-semibold ml-1">{t('rollover_meals')}</span>
            </p>
          </div>
          {isExpiringSoon ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
              <Clock className="w-3.5 h-3.5" />
              {daysLeft}d left
            </div>
          ) : (
            <div className="text-right">
              <p className="text-xs text-emerald-500">Expires with plan</p>
              <p className="text-sm font-semibold text-emerald-700">{format(parseISO(effectiveExpiry), 'MMM d, yyyy')}</p>
            </div>
          )}
        </div>

        {/* CTA — disabled once activated this session */}
        <Button
          onClick={handleUseCredits}
          disabled={activated}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ height: 48 }}
        >
          {activated ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Credits activated — browse meals!
            </>
          ) : (
            <>
              <ShoppingBag className="w-4 h-4 mr-2" />
              {t('rollover_use_credits')}
            </>
          )}
        </Button>

        {/* Footer */}
        <div className="flex items-start gap-2 text-xs text-emerald-600">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <p>Credits are automatically deducted when you schedule a meal. They expire with your current plan.</p>
        </div>
      </CardContent>
    </Card>
  );
}
