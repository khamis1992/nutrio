'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signUp } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { UserRole } from '@/types';

const roleOptions = [
  { value: 'customer', label: 'عميل' },
  { value: 'restaurant_owner', label: 'صاحب مطعم' },
  { value: 'gym_owner', label: 'صاحب صالة رياضية' },
  { value: 'driver', label: 'سائق' },
];

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

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
        router.push('/login?message=تم إنشاء الحساب بنجاح');
      }
    } catch (err) {
      setError('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary-600 mb-2">Nutrio</h1>
          <h2 className="text-2xl font-semibold text-gray-900">
            إنشاء حساب جديد
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            انضم إلى منصة Nutrio
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
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

            <Select
              label="نوع الحساب"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              options={roleOptions}
            />

            <Button
              type="submit"
              loading={loading}
              className="w-full"
            >
              إنشاء الحساب
            </Button>
          </form>
        </Card>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            لديك حساب بالفعل؟{' '}
            <a href="/login" className="text-primary-600 hover:text-primary-500">
              تسجيل الدخول
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
