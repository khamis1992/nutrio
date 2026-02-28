import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Car,
  MapPin,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const mobileNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/fleet' },
  { icon: Users, label: 'Drivers', to: '/fleet/drivers' },
  { icon: Car, label: 'Vehicles', to: '/fleet/vehicles' },
  { icon: MapPin, label: 'Tracking', to: '/fleet/tracking' },
  { icon: CreditCard, label: 'Payouts', to: '/fleet/payouts' },
];

export function FleetMobileNav() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/fleet') {
      return location.pathname === '/fleet';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      <div className="flex items-center justify-around h-16">
        {mobileNavItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full gap-1",
              "transition-colors duration-200",
              isActive(item.to)
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className={cn(
              "h-5 w-5",
              isActive(item.to) && "stroke-[2.5px]"
            )} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
