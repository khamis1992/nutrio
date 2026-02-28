import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTracking } from '@/fleet/context/TrackingContext';
import { useDrivers } from '@/fleet/hooks/useDrivers';
import { useCity } from '@/fleet/context/CityContext';

export function DriversStatusChart() {
  const { onlineCount } = useTracking();
  const { selectedCity } = useCity();
  
  const { drivers, isLoading } = useDrivers({
    cityId: selectedCity?.id,
    limit: 1000, // Get all drivers for stats
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[200px]" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalDrivers = drivers.length;
  const onlineDrivers = onlineCount;
  const offlineDrivers = totalDrivers - onlineDrivers;
  
  // Calculate status breakdown
  const statusCounts = drivers.reduce((acc, driver) => {
    acc[driver.status] = (acc[driver.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const onlinePercentage = totalDrivers > 0 ? (onlineDrivers / totalDrivers) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Driver Status Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Simple Bar Chart Representation */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Online</span>
            <span className="font-medium">{onlineDrivers} ({Math.round(onlinePercentage)}%)</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${onlinePercentage}%` }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Offline</span>
            <span className="font-medium">{offlineDrivers}</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-gray-400 rounded-full transition-all duration-500"
              style={{ width: `${totalDrivers > 0 ? (offlineDrivers / totalDrivers) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground capitalize">
                {status.replace('_', ' ')}
              </span>
              <span className="font-medium">{count}</span>
            </div>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{onlineDrivers}</div>
            <div className="text-xs text-muted-foreground">Online</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{offlineDrivers}</div>
            <div className="text-xs text-muted-foreground">Offline</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{totalDrivers}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
