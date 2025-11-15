-- Add Vietnamese translation and synonyms columns to words table
-- Execute this SQL statement in your Supabase SQL editor

ALTER TABLE public.words
ADD COLUMN IF NOT EXISTS vietnamese_translation TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS synonyms TEXT DEFAULT '';

-- Update the full text search index to include the new columns
DROP INDEX IF EXISTS idx_words_search;
CREATE INDEX idx_words_search ON public.words
USING gin(to_tsvector('english', word || ' ' || definition || ' ' || example_sentence || ' ' || vietnamese_translation || ' ' || synonyms));

-- Add comment for documentation
COMMENT ON COLUMN public.words.vietnamese_translation IS 'Vietnamese translation of the word';
COMMENT ON COLUMN public.words.synonyms IS 'Comma-separated list of synonym words or phrases';