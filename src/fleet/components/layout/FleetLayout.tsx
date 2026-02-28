import { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { FleetSidebar } from './FleetSidebar';
import { FleetHeader } from './FleetHeader';
import { FleetMobileNav } from './FleetMobileNav';
import { useFleetAuth } from '@/fleet/hooks/useFleetAuth';
import { TrackingProvider } from '@/fleet/context/TrackingContext';
import { CityProvider } from '@/fleet/context/CityContext';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';

interface FleetLayoutProps {
  children?: ReactNode;
}

export function FleetLayout({ children }: FleetLayoutProps) {
  const { isLoading } = useFleetAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <CityProvider>
      <TrackingProvider>
        <SidebarProvider>
          <div className="min-h-screen flex w-full bg-background">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block">
              <FleetSidebar />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-screen">
              {/* Header */}
              <FleetHeader />

              {/* Main Content */}
              <main className="flex-1 overflow-auto p-4 lg:p-6 pb-24 lg:pb-6">
                <div className="max-w-7xl mx-auto">
                  {children || <Outlet />}
                </div>
              </main>

              {/* Mobile Navigation */}
              <FleetMobileNav />
            </div>
          </div>
        </SidebarProvider>
      </TrackingProvider>
    </CityProvider>
  );
}

export default FleetLayout;
