import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  RefreshCw, 
  Clock, 
  AlertTriangle,
  Sparkles,
  Calendar,
  ArrowRight,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { differenceInDays, format } from 'date-fns';

interface RolloverCredit {
  id: string;
  subscription_id: string;
  rollover_credits: number;
  source_cycle_start: string;
  source_cycle_end: string;
  expiry_date: string;
  status: 'active' | 'consumed' | 'expired';
  created_at: string;
}

export function RolloverCreditsWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rollovers, setRollovers] = useState<RolloverCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRollover, setTotalRollover] = useState(0);
  const [totalExpiring, setTotalExpiring] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetchRolloverCredits();
  }, [user]);

  const fetchRolloverCredits = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('subscription_rollovers')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .gte('expiry_date', today)
        .order('expiry_date', { ascending: true });

      if (error) {
        console.warn('Rollover credits table not available:', error.message);
        setLoading(false);
        return;
      }

      const mapped = (data || []) as RolloverCredit[];
      setRollovers(mapped);
      
      const total = mapped.reduce((sum, r) => sum + (r.rollover_credits || 0), 0);
      setTotalRollover(total);

      const expiring = mapped.filter(r => {
        const daysUntilExpiry = differenceInDays(new Date(r.expiry_date), new Date());
        return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
      }).reduce((sum, r) => sum + (r.rollover_credits || 0), 0);
      
      setTotalExpiring(expiring);
    } catch (err) {
      console.error('Error fetching rollover credits:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateRollover = async () => {
    try {
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .single();

      if (subError || !subscription) {
        toast({
          title: 'No active subscription',
          description: 'You need an active subscription to calculate rollover credits.',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase.rpc('calculate_rollover_credits', {
        p_subscription_id: subscription.id,
        p_user_id: user?.id,
      });

      if (error) throw error;

      const result = data as { success: boolean; rollover_credits?: number; error?: string; message?: string };

      if (result.success) {
        toast({
          title: '🎉 Rollover Credits Granted!',
          description: `${result.rollover_credits} credits rolled over from your unused meals. They expire at the end of next billing cycle.`,
        });
        fetchRolloverCredits();
      } else {
        let friendlyMsg = result.message || result.error || 'No rollover credits available.';
        if (friendlyMsg.includes('payment')) {
          friendlyMsg = 'Rollover credits are granted automatically when your subscription renews. Check back after your next billing cycle.';
        } else if (friendlyMsg.includes('initial subscription')) {
          friendlyMsg = 'Rollover credits apply from your second billing cycle onwards once you have unused meals to carry forward.';
        } else if (friendlyMsg.includes('not found')) {
          friendlyMsg = 'No active subscription found. Please subscribe first.';
        }
        toast({
          title: 'Rollover Not Available Yet',
          description: friendlyMsg,
        });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Please try again later.';
      toast({
        title: 'Could Not Check Rollover',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  if (loading) return null;

  // No active rollover credits — show eligibility card
  if (totalRollover === 0 && rollovers.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border-emerald-200/50">
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-emerald-900">Rollover Credits</h3>
              <p className="text-emerald-600 text-sm">Carry forward unused meals</p>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-white/60 rounded-xl p-4 space-y-2 border border-emerald-100">
            <p className="text-sm text-emerald-800">
              Unused meals at the end of your billing cycle roll over automatically — up to 20% of your monthly allocation.
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            {[
              { step: 1, text: 'End each cycle with unused meals' },
              { step: 2, text: 'Up to 20% carry forward on renewal' },
              { step: 3, text: 'Use them in the next cycle' },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-600">
                  {item.step}
                </div>
                <span className="text-sm text-emerald-700">{item.text}</span>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <Button 
            variant="outline"
            size="sm" 
            onClick={calculateRollover}
            className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400"
          >
            Check Eligibility
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Has rollover credits — show the main card
  return (
    <Card className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border-emerald-200/50">
      <CardContent className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-emerald-900">Rollover Credits</h3>
              <p className="text-emerald-600 text-sm">Your unused meals</p>
            </div>
          </div>
          {totalExpiring > 0 && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {totalExpiring} expiring
            </Badge>
          )}
        </div>

        {/* Main Stats */}
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <p className="text-emerald-600 text-sm">Available Credits</p>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold text-emerald-700">{totalRollover}</span>
              <span className="text-emerald-600 text-lg">meals</span>
            </div>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-emerald-600" />
          </div>
        </div>

        {/* Progress to expiry indicator */}
        {rollovers.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-emerald-600 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                Next expiry
              </span>
              <span className="font-medium text-emerald-800">
                {format(new Date(rollovers[0].expiry_date), 'MMM d, yyyy')}
              </span>
            </div>
            <Progress 
              value={Math.max(0, 100 - (differenceInDays(new Date(rollovers[0].expiry_date), new Date()) / 30) * 100)} 
              className="h-2 bg-emerald-100 [&>div]:bg-emerald-500"
            />
          </div>
        )}

        {/* Individual Credits List */}
        {rollovers.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-emerald-700">Active Credits</p>
            <div className="grid gap-2">
              {rollovers.slice(0, 3).map((rollover) => {
                const daysUntilExpiry = differenceInDays(new Date(rollover.expiry_date), new Date());
                const isExpiringSoon = daysUntilExpiry <= 7;
                const expiryPercent = Math.max(0, Math.min(100, (daysUntilExpiry / 30) * 100));

                return (
                  <div 
                    key={rollover.id}
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      isExpiringSoon 
                        ? 'bg-amber-50 border-amber-200' 
                        : 'bg-white/60 border-emerald-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isExpiringSoon ? 'bg-amber-100' : 'bg-emerald-100'
                      }`}>
                        {isExpiringSoon ? (
                          <Clock className="w-4 h-4 text-amber-600" />
                        ) : (
                          <RefreshCw className="w-4 h-4 text-emerald-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-emerald-900">{rollover.rollover_credits} credits</p>
                        <p className={`text-xs ${isExpiringSoon ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {isExpiringSoon ? (
                            <>Expires in {daysUntilExpiry} days</>
                          ) : (
                            <>Valid until {format(new Date(rollover.expiry_date), 'MMM d')}</>
                          )}
                        </p>
                      </div>
                    </div>
                    {/* Mini expiry bar */}
                    <div className="w-12">
                      <div className="h-1 bg-emerald-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${isExpiringSoon ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ width: `${expiryPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer Note */}
        <div className="pt-3 border-t border-emerald-200">
          <div className="flex items-start gap-2 text-xs text-emerald-600">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Rollover credits expire at the end of your next billing cycle. Use them before they expire!</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
