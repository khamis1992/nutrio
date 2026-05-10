import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calculator, 
  DollarSign, 
  TrendingUp, 
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface OrderCommission {
  id: string;
  total_amount: number;
  commission_rate: number;
  commission_amount: number;
  restaurant_payout: number;
  status: string;
  created_at: string;
  restaurant_name?: string;
}

interface CommissionStats {
  totalOrders: number;
  totalRevenue: number;
  totalCommission: number;
  totalPayout: number;
  averageOrderValue: number;
  commissionRate: number;
}

interface PartnerCommissionProps {
  restaurantId?: string;
  dateRange?: "today" | "week" | "month" | "all";
}

/**
 * Commission Display Component for Partner Portal
 * Shows commission breakdown for each order
 * Only visible to partners - NOT visible to customers
 */
export function PartnerCommission({ restaurantId, dateRange = "month" }: PartnerCommissionProps) {
  const { user } = useAuth();
  const [commissions, setCommissions] = useState<OrderCommission[]>([]);
  const [stats, setStats] = useState<CommissionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && restaurantId) {
      fetchCommissionData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, restaurantId, dateRange]);

  const fetchCommissionData = async () => {
    if (!restaurantId) return;

    try {
      setLoading(true);

      // Calculate date filter
      const now = new Date();
      let startDate = new Date();
      switch (dateRange) {
        case "today":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "week":
          startDate.setDate(now.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(now.getMonth() - 1);
          break;
        default:
          startDate = new Date(0); // All time
      }

      // Fetch orders with commission data
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          status,
          created_at,
          restaurant:restaurants(name)
        `)
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data - commission fields may exist from trigger but aren't in generated types
      const transformedOrders: OrderCommission[] = (ordersData || []).map(order => {
        const raw = order as Record<string, unknown>;
        return {
          id: order.id,
          total_amount: Number(order.total_amount) || 0,
          commission_rate: Number(raw.commission_rate) || 18,
          commission_amount: Number(raw.commission_amount) || 0,
          restaurant_payout: Number(raw.restaurant_payout) || 0,
          status: order.status,
          created_at: order.created_at,
          restaurant_name: ((order as Record<string, unknown>).restaurant as { name?: string } | undefined)?.name,
        };
      });

      setCommissions(transformedOrders);

      // Calculate stats
      const totalOrders = transformedOrders.length;
      const totalRevenue = transformedOrders.reduce((sum, o) => sum + o.total_amount, 0);
      const totalCommission = transformedOrders.reduce((sum, o) => sum + o.commission_amount, 0);
      const totalPayout = transformedOrders.reduce((sum, o) => sum + o.restaurant_payout, 0);

      // Calculate average commission rate from actual orders
      const avgCommissionRate = totalOrders > 0
        ? transformedOrders.reduce((sum, o) => sum + o.commission_rate, 0) / totalOrders
        : 18;

      setStats({
        totalOrders,
        totalRevenue,
        totalCommission,
        totalPayout,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        commissionRate: avgCommissionRate,
      });

    } catch (error) {
      console.error("Error fetching commission data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user || !restaurantId) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-green-50 to-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5 text-green-600" />
          Commission & Earnings
          <Badge variant="outline" className="ml-2 bg-green-100 text-green-700">
            {stats?.commissionRate?.toFixed(0) ?? 18}% Commission
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : stats ? (
          <div className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground">Total Orders</p>
                <p className="text-xl font-bold">{stats.totalOrders}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground">Your Payout ({(100 - stats.commissionRate).toFixed(0)}%)</p>
                <p className="text-xl font-bold text-green-600">{stats.totalPayout.toFixed(0)} QAR</p>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-lg font-semibold">{stats.totalRevenue.toFixed(0)} QAR</p>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground">Platform Commission ({stats.commissionRate.toFixed(0)}%)</p>
                <p className="text-lg font-semibold text-orange-600">{stats.totalCommission.toFixed(0)} QAR</p>
              </div>
            </div>

            {/* Breakdown Note */}
            <div className="bg-blue-50 p-3 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">How it works:</p>
                  <p className="text-blue-700 text-xs">
                    For every order, you receive <strong>{(100 - stats.commissionRate).toFixed(0)}%</strong> of the meal price.
                    Nutrio keeps <strong>{stats.commissionRate.toFixed(0)}%</strong> as commission.
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Orders with Commission */}
            {commissions.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Recent Orders</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {commissions.slice(0, 5).map(order => (
                    <div key={order.id} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
                      <div>
                        <span className="font-mono text-xs">#{order.id.slice(0, 8)}</span>
                        <span className="text-muted-foreground ml-2">{order.total_amount} QAR</span>
                      </div>
                      <div className="text-right">
                        <span className="text-green-600 font-medium">+{order.restaurant_payout.toFixed(0)} QAR</span>
                        <p className="text-xs text-muted-foreground">Your payout</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            No commission data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Simple order commission breakdown component
 * Can be added to order detail pages in Partner Portal
 */
export function OrderCommissionBreakdown({ order }: { order: OrderCommission }) {
  const mealPrice = order.total_amount;
  const rate = order.commission_rate || 18;
  const commission = order.commission_amount || mealPrice * (rate / 100);
  const payout = order.restaurant_payout || mealPrice - commission;

  return (
    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
      <h4 className="font-medium flex items-center gap-2">
        <DollarSign className="h-4 w-4" />
        Order Financial Breakdown
      </h4>
      
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Meal Price</span>
          <span>{mealPrice.toFixed(2)} QAR</span>
        </div>
        <div className="flex justify-between text-orange-600">
          <span>Platform Commission ({rate.toFixed(0)}%)</span>
          <span>- {commission.toFixed(2)} QAR</span>
        </div>
        <div className="border-t pt-2 flex justify-between font-medium">
          <span>Your Payout ({(100 - rate).toFixed(0)}%)</span>
          <span className="text-green-600">+ {payout.toFixed(2)} QAR</span>
        </div>
      </div>
    </div>
  );
}

export default PartnerCommission;
