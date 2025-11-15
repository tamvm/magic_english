-- Magic English Database Schema
-- Execute these SQL statements in your Supabase SQL editor

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- User profiles table for tracking progress and achievements
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_words_added INTEGER DEFAULT 0,
  total_sentences_scored INTEGER DEFAULT 0,
  daily_goal INTEGER DEFAULT 5,
  weekly_goal INTEGER DEFAULT 30,
  streak_freezes_available INTEGER DEFAULT 2,
  last_activity_date DATE,
  achievements JSONB DEFAULT '[]'::jsonb,
  activity_history JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Words table for vocabulary storage
CREATE TABLE IF NOT EXISTS public.words (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  word TEXT NOT NULL,
  definition TEXT DEFAULT '',
  word_type TEXT DEFAULT '',
  cefr_level TEXT DEFAULT '',
  ipa_pronunciation TEXT DEFAULT '',
  example_sentence TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Add index for better search performance
  CONSTRAINT words_word_check CHECK (length(word) > 0)
);

-- Database collections table for organizing words
CREATE TABLE IF NOT EXISTS public.collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  UNIQUE(user_id, name)
);

-- Word collections mapping table
CREATE TABLE IF NOT EXISTS public.word_collections (
  word_id UUID REFERENCES public.words(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE,
  PRIMARY KEY (word_id, collection_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_words_user_id ON public.words(user_id);
CREATE INDEX IF NOT EXISTS idx_words_word ON public.words(word);
CREATE INDEX IF NOT EXISTS idx_words_created_at ON public.words(created_at);
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON public.collections(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(id);

-- Full text search index for words
CREATE INDEX IF NOT EXISTS idx_words_search ON public.words
USING gin(to_tsvector('english', word || ' ' || definition || ' ' || example_sentence));

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_collections ENABLE ROW LEVEL SECURITY;

-- Create Row Level Security Policies

-- Users policies
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Profiles policies
CREATE POLICY "Users can view their own profile data" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile data" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile data" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Words policies
CREATE POLICY "Users can view their own words" ON public.words
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own words" ON public.words
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own words" ON public.words
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own words" ON public.words
  FOR DELETE USING (auth.uid() = user_id);

-- Collections policies
CREATE POLICY "Users can view their own collections" ON public.collections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own collections" ON public.collections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collections" ON public.collections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own collections" ON public.collections
  FOR DELETE USING (auth.uid() = user_id);

-- Word collections policies
CREATE POLICY "Users can manage word collections" ON public.word_collections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.words w
      WHERE w.id = word_collections.word_id AND w.user_id = auth.uid()
    )
  );

-- Create functions for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');

  INSERT INTO public.profiles (id)
  VALUES (NEW.id);

  -- Create a default collection
  INSERT INTO public.collections (user_id, name, description, is_active)
  VALUES (NEW.id, 'My Vocabulary', 'Default vocabulary collection', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_words BEFORE UPDATE ON public.words
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_collections BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();