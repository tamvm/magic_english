-- Add CEFR level field to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cefr_level TEXT DEFAULT 'B2';

-- Update existing profiles to have B2 as default (intermediate level)
UPDATE public.profiles
SET cefr_level = 'B2'
WHERE cefr_level IS NULL OR cefr_level = '';