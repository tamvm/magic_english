import { useState, useEffect } from 'react';
import { flashcardAPI } from '../lib/api';

export const useFlashcards = () => {
  const [dueCards, setDueCards] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [sessionStats, setSessionStats] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [includeQuizQuestions, setIncludeQuizQuestions] = useState(false);

  // Pre-loading state
  const [nextCard, setNextCard] = useState(null);
  const [isPreloading, setIsPreloading] = useState(false);

  // Fetch more cards when needed (for pre-loading)
  const fetchMoreCards = async () => {
    if (isPreloading) return []; // Prevent concurrent fetches

    try {
      setIsPreloading(true);
      const response = await flashcardAPI.getDueCards({
        limit: 10, // Fetch smaller batch for pre-loading
        includeNew: true,
        includeQuizQuestions: includeQuizQuestions
      });

      if (response.data.cards.length > 0) {
        // Add new cards to the end of current dueCards
        setDueCards(prev => [...prev, ...response.data.cards]);
        return response.data.cards;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch more cards:', error);
      return [];
    } finally {
      setIsPreloading(false);
    }
  };

  // Fetch cards due for review
  const fetchDueCards = async (limit = 20, includeQuizQuestionsParam = null) => {
    try {
      setLoading(true);
      setError(null);

      // Use parameter if provided, otherwise use stored state
      const shouldIncludeQuiz = includeQuizQuestionsParam !== null
        ? includeQuizQuestionsParam
        : includeQuizQuestions;

      // Update the stored state
      if (includeQuizQuestionsParam !== null) {
        setIncludeQuizQuestions(includeQuizQuestionsParam);
      }

      const response = await flashcardAPI.getDueCards({
        limit,
        includeNew: true,
        includeQuizQuestions: shouldIncludeQuiz
      });

      setDueCards(response.data.cards);

      if (response.data.cards.length > 0) {
        setCurrentCard(response.data.cards[0]);
        setCurrentCardIndex(0);
        // Pre-load next card
        setNextCard(response.data.cards.length > 1 ? response.data.cards[1] : null);
      }

      return response.data;
    } catch (err) {
      console.error('Failed to fetch due cards:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Start a new study session
  const startSession = async () => {
    try {
      setError(null);

      const response = await flashcardAPI.startSession();
      setCurrentSession(response.data.session);

      // Fetch due cards after starting session with current quiz mode
      await fetchDueCards();

      return response.data.session;
    } catch (err) {
      console.error('Failed to start session:', err);
      setError(err.message);
      return null;
    }
  };

  // End current study session
  const endSession = async (sessionData) => {
    try {
      setError(null);

      if (!currentSession) {
        throw new Error('No active session to end');
      }

      const response = await flashcardAPI.endSession(currentSession.id, sessionData);

      setCurrentSession(null);
      setCurrentCard(null);
      setDueCards([]);
      setCurrentCardIndex(0);

      return response.data.session;
    } catch (err) {
      console.error('Failed to end session:', err);
      setError(err.message);
      return null;
    }
  };

  // Review a card with rating (with instant next card switching)
  const reviewCard = async (cardId, rating, responseTime = null) => {
    try {
      setError(null);

      // INSTANT: Move to next card immediately before API call
      const nextIndex = currentCardIndex + 1;

      if (nextCard) {
        // Use pre-loaded next card for instant switching
        setCurrentCard(nextCard);
        setCurrentCardIndex(nextIndex);

        // Pre-load the card after next
        const cardAfterNext = nextIndex + 1 < dueCards.length ? dueCards[nextIndex + 1] : null;
        setNextCard(cardAfterNext);

        // If we're near the end of cards, fetch more in background
        if (nextIndex + 2 >= dueCards.length) {
          fetchMoreCards().then(newCards => {
            if (newCards.length > 0 && !cardAfterNext) {
              setNextCard(newCards[0]);
            }
          });
        }
      } else if (nextIndex < dueCards.length) {
        // Fallback: use cards from dueCards array
        setCurrentCard(dueCards[nextIndex]);
        setCurrentCardIndex(nextIndex);
        setNextCard(nextIndex + 1 < dueCards.length ? dueCards[nextIndex + 1] : null);
      } else {
        // No more cards available, fetch new ones
        await fetchDueCards();
      }

      // BACKGROUND: Submit rating to API (don't wait for response)
      flashcardAPI.reviewCard(cardId, {
        rating,
        responseTime
      }).catch(err => {
        console.error('Failed to review card (background):', err);
        // Could show a notification here that the rating wasn't saved
        // but don't block the user experience
      });

      return true; // Return immediately for instant feedback
    } catch (err) {
      console.error('Failed to review card:', err);
      setError(err.message);
      return null;
    }
  };

  // Skip a card without rating it (with instant next card switching)
  const skipCard = () => {
    try {
      setError(null);

      // INSTANT: Move to next card immediately
      const nextIndex = currentCardIndex + 1;

      if (nextCard) {
        // Use pre-loaded next card for instant switching
        setCurrentCard(nextCard);
        setCurrentCardIndex(nextIndex);

        // Pre-load the card after next
        const cardAfterNext = nextIndex + 1 < dueCards.length ? dueCards[nextIndex + 1] : null;
        setNextCard(cardAfterNext);

        // If we're near the end of cards, fetch more in background
        if (nextIndex + 2 >= dueCards.length) {
          fetchMoreCards().then(newCards => {
            if (newCards.length > 0 && !cardAfterNext) {
              setNextCard(newCards[0]);
            }
          });
        }
      } else if (nextIndex < dueCards.length) {
        // Fallback: use cards from dueCards array
        setCurrentCard(dueCards[nextIndex]);
        setCurrentCardIndex(nextIndex);
        setNextCard(nextIndex + 1 < dueCards.length ? dueCards[nextIndex + 1] : null);
      } else {
        // No more cards available, fetch new ones
        fetchDueCards();
      }

      return true;
    } catch (err) {
      console.error('Failed to skip card:', err);
      setError(err.message);
      return false;
    }
  };

  // Get quiz questions for a card
  const getQuizQuestions = async (cardId, questionType = null, limit = 1) => {
    try {
      setError(null);

      const response = await flashcardAPI.getQuizQuestions(cardId, { questionType, limit });

      return response.data.questions;
    } catch (err) {
      console.error('Failed to get quiz questions:', err);
      setError(err.message);
      return [];
    }
  };

  // Submit quiz answer with spaced repetition
  const submitQuizAnswer = async (questionId, userAnswer, responseTime, cardId) => {
    try {
      setError(null);

      const response = await flashcardAPI.submitQuizAnswer(questionId, {
        userAnswer,
        responseTime,
        cardId
      });

      return response.data;
    } catch (err) {
      console.error('Failed to submit quiz answer:', err);
      setError(err.message);
      return null;
    }
  };

  // Get user's flashcard statistics
  const getStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await flashcardAPI.getStats();
      setSessionStats(response.data);

      return response.data;
    } catch (err) {
      console.error('Failed to get stats:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Get progress data
  const getProgress = async (days = 30) => {
    try {
      setError(null);

      const response = await flashcardAPI.getProgress(days);

      return response.data;
    } catch (err) {
      console.error('Failed to get progress:', err);
      setError(err.message);
      return null;
    }
  };

  // Initialize on mount
  useEffect(() => {
    getStats();
  }, []);

  return {
    dueCards,
    currentCard,
    currentCardIndex,
    sessionStats,
    currentSession,
    loading,
    error,
    nextCard,
    isPreloading,
    fetchDueCards,
    startSession,
    endSession,
    reviewCard,
    skipCard,
    getQuizQuestions,
    submitQuizAnswer,
    getStats,
    getProgress,
    fetchMoreCards,
    // Helper computed values
    hasCards: dueCards.length > 0,
    progress: dueCards.length > 0 ? ((currentCardIndex + 1) / dueCards.length) * 100 : 0,
    cardsRemaining: Math.max(0, dueCards.length - currentCardIndex),
  };
};