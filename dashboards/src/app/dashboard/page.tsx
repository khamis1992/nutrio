'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Layout } from '@/components/layout/Layout';
import { UserRole } from '@/types';

export default function DashboardPage() {
  const [user, setUser] = useState<{ email: string; roles: UserRole[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }

      setUser({
        email: currentUser.email!,
        roles: currentUser.roles
      });

      // Redirect based on primary role
      if (currentUser.roles.includes('admin')) {
        router.push('/admin');
      } else if (currentUser.roles.includes('restaurant_owner')) {
        router.push('/restaurant');
      } else if (currentUser.roles.includes('gym_owner')) {
        router.push('/gym');
      } else if (currentUser.roles.includes('driver')) {
        router.push('/driver');
      } else {
        router.push('/customer');
      }
      
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout user={user}>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          مرحباً بك في Nutrio
        </h1>
        <p className="mt-2 text-gray-600">
          يتم توجيهك إلى لوحة التحكم المناسبة...
        </p>
      </div>
    </Layout>
  );
}
