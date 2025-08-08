'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Users,
  Store,
  Dumbbell,
  Truck,
  Settings,
  BarChart3,
  Menu,
  X,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  userRole: string;
}

export default function Sidebar({ userRole }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const getMenuItems = () => {
    const baseItems = [
      { href: `/${userRole}`, icon: LayoutDashboard, label: 'لوحة التحكم' },
      { href: `/${userRole}/analytics`, icon: BarChart3, label: 'الإحصائيات' },
    ];

    switch (userRole) {
      case 'admin':
        return [
          ...baseItems,
          { href: '/admin/users', icon: Users, label: 'المستخدمين' },
          { href: '/admin/restaurants', icon: Store, label: 'المطاعم' },
          { href: '/admin/gyms', icon: Dumbbell, label: 'الصالات الرياضية' },
          { href: '/admin/drivers', icon: Truck, label: 'السائقين' },
          { href: '/admin/settings', icon: Settings, label: 'الإعدادات' },
        ];
      case 'restaurant':
        return [
          ...baseItems,
          { href: '/restaurant/menu', icon: Store, label: 'القائمة' },
          { href: '/restaurant/orders', icon: Store, label: 'الطلبات' },
          { href: '/restaurant/settings', icon: Settings, label: 'الإعدادات' },
        ];
      case 'gym':
        return [
          ...baseItems,
          { href: '/gym/classes', icon: Dumbbell, label: 'الحصص' },
          { href: '/gym/trainers', icon: Users, label: 'المدربين' },
          { href: '/gym/bookings', icon: Dumbbell, label: 'الحجوزات' },
          { href: '/gym/settings', icon: Settings, label: 'الإعدادات' },
        ];
      default:
        return baseItems;
    }
  };

  const menuItems = getMenuItems();

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 rounded-md bg-white shadow-md"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Sidebar */}
      <div className={clsx(
        'fixed inset-y-0 right-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 border-b border-gray-200">
            <h1 className="text-xl font-bold text-primary-600">Nutrio</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx('sidebar-link', isActive && 'active')}
                  onClick={() => setIsOpen(false)}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gray-200">
            <button className="sidebar-link w-full">
              <LogOut className="h-5 w-5" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
