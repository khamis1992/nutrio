-- Location: supabase/migrations/20250806195528_add_health_goals_onboarding.sql
-- Schema Analysis: Existing user_profiles table with basic goals array field
-- Integration Type: Extension - Adding detailed health goals functionality
-- Dependencies: user_profiles table (existing)

-- Create health goal enum type
CREATE TYPE public.health_goal_type AS ENUM (
    'weight_loss',
    'maintain_weight', 
    'build_muscle',
    'medical_diet'
);

-- Create gender enum type
CREATE TYPE public.gender_type AS ENUM (
    'male',
    'female',
    'prefer_not_to_say'
);

-- Create user_goals table for detailed health information
CREATE TABLE public.user_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    goal public.health_goal_type NOT NULL,
    current_weight DECIMAL(5,2), -- in kg
    height INTEGER, -- in cm
    gender public.gender_type,
    age INTEGER,
    target_weight DECIMAL(5,2), -- in kg, optional
    activity_level TEXT DEFAULT 'moderate',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_user_goals_user_id ON public.user_goals(user_id);
CREATE INDEX idx_user_goals_goal ON public.user_goals(goal);

-- Enable RLS
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

-- Create RLS policy - Pattern 2: Simple User Ownership
CREATE POLICY "users_manage_own_user_goals"
ON public.user_goals
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_user_goals_updated_at
    BEFORE UPDATE ON public.user_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create helper function to get user's health goal
CREATE OR REPLACE FUNCTION public.get_user_health_goal(user_uuid UUID)
RETURNS public.user_goals
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT *
FROM public.user_goals ug
WHERE ug.user_id = user_uuid
ORDER BY ug.created_at DESC
LIMIT 1;
$$;

-- Mock data for existing users
DO $$
DECLARE
    existing_user_id UUID;
BEGIN
    -- Get existing user ID from user_profiles (if any exists)
    SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;
    
    -- Create sample health goal if user exists
    IF existing_user_id IS NOT NULL THEN
        INSERT INTO public.user_goals (user_id, goal, current_weight, height, gender, age)
        VALUES (existing_user_id, 'weight_loss'::public.health_goal_type, 75.5, 170, 'prefer_not_to_say'::public.gender_type, 28);
    END IF;
    
    RAISE NOTICE 'Health goals table created successfully. Sample data added for existing user if available.';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Health goals setup completed. Note: %', SQLERRM;
END $$;