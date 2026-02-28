import { Link, useLocation } from 'react-router-dom';
import {
  Truck,
  Users,
  MapPin,
  CreditCard,
  Settings,
  LogOut,
  LayoutDashboard,
  Car,
  Route,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useFleetAuth } from '@/fleet/hooks/useFleetAuth';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/fleet' },
  { icon: Users, label: 'Drivers', to: '/fleet/drivers' },
  { icon: Car, label: 'Vehicles', to: '/fleet/vehicles' },
  { icon: MapPin, label: 'Live Tracking', to: '/fleet/tracking' },
  { icon: Route, label: 'Route Optimization', to: '/fleet/routes' },
  { icon: CreditCard, label: 'Payouts', to: '/fleet/payouts' },
  { icon: Settings, label: 'Settings', to: '/fleet/settings' },
];

export function FleetSidebar() {
  const location = useLocation();
  const { logout, user } = useFleetAuth();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const isActive = (path: string) => {
    if (path === '/fleet') {
      return location.pathname === '/fleet';
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Truck className="w-4 h-4 text-primary" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sm">Fleet Portal</span>
              {user && (
                <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                  {user.fullName}
                </span>
              )}
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.to)}
                    tooltip={item.label}
                  >
                    <Link to={item.to}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip="Sign Out"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
