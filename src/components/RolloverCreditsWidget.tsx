import { useState, useEffect } from 'react';
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
  const [rollovers, setRollovers] = useState<RolloverCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRollover, setTotalRollover] = useState(0);
  const storageKey = `rollover_activated_${user?.id}`;
  // localStorage persists across app restarts on the same device
  const [activated, setActivated] = useState(() => {
    try { return localStorage.getItem(`rollover_activated_${user?.id}`) === 'true'; }
    catch { return false; }
  });

  useEffect(() => {
    if (!user) return;
    fetchRolloverCredits();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // When subscription end date is known, sync expiry dates in DB if they exceed plan end
  useEffect(() => {
    if (!user || !subscriptionEndDate) return;
    syncExpiryWithPlan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, subscriptionEndDate]);

  const syncExpiryWithPlan = async () => {
    if (!subscriptionEndDate) return;
    // Update any rollover records whose expiry_date is after the plan's end_date
    await supabase
      .from('subscription_rollovers')
      .update({ expiry_date: subscriptionEndDate })
      .eq('user_id', user?.id)
      .eq('status', 'active')
      .gt('expiry_date', subscriptionEndDate);
  };

  const fetchRolloverCredits = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
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
        try { localStorage.removeItem(storageKey); } catch { /* noop */ }
        setActivated(false);
      }
    } catch (err) {
      console.error('Error fetching rollover credits:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUseCredits = () => {
    try { localStorage.setItem(storageKey, 'true'); } catch { /* noop */ }
    setActivated(true);
    toast.success(`${totalRollover} rollover meal${totalRollover > 1 ? 's' : ''} ready to use!`, {
      description: 'Credits are applied automatically when you schedule a meal.',
      duration: 4000,
    });
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
  const effectiveExpiry = subscriptionEndDate && isBefore(parseISO(subscriptionEndDate), parseISO(nextExpiry.expiry_date))
    ? subscriptionEndDate
    : nextExpiry.expiry_date;
  const daysLeft = differenceInDays(parseISO(effectiveExpiry), new Date());

  const maxSlots = 10;
  const filledSlots = Math.min(totalRollover, maxSlots);

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{
      background: 'linear-gradient(135deg, #059669 0%, #0d9488 40%, #10b981 70%, #34d399 100%)',
    }}>
      {/* Decorative sparkle */}
      <Sparkles className="absolute bottom-3 right-3 w-8 h-8 text-white/10" />

      <div className="relative p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm tracking-wide uppercase">
                {t('rollover_credits_title')}
              </h3>
              <p className="text-white/70 text-xs">{t('rollover_credits_subtitle')}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black text-white leading-none">{totalRollover}</p>
            <p className="text-white/70 text-[10px] font-medium mt-0.5">Available Meals</p>
          </div>
        </div>

        {/* Meal slots progress bar */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 flex gap-1">
            {Array.from({ length: maxSlots }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-6 rounded-md"
                style={{
                  background: i < filledSlots
                    ? 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(167,243,208,0.55) 100%)'
                    : 'rgba(255,255,255,0.18)',
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/25 bg-white/10 backdrop-blur-sm shrink-0">
            <Clock className="w-3 h-3 text-amber-200" />
            <span className="text-[11px] font-semibold text-amber-100">{daysLeft}d left</span>
          </div>
        </div>
        <p className="text-center text-white/50 text-[11px] -mt-2">{totalRollover} available meal(s)</p>

        {/* CTA button */}
        <button
          onClick={activated ? undefined : handleUseCredits}
          disabled={activated}
          className="w-full rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border border-white/25 bg-white/10 backdrop-blur-sm text-white disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
          style={{ height: 48 }}
        >
          {activated ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Credits activated — browse meals!
            </>
          ) : (
            <>
              <ShoppingBag className="w-4 h-4" />
              {t('rollover_use_credits')}
            </>
          )}
        </button>

        {/* Footer note */}
        <div className="flex items-start gap-2 text-[11px] text-white/50">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <p>Credits are automatically deducted when you schedule a meal. They expire with your current plan.</p>
        </div>
      </div>
    </div>
  );
}
