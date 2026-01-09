-- Create reviews table for customer feedback
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  meal_id UUID REFERENCES public.meals(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  partner_response TEXT,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Users can create their own reviews
CREATE POLICY "Users can create their own reviews"
ON public.reviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own reviews
CREATE POLICY "Users can view their own reviews"
ON public.reviews FOR SELECT
USING (auth.uid() = user_id);

-- Anyone can view reviews for approved restaurants
CREATE POLICY "Anyone can view restaurant reviews"
ON public.reviews FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.restaurants r
  WHERE r.id = reviews.restaurant_id
  AND r.approval_status = 'approved'
));

-- Partners can view reviews for their restaurants
CREATE POLICY "Partners can view their restaurant reviews"
ON public.reviews FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.restaurants r
  WHERE r.id = reviews.restaurant_id
  AND r.owner_id = auth.uid()
));

-- Partners can update reviews (to add response)
CREATE POLICY "Partners can respond to reviews"
ON public.reviews FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.restaurants r
  WHERE r.id = reviews.restaurant_id
  AND r.owner_id = auth.uid()
));

-- Create payouts table
CREATE TABLE public.payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  order_count INTEGER NOT NULL DEFAULT 0,
  payout_method TEXT DEFAULT 'bank_transfer',
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- Partners can view their own payouts
CREATE POLICY "Partners can view their payouts"
ON public.payouts FOR SELECT
USING (auth.uid() = partner_id);

-- Admins can manage all payouts
CREATE POLICY "Admins can manage payouts"
ON public.payouts FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payouts_updated_at
BEFORE UPDATE ON public.payouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();