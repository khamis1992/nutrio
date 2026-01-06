-- Create affiliate application status enum
CREATE TYPE public.affiliate_status AS ENUM ('pending', 'approved', 'rejected');

-- Create affiliate applications table
CREATE TABLE public.affiliate_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.affiliate_status NOT NULL DEFAULT 'pending',
  application_note TEXT,
  rejection_reason TEXT,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.affiliate_applications ENABLE ROW LEVEL SECURITY;

-- Users can view their own application
CREATE POLICY "Users can view their own application"
ON public.affiliate_applications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own application
CREATE POLICY "Users can insert their own application"
ON public.affiliate_applications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all applications
CREATE POLICY "Admins can view all applications"
ON public.affiliate_applications
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update applications
CREATE POLICY "Admins can update applications"
ON public.affiliate_applications
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Create function to check if user is approved affiliate
CREATE OR REPLACE FUNCTION public.is_approved_affiliate(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.affiliate_applications
    WHERE user_id = _user_id
      AND status = 'approved'
  )
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_affiliate_applications_updated_at
BEFORE UPDATE ON public.affiliate_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();