'use client';

import { useState, useEffect } from 'react';
import { 
  MapPin, 
  Navigation, 
  Clock, 
  DollarSign,
  Package,
  Star,
  Phone,
  MessageCircle,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

export default function DriverApp() {
  const [isOnline, setIsOnline] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [activeOrder, setActiveOrder] = useState<any>(null);

  // Mock active order
  useEffect(() => {
    if (isOnline) {
      setActiveOrder({
        id: '#12847',
        restaurant: 'مطعم الذواقة',
        customer: 'أحمد محمد',
        customerPhone: '+966501234567',
        pickupAddress: 'شارع الملك فهد، الرياض',
        deliveryAddress: 'حي النرجس، الرياض',
        items: ['برجر كلاسيك', 'بطاطس مقلية', 'مشروب غازي'],
        total: '₹ 125',
        status: 'pickup_ready',
        estimatedTime: '15 دقيقة',
        distance: '2.5 كم'
      });
    } else {
      setActiveOrder(null);
    }
  }, [isOnline]);

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  }, []);

  const stats = [
    {
      title: 'طلبات اليوم',
      value: '12',
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'الأرباح اليوم',
      value: '₹ 340',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'التقييم',
      value: '4.9',
      icon: Star,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'وقت التوصيل',
      value: '18 دقيقة',
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pickup_ready':
        return 'warning';
      case 'picked_up':
        return 'primary';
      case 'delivered':
        return 'success';
      default:
        return 'secondary';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pickup_ready':
        return 'جاهز للاستلام';
      case 'picked_up':
        return 'تم الاستلام';
      case 'delivered':
        return 'تم التوصيل';
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">تطبيق السائق</h1>
              <p className="text-sm text-gray-600">
                {currentLocation ? 
                  `الموقع: ${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : 
                  'جاري تحديد الموقع...'
                }
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant={isOnline ? 'success' : 'secondary'}
                onClick={() => setIsOnline(!isOnline)}
                className="flex items-center gap-2"
              >
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
                {isOnline ? 'متصل' : 'غير متصل'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-600">{stat.title}</p>
                      <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                    </div>
                    <div className={`p-2 rounded-full ${stat.bgColor}`}>
                      <Icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Active Order */}
        {activeOrder ? (
          <Card className="border-blue-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">الطلب النشط</CardTitle>
                <Badge variant={getStatusColor(activeOrder.status)}>
                  {getStatusText(activeOrder.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Order Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-900">{activeOrder.id}</p>
                  <p className="font-bold text-green-600">{activeOrder.total}</p>
                </div>
                <p className="text-sm text-gray-600">من: {activeOrder.restaurant}</p>
                <p className="text-sm text-gray-600">إلى: {activeOrder.customer}</p>
              </div>

              {/* Addresses */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-100 rounded-full">
                    <Package className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">نقطة الاستلام</p>
                    <p className="text-sm text-gray-600">{activeOrder.pickupAddress}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <MapPin className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">نقطة التوصيل</p>
                    <p className="text-sm text-gray-600">{activeOrder.deliveryAddress}</p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <p className="font-medium text-gray-900 mb-2">تفاصيل الطلب:</p>
                <div className="bg-gray-50 p-3 rounded-lg">
                  {activeOrder.items.map((item: string, index: number) => (
                    <p key={index} className="text-sm text-gray-600">• {item}</p>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button variant="primary" className="flex items-center justify-center gap-2">
                  <Navigation className="h-4 w-4" />
                  التنقل
                </Button>
                <Button variant="secondary" className="flex items-center justify-center gap-2">
                  <Phone className="h-4 w-4" />
                  اتصال
                </Button>
              </div>

              {/* Status Actions */}
              <div className="space-y-2">
                {activeOrder.status === 'pickup_ready' && (
                  <Button 
                    variant="success" 
                    className="w-full"
                    onClick={() => setActiveOrder({...activeOrder, status: 'picked_up'})}
                  >
                    <CheckCircle className="h-4 w-4 ml-2" />
                    تأكيد الاستلام
                  </Button>
                )}
                {activeOrder.status === 'picked_up' && (
                  <Button 
                    variant="success" 
                    className="w-full"
                    onClick={() => setActiveOrder({...activeOrder, status: 'delivered'})}
                  >
                    <CheckCircle className="h-4 w-4 ml-2" />
                    تأكيد التوصيل
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              {isOnline ? (
                <div>
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900 mb-2">في انتظار طلب جديد</p>
                  <p className="text-gray-600">سيتم إشعارك عند توفر طلب في منطقتك</p>
                </div>
              ) : (
                <div>
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900 mb-2">غير متصل</p>
                  <p className="text-gray-600">اضغط على "متصل" لبدء استقبال الطلبات</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Deliveries */}
        <Card>
          <CardHeader>
            <CardTitle>التوصيلات الأخيرة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { id: '#12846', customer: 'فاطمة علي', amount: '₹ 89', time: '11:30 ص', rating: 5 },
                { id: '#12845', customer: 'محمد سالم', amount: '₹ 156', time: '10:45 ص', rating: 4 },
                { id: '#12844', customer: 'نورا أحمد', amount: '₹ 203', time: '10:15 ص', rating: 5 },
              ].map((delivery) => (
                <div key={delivery.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{delivery.id}</p>
                    <p className="text-sm text-gray-600">{delivery.customer}</p>
                    <p className="text-xs text-gray-500">{delivery.time}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{delivery.amount}</p>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`h-3 w-3 ${i < delivery.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
