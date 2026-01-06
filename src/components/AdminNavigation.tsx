import { Link, useLocation } from "react-router-dom";
import { Shield, Store, Users, ShoppingBag, BarChart3, CreditCard, Settings, Download, Wallet, Tag } from "lucide-react";

const navItems = [
  { icon: Shield, label: "Dashboard", to: "/admin" },
  { icon: Store, label: "Restaurants", to: "/admin/restaurants" },
  { icon: Users, label: "Users", to: "/admin/users" },
  { icon: ShoppingBag, label: "Orders", to: "/admin/orders" },
  { icon: CreditCard, label: "Subs", to: "/admin/subscriptions" },
  { icon: Wallet, label: "Payouts", to: "/admin/payouts" },
  { icon: Tag, label: "Diet Tags", to: "/admin/diet-tags" },
  { icon: BarChart3, label: "Analytics", to: "/admin/analytics" },
  { icon: Download, label: "Export", to: "/admin/exports" },
  { icon: Settings, label: "Settings", to: "/admin/settings" },
];

export function AdminNavigation() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="container max-w-6xl mx-auto px-4">
        <div className="flex justify-around py-2">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex-col h-auto py-2 flex items-center transition-colors ${
                isActive(item.to)
                  ? "text-destructive"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
