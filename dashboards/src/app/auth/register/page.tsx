'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Card from '@/components/ui/Card';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { signUp } = useAuth();
  const router = useRouter();

  const roleOptions = [
    { value: 'customer', label: 'عميل' },
    { value: 'restaurant_owner', label: 'مالك مطعم' },
    { value: 'gym_owner', label: 'مالك صالة رياضية' },
    { value: 'driver', label: 'سائق' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('كلمات المرور غير متطابقة');
      setLoading(false);
      return;
    }

    try {
      const { error } = await signUp(email, password, role);
      
      if (error) {
        setError('حدث خطأ أثناء إنشاء الحساب');
      } else {
        router.push('/auth/login');
      }
    } catch (err) {
      setError('حدث خطأ أثناء إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary-600 mb-2">Nutrio</h1>
          <h2 className="text-xl font-semibold text-gray-900">إنشاء حساب جديد</h2>
          <p className="text-gray-600">انضم إلى منصة Nutrio</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <Input
              label="البريد الإلكتروني"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="example@domain.com"
            />

            <Select
              label="نوع الحساب"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              options={roleOptions}
              required
            />

            <Input
              label="كلمة المرور"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />

            <Input
              label="تأكيد كلمة المرور"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
            />

            <Button
              type="submit"
              loading={loading}
              className="w-full"
            >
              إنشاء الحساب
            </Button>

            <div className="text-center">
              <Link
                href="/auth/login"
                className="text-primary-600 hover:text-primary-500"
              >
                لديك حساب بالفعل؟ سجل الدخول
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
