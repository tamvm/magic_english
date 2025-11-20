-- Fix missing RLS policies for quiz_questions table
-- This allows the system to insert quiz questions for words owned by the user

-- Add INSERT policy for quiz_questions (drop first to avoid conflicts)
DROP POLICY IF EXISTS "System can insert quiz questions for user words" ON public.quiz_questions;
CREATE POLICY "System can insert quiz questions for user words" ON public.quiz_questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.words w
      WHERE w.id = quiz_questions.word_id AND w.user_id = auth.uid()
    )
  );

-- Add UPDATE policy for quiz_questions (for usage stats)
DROP POLICY IF EXISTS "System can update quiz questions for user words" ON public.quiz_questions;
CREATE POLICY "System can update quiz questions for user words" ON public.quiz_questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.words w
      WHERE w.id = quiz_questions.word_id AND w.user_id = auth.uid()
    )
  );

-- Add DELETE policy for quiz_questions
DROP POLICY IF EXISTS "System can delete quiz questions for user words" ON public.quiz_questions;
CREATE POLICY "System can delete quiz questions for user words" ON public.quiz_questions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.words w
      WHERE w.id = quiz_questions.word_id AND w.user_id = auth.uid()
    )
  );