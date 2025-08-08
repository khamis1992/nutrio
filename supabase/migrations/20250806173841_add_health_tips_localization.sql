-- Location: supabase/migrations/20250806173841_add_health_tips_localization.sql
-- Schema Analysis: Extending existing health_tips table for localization support
-- Integration Type: Extension of existing functionality
-- Dependencies: Existing health_tips table

-- Add columns for Arabic content and language support
ALTER TABLE public.health_tips
ADD COLUMN IF NOT EXISTS title_ar TEXT,
ADD COLUMN IF NOT EXISTS content_ar TEXT,
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en' CHECK (language IN ('en', 'ar'));

-- Update existing records to set default language
UPDATE public.health_tips 
SET language = 'en'
WHERE language IS NULL;

-- Add index for language-based queries
CREATE INDEX IF NOT EXISTS idx_health_tips_language ON public.health_tips(language);
CREATE INDEX IF NOT EXISTS idx_health_tips_language_active ON public.health_tips(language, is_active);

-- Update existing Arabic data to include English translations and proper language attribution
UPDATE public.health_tips
SET 
    title_ar = title,
    content_ar = content,
    title = CASE 
        WHEN title = 'شرب الماء قبل الأكل' THEN 'Drink Water Before Meals'
        WHEN title = 'المشي اليومي' THEN 'Daily Walking'
        ELSE 'Health Tip'
    END,
    content = CASE 
        WHEN content LIKE '%شرب كوب ماء قبل الأكل يساعد في تقليل الشهية%' THEN 'Drinking a glass of water before meals helps reduce appetite and aids in portion control.'
        WHEN content LIKE '%المشي لمدة 30 دقيقة يوميا يحسن من صحة القلب والأوع%' THEN 'Walking for 30 minutes daily improves heart health and blood circulation, reducing the risk of cardiovascular diseases.'
        ELSE 'Stay healthy with daily good habits and balanced nutrition.'
    END,
    language = 'en';

-- Insert additional English health tips to provide variety
INSERT INTO public.health_tips (title, content, title_ar, content_ar, category, language, is_active, display_order)
VALUES
    ('Stay Hydrated', 'Drink at least 8 glasses of water daily to maintain proper hydration and support bodily functions.', 'حافظ على الترطيب', 'اشرب ما لا يقل عن 8 أكواب من الماء يوميا للحفاظ على الترطيب المناسب ودعم وظائف الجسم.', 'nutrition', 'en', true, 3),
    ('Get Enough Sleep', 'Aim for 7-9 hours of quality sleep each night to improve mental clarity and physical recovery.', 'احصل على نوم كافٍ', 'اهدف إلى النوم لمدة 7-9 ساعات كل ليلة لتحسين الوضوح الذهني والتعافي الجسدي.', 'lifestyle', 'en', true, 4),
    ('Eat More Fruits', 'Include at least 2-3 servings of fresh fruits daily for essential vitamins and natural energy.', 'تناول المزيد من الفواكه', 'تناول ما لا يقل عن 2-3 حصص من الفواكه الطازجة يوميا للحصول على الفيتامينات الأساسية والطاقة الطبيعية.', 'nutrition', 'en', true, 5),
    ('Practice Deep Breathing', 'Take 5 minutes daily for deep breathing exercises to reduce stress and improve focus.', 'مارس التنفس العميق', 'خذ 5 دقائق يوميا لتمارين التنفس العميق لتقليل التوتر وتحسين التركيز.', 'mental_health', 'en', true, 6),
    ('Limit Screen Time', 'Reduce screen time especially before bed to improve sleep quality and eye health.', 'قلل من وقت الشاشة', 'قلل من وقت الشاشة خاصة قبل النوم لتحسين جودة النوم وصحة العينين.', 'lifestyle', 'en', true, 7);

-- Update the trigger to handle updated_at for the new columns
CREATE OR REPLACE FUNCTION public.update_health_tips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;