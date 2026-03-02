import { Outlet } from "react-router-dom";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import backgroundImage from "@/assets/background.png";

/**
 * CustomerLayout - Shared layout wrapper for all customer-facing pages
 * Provides consistent background and navigation across the customer app
 */
export const CustomerLayout = () => {
  return (
    <div 
      className="relative min-h-screen"
      style={{ 
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Semi-transparent overlay for readability */}
      <div className="absolute inset-0 bg-background/70" />
      
      {/* Content */}
      <div className="relative z-10">
        <Outlet />
        <CustomerNavigation />
      </div>
    </div>
  );
};

export default CustomerLayout;
