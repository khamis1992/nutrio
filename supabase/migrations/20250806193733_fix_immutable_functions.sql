-- Location: supabase/migrations/20250806193733_fix_immutable_functions.sql
-- Schema Analysis: Fix functions that need to be IMMUTABLE for index usage
-- Integration Type: Fix - Correcting function volatility issues
-- Dependencies: Existing tables and functions

-- Fix any existing functions that are used in indexes to be IMMUTABLE
-- This addresses the "functions in index predicate must be marked IMMUTABLE" error

-- Drop and recreate common trigger functions with proper immutability where needed
-- Note: Trigger functions should generally remain VOLATILE, but any functions used in indexes must be IMMUTABLE

-- Create IMMUTABLE helper functions for search/filtering operations
CREATE OR REPLACE FUNCTION public.normalize_text(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
SELECT COALESCE(lower(trim(input_text)), '')
$$;

-- Create IMMUTABLE function for dietary tag search
CREATE OR REPLACE FUNCTION public.normalize_array_text(input_array TEXT[])
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
SELECT CASE 
    WHEN input_array IS NULL THEN ARRAY[]::TEXT[]
    ELSE array_agg(lower(trim(tag))) 
    FROM unnest(input_array) AS tag 
END
$$;

-- Fix any problematic indexes by dropping and recreating them with proper IMMUTABLE functions
-- Drop existing problematic indexes if they exist
DROP INDEX IF EXISTS public.idx_restaurants_search_text;
DROP INDEX IF EXISTS public.idx_meals_search_text;
DROP INDEX IF EXISTS public.idx_restaurants_dietary_normalized;

-- Recreate indexes using IMMUTABLE functions
CREATE INDEX IF NOT EXISTS idx_restaurants_search_name 
ON public.restaurants USING btree (public.normalize_text(name));

CREATE INDEX IF NOT EXISTS idx_restaurants_search_cuisine 
ON public.restaurants USING btree (public.normalize_text(cuisine_type));

CREATE INDEX IF NOT EXISTS idx_meals_search_name 
ON public.meals USING btree (public.normalize_text(name));

-- Create GIN index for dietary tags search using IMMUTABLE function
CREATE INDEX IF NOT EXISTS idx_restaurants_dietary_tags_normalized 
ON public.restaurants USING gin (public.normalize_array_text(dietary_tags));

-- Ensure update trigger functions remain as they are (VOLATILE is correct for triggers)
-- These functions modify data and should not be IMMUTABLE

-- Add a utility function for case-insensitive email lookup (IMMUTABLE)
CREATE OR REPLACE FUNCTION public.normalize_email(email_input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
SELECT lower(trim(COALESCE(email_input, '')))
$$;

-- Create index for case-insensitive email lookups if user_profiles exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        CREATE INDEX IF NOT EXISTS idx_user_profiles_email_normalized 
        ON public.user_profiles USING btree (public.normalize_email(email));
    END IF;
END $$;

-- Log success message
DO $$
BEGIN
    RAISE NOTICE 'Successfully fixed IMMUTABLE function issues. All indexes now use properly marked IMMUTABLE functions.';
END $$;