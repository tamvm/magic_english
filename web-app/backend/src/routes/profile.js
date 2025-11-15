import express from 'express';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const updateGoalsSchema = Joi.object({
  dailyGoal: Joi.number().integer().min(1).max(100),
  weeklyGoal: Joi.number().integer().min(1).max(1000),
});

// Get user profile and stats
router.get('/', async (req, res, next) => {
  try {
    let { data: profile, error } = await req.supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    // If profile doesn't exist, create it using upsert
    if (error && error.code === 'PGRST116') {
      const { data: newProfile, error: createError } = await req.supabase
        .from('profiles')
        .upsert({
          id: req.user.id,
          current_streak: 0,
          longest_streak: 0,
          total_words_added: 0,
          total_sentences_scored: 0,
          daily_goal: 5,
          weekly_goal: 30,
          streak_freezes_available: 2,
          achievements: [],
          activity_history: {},
        }, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (createError) {
        return next(createError);
      }
      profile = newProfile;
    } else if (error) {
      return next(error);
    }

    // Get additional stats
    const { data: wordsStats } = await req.supabase
      .from('words')
      .select('cefr_level, word_type, created_at')
      .eq('user_id', req.user.id);

    const stats = {
      totalWords: wordsStats?.length || 0,
      cefrLevels: groupBy(wordsStats || [], 'cefr_level'),
      wordTypes: groupBy(wordsStats || [], 'word_type'),
      wordsThisWeek: getWordsThisWeek(wordsStats || []),
      wordsToday: getWordsToday(wordsStats || []),
    };

    res.json({
      profile: {
        ...profile,
        stats,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Record activity (words added or sentences scored)
router.post('/activity', async (req, res, next) => {
  try {
    const activitySchema = Joi.object({
      wordsAdded: Joi.number().integer().min(0).default(0),
      sentencesScored: Joi.number().integer().min(0).default(0),
    });

    const { error, value } = activitySchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const { wordsAdded, sentencesScored } = value;
    const today = new Date().toISOString().split('T')[0];

    // Get current profile
    const { data: profile, error: getError } = await req.supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (getError) {
      return next(getError);
    }

    // Update activity history
    const activityHistory = profile.activity_history || {};
    const todayActivity = activityHistory[today] || {
      words: 0,
      sentences: 0,
    };

    todayActivity.words += wordsAdded;
    todayActivity.sentences += sentencesScored;
    activityHistory[today] = todayActivity;

    // Calculate streak
    let currentStreak = profile.current_streak || 0;
    const lastActivityDate = profile.last_activity_date;

    if (lastActivityDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastActivityDate === yesterdayStr) {
        currentStreak += 1;
      } else if (lastActivityDate !== today) {
        currentStreak = 1; // Reset streak if there was a gap
      }
    }

    const longestStreak = Math.max(profile.longest_streak || 0, currentStreak);

    // Update profile
    const { data: updatedProfile, error: updateError } = await req.supabase
      .from('profiles')
      .update({
        current_streak: currentStreak,
        longest_streak: longestStreak,
        total_words_added: (profile.total_words_added || 0) + wordsAdded,
        total_sentences_scored: (profile.total_sentences_scored || 0) + sentencesScored,
        last_activity_date: today,
        activity_history: activityHistory,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (updateError) {
      return next(updateError);
    }

    // Check for new achievements
    const achievements = await checkAchievements(updatedProfile, req.supabase, req.user.id);

    res.json({
      message: 'Activity recorded successfully',
      profile: updatedProfile,
      newAchievements: achievements,
    });
  } catch (error) {
    next(error);
  }
});

// Update learning goals
router.put('/goals', async (req, res, next) => {
  try {
    const { error, value } = updateGoalsSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const { data: profile, error: updateError } = await req.supabase
      .from('profiles')
      .update({
        daily_goal: value.dailyGoal,
        weekly_goal: value.weeklyGoal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (updateError) {
      return next(updateError);
    }

    res.json({
      message: 'Goals updated successfully',
      profile,
    });
  } catch (error) {
    next(error);
  }
});

// Get activity history for calendar view
router.get('/activity-history', async (req, res, next) => {
  try {
    const daysSchema = Joi.object({
      days: Joi.number().integer().min(1).max(365).default(30),
    });

    const { error, value } = daysSchema.validate(req.query);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const { data: profile, error: getError } = await req.supabase
      .from('profiles')
      .select('activity_history')
      .eq('id', req.user.id)
      .single();

    if (getError) {
      return next(getError);
    }

    const activityHistory = profile.activity_history || {};
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - value.days);

    const history = [];
    for (let i = 0; i < value.days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      history.push({
        date: dateStr,
        activity: activityHistory[dateStr] || { words: 0, sentences: 0 },
      });
    }

    res.json({
      history,
    });
  } catch (error) {
    next(error);
  }
});

// Use streak freeze
router.post('/use-freeze', async (req, res, next) => {
  try {
    const { data: profile, error: getError } = await req.supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (getError) {
      return next(getError);
    }

    if ((profile.streak_freezes_available || 0) <= 0) {
      return res.status(400).json({
        error: 'No streak freezes available',
      });
    }

    const { data: updatedProfile, error: updateError } = await req.supabase
      .from('profiles')
      .update({
        streak_freezes_available: (profile.streak_freezes_available || 0) - 1,
        last_activity_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (updateError) {
      return next(updateError);
    }

    res.json({
      message: 'Streak freeze used successfully',
      profile: updatedProfile,
    });
  } catch (error) {
    next(error);
  }
});

// Helper methods
const groupBy = function(array, key) {
  return array.reduce((result, item) => {
    const group = item[key] || 'Unknown';
    result[group] = (result[group] || 0) + 1;
    return result;
  }, {});
};

const getWordsThisWeek = function(words) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  return words.filter(word =>
    new Date(word.created_at) >= oneWeekAgo
  ).length;
};

const getWordsToday = function(words) {
  const today = new Date().toISOString().split('T')[0];

  return words.filter(word =>
    word.created_at.startsWith(today)
  ).length;
};

const checkAchievements = async function(profile, supabase, userId) {
  const achievements = profile.achievements || [];
  const newAchievements = [];

  const achievementRules = [
    {
      id: 'first_word',
      name: 'First Word',
      description: 'Added your first word',
      condition: () => profile.total_words_added >= 1,
      icon: '🎯',
    },
    {
      id: 'word_collector_10',
      name: 'Word Collector',
      description: 'Added 10 words',
      condition: () => profile.total_words_added >= 10,
      icon: '📚',
    },
    {
      id: 'word_collector_50',
      name: 'Word Master',
      description: 'Added 50 words',
      condition: () => profile.total_words_added >= 50,
      icon: '🏆',
    },
    {
      id: 'word_collector_100',
      name: 'Vocabulary Expert',
      description: 'Added 100 words',
      condition: () => profile.total_words_added >= 100,
      icon: '🥇',
    },
    {
      id: 'streak_7',
      name: 'Week Warrior',
      description: '7-day learning streak',
      condition: () => profile.current_streak >= 7,
      icon: '🔥',
    },
    {
      id: 'streak_30',
      name: 'Month Master',
      description: '30-day learning streak',
      condition: () => profile.current_streak >= 30,
      icon: '⭐',
    },
    {
      id: 'sentence_scorer_10',
      name: 'Grammar Judge',
      description: 'Scored 10 sentences',
      condition: () => profile.total_sentences_scored >= 10,
      icon: '⚖️',
    },
  ];

  const currentAchievementIds = achievements.map(a => a.id);

  for (const rule of achievementRules) {
    if (!currentAchievementIds.includes(rule.id) && rule.condition()) {
      const newAchievement = {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        icon: rule.icon,
        unlockedAt: new Date().toISOString(),
      };
      achievements.push(newAchievement);
      newAchievements.push(newAchievement);
    }
  }

  if (newAchievements.length > 0) {
    // Update profile with new achievements
    await supabase
      .from('profiles')
      .update({
        achievements,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
  }

  return newAchievements;
};

export default router;