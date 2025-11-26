-- Add FSRS fields to quiz_questions table for exponential spaced repetition

-- Add new fields to quiz_questions table
ALTER TABLE public.quiz_questions
ADD COLUMN IF NOT EXISTS stability REAL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS difficulty REAL DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS total_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS correct_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS interval_days REAL DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS last_review TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS avg_response_time INTEGER DEFAULT 5000;

-- Add constraints
ALTER TABLE public.quiz_questions
ADD CONSTRAINT quiz_stability_check CHECK (stability > 0),
ADD CONSTRAINT quiz_difficulty_check CHECK (difficulty >= 1 AND difficulty <= 10),
ADD CONSTRAINT quiz_attempts_check CHECK (total_attempts >= 0 AND correct_attempts >= 0 AND correct_attempts <= total_attempts),
ADD CONSTRAINT quiz_interval_check CHECK (interval_days > 0);

-- Update existing quiz questions with default FSRS values based on their current performance
DO $$
DECLARE
    question_record RECORD;
    calculated_success_rate REAL;
    calculated_stability REAL;
    calculated_difficulty REAL;
BEGIN
    -- Loop through existing quiz questions that don't have FSRS data
    FOR question_record IN
        SELECT id, usage_count, success_rate
        FROM public.quiz_questions
        WHERE stability = 1.0 AND difficulty = 5.0 -- Default values indicate no FSRS data
    LOOP
        -- Calculate initial FSRS values based on historical performance
        calculated_success_rate := COALESCE(question_record.success_rate, 0.0);

        -- Set initial stability based on success rate and usage
        IF question_record.usage_count = 0 THEN
            calculated_stability := 1.0; -- New question
        ELSE
            -- Higher success rate = higher initial stability (1-7 days)
            calculated_stability := 1.0 + (calculated_success_rate * 6.0);
        END IF;

        -- Set initial difficulty based on success rate
        -- Lower success rate = higher difficulty
        calculated_difficulty := 10.0 - (calculated_success_rate * 5.0);
        calculated_difficulty := GREATEST(1.0, LEAST(10.0, calculated_difficulty));

        -- Update the question with calculated values
        UPDATE public.quiz_questions
        SET
            stability = calculated_stability,
            difficulty = calculated_difficulty,
            total_attempts = GREATEST(question_record.usage_count, 0),
            correct_attempts = GREATEST(ROUND(question_record.usage_count * calculated_success_rate), 0),
            interval_days = calculated_stability,
            due_date = timezone('utc'::text, now()) -- Make all existing questions available immediately
        WHERE id = question_record.id;
    END LOOP;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_quiz_questions_due_date ON public.quiz_questions(due_date);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_stability ON public.quiz_questions(stability);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_difficulty ON public.quiz_questions(difficulty);

-- Add composite index for efficient scheduling queries
CREATE INDEX IF NOT EXISTS idx_quiz_questions_scheduling
ON public.quiz_questions(due_date, difficulty, stability)
WHERE due_date IS NOT NULL;

-- Update the updated_at timestamp trigger to include new fields
CREATE OR REPLACE FUNCTION update_quiz_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS trigger_quiz_questions_updated_at ON public.quiz_questions;
CREATE TRIGGER trigger_quiz_questions_updated_at
    BEFORE UPDATE ON public.quiz_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_quiz_questions_updated_at();

-- Add a function to clean up old quiz attempts (optional - for performance)
CREATE OR REPLACE FUNCTION cleanup_old_quiz_attempts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete quiz attempts older than 1 year to keep table manageable
    DELETE FROM public.quiz_attempts
    WHERE created_at < (now() - interval '1 year');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the new system
COMMENT ON COLUMN public.quiz_questions.stability IS 'FSRS stability value - higher means longer intervals between reviews';
COMMENT ON COLUMN public.quiz_questions.difficulty IS 'FSRS difficulty value (1-10) - higher means more difficult to remember';
COMMENT ON COLUMN public.quiz_questions.total_attempts IS 'Total number of times this question was attempted';
COMMENT ON COLUMN public.quiz_questions.correct_attempts IS 'Number of correct attempts';
COMMENT ON COLUMN public.quiz_questions.interval_days IS 'Current review interval in days';
COMMENT ON COLUMN public.quiz_questions.due_date IS 'When this question is next due for review';
COMMENT ON COLUMN public.quiz_questions.last_review IS 'When this question was last reviewed';
COMMENT ON COLUMN public.quiz_questions.avg_response_time IS 'Average response time in milliseconds';