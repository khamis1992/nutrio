-- Location: supabase/migrations/20250106172019_add_health_tips_table.sql
-- Module: Health Tips of the Day
-- Integration Type: NEW_MODULE
-- Dependencies: Uses existing public schema patterns

-- Create health tips table
CREATE TABLE public.health_tips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create index for better performance
CREATE INDEX idx_health_tips_active ON public.health_tips(is_active);
CREATE INDEX idx_health_tips_category ON public.health_tips(category);
CREATE INDEX idx_health_tips_display_order ON public.health_tips(display_order);

-- Function for updating updated_at column
CREATE OR REPLACE FUNCTION public.update_health_tips_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- Enable RLS for health tips table
ALTER TABLE public.health_tips ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow public read access for health tips
CREATE POLICY "public_can_read_health_tips"
ON public.health_tips
FOR SELECT
TO public
USING (is_active = true);

-- RLS Policy: Allow authenticated users to manage all health tips (admin feature)
CREATE POLICY "authenticated_can_manage_health_tips"
ON public.health_tips
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Add trigger for automatic updated_at updates
CREATE TRIGGER update_health_tips_updated_at_trigger
    BEFORE UPDATE ON public.health_tips
    FOR EACH ROW
    EXECUTE FUNCTION public.update_health_tips_updated_at();

-- Insert sample health tips data
DO $$
BEGIN
    INSERT INTO public.health_tips (title, content, category, display_order, is_active) VALUES
        ('شرب الماء قبل الأكل', 'شرب كوب ماء قبل الأكل يساعد في تقليل الشهية 💧', 'nutrition', 1, true),
        ('المشي اليومي', 'المشي لمدة 30 دقيقة يوميا يحسن من صحة القلب والأوعية الدموية 🚶‍♂️', 'exercise', 2, true),
        ('تناول الخضروات', 'تناول 5 حصص من الخضروات والفواكه يوميا يقوي جهاز المناعة 🥗', 'nutrition', 3, true),
        ('النوم الصحي', 'الحصول على 7-8 ساعات نوم يوميا يساعد على استعادة الطاقة والتركيز 😴', 'lifestyle', 4, true),
        ('تجنب السكريات', 'تقليل السكريات المضافة يساعد في الحفاظ على وزن صحي وتقليل مخاطر السكري 🚫🍭', 'nutrition', 5, true),
        ('التنفس العميق', 'ممارسة تمارين التنفس العميق لدقائق قليلة يقلل من التوتر والقلق 🧘‍♀️', 'mental_health', 6, true),
        ('تناول البروتين', 'تناول مصدر بروتين في كل وجبة يساعد في بناء العضلات والشعور بالشبع 🥩', 'nutrition', 7, true),
        ('شرب الشاي الأخضر', 'الشاي الأخضر غني بمضادات الأكسدة ويساعد في تحسين عملية الأيض 🍵', 'nutrition', 8, true),
        ('تمارين التمدد', 'القيام بتمارين التمدد صباحا ومساء يحسن المرونة ويقلل آلام العضلات 🤸‍♀️', 'exercise', 9, true),
        ('الضحك والمرح', 'الضحك يفرز هرمونات السعادة ويقوي جهاز المناعة 😄', 'mental_health', 10, true);

EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'Health tips already exist, skipping insertion';
    WHEN OTHERS THEN
        RAISE NOTICE 'Error inserting health tips: %', SQLERRM;
END $$;