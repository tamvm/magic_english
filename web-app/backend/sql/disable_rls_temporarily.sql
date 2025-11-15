-- Temporary fix: Disable RLS to get the app working
-- Run this in your Supabase SQL editor
-- WARNING: This temporarily disables security - use only for development

-- Disable RLS temporarily on all tables
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.words DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_collections DISABLE ROW LEVEL SECURITY;

-- Grant full access to authenticated users for development
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Create a function to debug auth context (optional)
CREATE OR REPLACE FUNCTION debug_auth_context()
RETURNS TABLE(
  current_user_id UUID,
  user_role TEXT,
  jwt_claims JSONB
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    auth.uid() as current_user_id,
    current_user as user_role,
    auth.jwt() as jwt_claims;
$$;