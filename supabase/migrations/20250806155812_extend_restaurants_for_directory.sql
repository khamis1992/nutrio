-- Location: supabase/migrations/20250806155812_extend_restaurants_for_directory.sql
-- Schema Analysis: Restaurants and meals tables exist, extending restaurants for directory functionality
-- Integration Type: extension
-- Dependencies: restaurants (existing table)

-- Add missing fields to existing restaurants table for directory functionality
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS cuisine_type TEXT,
ADD COLUMN IF NOT EXISTS dietary_tags TEXT[]; -- Array for tags like 'Vegan', 'High Protein', etc.

-- Create index for better performance on filtering
CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine_type ON public.restaurants(cuisine_type);
CREATE INDEX IF NOT EXISTS idx_restaurants_dietary_tags ON public.restaurants USING GIN(dietary_tags);

-- Update sample data for better directory experience
DO $$
DECLARE
    khamis_id UUID;
BEGIN
    -- Get the existing KHAMIS restaurant
    SELECT id INTO khamis_id FROM public.restaurants WHERE name = 'KHAMIS' LIMIT 1;
    
    -- Update existing restaurant with directory fields
    IF khamis_id IS NOT NULL THEN
        UPDATE public.restaurants 
        SET 
            description = 'Premium Mediterranean cuisine with fresh, locally-sourced ingredients. Experience authentic flavors in a modern setting.',
            cuisine_type = 'Mediterranean',
            dietary_tags = ARRAY['High Protein', 'Gluten Free Options'],
            image_url = COALESCE(image_url, 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop')
        WHERE id = khamis_id;
    END IF;

    -- Add additional restaurants for better directory showcase
    INSERT INTO public.restaurants (name, description, cuisine_type, dietary_tags, location, rating, image_url, active) VALUES 
        (
            'Green Garden Café', 
            'Farm-to-table restaurant specializing in organic, plant-based meals that nourish your body and delight your senses.',
            'Vegan',
            ARRAY['Vegan', 'Organic', 'Low Calorie'],
            'West Bay, Doha',
            4.8,
            'https://images.unsplash.com/photo-1543353071-10c2e6c4e063?w=400&h=300&fit=crop',
            true
        ),
        (
            'Protein Palace', 
            'High-performance nutrition hub designed for athletes and fitness enthusiasts. Maximum protein, maximum flavor.',
            'Sports Nutrition',
            ARRAY['High Protein', 'Keto Friendly', 'Low Carb'],
            'The Pearl, Doha',
            4.6,
            'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop',
            true
        ),
        (
            'Wellness Kitchen', 
            'Holistic approach to healthy eating with balanced macros and mindful portions. Nutritionist-approved menu items.',
            'Healthy',
            ARRAY['Balanced Macros', 'Nutritionist Approved'],
            'Katara, Doha',
            4.7,
            'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&h=300&fit=crop',
            true
        ),
        (
            'Spice Route', 
            'Authentic Middle Eastern and Indian flavors with traditional spices and cooking methods. Rich cultural heritage on every plate.',
            'Middle Eastern',
            ARRAY['Authentic Spices', 'Traditional'],
            'Souq Waqif, Doha',
            4.5,
            'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
            true
        );

EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error updating restaurants: %', SQLERRM;
END $$;