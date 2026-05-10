import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

// Deep link routes for push notifications
export const DEEP_LINK_ROUTES = {
  // Order related
  'order_detail': '/orders/:id',
  'order_history': '/orders',
  'delivery_tracking': '/delivery/:id',
  
  // Subscription related
  'subscription': '/subscription',
  'subscription_manage': '/subscription',
  
  // Wallet & Payments
  'wallet': '/wallet',
  'checkout': '/checkout',
  
  // Meals & Restaurants
  'meals': '/meals',
  'restaurant': '/restaurant/:id',
  'meal_detail': '/meal/:id',
  'schedule': '/schedule',
  
  // Progress & Health
  'progress': '/progress',
  'weight_tracking': '/weight',
  
  // Social & Support
  'support': '/support',
  'referral': '/affiliate',
  'affiliate': '/affiliate',
  
  // Profile
  'profile': '/profile',
  'settings': '/settings',
  'notifications': '/notifications',
} as const;

export type DeepLinkRoute = keyof typeof DEEP_LINK_ROUTES;

interface PushNotificationData {
  type: DeepLinkRoute;
  id?: string;
  params?: Record<string, string>;
  title?: string;
  body?: string;
}

export function usePushNotificationDeepLink() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Handle push notification click
    const handlePushNotification = (event: MessageEvent) => {
      if (event.data?.type === 'push-notification-click') {
        const notificationData: PushNotificationData = event.data.payload;
        handleDeepLink(notificationData);
      }
    };

    // Listen for messages from service worker
    navigator.serviceWorker?.addEventListener('message', handlePushNotification);

    // Check for pending deep link on app load
    checkPendingDeepLink();

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handlePushNotification);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const handleDeepLink = (data: PushNotificationData) => {
    const { type, id, params } = data;
    
    // Validate route type exists
    if (!type || !DEEP_LINK_ROUTES[type]) {
      console.warn('Invalid deep link type:', type);
      // Fallback to home
      navigate('/');
      return;
    }
    
    // Build the route
    let route: string = DEEP_LINK_ROUTES[type];
    
    // Replace route parameters
    if (id) {
      route = route.replace(':id', id);
    }
    
    // Validate the resulting route exists (basic check)
    // If route contains unresolved :id, it's likely invalid
    if (route.includes(':')) {
      console.warn('Unresolved route params in deep link:', route);
      // Fallback to home
      navigate('/');
      return;
    }
    
    // Add query params if any
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(params);
      route += `?${searchParams.toString()}`;
    }

    // Navigate to the route
    navigate(route);
    
    // Show toast notification
    if (data.title) {
      toast({
        title: data.title,
        description: data.body || '',
      });
    }

    // Clear any pending deep link
    localStorage.removeItem('pending_deep_link');
  };

  const checkPendingDeepLink = () => {
    const pendingDeepLink = localStorage.getItem('pending_deep_link');
    if (pendingDeepLink) {
      try {
        const data: PushNotificationData = JSON.parse(pendingDeepLink);
        // Validate the parsed data has required fields
        if (!data || !data.type) {
          console.warn('Invalid pending deep link data');
          localStorage.removeItem('pending_deep_link');
          return;
        }
        handleDeepLink(data);
      } catch (err) {
        console.error('Error parsing pending deep link:', err);
        // Clear invalid data
        localStorage.removeItem('pending_deep_link');
      }
    }
  };

  const storePendingDeepLink = (data: PushNotificationData) => {
    localStorage.setItem('pending_deep_link', JSON.stringify(data));
  };

  return {
    handleDeepLink,
    storePendingDeepLink,
  };
}

// Utility function to create notification payload
export function createNotificationPayload(
  type: DeepLinkRoute,
  options: {
    id?: string;
    params?: Record<string, string>;
    title?: string;
    body?: string;
  } = {}
): PushNotificationData {
  return {
    type,
    id: options.id,
    params: options.params,
    title: options.title,
    body: options.body,
  };
}

// Common notification templates
export const NOTIFICATION_TEMPLATES = {
  orderReady: (orderId: string, restaurantName: string) => 
    createNotificationPayload('order_detail', {
      id: orderId,
      title: 'Order Ready!',
      body: `Your order from ${restaurantName} is ready for pickup`,
    }),
  
  orderDelivered: (orderId: string) => 
    createNotificationPayload('order_detail', {
      id: orderId,
      title: 'Order Delivered',
      body: 'Your meal has been delivered. Enjoy!',
    }),
  
  lowCredits: (remainingMeals: number) => 
    createNotificationPayload('subscription', {
      title: 'Low on Credits',
      body: `You have ${remainingMeals} meals remaining. Upgrade your plan?`,
    }),
  
  streakReminder: (streakDays: number) => 
    createNotificationPayload('progress', {
      title: 'Keep Your Streak!',
      body: `You're on a ${streakDays} day streak. Log a meal today!`,
    }),
  
  newRestaurant: (restaurantId: string, restaurantName: string) => 
    createNotificationPayload('restaurant', {
      id: restaurantId,
      title: 'New Restaurant',
      body: `${restaurantName} is now available. Check them out!`,
    }),
  
  referralBonus: (amount: number) =>
    createNotificationPayload('affiliate', {
      title: 'Affiliate Commission!',
      body: `You earned ${amount} QAR from your affiliate network`,
    }),
  
  weeklyReport: () => 
    createNotificationPayload('progress', {
      title: 'Weekly Report Ready',
      body: 'Your nutrition report for this week is ready to view',
    }),
};
