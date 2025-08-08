import DashboardLayout from '@/components/layout/DashboardLayout';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import LineChart from '@/components/charts/LineChart';
import BarChart from '@/components/charts/BarChart';
import { 
  Calendar, 
  Users, 
  DollarSign, 
  Star,
  TrendingUp,
  Clock,
  Activity,
  AlertCircle
} from 'lucide-react';

export default function GymDashboard() {
  // Mock data for charts
  const bookingsData = {
    labels: ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'],
    datasets: [
      {
        label: 'الحجوزات',
        data: [25, 32, 28, 35, 42, 38, 30],
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
      },
    ],
  };

  const classesData = {
    labels: ['يوجا', 'كارديو', 'رفع أثقال', 'زومبا', 'بيلاتس'],
    datasets: [
      {
        label: 'عدد الحجوزات',
        data: [45, 67, 89, 34, 23],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      },
    ],
  };

  const stats = [
    {
      title: 'حجوزات اليوم',
      value: '32',
      change: '+15%',
      icon: Calendar,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'الأعضاء النشطين',
      value: '156',
      change: '+8%',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'إيرادات اليوم',
      value: '₹ 1,240',
      change: '+12%',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'التقييم',
      value: '4.9',
      change: '+0.1',
      icon: Star,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
  ];

  const todayClasses = [
    { 
      name: 'يوجا الصباح', 
      trainer: 'سارة أحمد', 
      time: '08:00 - 09:00', 
      booked: 12, 
      capacity: 15, 
      status: 'جاري' 
    },
    { 
      name: 'كارديو مكثف', 
      trainer: 'محمد علي', 
      time: '10:00 - 11:00', 
      booked: 8, 
      capacity: 12, 
      status: 'قادم' 
    },
    { 
      name: 'رفع أثقال', 
      trainer: 'أحمد سالم', 
      time: '14:00 - 15:30', 
      booked: 15, 
      capacity: 15, 
      status: 'مكتمل' 
    },
    { 
      name: 'زومبا', 
      trainer: 'فاطمة محمد', 
      time: '18:00 - 19:00', 
      booked: 10, 
      capacity: 20, 
      status: 'قادم' 
    },
  ];

  const recentBookings = [
    { id: '#B001', member: 'أحمد محمد', class: 'يوجا الصباح', time: '08:00', status: 'مؤكد' },
    { id: '#B002', member: 'فاطمة علي', class: 'كارديو مكثف', time: '10:00', status: 'مؤكد' },
    { id: '#B003', member: 'محمد سالم', class: 'رفع أثقال', time: '14:00', status: 'ملغي' },
    { id: '#B004', member: 'نورا أحمد', class: 'زومبا', time: '18:00', status: 'في الانتظار' },
  ];

  return (
    <DashboardLayout title="لوحة تحكم الصالة الرياضية" userRole="gym">
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
                      <p className={`text-sm ${stat.change.startsWith('+') ? 'text-green-600' : 'text-gray-600'}`}>
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
              <CardTitle>الحجوزات الأسبوعية</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChart data={bookingsData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الحصص الأكثر شعبية</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart data={classesData} />
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Classes */}
          <Card>
            <CardHeader>
              <CardTitle>حصص اليوم</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {todayClasses.map((classItem, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-gray-900">{classItem.name}</p>
                        <span className="text-sm text-gray-500">{classItem.time}</span>
                      </div>
                      <p className="text-sm text-gray-600">المدرب: {classItem.trainer}</p>
                      <p className="text-sm text-gray-500">
                        {classItem.booked}/{classItem.capacity} مشترك
                      </p>
                    </div>
                    <div className="text-left ml-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        classItem.status === 'جاري' ? 'bg-green-100 text-green-800' :
                        classItem.status === 'مكتمل' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {classItem.status}
                      </span>
                      <div className="w-20 bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full" 
                          style={{ width: `${(classItem.booked / classItem.capacity) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Bookings */}
          <Card>
            <CardHeader>
              <CardTitle>الحجوزات الأخيرة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-gray-900">{booking.id}</p>
                        <span className="text-sm text-gray-500">{booking.time}</span>
                      </div>
                      <p className="text-sm text-gray-600">{booking.member}</p>
                      <p className="text-sm text-gray-500">{booking.class}</p>
                    </div>
                    <div className="text-left ml-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        booking.status === 'مؤكد' ? 'bg-green-100 text-green-800' :
                        booking.status === 'ملغي' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-800">تحديثات مهمة</p>
                <p className="text-sm text-blue-700">
                  • حصة "رفع أثقال" الساعة 2:00 مكتملة العدد
                  <br />
                  • المدرب أحمد سالم سيتأخر 15 دقيقة على حصة المساء
                  <br />
                  • 5 حجوزات جديدة في انتظار التأكيد
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
