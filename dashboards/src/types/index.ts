export type UserRole = 'admin' | 'restaurant_owner' | 'gym_owner' | 'driver' | 'customer';

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface User {
  id: string;
  email: string;
  created_at: string;
  user_roles: UserRole[];
}

export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  image_url?: string;
  is_active: boolean;
  rating: number;
  total_reviews: number;
  delivery_fee: number;
  min_order_amount: number;
  estimated_delivery_time: number;
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  image_url?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id?: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  is_available: boolean;
  is_featured: boolean;
  preparation_time: number;
  ingredients?: string[];
  allergens?: string[];
  created_at: string;
  updated_at: string;
  category?: MenuCategory;
}

export interface RestaurantOrder {
  id: string;
  restaurant_id: string;
  customer_id: string;
  driver_id?: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  customer_notes?: string;
  delivery_address?: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  estimated_delivery_time?: string;
  confirmed_at?: string;
  prepared_at?: string;
  delivered_at?: string;
  created_at: string;
  updated_at: string;
  restaurant?: Restaurant;
  driver?: Driver;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  special_instructions?: string;
  created_at: string;
  menu_item?: MenuItem;
}

export interface Gym {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  image_url?: string;
  is_active: boolean;
  rating: number;
  total_reviews: number;
  membership_fee: number;
  created_at: string;
  updated_at: string;
}

export interface Trainer {
  id: string;
  gym_id: string;
  name: string;
  email?: string;
  phone?: string;
  bio?: string;
  specializations?: string[];
  image_url?: string;
  experience_years: number;
  rating: number;
  total_reviews: number;
  hourly_rate?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GymClass {
  id: string;
  gym_id: string;
  trainer_id?: string;
  name: string;
  description?: string;
  category?: string;
  duration_minutes: number;
  max_participants: number;
  price: number;
  difficulty_level: string;
  equipment_needed?: string[];
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  trainer?: Trainer;
}

export interface ClassSchedule {
  id: string;
  class_id: string;
  trainer_id?: string;
  start_time: string;
  end_time: string;
  available_spots?: number;
  booked_spots: number;
  is_cancelled: boolean;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  gym_class?: GymClass;
  trainer?: Trainer;
}

export interface ClassBooking {
  id: string;
  schedule_id: string;
  customer_id: string;
  status: BookingStatus;
  booking_date: string;
  payment_amount?: number;
  payment_status: string;
  notes?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  schedule?: ClassSchedule;
}

export interface Driver {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  vehicle_type?: string;
  vehicle_number?: string;
  license_number?: string;
  is_active: boolean;
  is_available: boolean;
  current_latitude?: number;
  current_longitude?: number;
  rating: number;
  total_deliveries: number;
  created_at: string;
  updated_at: string;
}

export interface SystemSettings {
  id: string;
  key: string;
  value: any;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Analytics {
  date: string;
  total_orders?: number;
  total_revenue?: number;
  average_order_value?: number;
  cancelled_orders?: number;
  total_bookings?: number;
  cancelled_bookings?: number;
  no_show_bookings?: number;
  average_class_occupancy?: number;
}
