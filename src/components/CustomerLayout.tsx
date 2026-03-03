import { Outlet } from "react-router-dom";
import { CustomerNavigation } from "@/components/CustomerNavigation";

/**
 * CustomerLayout - Shared layout wrapper for all customer-facing pages
 * Provides consistent background and navigation across the customer app
 */
export const CustomerLayout = () => {
  return (
    <div 
      className="relative min-h-screen"
      style={{ background: '#f5f5f5' }}
    >
      {/* Content */}
      <div className="relative z-10">
        <Outlet />
        <CustomerNavigation />
      </div>
    </div>
  );
};

export default CustomerLayout;
