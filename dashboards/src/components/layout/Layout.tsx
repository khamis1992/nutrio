'use client';

import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { UserRole } from '@/types';

interface LayoutProps {
  children: ReactNode;
  user: {
    email: string;
    roles: UserRole[];
  };
}

export function Layout({ children, user }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50" dir="rtl">
      <Sidebar userRoles={user.roles} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
