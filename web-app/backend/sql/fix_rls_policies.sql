-- Fix RLS policies for Magic English
-- Run this in your Supabase SQL editor to fix the permission issues

-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Users can view their own profile data" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile data" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile data" ON public.profiles;

DROP POLICY IF EXISTS "Users can view their own words" ON public.words;
DROP POLICY IF EXISTS "Users can insert their own words" ON public.words;
DROP POLICY IF EXISTS "Users can update their own words" ON public.words;
DROP POLICY IF EXISTS "Users can delete their own words" ON public.words;

-- Create more permissive RLS policies for profiles
CREATE POLICY "Enable read access for authenticated users on profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Enable insert access for authenticated users on profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update access for authenticated users on profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Create more permissive RLS policies for words
CREATE POLICY "Enable read access for authenticated users on words"
ON public.words FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Enable insert access for authenticated users on words"
ON public.words FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update access for authenticated users on words"
ON public.words FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable delete access for authenticated users on words"
ON public.words FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Also create a policy for the users table if needed
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

CREATE POLICY "Enable read access for authenticated users on users"
ON public.users FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Enable insert access for authenticated users on users"
ON public.users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update access for authenticated users on users"
ON public.users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Grant additional permissions to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.words TO authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.collections TO authenticated;
GRANT ALL ON public.word_collections TO authenticated;

-- Make sure the trigger function has proper permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO authenticated;