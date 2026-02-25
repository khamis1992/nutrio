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
      // Fetch active rollover credits
      const { data, error } = await supabase
        .from('subscription_rollovers')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .order('expiry_date', { ascending: true });

      if (error) throw error;

      setRollovers(data || []);
      
      // Calculate totals
      const total = data?.reduce((sum, r) => sum + (r.rollover_credits || 0), 0) || 0;
      setTotalRollover(total);

      // Calculate expiring in next 7 days
      const expiring = data?.filter(r => {
        const daysUntilExpiry = differenceInDays(new Date(r.expiry_date), new Date());
        return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
      }).reduce((sum, r) => sum + (r.rollover_credits || 0), 0) || 0;
      
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
          title: 'Rollover Credits Calculated!',
          description: `You've received ${result.rollover_credits} rollover credits from your unused meals.`,
        });
        fetchRolloverCredits();
      } else {
        toast({
          title: 'Rollover Calculation',
          description: result.message || result.error || 'No rollover credits available at this time.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to calculate rollover credits.',
        variant: 'destructive',
      });
    }
  };

  if (loading) return null;

  // Only show if user has rollover credits or it's near cycle end
  if (totalRollover === 0 && rollovers.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base font-semibold">Rollover Credits</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Didn't use all your meals this month? You can roll over up to 20% of unused credits to next month!
          </p>
          <Button variant="outline" size="sm" onClick={calculateRollover} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Check Eligibility
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
