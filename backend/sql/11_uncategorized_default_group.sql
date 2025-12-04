-- Change default collection from "My Vocabulary" to "Uncategorized"
-- Update all existing collections named "My Vocabulary"
-- Assign all ungrouped words to their user's Uncategorized collection

BEGIN;

-- Step 1: Rename existing "My Vocabulary" collections to "Uncategorized"
UPDATE public.collections
SET
  name = 'Uncategorized',
  description = 'Default group for uncategorized vocabulary'
WHERE
  name = 'My Vocabulary'
  OR name = 'Default vocabulary collection'
  OR description = 'Default vocabulary collection';

-- Step 2: Update the trigger function to create "Uncategorized" for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');

  INSERT INTO public.profiles (id)
  VALUES (NEW.id);

  -- Create a default Uncategorized collection
  INSERT INTO public.collections (user_id, name, description, is_active, color, icon)
  VALUES (NEW.id, 'Uncategorized', 'Default group for uncategorized vocabulary', true, '#6366f1', 'Folder');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Assign all ungrouped words to their user's Uncategorized collection
-- This ensures all words belong to a group for consistent UI/filtering
UPDATE public.words w
SET group_id = (
  SELECT c.id
  FROM public.collections c
  WHERE c.user_id = w.user_id
    AND c.name = 'Uncategorized'
  LIMIT 1
)
WHERE w.group_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.collections c
    WHERE c.user_id = w.user_id
      AND c.name = 'Uncategorized'
  );

COMMIT;

-- Verify the migration
-- SELECT COUNT(*) FROM words WHERE group_id IS NULL; -- Should be 0 or very low
-- SELECT name, COUNT(*) as user_count FROM collections WHERE name = 'Uncategorized' GROUP BY name;
