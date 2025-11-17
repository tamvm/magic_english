-- Complete Flashcard System with FSRS Spaced Repetition
-- This script safely creates all components and handles existing ones gracefully
-- Execute this SQL statement in your Supabase SQL editor

-- Cards table: One card per word for each user
CREATE TABLE IF NOT EXISTS public.cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  word_id UUID REFERENCES public.words(id) ON DELETE CASCADE NOT NULL,

  -- FSRS Algorithm Parameters
  stability REAL DEFAULT 1.0,              -- How stable the memory is
  difficulty REAL DEFAULT 5.0,             -- Difficulty rating (1-10)
  elapsed_days INTEGER DEFAULT 0,          -- Days since last review
  scheduled_days INTEGER DEFAULT 1,        -- Days until next review
  reps INTEGER DEFAULT 0,                  -- Number of repetitions
  lapses INTEGER DEFAULT 0,                -- Number of times forgotten
  last_review TIMESTAMP WITH TIME ZONE,    -- Last review time

  -- Card State
  state TEXT DEFAULT 'new' CHECK (state IN ('new', 'learning', 'review', 'relearning')),
  due_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

  -- Performance tracking
  total_study_time INTEGER DEFAULT 0,      -- Total time spent studying (seconds)
  ease_factor REAL DEFAULT 2.5,           -- Legacy Anki-style ease factor

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Ensure one card per word per user
  UNIQUE(user_id, word_id)
);

-- Review History table: Track all review sessions
CREATE TABLE IF NOT EXISTS public.review_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE NOT NULL,

  -- Review details
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 4), -- 1=Again, 2=Hard, 3=Good, 4=Easy
  response_time INTEGER,                    -- Time to answer in milliseconds
  review_type TEXT DEFAULT 'manual' CHECK (review_type IN ('manual', 'auto')),

  -- State before review
  old_stability REAL,
  old_difficulty REAL,
  old_state TEXT,
  old_due_date TIMESTAMP WITH TIME ZONE,

  -- State after review
  new_stability REAL,
  new_difficulty REAL,
  new_state TEXT,
  new_due_date TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Quiz Questions table: Store AI-generated questions for each word
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  word_id UUID REFERENCES public.words(id) ON DELETE CASCADE NOT NULL,

  -- Question details
  question_type TEXT NOT NULL CHECK (question_type IN (
    'fill_blank', 'definition_choice', 'synonym_choice', 'context_choice'
  )),
  question_text TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  options JSONB DEFAULT '[]'::jsonb,        -- Array of all options for multiple choice
  explanation TEXT DEFAULT '',             -- Explanation of correct answer

  -- Metadata
  difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
  usage_count INTEGER DEFAULT 0,          -- How many times this question was used
  success_rate REAL DEFAULT 0.0,          -- Success rate for this question

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Quiz Attempts table: Track quiz question attempts
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.quiz_questions(id) ON DELETE CASCADE NOT NULL,

  -- Attempt details
  user_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  response_time INTEGER,                    -- Time to answer in milliseconds

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Study Sessions table: Track study sessions for analytics
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Session details
  cards_studied INTEGER DEFAULT 0,
  new_cards INTEGER DEFAULT 0,
  review_cards INTEGER DEFAULT 0,
  total_time INTEGER DEFAULT 0,           -- Total session time in seconds

  -- Performance metrics
  correct_answers INTEGER DEFAULT 0,
  total_answers INTEGER DEFAULT 0,
  average_response_time INTEGER DEFAULT 0,

  started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- User Statistics table: Aggregate statistics for dashboard
