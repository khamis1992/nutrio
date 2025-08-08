'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { signIn } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      } else {
        router.push('/admin');
      }
    } catch (err) {
      setError('حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary-600 mb-2">Nutrio</h1>
          <h2 className="text-xl font-semibold text-gray-900">تسجيل الدخول</h2>
          <p className="text-gray-600">ادخل إلى لوحة التحكم</p>
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

            <Input
              label="كلمة المرور"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />

            <Button
              type="submit"
              loading={loading}
              className="w-full"
            >
              تسجيل الدخول
            </Button>

            <div className="text-center">
              <Link
                href="/auth/register"
                className="text-primary-600 hover:text-primary-500"
              >
                ليس لديك حساب؟ سجل الآن
              </Link>
            </div>
          </form>
        </Card>

        {/* Demo Accounts */}
        <Card className="bg-blue-50">
          <h3 className="font-semibold text-blue-900 mb-3">حسابات تجريبية:</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <div>
              <strong>مدير النظام:</strong> admin@nutrio.com / password123
            </div>
            <div>
              <strong>مدير مطعم:</strong> restaurant@nutrio.com / password123
            </div>
            <div>
              <strong>مدير صالة:</strong> gym@nutrio.com / password123
            </div>
            <div>
              <strong>سائق:</strong> driver@nutrio.com / password123
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
