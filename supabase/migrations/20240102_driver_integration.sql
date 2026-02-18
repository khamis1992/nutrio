-- Driver App Integration Migration
-- Links orders to deliveries and creates automatic delivery records

-- Add order_id to deliveries table if not exists
DO $$ BEGIN
  ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- Create orders table if not exists (for meal ordering)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  meal_id UUID,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(10, 2) DEFAULT 3.00,
  tip_amount NUMERIC(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  delivery_address TEXT,
  delivery_lat NUMERIC(10, 7),
  delivery_lng NUMERIC(10, 7),
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  estimated_delivery_time TIMESTAMP WITH TIME ZONE,
  actual_delivery_time TIMESTAMP WITH TIME ZONE,
  special_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  preparing_at TIMESTAMPTZ,
  ready_for_pickup_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  meal_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON public.orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON public.orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON public.deliveries(order_id);

-- Enable RLS on orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Partners can view orders for their restaurant" ON public.orders;
DROP POLICY IF EXISTS "Drivers can view assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Partners can update order status" ON public.orders;
DROP POLICY IF EXISTS "Users can view their order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can create order items" ON public.order_items;

-- RLS Policies for orders
CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Partners can view orders for their restaurant"
  ON public.orders FOR SELECT
  USING (
    auth.uid() IN (
      SELECT owner_id FROM public.restaurants WHERE id = restaurant_id
    )
  );

CREATE POLICY "Drivers can view assigned orders"
  ON public.orders FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM public.drivers WHERE id = driver_id)
  );

CREATE POLICY "Partners can update order status"
  ON public.orders FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT owner_id FROM public.restaurants WHERE id = restaurant_id
    )
  );

-- RLS Policies for order_items
CREATE POLICY "Users can view their order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders WHERE id = order_items.order_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders WHERE id = order_items.order_id AND user_id = auth.uid()
    )
  );

-- Function to create delivery when order status changes to 'preparing'
CREATE OR REPLACE FUNCTION create_delivery_from_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create delivery if status changed to 'preparing' and no delivery exists
  IF NEW.status = 'preparing' AND OLD.status != 'preparing' THEN
    -- Check if delivery already exists for this order
    IF NOT EXISTS (
      SELECT 1 FROM public.deliveries WHERE order_id = NEW.id
    ) THEN
      INSERT INTO public.deliveries (
        order_id,
        driver_id,
        restaurant_id,
        user_id,
        status,
        pickup_address,
        delivery_address,
        delivery_lat,
        delivery_lng,
        delivery_fee,
        tip_amount
      )
      SELECT 
        NEW.id,
        NULL, -- No driver assigned yet
        NEW.restaurant_id,
        NEW.user_id,
        'pending',
        COALESCE(r.address, 'Restaurant Address'),
        NEW.delivery_address,
        NEW.delivery_lat,
        NEW.delivery_lng,
        COALESCE(NEW.delivery_fee, 3.00),
        COALESCE(NEW.tip_amount, 0)
      FROM public.restaurants r
      WHERE r.id = NEW.restaurant_id;
      
      -- Update preparing timestamp
      NEW.preparing_at = now();
    END IF;
  END IF;
  
  -- Update timestamps based on status changes
  IF NEW.status = 'ready_for_pickup' AND OLD.status != 'ready_for_pickup' THEN
    NEW.ready_for_pickup_at = now();
  END IF;
  
  IF NEW.status = 'picked_up' AND OLD.status != 'picked_up' THEN
    NEW.picked_up_at = now();
  END IF;
  
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    NEW.delivered_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;

-- Create trigger
CREATE TRIGGER on_order_status_change
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION create_delivery_from_order();

-- Function to sync delivery status back to order
CREATE OR REPLACE FUNCTION sync_delivery_to_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync delivery status to order
  IF NEW.status = 'claimed' THEN
    UPDATE public.orders 
    SET driver_id = NEW.driver_id,
        status = 'driver_assigned',
        updated_at = now()
    WHERE id = NEW.order_id;
  ELSIF NEW.status = 'picked_up' THEN
    UPDATE public.orders 
    SET status = 'picked_up',
        updated_at = now()
    WHERE id = NEW.order_id;
  ELSIF NEW.status = 'on_the_way' THEN
    UPDATE public.orders 
    SET status = 'out_for_delivery',
        updated_at = now()
    WHERE id = NEW.order_id;
  ELSIF NEW.status = 'delivered' THEN
    UPDATE public.orders 
    SET status = 'delivered',
        delivered_at = now(),
        updated_at = now()
    WHERE id = NEW.order_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_delivery_status_change ON public.deliveries;

-- Create trigger
CREATE TRIGGER on_delivery_status_change
  AFTER UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION sync_delivery_to_order();

-- Add updated_at trigger for orders
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
