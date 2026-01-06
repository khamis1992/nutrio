import { Link, useLocation } from "react-router-dom";
import { Salad, Utensils, Calendar, Users, User } from "lucide-react";

const navItems = [
  { icon: Salad, label: "Home", to: "/dashboard" },
  { icon: Utensils, label: "Restaurants", to: "/meals" },
  { icon: Calendar, label: "Schedule", to: "/schedule" },
  { icon: Users, label: "Affiliate", to: "/affiliate" },
  { icon: User, label: "Profile", to: "/profile" },
];

export function CustomerNavigation() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-colors ${
                isActive(item.to)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive(item.to) ? "fill-primary/20" : ""}`} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
