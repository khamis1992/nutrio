import { 
  Users, 
  Activity, 
  Truck, 
  Clock,
  TrendingUp,
  MapPin
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardStats } from '@/fleet/types/fleet';

interface DashboardStatsProps {
  stats: DashboardStats | null;
  isLoading?: boolean;
}

export function DashboardStats({ stats, isLoading }: DashboardStatsProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[80px] mb-2" />
              <Skeleton className="h-3 w-[120px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Drivers',
      value: stats.totalDrivers,
      icon: Users,
      description: 'Registered drivers',
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Active Drivers',
      value: stats.activeDrivers,
      icon: Activity,
      description: 'Approved & working',
      color: 'text-green-600',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Online Drivers',
      value: stats.onlineDrivers,
      icon: MapPin,
      description: 'Currently online',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'Orders In Progress',
      value: stats.ordersInProgress,
      icon: Truck,
      description: 'Active deliveries',
      color: 'text-orange-600',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: "Today's Deliveries",
      value: stats.todayDeliveries,
      icon: TrendingUp,
      description: 'Completed today',
      color: 'text-purple-600',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Avg Delivery Time',
      value: stats.averageDeliveryTime > 0 ? `${stats.averageDeliveryTime}m` : '-',
      icon: Clock,
      description: 'Minutes per delivery',
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-500/10',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {statCards.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {stat.title}
            </CardTitle>
            <div className={`${stat.bgColor} p-2 rounded-md`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
