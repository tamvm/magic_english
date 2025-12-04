import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { FSRS, RATING, CARD_STATE } from "../services/fsrs.js";
import { QuizFSRS, QUIZ_RESPONSE } from "../services/quizFsrs.js";
import { quizService } from "../services/quizService.js";

const router = express.Router();
const fsrs = new FSRS();
const quizFsrs = new QuizFSRS();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * GET /api/flashcards/due
 * Get cards due for review
 */
router.get("/due", async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      limit = 20,
      includeNew = true,
      includeQuizQuestions = false,
      groups, // NEW: Group filtering
    } = req.query;

    const now = new Date().toISOString();
    let query = req.supabase
      .from("cards")
      .select(
        `
        *,
        words!inner(*)
      `
      )
      .eq("user_id", userId)
      .lte("due_date", now);

    if (!includeNew) {
      query = query.neq("state", "new");
    }

    // NEW: Filter by groups if provided
    if (groups) {
      const groupIds = groups.includes(',')
        ? groups.split(',').map(id => id.trim())
        : [groups];

      if (groupIds.includes('ungrouped')) {
        const otherGroups = groupIds.filter(id => id !== 'ungrouped');
        if (otherGroups.length > 0) {
          query = query.or(`words.group_id.in.(${otherGroups.join(',')}),words.group_id.is.null`);
        } else {
          query = query.is('words.group_id', null);
        }
      } else {
        query = query.in('words.group_id', groupIds);
      }
    }

    const { data: cards, error } = await query
      .order("due_date", { ascending: true })
      .limit(parseInt(limit));

    if (error) {
      console.error("Error fetching due cards:", error);
      return res.status(500).json({ error: "Failed to fetch due cards" });
    }

    // Add next intervals for preview
    let cardsWithIntervals = cards.map((card) => ({
      ...card,
      nextIntervals: fsrs.getNextIntervals(card),
    }));

    // Include quiz questions if requested
    if (includeQuizQuestions && cards.length > 0) {
      const wordIds = cards.map((card) => card.word_id);

      const { data: quizQuestions, error: quizError } = await req.supabase
        .from("quiz_questions")
        .select("*")
        .in("word_id", wordIds);

      if (quizError) {
        console.error("Error fetching quiz questions:", quizError);
      } else {
        // Group quiz questions by word_id
        const questionsByWordId = {};
        quizQuestions?.forEach((question) => {
          if (!questionsByWordId[question.word_id]) {
            questionsByWordId[question.word_id] = [];
          }
          questionsByWordId[question.word_id].push(question);
        });

        // Add quiz questions to each card
        cardsWithIntervals = cardsWithIntervals.map((card) => ({
          ...card,
          quiz_questions: questionsByWordId[card.word_id] || [],
        }));
      }
    }

    res.json({
      cards: cardsWithIntervals,
      totalDue: cards.length,
    });
  } catch (error) {
    console.error("Error in /due endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/flashcards/stats
 * Get user's flashcard statistics
 */
router.get("/stats", async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user statistics
    const { data: userStats, error: statsError } = await req.supabase
      .from("user_statistics")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (statsError && statsError.code !== "PGRST116") {
      console.error("Error fetching user stats:", statsError);
      return res.status(500).json({ error: "Failed to fetch user statistics" });
    }

    // Get card counts by state
    const { data: cardCounts, error: countError } = await req.supabase
      .from("cards")
      .select("state")
      .eq("user_id", userId);

    if (countError) {
      console.error("Error fetching card counts:", countError);
      return res.status(500).json({ error: "Failed to fetch card counts" });
    }

    // Count cards due today
    const today = new Date().toISOString();
    const { data: dueCards, error: dueError } = await req.supabase
      .from("cards")
      .select("id")
      .eq("user_id", userId)
      .lte("due_date", today);

    if (dueError) {
      console.error("Error fetching due cards count:", dueError);
      return res.status(500).json({ error: "Failed to fetch due cards count" });
    }

    const stateSummary = cardCounts.reduce((acc, card) => {
      acc[card.state] = (acc[card.state] || 0) + 1;
      return acc;
    }, {});

    res.json({
      userStats: userStats || {
        current_streak: 0,
        longest_streak: 0,
        total_cards_studied: 0,
        total_study_time: 0,
        words_mastered: 0,
        daily_goal: 20,
      },
      cardCounts: stateSummary,
      dueToday: dueCards.length,
      totalCards: cardCounts.length,
    });
  } catch (error) {
    console.error("Error in /stats endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/flashcards/:cardId/review
 * Submit a card review
 */
router.post("/:cardId/review", async (req, res) => {
  try {
    const { cardId } = req.params;
    const { rating, responseTime } = req.body;
    const userId = req.user.id;

    // Validate rating
    if (!rating || rating < 1 || rating > 4) {
      return res.status(400).json({ error: "Rating must be between 1 and 4" });
    }

    // Get the current card
    const { data: card, error: cardError } = await req.supabase
      .from("cards")
      .select(
        `
        *,
        words!inner(*)
      `
      )
      .eq("id", cardId)
      .eq("user_id", userId)
      .single();

    if (cardError || !card) {
      return res.status(404).json({ error: "Card not found" });
    }

    // Calculate new card parameters using FSRS
    const reviewDate = new Date();
    const newParams = fsrs.schedule(card, rating, reviewDate);

    // Store old values for history
    const oldValues = {
      stability: card.stability,
      difficulty: card.difficulty,
      state: card.state,
      due_date: card.due_date,
    };

    // Update the card
    const { data: updatedCard, error: updateError } = await req.supabase
      .from("cards")
      .update({
        stability: newParams.stability,
        difficulty: newParams.difficulty,
        elapsed_days: newParams.elapsedDays,
        scheduled_days: newParams.scheduledDays,
        reps: newParams.reps,
        lapses: newParams.lapses,
        last_review: newParams.lastReview.toISOString(),
        state: newParams.state,
        due_date: newParams.dueDate.toISOString(),
        total_study_time: card.total_study_time + (responseTime || 0),
      })
      .eq("id", cardId)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating card:", updateError);
      return res.status(500).json({ error: "Failed to update card" });
    }

    // Record review history
    const { error: historyError } = await req.supabase
      .from("review_history")
      .insert({
        user_id: userId,
        card_id: cardId,
        rating,
        response_time: responseTime,
        old_stability: oldValues.stability,
        old_difficulty: oldValues.difficulty,
        old_state: oldValues.state,
        old_due_date: oldValues.due_date,
        new_stability: newParams.stability,
        new_difficulty: newParams.difficulty,
        new_state: newParams.state,
        new_due_date: newParams.dueDate.toISOString(),
      });

    if (historyError) {
      console.error("Error recording review history:", historyError);
      // Don't fail the request, just log the error
    }

    // Update user statistics
    await updateUserStatistics(req.supabase, userId, rating, responseTime || 0);

    res.json({
      card: {
        ...updatedCard,
        words: card.words,
      },
      nextIntervals: fsrs.getNextIntervals(updatedCard),
      reviewResult: {
        oldState: oldValues.state,
        newState: newParams.state,
        interval: newParams.scheduledDays,
        dueDate: newParams.dueDate,
      },
    });
  } catch (error) {
    console.error("Error in /review endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/flashcards/session/start
 * Start a new study session
 */
router.post("/session/start", async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: session, error } = await req.supabase
      .from("study_sessions")
      .insert({
        user_id: userId,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating study session:", error);
      return res.status(500).json({ error: "Failed to start study session" });
    }

    res.json({ session });
  } catch (error) {
    console.error("Error in /session/start endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/flashcards/session/:sessionId/end
 * End a study session
 */
router.put("/session/:sessionId/end", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      cardsStudied,
      newCards,
      reviewCards,
      totalTime,
      correctAnswers,
      totalAnswers,
    } = req.body;
    const userId = req.user.id;

    const averageResponseTime =
      totalAnswers > 0 ? Math.round((totalTime * 1000) / totalAnswers) : 0;

    const { data: session, error } = await req.supabase
      .from("study_sessions")
      .update({
        cards_studied: cardsStudied || 0,
        new_cards: newCards || 0,
        review_cards: reviewCards || 0,
        total_time: totalTime || 0,
        correct_answers: correctAnswers || 0,
        total_answers: totalAnswers || 0,
        average_response_time: averageResponseTime,
        ended_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error ending study session:", error);
      return res.status(500).json({ error: "Failed to end study session" });
    }

    res.json({ session });
  } catch (error) {
    console.error("Error in /session/end endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/flashcards/:cardId/quiz
 * Get quiz questions for a specific card
 */
router.get("/:cardId/quiz", async (req, res) => {
  try {
    const { cardId } = req.params;
    const { questionType = null, limit = 1 } = req.query;
    const userId = req.user.id;

    // Get the card and associated word
    const { data: card, error: cardError } = await req.supabase
      .from("cards")
      .select(
        `
        *,
        words!inner(*)
      `
      )
      .eq("id", cardId)
      .eq("user_id", userId)
      .single();

    if (cardError || !card) {
      return res.status(404).json({ error: "Card not found" });
    }

    // Get existing quiz questions
    let query = req.supabase
      .from("quiz_questions")
      .select("*")
      .eq("word_id", card.word_id);

    if (questionType) {
      query = query.eq("question_type", questionType);
    }

    const { data: existingQuestions, error: questionError } = await query
      .order("usage_count", { ascending: true })
      .limit(parseInt(limit));

    if (questionError) {
      console.error("Error fetching quiz questions:", questionError);
      return res.status(500).json({ error: "Failed to fetch quiz questions" });
    }

    // If no questions exist, generate new ones
    if (existingQuestions.length === 0) {
      const word = card.words;
      const questionTypes = questionType
        ? [questionType]
        : ["fill_blank", "definition_choice"];

      try {
        const newQuestions = await quizService.generateQuizQuestions(
          word,
          questionTypes,
          1
        );

        if (newQuestions.length > 0) {
          // Save questions to database
          const { data: savedQuestions, error: saveError } = await req.supabase
            .from("quiz_questions")
            .insert(newQuestions)
            .select();

          if (saveError) {
            console.error("Error saving quiz questions:", saveError);
            // Continue with generated questions even if save fails
          }

          res.json({
            questions: savedQuestions || newQuestions,
            generated: true,
          });
          return;
        }
      } catch (error) {
        console.error("Error generating quiz questions:", error);
        return res
          .status(500)
          .json({ error: "Failed to generate quiz questions" });
      }
    }

    // Shuffle options for existing questions
    const questionsWithShuffledOptions = existingQuestions.map((q) => {
      if (q.options && Array.isArray(q.options)) {
        return {
          ...q,
          options: quizService.shuffleArray(q.options),
        };
      }
      return q;
    });

    res.json({
      questions: questionsWithShuffledOptions,
      generated: false,
    });
  } catch (error) {
    console.error("Error in /quiz endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/flashcards/quiz/:questionId/answer
 * Submit an answer to a quiz question with FSRS exponential spaced repetition
 */
router.post("/quiz/:questionId/answer", async (req, res) => {
  try {
    const { questionId } = req.params;
    const { userAnswer, responseTime, cardId } = req.body;
    const userId = req.user.id;

    // Get the question with current FSRS data
    const { data: question, error: questionError } = await req.supabase
      .from("quiz_questions")
      .select("*")
      .eq("id", questionId)
      .single();

    if (questionError || !question) {
      return res.status(404).json({ error: "Question not found" });
    }

    // Check if answer is correct
    const isCorrect =
      userAnswer.trim().toLowerCase() ===
      question.correct_answer.trim().toLowerCase();

    // Find the card associated with this question's word
    let actualCardId = cardId;
    if (!cardId) {
      const { data: card, error: cardError } = await req.supabase
        .from("cards")
        .select("id")
        .eq("user_id", userId)
        .eq("word_id", question.word_id)
        .single();

      if (!cardError && card) {
        actualCardId = card.id;
      } else {
        console.error("Could not find card for quiz question:", {
          questionId,
          wordId: question.word_id,
          cardError,
        });
        // Create a card for this word if it doesn't exist
        const { data: newCard, error: createCardError } = await req.supabase
          .from("cards")
          .insert({
            user_id: userId,
            word_id: question.word_id,
          })
          .select("id")
          .single();

        if (!createCardError && newCard) {
          actualCardId = newCard.id;
        } else {
          console.error(
            "Failed to create card for quiz question:",
            createCardError
          );
          return res
            .status(500)
            .json({ error: "Failed to associate quiz attempt with card" });
        }
      }
    }

    // Calculate new FSRS parameters
    const reviewDate = new Date();
    const newParams = quizFsrs.schedule(question, isCorrect, responseTime || 5000, reviewDate);

    // Record the attempt
    const { error: attemptError } = await req.supabase
      .from("quiz_attempts")
      .insert({
        user_id: userId,
        card_id: actualCardId,
        question_id: questionId,
        user_answer: userAnswer,
        is_correct: isCorrect,
        response_time: responseTime,
      });

    if (attemptError) {
      console.error("Error recording quiz attempt:", attemptError);
      // Don't fail the request, just log the error
    }

    // Update question with new FSRS parameters and legacy statistics
    const newUsageCount = question.usage_count + 1;
    const newSuccessRate =
      question.usage_count > 0
        ? (question.success_rate * question.usage_count + (isCorrect ? 1 : 0)) /
          newUsageCount
        : isCorrect
          ? 1
          : 0;

    const { error: updateError } = await req.supabase
      .from("quiz_questions")
      .update({
        // Legacy fields (for backwards compatibility)
        usage_count: newUsageCount,
        success_rate: newSuccessRate,

        // New FSRS fields
        stability: newParams.stability,
        difficulty: newParams.difficulty,
        total_attempts: newParams.total_attempts,
        correct_attempts: newParams.correct_attempts,
        interval_days: newParams.interval_days,
        due_date: newParams.due_date.toISOString(),
        last_review: newParams.last_review.toISOString(),
        avg_response_time: newParams.avg_response_time,
      })
      .eq("id", questionId);

    if (updateError) {
      console.error("Error updating quiz question FSRS data:", updateError);
      // Continue anyway - the attempt was recorded
    }

    // Get next intervals for different response qualities (for UI feedback)
    const nextIntervals = quizFsrs.getNextIntervals({
      ...question,
      ...newParams
    });

    res.json({
      isCorrect,
      correctAnswer: question.correct_answer,
      explanation: question.explanation,
      userAnswer,
      fsrs: {
        // Detailed FSRS information
        stability: newParams.stability,
        difficulty: newParams.difficulty,
        interval_days: newParams.interval_days,
        due_date: newParams.due_date,
        response_quality: newParams.response_quality,
        success_rate: newParams.success_rate,
        next_intervals: nextIntervals
      },
      spaced_repetition: {
        // Legacy simple info for backwards compatibility
        will_repeat_soon: newParams.interval_days < 1,
        priority: isCorrect ? "low" : "high",
        next_review: newParams.due_date,
        interval_description: newParams.interval_days < 1
          ? `${Math.round(newParams.interval_days * 24)} hours`
          : newParams.interval_days < 7
          ? `${Math.round(newParams.interval_days)} days`
          : `${Math.round(newParams.interval_days / 7)} weeks`
      },
    });
  } catch (error) {
    console.error("Error in /quiz/answer endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/flashcards/progress
 * Get user's learning progress
 */
router.get("/progress", async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get review history for the period
    const { data: reviews, error: reviewError } = await req.supabase
      .from("review_history")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true });

    if (reviewError) {
      console.error("Error fetching review history:", reviewError);
      return res.status(500).json({ error: "Failed to fetch review history" });
    }

    // Get study sessions for the period
    const { data: sessions, error: sessionError } = await req.supabase
      .from("study_sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("started_at", startDate.toISOString())
      .order("started_at", { ascending: true });

    if (sessionError) {
      console.error("Error fetching study sessions:", sessionError);
      return res.status(500).json({ error: "Failed to fetch study sessions" });
    }

    // Group data by day
    const progressByDay = {};
    const today = new Date();

    for (let i = 0; i < parseInt(days); i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      progressByDay[dateStr] = {
        date: dateStr,
        reviews: 0,
        correctReviews: 0,
        studyTime: 0,
        sessions: 0,
      };
    }

    // Process reviews
    reviews.forEach((review) => {
      const date = review.created_at.split("T")[0];
      if (progressByDay[date]) {
        progressByDay[date].reviews++;
        if (review.rating >= 3) {
          progressByDay[date].correctReviews++;
        }
      }
    });

    // Process sessions
    sessions.forEach((session) => {
      const date = session.started_at.split("T")[0];
      if (progressByDay[date]) {
        progressByDay[date].studyTime += session.total_time || 0;
        progressByDay[date].sessions++;
      }
    });

    res.json({
      progressByDay: Object.values(progressByDay).sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      ),
      totalReviews: reviews.length,
      totalSessions: sessions.length,
      totalStudyTime: sessions.reduce((sum, s) => sum + (s.total_time || 0), 0),
    });
  } catch (error) {
    console.error("Error in /progress endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Helper function to update user statistics
 */
async function updateUserStatistics(supabase, userId, rating, responseTime) {
  try {
    // Get current stats
    const { data: currentStats, error: statsError } = await supabase
      .from("user_statistics")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (statsError && statsError.code !== "PGRST116") {
      console.error("Error fetching user stats for update:", statsError);
      return;
    }

    const stats = currentStats || {
      total_cards_studied: 0,
      total_study_time: 0,
      total_reviews: 0,
      average_retention_rate: 0,
      average_response_time: 0,
      current_streak: 0,
      longest_streak: 0,
      words_mastered: 0,
      last_study_date: null,
    };

    // Calculate new values
    const newTotalReviews = stats.total_reviews + 1;
    const wasCorrect = rating >= 3 ? 1 : 0;
    const newRetentionRate =
      (stats.average_retention_rate * stats.total_reviews + wasCorrect) /
      newTotalReviews;
    const newAvgResponseTime =
      stats.total_reviews > 0
        ? Math.round(
            (stats.average_response_time * stats.total_reviews + responseTime) /
              newTotalReviews
          )
        : responseTime;

    // Update streak
    const today = new Date().toISOString().split("T")[0];
    const lastStudyDate = stats.last_study_date;
    let newStreak = stats.current_streak;

    if (!lastStudyDate || lastStudyDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      if (lastStudyDate === yesterdayStr) {
        newStreak += 1; // Continue streak
      } else if (!lastStudyDate || lastStudyDate !== today) {
        newStreak = 1; // Start new streak
      }
    }

    // Count mastered words (cards with stability > 21 days)
    const { data: masteredCards, error: masteredError } = await supabase
      .from("cards")
      .select("id")
      .eq("user_id", userId)
      .gte("stability", 21);

    const wordsMastered = masteredError
      ? stats.words_mastered || 0
      : masteredCards.length;

    // Update statistics
    const updateData = {
      total_cards_studied: stats.total_cards_studied + 1,
      total_study_time: stats.total_study_time + responseTime,
      total_reviews: newTotalReviews,
      average_retention_rate: newRetentionRate,
      average_response_time: newAvgResponseTime,
      current_streak: newStreak,
      longest_streak: Math.max(stats.longest_streak || 0, newStreak),
      words_mastered: wordsMastered,
      last_study_date: today,
    };

    await supabase.from("user_statistics").upsert({
      user_id: userId,
      ...updateData,
    });
  } catch (error) {
    console.error("Error updating user statistics:", error);
  }
}

/**
 * DELETE /api/flashcards/quiz-questions/:questionId
 * Delete a quiz question
 */
router.delete("/quiz-questions/:questionId", async (req, res) => {
  try {
    const { questionId } = req.params;
    const userId = req.user.id;

    // Verify the question belongs to the user's word
    const { data: question, error: questionError } = await req.supabase
      .from("quiz_questions")
      .select(
        `
        *,
        words!inner(user_id)
      `
      )
      .eq("id", questionId)
      .eq("words.user_id", userId)
      .single();

    if (questionError || !question) {
      return res
        .status(404)
        .json({ error: "Question not found or access denied" });
    }

    // Delete the question
    const { error: deleteError } = await req.supabase
      .from("quiz_questions")
      .delete()
      .eq("id", questionId);

    if (deleteError) {
      console.error("Error deleting quiz question:", deleteError);
      return res.status(500).json({ error: "Failed to delete quiz question" });
    }

    res.json({ message: "Quiz question deleted successfully" });
  } catch (error) {
    console.error("Error in delete quiz question endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/flashcards/quiz-questions
 * Get quiz questions due for review with FSRS exponential spaced repetition
 */
router.get("/quiz-questions", async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 100, includeNew = true } = req.query;

    console.log(
      `Fetching quiz questions for user ${userId}, limit: ${limit}, includeNew: ${includeNew}`
    );

    const now = new Date();
    const nowIso = now.toISOString();

    // Build query to get quiz questions due for review using FSRS
    let query = req.supabase
      .from("quiz_questions")
      .select(
        `
        *,
        words!inner(
          id,
          word,
          definition,
          word_type,
          cefr_level,
          example_sentence,
          vietnamese_translation,
          synonyms
        )
      `
      )
      .eq("words.user_id", userId);

    // Filter by due date for questions that have been reviewed before
    // Include questions that are due now OR new questions (no due_date set)
    if (includeNew === "true" || includeNew === true) {
      query = query.or(`due_date.lte.${nowIso},due_date.is.null`);
    } else {
      query = query.lte("due_date", nowIso);
    }

    const { data: questions, error: questionsError } = await query
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(parseInt(limit) * 2); // Fetch more than needed for better selection

    if (questionsError) {
      console.error("Error fetching quiz questions:", questionsError);
      return res.status(500).json({ error: "Failed to fetch quiz questions" });
    }

    if (!questions || questions.length === 0) {
      console.log("No quiz questions found");
      return res.json({
        questions: [],
        total: 0,
        returned: 0,
      });
    }

    // Process questions with FSRS prioritization
    const processedQuestions = questions.map((question) => {
      const isDue = quizFsrs.isDue(question, now);
      const isNew = !question.due_date || !question.last_review;

      // Calculate priority based on FSRS parameters
      let priority;
      if (isNew) {
        priority = 3; // Medium priority for new questions
      } else if (!isDue) {
        priority = 10; // Very low priority for not-due questions (shouldn't appear with current query)
      } else {
        // Priority based on difficulty and how overdue the question is
        const hoursOverdue = question.due_date
          ? Math.max(0, (now - new Date(question.due_date)) / (1000 * 60 * 60))
          : 0;
        const difficulty = question.difficulty || 5;

        // Higher difficulty and more overdue = higher priority
        // Priority scale: 1 (highest) to 9 (lowest)
        priority = Math.max(1, Math.min(9, Math.round(10 - difficulty - hoursOverdue / 24)));
      }

      return {
        ...question,
        is_new: isNew,
        is_due: isDue,
        priority: priority,
        hours_overdue: question.due_date
          ? Math.max(0, (now - new Date(question.due_date)) / (1000 * 60 * 60))
          : 0
      };
    })
    .filter(q => q.is_due || q.is_new) // Only include due or new questions
    .sort((a, b) => {
      // Sort by priority first (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // Then by how overdue they are (more overdue first)
      if (a.hours_overdue !== b.hours_overdue) {
        return b.hours_overdue - a.hours_overdue;
      }

      // Finally by difficulty (harder questions first)
      return (b.difficulty || 5) - (a.difficulty || 5);
    });

    console.log(`Found ${questions.length} total questions, ${processedQuestions.length} are due`);

    // Limit results
    const limitedQuestions = processedQuestions.slice(0, parseInt(limit));

    // Shuffle options for questions and add FSRS info
    const questionsWithShuffledOptions = limitedQuestions.map((q) => {
      const questionWithShuffled = {
        ...q,
        fsrs_info: {
          stability: q.stability || 1,
          difficulty: q.difficulty || 5,
          interval_days: q.interval_days || 1,
          due_date: q.due_date,
          success_rate: q.success_rate || 0,
          total_attempts: q.total_attempts || 0
        }
      };

      if (q.options && Array.isArray(q.options)) {
        return {
          ...questionWithShuffled,
          options: quizService.shuffleArray(q.options),
        };
      }
      return questionWithShuffled;
    });

    console.log(
      `Returning ${questionsWithShuffledOptions.length} quiz questions (FSRS-scheduled)`
    );

    res.json({
      questions: questionsWithShuffledOptions,
      total: processedQuestions.length,
      returned: questionsWithShuffledOptions.length,
      fsrs_info: {
        new_questions: processedQuestions.filter(q => q.is_new).length,
        overdue_questions: processedQuestions.filter(q => q.hours_overdue > 0).length,
        avg_interval: processedQuestions.reduce((sum, q) => sum + (q.interval_days || 1), 0) / processedQuestions.length
      }
    });
  } catch (error) {
    console.error("Quiz questions endpoint error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
