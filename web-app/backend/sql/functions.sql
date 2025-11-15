-- Database functions for Magic English
-- Execute these in your Supabase SQL editor after running migrations.sql

-- Function to increment words added count and update streak
CREATE OR REPLACE FUNCTION increment_words_added(user_id UUID)
RETURNS void AS $$
DECLARE
    today DATE := CURRENT_DATE;
    profile_record profiles%ROWTYPE;
    new_streak INTEGER := 1;
    activity_data JSONB;
    today_activity JSONB;
BEGIN
    -- Get current profile
    SELECT * INTO profile_record
    FROM profiles
    WHERE id = user_id;

    -- If profile doesn't exist, create it
    IF NOT FOUND THEN
        INSERT INTO profiles (id, total_words_added, current_streak, last_activity_date)
        VALUES (user_id, 1, 1, today);
        RETURN;
    END IF;

    -- Update activity history
    activity_data := COALESCE(profile_record.activity_history, '{}'::jsonb);
    today_activity := COALESCE(activity_data->today::text, '{"words": 0, "sentences": 0}'::jsonb);

    today_activity := jsonb_set(
        today_activity,
        '{words}',
        ((today_activity->>'words')::int + 1)::text::jsonb
    );

    activity_data := jsonb_set(activity_data, ARRAY[today::text], today_activity);

    -- Calculate streak
    IF profile_record.last_activity_date = today THEN
        -- Same day, keep current streak
        new_streak := profile_record.current_streak;
    ELSIF profile_record.last_activity_date = today - INTERVAL '1 day' THEN
        -- Yesterday, increment streak
        new_streak := profile_record.current_streak + 1;
    ELSE
        -- Gap in activity, reset streak
        new_streak := 1;
    END IF;

    -- Update profile
    UPDATE profiles
    SET
        total_words_added = profile_record.total_words_added + 1,
        current_streak = new_streak,
        longest_streak = GREATEST(profile_record.longest_streak, new_streak),
        last_activity_date = today,
        activity_history = activity_data,
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment sentences scored count
CREATE OR REPLACE FUNCTION increment_sentences_scored(user_id UUID)
RETURNS void AS $$
DECLARE
    today DATE := CURRENT_DATE;
    profile_record profiles%ROWTYPE;
    new_streak INTEGER := 1;
    activity_data JSONB;
    today_activity JSONB;
