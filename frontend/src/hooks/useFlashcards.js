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

  // Fetch cards due for review
  const fetchDueCards = async (limit = 20, includeQuizQuestions = false) => {
    try {
      setLoading(true);
      setError(null);

      const response = await flashcardAPI.getDueCards({
        limit,
        includeNew: true,
        includeQuizQuestions
      });

      setDueCards(response.data.cards);

      if (response.data.cards.length > 0) {
        setCurrentCard(response.data.cards[0]);
        setCurrentCardIndex(0);
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

      // Fetch due cards after starting session
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

  // Review a card with rating
  const reviewCard = async (cardId, rating, responseTime = null) => {
    try {
      setError(null);

      const response = await flashcardAPI.reviewCard(cardId, {
        rating,
        responseTime
      });

      // Move to next card
      const nextIndex = currentCardIndex + 1;
      if (nextIndex < dueCards.length) {
        setCurrentCard(dueCards[nextIndex]);
        setCurrentCardIndex(nextIndex);
      } else {
        // No more cards, fetch new due cards
        await fetchDueCards();
      }

      return response.data;
    } catch (err) {
      console.error('Failed to review card:', err);
      setError(err.message);
      return null;
    }
  };

  // Skip a card without rating it
  const skipCard = () => {
    try {
      setError(null);

      // Move to next card without API call
      const nextIndex = currentCardIndex + 1;
      if (nextIndex < dueCards.length) {
        setCurrentCard(dueCards[nextIndex]);
        setCurrentCardIndex(nextIndex);
      } else {
        // No more cards, fetch new due cards
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

  // Submit quiz answer
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
    fetchDueCards,
    startSession,
    endSession,
    reviewCard,
    skipCard,
    getQuizQuestions,
    submitQuizAnswer,
    getStats,
    getProgress,
    // Helper computed values
    hasCards: dueCards.length > 0,
    progress: dueCards.length > 0 ? ((currentCardIndex + 1) / dueCards.length) * 100 : 0,
    cardsRemaining: Math.max(0, dueCards.length - currentCardIndex),
  };
};