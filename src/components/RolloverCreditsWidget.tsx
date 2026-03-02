import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  RefreshCw, 
  Clock, 
  AlertCircle,
  ChevronRight,
  PiggyBank
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

      // Query using status column (active, consumed, expired)
      const { data, error } = await supabase
        .from('subscription_rollovers')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .gte('expiry_date', today)
        .order('expiry_date', { ascending: true });

      if (error) {
        // Table may not exist yet — treat as empty, don't crash
        console.warn('Rollover credits table not available:', error.message);
        setLoading(false);
        return;
      }

      // Data already has status field from DB
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
      // Get active subscription
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

      // Call the calculate_rollover_credits function
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
        // Provide user-friendly explanations for common failure reasons
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
    } catch (err: any) {
      toast({
        title: 'Could Not Check Rollover',
        description: err.message || 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  if (loading) return null;

  // No active rollover credits — show info card
  if (totalRollover === 0 && rollovers.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base font-semibold">Rollover Credits</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Unused meals at the end of your billing cycle roll over automatically — up to 20% of your monthly allocation. They appear here after your subscription renews.
          </p>
          <div className="bg-white/60 rounded-xl p-3 border border-blue-200/60 space-y-1.5">
            <p className="text-xs font-semibold text-blue-700">How rollover works:</p>
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">1</span>
              <span>End each cycle with unused meals</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">2</span>
              <span>Up to 20% carry forward when your plan renews</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">3</span>
              <span>Credits expire at the end of the following cycle</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={calculateRollover} className="w-full border-blue-300 text-blue-700 hover:bg-blue-50">
            <RefreshCw className="w-4 h-4 mr-2" />
            Check Eligibility Now
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base font-semibold">Rollover Credits</CardTitle>
          </div>
          {totalExpiring > 0 && (
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
              <AlertCircle className="w-3 h-3 mr-1" />
              {totalExpiring} expiring soon
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Total Rollover */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Available Rollover Credits</p>
            <p className="text-3xl font-bold text-blue-700">{totalRollover}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-blue-600" />
          </div>
        </div>

        {/* Active Rollovers List */}
        {rollovers.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Active Credits</p>
            <div className="space-y-2">
              {rollovers.slice(0, 3).map((rollover) => {
                const daysUntilExpiry = differenceInDays(new Date(rollover.expiry_date), new Date());
                const isExpiringSoon = daysUntilExpiry <= 7;

                return (
                  <div 
                    key={rollover.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isExpiringSoon 
                        ? 'bg-amber-50 border-amber-200' 
                        : 'bg-white/60 border-blue-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isExpiringSoon ? 'bg-amber-100' : 'bg-blue-100'
                      }`}>
                        {isExpiringSoon ? (
                          <Clock className={`w-4 h-4 ${isExpiringSoon ? 'text-amber-600' : 'text-blue-600'}`} />
                        ) : (
                          <RefreshCw className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{rollover.rollover_credits} credits</p>
                        <p className={`text-xs ${isExpiringSoon ? 'text-amber-700' : 'text-muted-foreground'}`}>
                          {isExpiringSoon ? (
                            <>Expires in {daysUntilExpiry} days</>
                          ) : (
                            <>Valid until {format(new Date(rollover.expiry_date), 'MMM d')}</>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="bg-white/50 p-3 rounded-lg border border-blue-200/50">
          <p className="text-xs text-muted-foreground">
            <strong>How it works:</strong> At the end of each billing cycle, up to 20% of your unused meal credits are rolled over to the next month. Rollover credits expire at the end of the next billing cycle.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
