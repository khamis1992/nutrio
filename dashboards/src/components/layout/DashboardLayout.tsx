import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  userRole: string;
}

export default function DashboardLayout({ children, title, userRole }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userRole={userRole} />
      
      <div className="flex-1 flex flex-col overflow-hidden lg:mr-64">
        <Header title={title} userRole={userRole} />
        
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