CREATE TABLE IF NOT EXISTS public.user_statistics (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,

  -- Daily metrics
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_study_date DATE,

  -- Lifetime metrics
  total_cards_studied INTEGER DEFAULT 0,
  total_study_time INTEGER DEFAULT 0,    -- Total time in seconds
  total_reviews INTEGER DEFAULT 0,
  words_mastered INTEGER DEFAULT 0,      -- Cards with stability > 21 days

  -- Performance metrics
  average_retention_rate REAL DEFAULT 0.0,
  average_response_time INTEGER DEFAULT 0,

  -- Weekly/Monthly goals
  daily_goal INTEGER DEFAULT 20,
  weekly_goal INTEGER DEFAULT 140,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance (safe creation)
DO $$
BEGIN
    -- Cards indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cards_user_id') THEN
        CREATE INDEX idx_cards_user_id ON public.cards(user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cards_due_date') THEN
        CREATE INDEX idx_cards_due_date ON public.cards(due_date);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cards_state') THEN
        CREATE INDEX idx_cards_state ON public.cards(state);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cards_user_due') THEN
        CREATE INDEX idx_cards_user_due ON public.cards(user_id, due_date) WHERE state IN ('learning', 'review', 'relearning');
    END IF;

    -- Review history indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_review_history_user_id') THEN
        CREATE INDEX idx_review_history_user_id ON public.review_history(user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_review_history_card_id') THEN
        CREATE INDEX idx_review_history_card_id ON public.review_history(card_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_review_history_created_at') THEN
        CREATE INDEX idx_review_history_created_at ON public.review_history(created_at);
    END IF;

    -- Quiz questions indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_quiz_questions_word_id') THEN
        CREATE INDEX idx_quiz_questions_word_id ON public.quiz_questions(word_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_quiz_questions_type') THEN
        CREATE INDEX idx_quiz_questions_type ON public.quiz_questions(question_type);
    END IF;

    -- Quiz attempts indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_quiz_attempts_user_id') THEN
        CREATE INDEX idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_quiz_attempts_card_id') THEN
        CREATE INDEX idx_quiz_attempts_card_id ON public.quiz_attempts(card_id);
    END IF;

    -- Study sessions indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_study_sessions_user_id') THEN
        CREATE INDEX idx_study_sessions_user_id ON public.study_sessions(user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_study_sessions_started_at') THEN
        CREATE INDEX idx_study_sessions_started_at ON public.study_sessions(started_at);
    END IF;
END
$$;

-- Enable Row Level Security
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_statistics ENABLE ROW LEVEL SECURITY;

-- Create or replace Row Level Security Policies (handles existing policies gracefully)

-- Cards policies
DROP POLICY IF EXISTS "Users can view their own cards" ON public.cards;
CREATE POLICY "Users can view their own cards" ON public.cards
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own cards" ON public.cards;
CREATE POLICY "Users can insert their own cards" ON public.cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own cards" ON public.cards;
CREATE POLICY "Users can update their own cards" ON public.cards
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own cards" ON public.cards;
CREATE POLICY "Users can delete their own cards" ON public.cards
  FOR DELETE USING (auth.uid() = user_id);

-- Review history policies
DROP POLICY IF EXISTS "Users can view their own review history" ON public.review_history;
CREATE POLICY "Users can view their own review history" ON public.review_history
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own review history" ON public.review_history;
CREATE POLICY "Users can insert their own review history" ON public.review_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Quiz questions policies (read-only for users, questions are generated by system)
DROP POLICY IF EXISTS "Users can view quiz questions for their words" ON public.quiz_questions;
CREATE POLICY "Users can view quiz questions for their words" ON public.quiz_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.words w
      WHERE w.id = quiz_questions.word_id AND w.user_id = auth.uid()
    )
  );

-- Quiz attempts policies
DROP POLICY IF EXISTS "Users can view their own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can view their own quiz attempts" ON public.quiz_attempts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can insert their own quiz attempts" ON public.quiz_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Study sessions policies
DROP POLICY IF EXISTS "Users can view their own study sessions" ON public.study_sessions;
CREATE POLICY "Users can view their own study sessions" ON public.study_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own study sessions" ON public.study_sessions;
CREATE POLICY "Users can insert their own study sessions" ON public.study_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own study sessions" ON public.study_sessions;
CREATE POLICY "Users can update their own study sessions" ON public.study_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- User statistics policies
DROP POLICY IF EXISTS "Users can view their own statistics" ON public.user_statistics;
CREATE POLICY "Users can view their own statistics" ON public.user_statistics
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own statistics" ON public.user_statistics;
CREATE POLICY "Users can insert their own statistics" ON public.user_statistics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own statistics" ON public.user_statistics;
CREATE POLICY "Users can update their own statistics" ON public.user_statistics
  FOR UPDATE USING (auth.uid() = user_id);

-- Create or replace updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at_cards ON public.cards;
CREATE TRIGGER set_updated_at_cards BEFORE UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_quiz_questions ON public.quiz_questions;
CREATE TRIGGER set_updated_at_quiz_questions BEFORE UPDATE ON public.quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_user_statistics ON public.user_statistics;
CREATE TRIGGER set_updated_at_user_statistics BEFORE UPDATE ON public.user_statistics
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to create cards automatically when words are added
CREATE OR REPLACE FUNCTION public.create_card_for_word()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.cards (user_id, word_id)
  VALUES (NEW.user_id, NEW.id)
  ON CONFLICT (user_id, word_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create cards for new words
DROP TRIGGER IF EXISTS on_word_created ON public.words;
CREATE TRIGGER on_word_created
  AFTER INSERT ON public.words
  FOR EACH ROW EXECUTE FUNCTION public.create_card_for_word();

-- Create cards for existing words that don't have cards yet
INSERT INTO public.cards (user_id, word_id)
SELECT w.user_id, w.id
FROM public.words w
LEFT JOIN public.cards c ON c.user_id = w.user_id AND c.word_id = w.id
WHERE c.id IS NULL
ON CONFLICT (user_id, word_id) DO NOTHING;

-- Initialize user statistics for users who don't have them
INSERT INTO public.user_statistics (user_id)
SELECT DISTINCT u.id
FROM auth.users u
LEFT JOIN public.user_statistics s ON s.user_id = u.id
WHERE s.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Update the existing user creation trigger to include stats
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');

  INSERT INTO public.profiles (id)
  VALUES (NEW.id);

  INSERT INTO public.user_statistics (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Create a default collection
  INSERT INTO public.collections (user_id, name, description, is_active)
  VALUES (NEW.id, 'My Vocabulary', 'Default vocabulary collection', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;