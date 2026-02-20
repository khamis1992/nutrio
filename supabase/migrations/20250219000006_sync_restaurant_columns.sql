-- Fix restaurants table schema mismatch
-- The code expects approval_status but existing data uses status column

-- 1. Ensure approval_status column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE public.restaurants ADD COLUMN approval_status TEXT DEFAULT 'pending';
  END IF;
END
$$;

-- 2. Ensure is_active column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.restaurants ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END
$$;

-- 3. Copy data from status to approval_status for existing restaurants
-- Map: 'pending' -> 'pending', 'active' -> 'approved', 'inactive' -> 'rejected'
UPDATE public.restaurants 
SET approval_status = CASE 
  WHEN status = 'pending' THEN 'pending'::approval_status
  WHEN status = 'active' THEN 'approved'::approval_status
  WHEN status = 'inactive' THEN 'rejected'::approval_status
  ELSE 'pending'::approval_status
END
WHERE approval_status IS NULL;

-- 4. Set is_active based on status
UPDATE public.restaurants 
SET is_active = (status = 'active')
WHERE is_active IS NULL;

-- 5. Also ensure phone column exists (code expects 'phone' but DB might have 'phone_number')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'phone'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE public.restaurants ADD COLUMN phone TEXT;
    UPDATE public.restaurants SET phone = phone_number;
  END IF;
END
$$;

-- 6. Ensure logo_url column exists (code expects 'logo_url' but DB might have 'image_url')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'logo_url'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE public.restaurants ADD COLUMN logo_url TEXT;
    UPDATE public.restaurants SET logo_url = image_url;
  END IF;
END
$$;

-- 7. Show migration results
SELECT 
  'Restaurants updated' as info,
  COUNT(*) as total,
  COUNT(CASE WHEN approval_status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) as approved,
  COUNT(CASE WHEN approval_status = 'rejected' THEN 1 END) as rejected
FROM public.restaurants;
