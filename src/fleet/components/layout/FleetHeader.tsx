import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Menu, 
  Bell, 
  ChevronDown, 
  MapPin, 
  Wifi, 
  WifiOff,
  User
} from 'lucide-react';
import { useTracking } from '@/fleet/context/TrackingContext';
import { useCity } from '@/fleet/context/CityContext';
import { useFleetAuth } from '@/fleet/hooks/useFleetAuth';
import { CitySelector } from '@/fleet/components/common/CitySelector';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function FleetHeader() {
  const location = useLocation();
  const { isConnected, onlineCount } = useTracking();
  const { selectedCity } = useCity();
  const { user, logout } = useFleetAuth();
  const [notifications] = useState(0);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/fleet') return 'Dashboard';
    if (path.startsWith('/fleet/drivers')) return 'Driver Management';
    if (path.startsWith('/fleet/vehicles')) return 'Vehicle Management';
    if (path.startsWith('/fleet/tracking')) return 'Live Tracking';
    if (path.startsWith('/fleet/payouts')) return 'Payout Management';
    if (path.startsWith('/fleet/settings')) return 'Settings';
    return 'Fleet Portal';
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <SidebarTrigger className="lg:hidden">
            <Menu className="h-5 w-5" />
          </SidebarTrigger>
          
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold leading-none tracking-tight">
              {getPageTitle()}
            </h1>
            {selectedCity && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{selectedCity.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Center Section - City Selector (Desktop) */}
        <div className="hidden md:flex items-center">
          <CitySelector />
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 lg:gap-4">
          {/* Connection Status */}
          <div className={cn(
            "hidden sm:flex items-center gap-2 px-2 py-1 rounded-md text-xs",
            isConnected ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
          )}>
            {isConnected ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            <span className="hidden lg:inline">
              {isConnected ? `${onlineCount} Online` : 'Disconnected'}
            </span>
          </div>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
          >
            <Bell className="h-5 w-5" />
            {notifications > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {notifications}
              </Badge>
            )}
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <span className="hidden lg:inline text-sm font-medium">
                  {user?.fullName || 'User'}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{user?.fullName}</span>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/fleet/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()}>
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
