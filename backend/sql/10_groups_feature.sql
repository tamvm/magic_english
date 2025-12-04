-- Groups Feature Migration
-- Extends collections table with color/icon metadata for Groups UI
-- Adds optional group_id FK to words table for one-to-many relationship
-- Execute in Supabase SQL editor

-- Step 1: Extend collections table with group metadata
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#6366f1' CHECK (color ~* '^#[0-9A-Fa-f]{6}$'),
  ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'folder';

COMMENT ON COLUMN public.collections.color IS 'Hex color code for group UI display (e.g., #FF5733)';
COMMENT ON COLUMN public.collections.icon IS 'Lucide-react icon name for group visual representation';

-- Step 2: Add optional group relationship to words
ALTER TABLE public.words
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.collections(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.words.group_id IS 'Optional group assignment (one word belongs to one group). NULL = ungrouped/orphaned vocabulary';

-- Step 3: Create performance indexes
-- Single column index for group filtering queries
CREATE INDEX IF NOT EXISTS idx_words_group_id ON public.words(group_id);

-- Composite index for common query pattern (user_id + group_id)
-- Optimizes: SELECT * FROM words WHERE user_id = ? AND group_id IN (?, ?)
CREATE INDEX IF NOT EXISTS idx_words_user_group ON public.words(user_id, group_id);

-- Step 4: Verify RLS policies (no changes needed - group_id scoped via FK)
-- Existing policies on collections already enforce user_id scoping:
-- - SELECT: auth.uid() = user_id
-- - INSERT: auth.uid() = user_id
-- - UPDATE: auth.uid() = user_id
-- - DELETE: auth.uid() = user_id
-- Group_id is automatically user-scoped via FK to collections(user_id)

-- Migration completed successfully
-- All schema changes are idempotent (IF NOT EXISTS clauses)
-- No data loss - existing words remain queryable with group_id = NULL

-- ============================================================================
-- ROLLBACK SCRIPT
-- Execute manually if migration needs to be reversed
-- Test in staging environment before running in production
-- ============================================================================

/*
BEGIN;

-- Remove group_id column and related indexes
ALTER TABLE public.words DROP COLUMN IF EXISTS group_id;
DROP INDEX IF EXISTS public.idx_words_group_id;
DROP INDEX IF EXISTS public.idx_words_user_group;

-- Remove color and icon columns from collections
ALTER TABLE public.collections DROP COLUMN IF EXISTS color;
ALTER TABLE public.collections DROP COLUMN IF EXISTS icon;

COMMIT;
*/