BEGIN
    -- Get current profile
    SELECT * INTO profile_record
    FROM profiles
    WHERE id = user_id;

    -- If profile doesn't exist, create it
    IF NOT FOUND THEN
        INSERT INTO profiles (id, total_sentences_scored, current_streak, last_activity_date)
        VALUES (user_id, 1, 1, today);
        RETURN;
    END IF;

    -- Update activity history
    activity_data := COALESCE(profile_record.activity_history, '{}'::jsonb);
    today_activity := COALESCE(activity_data->today::text, '{"words": 0, "sentences": 0}'::jsonb);

    today_activity := jsonb_set(
        today_activity,
        '{sentences}',
        ((today_activity->>'sentences')::int + 1)::text::jsonb
    );

    activity_data := jsonb_set(activity_data, ARRAY[today::text], today_activity);

    -- Calculate streak
    IF profile_record.last_activity_date = today THEN
        -- Same day, keep current streak
        new_streak := profile_record.current_streak;
    ELSIF profile_record.last_activity_date = today - INTERVAL '1 day' THEN
        -- Yesterday, increment streak
        new_streak := profile_record.current_streak + 1;
    ELSE
        -- Gap in activity, reset streak
        new_streak := 1;
    END IF;

    -- Update profile
    UPDATE profiles
    SET
        total_sentences_scored = profile_record.total_sentences_scored + 1,
        current_streak = new_streak,
        longest_streak = GREATEST(profile_record.longest_streak, new_streak),
        last_activity_date = today,
        activity_history = activity_data,
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search words with full text search
CREATE OR REPLACE FUNCTION search_words(
    user_id UUID,
    search_query TEXT,
    search_limit INTEGER DEFAULT 50,
    search_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    word TEXT,
    definition TEXT,
    word_type TEXT,
    cefr_level TEXT,
    ipa_pronunciation TEXT,
    example_sentence TEXT,
    notes TEXT,
    tags JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        w.id,
        w.word,
        w.definition,
        w.word_type,
        w.cefr_level,
        w.ipa_pronunciation,
        w.example_sentence,
        w.notes,
        w.tags,
        w.created_at,
        w.updated_at,
        ts_rank(
            to_tsvector('english', w.word || ' ' || w.definition || ' ' || w.example_sentence),
            plainto_tsquery('english', search_query)
        ) as rank
    FROM words w
    WHERE
        w.user_id = search_words.user_id
        AND (
            search_query IS NULL
            OR to_tsvector('english', w.word || ' ' || w.definition || ' ' || w.example_sentence)
               @@ plainto_tsquery('english', search_query)
        )
    ORDER BY rank DESC, w.created_at DESC
    LIMIT search_limit OFFSET search_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user statistics
CREATE OR REPLACE FUNCTION get_user_stats(user_id UUID)
RETURNS TABLE(
    total_words INTEGER,
    words_today INTEGER,
    words_this_week INTEGER,
    cefr_distribution JSONB,
    word_type_distribution JSONB,
    recent_activity JSONB
) AS $$
DECLARE
    today DATE := CURRENT_DATE;
    week_start DATE := today - INTERVAL '7 days';
BEGIN
    RETURN QUERY
    SELECT
        COUNT(w.id)::INTEGER as total_words,
        COUNT(CASE WHEN DATE(w.created_at) = today THEN 1 END)::INTEGER as words_today,
        COUNT(CASE WHEN DATE(w.created_at) >= week_start THEN 1 END)::INTEGER as words_this_week,

        COALESCE(
            jsonb_object_agg(
                COALESCE(NULLIF(w.cefr_level, ''), 'Unknown'),
                cefr_counts.count
            ) FILTER (WHERE cefr_counts.count > 0),
            '{}'::jsonb
        ) as cefr_distribution,

        COALESCE(
            jsonb_object_agg(
                COALESCE(NULLIF(w.word_type, ''), 'Unknown'),
                type_counts.count
            ) FILTER (WHERE type_counts.count > 0),
            '{}'::jsonb
        ) as word_type_distribution,

        COALESCE(p.activity_history, '{}'::jsonb) as recent_activity

    FROM words w
    LEFT JOIN (
        SELECT cefr_level, COUNT(*) as count
        FROM words
        WHERE user_id = get_user_stats.user_id
        GROUP BY cefr_level
    ) cefr_counts ON w.cefr_level = cefr_counts.cefr_level
    LEFT JOIN (
        SELECT word_type, COUNT(*) as count
        FROM words
        WHERE user_id = get_user_stats.user_id
        GROUP BY word_type
    ) type_counts ON w.word_type = type_counts.word_type
    LEFT JOIN profiles p ON p.id = get_user_stats.user_id
    WHERE w.user_id = get_user_stats.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean old activity history (keep last 6 months)
CREATE OR REPLACE FUNCTION cleanup_activity_history()
RETURNS void AS $$
DECLARE
    cutoff_date DATE := CURRENT_DATE - INTERVAL '6 months';
    profile_record RECORD;
    cleaned_history JSONB;
    activity_key TEXT;
BEGIN
    FOR profile_record IN SELECT id, activity_history FROM profiles LOOP
        cleaned_history := '{}'::jsonb;

        FOR activity_key IN SELECT jsonb_object_keys(profile_record.activity_history) LOOP
            IF activity_key::DATE >= cutoff_date THEN
                cleaned_history := jsonb_set(
                    cleaned_history,
                    ARRAY[activity_key],
                    profile_record.activity_history->activity_key
                );
            END IF;
        END LOOP;

        UPDATE profiles
        SET activity_history = cleaned_history, updated_at = NOW()
        WHERE id = profile_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION increment_words_added(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_sentences_scored(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_words(UUID, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_stats(UUID) TO authenticated;