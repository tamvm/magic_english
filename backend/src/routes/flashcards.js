import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { FSRS, RATING, CARD_STATE } from "../services/fsrs.js";
import { quizService } from "../services/quizService.js";

const router = express.Router();
const fsrs = new FSRS();

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
 * Submit an answer to a quiz question with simplified spaced repetition
 */
router.post("/quiz/:questionId/answer", async (req, res) => {
  try {
    const { questionId } = req.params;
    const { userAnswer, responseTime, cardId } = req.body;
    const userId = req.user.id;

    // Get the question
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

    // Update question usage statistics
    const newUsageCount = question.usage_count + 1;
    const newSuccessRate =
      question.usage_count > 0
        ? (question.success_rate * question.usage_count + (isCorrect ? 1 : 0)) /
          newUsageCount
        : isCorrect
          ? 1
          : 0;

    await req.supabase
      .from("quiz_questions")
      .update({
        usage_count: newUsageCount,
        success_rate: newSuccessRate,
      })
      .eq("id", questionId);

    res.json({
      isCorrect,
      correctAnswer: question.correct_answer,
      explanation: question.explanation,
      userAnswer,
      spaced_repetition: {
        // Simplified spaced repetition info
        will_repeat_soon: !isCorrect,
        priority: isCorrect ? "low" : "high",
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
 * Get quiz questions due for review with spaced repetition
 */
router.get("/quiz-questions", async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 100, includeNew = true } = req.query;

    console.log(
      `Fetching quiz questions for user ${userId}, limit: ${limit}, includeNew: ${includeNew}`
    );

    const now = new Date().toISOString();

    // Get quiz questions with their latest attempt status
    const { data: questionsWithAttempts, error: questionsError } =
      await req.supabase
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

    if (questionsError) {
      console.error(
        "Error fetching quiz questions with cards:",
        questionsError
      );
      return res.status(500).json({ error: "Failed to fetch quiz questions" });
    }

    // Get recent quiz attempts for these questions to implement simplified spaced repetition
    let questionsWithRecentAttempts = [];

    if (questionsWithAttempts && questionsWithAttempts.length > 0) {
      const questionIds = questionsWithAttempts.map((q) => q.id);

      // Get the most recent attempt for each question by this user
      const { data: recentAttempts, error: attemptsError } = await req.supabase
        .from("quiz_attempts")
        .select("question_id, is_correct, created_at")
        .eq("user_id", userId)
        .in("question_id", questionIds)
        .order("created_at", { ascending: false });

      if (attemptsError) {
        console.error("Error fetching quiz attempts:", attemptsError);
      }

      // Group attempts by question_id (most recent first due to ordering)
      const attemptsByQuestion = {};
      recentAttempts?.forEach((attempt) => {
        if (!attemptsByQuestion[attempt.question_id]) {
          attemptsByQuestion[attempt.question_id] = attempt;
        }
      });

      // Filter and prioritize questions based on attempts
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      for (const question of questionsWithAttempts) {
        const lastAttempt = attemptsByQuestion[question.id];

        if (!lastAttempt) {
          // New question - include if includeNew is true
          if (includeNew === "true" || includeNew === true) {
            questionsWithRecentAttempts.push({
              ...question,
              is_new: true,
              priority: 3, // Medium priority for new questions
              last_attempt: null,
            });
          }
        } else {
          // Question has been attempted before
          const attemptDate = new Date(lastAttempt.created_at);

          if (!lastAttempt.is_correct) {
            // Wrong answer - high priority, always include
            questionsWithRecentAttempts.push({
              ...question,
              is_new: false,
              priority: 1, // Highest priority for wrong answers
              last_attempt: lastAttempt,
            });
          } else {
            // Correct answer - include based on time passed
            if (attemptDate < oneDayAgo) {
              questionsWithRecentAttempts.push({
                ...question,
                is_new: false,
                priority: 5, // Lower priority for old correct answers
                last_attempt: lastAttempt,
              });
            }
            // Skip recent correct answers (spaced repetition)
          }
        }
      }
    }

    // Sort by priority (lower number = higher priority)
    questionsWithRecentAttempts.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Same priority - sort by last attempt date (older first)
      if (a.last_attempt && b.last_attempt) {
        return (
          new Date(a.last_attempt.created_at) -
          new Date(b.last_attempt.created_at)
        );
      }
      return 0;
    });

    let dueQuestions = questionsWithRecentAttempts;

    console.log(`After filtering: ${dueQuestions.length} due questions`);

    // Limit results
    const limitedQuestions = dueQuestions.slice(0, parseInt(limit));

    // Shuffle options for questions
    const questionsWithShuffledOptions = limitedQuestions.map((q) => {
      if (q.options && Array.isArray(q.options)) {
        return {
          ...q,
          options: quizService.shuffleArray(q.options),
        };
      }
      return q;
    });

    console.log(
      `Returning ${questionsWithShuffledOptions.length} quiz questions`
    );

    res.json({
      questions: questionsWithShuffledOptions,
      total: dueQuestions.length,
      returned: questionsWithShuffledOptions.length,
    });
  } catch (error) {
    console.error("Quiz questions endpoint error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
