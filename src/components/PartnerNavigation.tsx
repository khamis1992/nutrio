import { Link, useLocation } from "react-router-dom";
import { Store, UtensilsCrossed, Package, Settings } from "lucide-react";

const navItems = [
  { icon: Store, label: "Dashboard", to: "/partner" },
  { icon: UtensilsCrossed, label: "Menu", to: "/partner/menu" },
  { icon: Package, label: "Orders", to: "/partner/orders" },
  { icon: Settings, label: "Settings", to: "/partner/settings" },
];

export function PartnerNavigation() {
  const location = useLocation();
  
  const isActive = (path: string) => {
    if (path === "/partner") {
      return location.pathname === "/partner";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="flex justify-around py-2">
          {navItems.map((item) => (
            <Link 
              key={item.to}
              to={item.to} 
              className={`flex-col h-auto py-2 flex items-center transition-colors ${
                isActive(item.to) 
                  ? "text-primary" 
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
