import DashboardLayout from '@/components/layout/DashboardLayout';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import LineChart from '@/components/charts/LineChart';
import BarChart from '@/components/charts/BarChart';
import { 
  ShoppingCart, 
  DollarSign, 
  Clock, 
  Star,
  TrendingUp,
  Users,
  Package,
  AlertCircle
} from 'lucide-react';

export default function RestaurantDashboard() {
  // Mock data for charts
  const salesData = {
    labels: ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'],
    datasets: [
      {
        label: 'المبيعات (ريال)',
        data: [1200, 1900, 1500, 2500, 2200, 3000, 2800],
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
      },
    ],
  };

  const ordersData = {
    labels: ['الإفطار', 'الغداء', 'العشاء', 'وجبات خفيفة'],
    datasets: [
      {
        label: 'عدد الطلبات',
        data: [45, 120, 89, 67],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
    ],
  };

  const stats = [
    {
      title: 'طلبات اليوم',
      value: '47',
      change: '+12%',
      icon: ShoppingCart,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'إيرادات اليوم',
      value: '₹ 2,340',
      change: '+8%',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'متوسط وقت التحضير',
      value: '18 دقيقة',
      change: '-5%',
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'التقييم',
      value: '4.8',
      change: '+0.2',
      icon: Star,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
  ];

  const recentOrders = [
    { id: '#1234', customer: 'أحمد محمد', items: 'برجر + بطاطس + مشروب', amount: '₹ 85', status: 'قيد التحضير', time: '10:30 ص' },
    { id: '#1235', customer: 'فاطمة علي', items: 'بيتزا مارجريتا', amount: '₹ 120', status: 'جاهز', time: '10:25 ص' },
    { id: '#1236', customer: 'محمد سالم', items: 'سلطة سيزر + عصير', amount: '₹ 65', status: 'مكتمل', time: '10:20 ص' },
    { id: '#1237', customer: 'نورا أحمد', items: 'ساندويش دجاج + قهوة', amount: '₹ 45', status: 'ملغي', time: '10:15 ص' },
  ];

  const popularItems = [
    { name: 'برجر كلاسيك', orders: 45, revenue: '₹ 1,350' },
    { name: 'بيتزا مارجريتا', orders: 32, revenue: '₹ 1,920' },
    { name: 'سلطة سيزر', orders: 28, revenue: '₹ 840' },
    { name: 'ساندويش دجاج', orders: 24, revenue: '₹ 720' },
  ];

  return (
    <DashboardLayout title="لوحة تحكم المطعم" userRole="restaurant">
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
                      <p className={`text-sm ${stat.change.startsWith('+') ? 'text-green-600' : stat.change.startsWith('-') ? 'text-red-600' : 'text-gray-600'}`}>
                        {stat.change} من أمس
                      </p>
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
              <CardTitle>المبيعات الأسبوعية</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChart data={salesData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الطلبات حسب الوجبة</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart data={ordersData} />
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Orders */}
          <Card>
            <CardHeader>
              <CardTitle>الطلبات الأخيرة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-gray-900">{order.id}</p>
                        <span className="text-sm text-gray-500">{order.time}</span>
                      </div>
                      <p className="text-sm text-gray-600">{order.customer}</p>
                      <p className="text-sm text-gray-500">{order.items}</p>
                    </div>
                    <div className="text-left ml-4">
                      <p className="font-medium text-gray-900">{order.amount}</p>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        order.status === 'مكتمل' ? 'bg-green-100 text-green-800' :
                        order.status === 'جاهز' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'قيد التحضير' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Popular Items */}
          <Card>
            <CardHeader>
              <CardTitle>الأصناف الأكثر طلباً</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {popularItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600">{item.orders} طلب</p>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{item.revenue}</p>
                      <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                        <div 
                          className="bg-green-600 h-2 rounded-full" 
                          style={{ width: `${(item.orders / 50) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium text-orange-800">تنبيهات مهمة</p>
                <p className="text-sm text-orange-700">
                  • نفدت كمية البرجر الكلاسيك - يرجى تحديث المخزون
                  <br />
                  • 3 طلبات تنتظر التأكيد لأكثر من 10 دقائق
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
