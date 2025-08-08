'use client';

import { Bell, Search, User } from 'lucide-react';
import Button from '../ui/Button';

interface HeaderProps {
  title: string;
  userRole: string;
}

export default function Header({ title, userRole }: HeaderProps) {
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'مدير النظام';
      case 'restaurant':
        return 'مدير مطعم';
      case 'gym':
        return 'مدير صالة رياضية';
      case 'driver':
        return 'سائق';
      default:
        return 'مستخدم';
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500">{getRoleLabel(userRole)}</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="البحث..."
              className="input pr-10 w-64"
            />
          </div>

          {/* Notifications */}
          <Button variant="secondary" size="sm" className="p-2">
            <Bell className="h-5 w-5" />
          </Button>

          {/* Profile */}
          <Button variant="secondary" size="sm" className="p-2">
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
