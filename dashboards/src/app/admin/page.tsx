import DashboardLayout from '@/components/layout/DashboardLayout';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import LineChart from '@/components/charts/LineChart';
import BarChart from '@/components/charts/BarChart';
import PieChart from '@/components/charts/PieChart';
import { 
  Users, 
  Store, 
  Dumbbell, 
  Truck, 
  TrendingUp, 
  DollarSign,
  ShoppingCart,
  Calendar
} from 'lucide-react';

export default function AdminDashboard() {
  // Mock data for charts
  const revenueData = {
    labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
    datasets: [
      {
        label: 'الإيرادات (ريال)',
        data: [12000, 19000, 15000, 25000, 22000, 30000],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
      },
    ],
  };

  const ordersData = {
    labels: ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'],
    datasets: [
      {
        label: 'الطلبات',
        data: [65, 59, 80, 81, 56, 55, 40],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      },
    ],
  };

  const categoryData = {
    labels: ['مطاعم', 'صالات رياضية', 'سائقين', 'عملاء'],
    datasets: [
      {
        data: [45, 25, 15, 15],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(34, 197, 94, 1)',
          'rgba(251, 191, 36, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const stats = [
    {
      title: 'إجمالي المستخدمين',
      value: '2,543',
      change: '+12%',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'المطاعم النشطة',
      value: '156',
      change: '+8%',
      icon: Store,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'الصالات الرياضية',
      value: '89',
      change: '+15%',
      icon: Dumbbell,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'السائقين المتاحين',
      value: '234',
      change: '+5%',
      icon: Truck,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'إجمالي الطلبات',
      value: '12,847',
      change: '+23%',
      icon: ShoppingCart,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      title: 'الإيرادات الشهرية',
      value: '₹ 45,230',
      change: '+18%',
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'الحجوزات اليوم',
      value: '127',
      change: '+7%',
      icon: Calendar,
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
    },
    {
      title: 'معدل النمو',
      value: '24.5%',
      change: '+3%',
      icon: TrendingUp,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
    },
  ];

  return (
    <DashboardLayout title="لوحة التحكم الرئيسية" userRole="admin">
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                      <p className="text-sm text-green-600">{stat.change} من الشهر الماضي</p>
                    </div>
                    <div className={`p-3 rounded-full ${stat.bgColor}`}>
                      <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>الإيرادات الشهرية</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChart data={revenueData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الطلبات الأسبوعية</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart data={ordersData} />
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>توزيع الفئات</CardTitle>
            </CardHeader>
            <CardContent>
              <PieChart data={categoryData} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>الطلبات الأخيرة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { id: '#12847', customer: 'أحمد محمد', restaurant: 'مطعم الذواقة', amount: '₹ 125', status: 'مكتمل' },
                  { id: '#12846', customer: 'فاطمة علي', restaurant: 'بيتزا هت', amount: '₹ 89', status: 'قيد التحضير' },
                  { id: '#12845', customer: 'محمد سالم', restaurant: 'كنتاكي', amount: '₹ 156', status: 'في الطريق' },
                  { id: '#12844', customer: 'نورا أحمد', restaurant: 'مطعم البحر', amount: '₹ 203', status: 'مكتمل' },
                ].map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{order.id}</p>
                      <p className="text-sm text-gray-600">{order.customer} - {order.restaurant}</p>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{order.amount}</p>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        order.status === 'مكتمل' ? 'bg-green-100 text-green-800' :
                        order.status === 'قيد التحضير' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
