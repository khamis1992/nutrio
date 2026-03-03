-- Migration: Add updated_at to subscriptions for compatibility
-- Date: 2026-03-03
-- Context: Some legacy function paths still reference subscriptions.updated_at.
-- This keeps updates safe while newer function versions phase in.

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.subscriptions
SET updated_at = COALESCE(updated_at, now())
WHERE updated_at IS NULL;
