import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useDrivers } from "@/fleet/hooks/useDrivers";
import { useCity } from "@/fleet/context/CityContext";
import { 
  Search, 
  Plus, 
  MapPin, 
  Phone, 
  Star,
  ChevronRight,
  Filter,
  Car
} from "lucide-react";
import { Link } from "react-router-dom";

export default function DriverManagement() {
  const { selectedCities } = useCity();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  
  // Memoize cityIds to prevent infinite re-renders
  const cityIds = useMemo(() => selectedCities.map(c => c.id), [selectedCities]);
  
  const { drivers, isLoading, total } = useDrivers({
    cityIds,
    status: statusFilter,
    search: search || undefined,
    page,
    limit: 20,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "pending_verification":
        return <Badge variant="outline" className="text-amber-500 border-amber-500">Pending</Badge>;
      case "suspended":
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="secondary">Inactive</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Drivers</h1>
          <p className="text-muted-foreground">Manage your delivery drivers</p>
        </div>
        <Link to="/fleet/drivers/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Driver
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search drivers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-background"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending_verification">Pending</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </select>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Driver Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {drivers.map((driver) => (
          <Link key={driver.id} to={`/fleet/drivers/${driver.id}`}>
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-semibold text-primary">
                        {driver.fullName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold">{driver.fullName}</h3>
                      <p className="text-sm text-muted-foreground">{driver.phone}</p>
                    </div>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${driver.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>

                <div className="mt-4 flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{driver.phone}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span>{driver.rating.toFixed(1)}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  {getStatusBadge(driver.status)}
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{driver.cityId}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Deliveries</span>
                  <span className="font-medium">{driver.totalDeliveries}</span>
                </div>
                {driver.vehiclePlate && (
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Car className="h-4 w-4" />
                    <span className="font-mono font-medium text-foreground">{driver.vehiclePlate}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Empty State */}
      {drivers.length === 0 && !isLoading && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">No drivers found</h3>
            <p className="text-muted-foreground mt-1">
              Try adjusting your search or filters
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 20 + 1} - {Math.min(page * 20, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(p => p + 1)}
              disabled={page * 20 >= total}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
