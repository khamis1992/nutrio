import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDriverDetail } from "@/fleet/hooks/useDrivers";
import { 
  ArrowLeft, 
  Phone, 
  MapPin, 
  Star,
  Truck,
  FileText,
  Activity,
  Edit,
  MessageSquare
} from "lucide-react";

export default function DriverDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { driver, isLoading } = useDriverDetail(id || "");

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
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Driver not found</h2>
        <div className="flex justify-start rtl:flex-row-reverse mt-4">
          <Button onClick={() => navigate("/fleet/drivers")}>
            <ArrowLeft className="h-4 w-4 mr-2 rtl-flip-back" />
            Back to Drivers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 rtl:flex-row-reverse">
        <Button variant="outline" size="icon" onClick={() => navigate("/fleet/drivers")}>
          <ArrowLeft className="h-4 w-4 rtl-flip-back" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{driver.fullName}</h1>
          <p className="text-muted-foreground">Driver ID: {driver.id.slice(0, 8)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <MessageSquare className="h-4 w-4 mr-2" />
            Message
          </Button>
          <Button>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {driver.fullName.charAt(0)}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-semibold">{driver.fullName}</h2>
                {getStatusBadge(driver.status)}
                <div className={`w-3 h-3 rounded-full ${driver.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                <span className="text-sm text-muted-foreground">
                  {driver.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{driver.phone}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{driver.cityId}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span>{driver.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold">{driver.totalDeliveries}</p>
            <p className="text-sm text-muted-foreground">Total Deliveries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold">{driver.rating.toFixed(1)}</p>
            <p className="text-sm text-muted-foreground">Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold">{driver.currentBalance.toFixed(0)}</p>
            <p className="text-sm text-muted-foreground">Wallet (QAR)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold">{driver.totalEarnings.toFixed(0)}</p>
            <p className="text-sm text-muted-foreground">Total Earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Location & Vehicle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Current Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            {driver.currentLatitude && driver.currentLongitude ? (
              <div>
                <p className="text-sm text-muted-foreground">Last updated: {driver.locationUpdatedAt ? new Date(driver.locationUpdatedAt).toLocaleString() : 'Unknown'}</p>
                <div className="mt-4 h-48 bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">Map view coming soon</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No location data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Assigned Vehicle
            </CardTitle>
          </CardHeader>
          <CardContent>
            {driver.assignedVehicleId ? (
              <div className="space-y-2">
                <p className="font-medium">Vehicle ID: {driver.assignedVehicleId}</p>
                <Button variant="outline" size="sm">View Vehicle Details</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground">No vehicle assigned</p>
                <Button size="sm">
                  <Truck className="h-4 w-4 mr-2" />
                  Assign Vehicle
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span>Driver's License</span>
              <Badge variant="outline">Pending</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span>Vehicle Registration</span>
              <Badge variant="outline">Pending</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span>Insurance Document</span>
              <Badge variant="outline">Pending</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <div className="flex-1">
                <p className="font-medium">Went online</p>
                <p className="text-sm text-muted-foreground">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <div className="flex-1">
                <p className="font-medium">Completed delivery #1234</p>
                <p className="text-sm text-muted-foreground">3 hours ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <div className="flex-1">
                <p className="font-medium">Accepted delivery #1235</p>
                <p className="text-sm text-muted-foreground">4 hours ago</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
