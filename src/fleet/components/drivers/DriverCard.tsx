import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DriverStatusBadge } from './DriverStatusBadge';
import { 
  Phone, 
  Mail, 
  MapPin, 
  Navigation,
  MoreVertical,
  Star,
  Truck
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Driver } from '@/fleet/types/fleet';

interface DriverCardProps {
  driver: Driver & { isOnline?: boolean };
}

export function DriverCard({ driver }: DriverCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Card 
      className="group hover:shadow-md transition-shadow"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center
              ${driver.isOnline 
                ? 'bg-green-500/10 text-green-600' 
                : 'bg-gray-100 text-gray-500'
              }
            `}>
              {driver.profilePhotoUrl ? (
                <img 
                  src={driver.profilePhotoUrl} 
                  alt={driver.fullName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-lg font-semibold">
                  {driver.fullName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Name & Status */}
            <div>
              <h3 className="font-semibold text-sm">{driver.fullName}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <DriverStatusBadge status={driver.status} />
                {driver.isOnline && (
                  <Badge variant="default" className="bg-green-500 text-[10px] px-1.5 py-0">
                    Online
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/fleet/drivers/${driver.id}`}>View Details</Link>
              </DropdownMenuItem>
              <DropdownMenuItem>Edit Driver</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">Deactivate</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Contact Info */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            <span>{driver.phone}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            <span className="truncate">{driver.email}</span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-1 text-sm">
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            <span className="font-medium">{driver.rating.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span>{driver.totalDeliveries} deliveries</span>
          </div>
          <div className="text-sm font-medium">
            QAR {driver.currentBalance.toFixed(2)}
          </div>
        </div>

        {/* Location Info (if online) */}
        {driver.isOnline && driver.currentLatitude && driver.currentLongitude && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Navigation className="h-3 w-3" />
                <span>Currently active</span>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link to={`/fleet/tracking?driver=${driver.id}`}>
                  Track
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
