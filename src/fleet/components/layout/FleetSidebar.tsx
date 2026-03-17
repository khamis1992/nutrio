import { Link, useLocation } from 'react-router-dom';
import {
  Truck,
  Users,
  MapPin,
  SendHorizonal,
  CreditCard,
  Settings,
  LogOut,
  LayoutDashboard,
  Car,
  BarChart2,
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
import { useUnassignedOrderCount } from '@/fleet/hooks/useUnassignedOrderCount';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/fleet' },
  { icon: SendHorizonal, label: 'Dispatch', to: '/fleet/dispatch' },
  { icon: Users, label: 'Drivers', to: '/fleet/drivers' },
  { icon: Car, label: 'Vehicles', to: '/fleet/vehicles' },
  { icon: MapPin, label: 'Live Tracking', to: '/fleet/tracking' },
  { icon: CreditCard, label: 'Payouts', to: '/fleet/payouts' },
  { icon: BarChart2, label: 'Analytics', to: '/fleet/analytics' },
  { icon: Zap, label: 'Auto Dispatch', to: '/fleet/auto-dispatch' },
  { icon: Settings, label: 'Settings', to: '/fleet/settings' },
];

export function FleetSidebar() {
  const location = useLocation();
  const { logout, user } = useFleetAuth();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const unassignedCount = useUnassignedOrderCount();

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
              {navItems.map((item) => {
                const isOrders = item.to === '/fleet/dispatch';
                const showBadge = isOrders && unassignedCount > 0;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.to)}
                      tooltip={item.label}
                    >
                      <Link to={item.to} className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </span>
                        {showBadge && !isCollapsed && (
                          <span className="ml-auto min-w-[20px] h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center px-1.5">
                            {unassignedCount > 99 ? "99+" : unassignedCount}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
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
