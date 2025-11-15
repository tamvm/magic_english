-- Add unique constraint to prevent duplicate words per user
-- This migration adds a unique constraint on (user_id, word) to prevent duplicate words

-- First, let's remove any existing duplicates (keeping the most recent one)
DELETE FROM public.words w1
WHERE EXISTS (
  SELECT 1 FROM public.words w2
  WHERE w2.user_id = w1.user_id
  AND LOWER(w2.word) = LOWER(w1.word)
  AND w2.created_at > w1.created_at
);

-- Add unique constraint on (user_id, LOWER(word)) to prevent case-insensitive duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_words_user_word_unique
ON public.words(user_id, LOWER(word));

-- Add comment for documentation
COMMENT ON INDEX idx_words_user_word_unique IS 'Prevents duplicate words per user (case-insensitive)';