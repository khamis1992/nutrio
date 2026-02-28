import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDrivers } from '@/fleet/hooks/useDrivers';
import { useTracking } from '@/fleet/context/TrackingContext';
import { useCity } from '@/fleet/context/CityContext';
import { DriverCard } from './DriverCard';
import { DriverFilters } from './DriverFilters';
import { Search, RefreshCw } from 'lucide-react';

export function DriverList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  
  const { selectedCity } = useCity();
  const { drivers: trackingDrivers } = useTracking();
  
  const { 
    drivers, 
    isLoading, 
    pagination,
    refetch 
  } = useDrivers({
    cityIds: selectedCity ? [selectedCity.id] : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: search || undefined,
  });

  // Merge REST API data with real-time tracking data
  const mergedDrivers = drivers.map(driver => {
    const trackingData = trackingDrivers.find(t => t.driverId === driver.id);
    return {
      ...driver,
      isOnline: trackingData?.isOnline ?? driver.isOnline,
      currentLatitude: trackingData?.latitude ?? driver.currentLatitude,
      currentLongitude: trackingData?.longitude ?? driver.currentLongitude,
      locationUpdatedAt: trackingData?.timestamp ?? driver.locationUpdatedAt,
    };
  });

  // Filter by online status if needed
  const filteredDrivers = showOnlineOnly 
    ? mergedDrivers.filter(d => d.isOnline)
    : mergedDrivers;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Drivers</h1>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search drivers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>
          <DriverFilters 
            status={statusFilter}
            onStatusChange={setStatusFilter}
            showOnlineOnly={showOnlineOnly}
            onToggleOnline={() => setShowOnlineOnly(!showOnlineOnly)}
          />
        </div>
      </div>

      {/* Driver Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-4 space-y-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-20 w-full" />
            </Card>
          ))}
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No drivers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrivers.map(driver => (
            <DriverCard key={driver.id} driver={driver} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            Showing {drivers.length} of {pagination.total} drivers
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
