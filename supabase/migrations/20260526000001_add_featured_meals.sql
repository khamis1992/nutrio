-- ============================================================================
-- Add is_featured / featured_priority columns for hero card hierarchy
-- Featured meals get larger hero cards on the meals browsing page
-- ============================================================================

ALTER TABLE public.meals
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

ALTER TABLE public.meals
ADD COLUMN IF NOT EXISTS featured_priority INTEGER DEFAULT 0;

COMMENT ON COLUMN public.meals.is_featured IS 'When true, this meal gets a hero-sized card on the meals page';
COMMENT ON COLUMN public.meals.featured_priority IS 'Higher number = shown first among featured meals';

CREATE INDEX IF NOT EXISTS idx_meals_featured ON public.meals(is_featured, featured_priority DESC)
  WHERE is_featured = true AND is_available = true AND deleted_at IS NULL;
