import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Clock,
  Flame,
  BarChart3,
  X,
  Check,
  HelpCircle,
  SkipForward,
} from 'lucide-react';

import { useFlashcards } from '../hooks/useFlashcards';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { flashcardAPI } from '../lib/api';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import FlashCard from '../components/Flashcards/FlashCard';
import QuizQuestion from '../components/Flashcards/QuizQuestion';

const Study = () => {
  const navigate = useNavigate();
  const {
    dueCards,
    currentCard,
    currentCardIndex,
    sessionStats,
    reviewCard,
    skipCard,
    startSession,
    endSession,
    fetchDueCards,
    loading,
    error,
    cardsRemaining
  } = useFlashcards();

  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [cardStartTime, setCardStartTime] = useState(null);
  const [showSessionEnd, setShowSessionEnd] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [isRatingInProgress, setIsRatingInProgress] = useState(false);
  const [reviewedCards, setReviewedCards] = useState([]);
  const [showReview, setShowReview] = useState(false);

  // Quiz mode state
  const [studyMode, setStudyMode] = useState('flashcard'); // 'flashcard' or 'quiz'
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [quizAnswer, setQuizAnswer] = useState('');
  const [showQuizAnswer, setShowQuizAnswer] = useState(false);
  const [allQuizQuestions, setAllQuizQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loadingQuizQuestions, setLoadingQuizQuestions] = useState(false);

  // Study session state
  const [studyStats, setStudyStats] = useState({
    cardsStudied: 0,
    newCards: 0,
    reviewCards: 0,
    correctAnswers: 0,
    totalAnswers: 0,
  });

  // Initialize session
  useEffect(() => {
    // Reset all session states on mount
    setShowSessionEnd(false);
    setShowReview(false);
    setReviewedCards([]);
    setStudyStats({
      cardsStudied: 0,
      newCards: 0,
      reviewCards: 0,
      correctAnswers: 0,
      totalAnswers: 0,
    });

    startSession();
    setSessionStartTime(Date.now());
    // Remove cleanup - let user explicitly end session
  }, []);

  // Set card start time when new card appears
  useEffect(() => {
    if (currentCard) {
      setCardStartTime(Date.now());
      setIsFlipped(false);
      setIsRatingInProgress(false);

      // Set up quiz question if in quiz mode
      if (studyMode === 'quiz' && currentCard.quiz_questions && currentCard.quiz_questions.length > 0) {
        // Pick a random quiz question for this card
        const randomQuestion = currentCard.quiz_questions[Math.floor(Math.random() * currentCard.quiz_questions.length)];
        setCurrentQuestion(randomQuestion);
        setShowQuizAnswer(false);
        setQuizAnswer('');
      } else {
        setCurrentQuestion(null);
      }
    }
  }, [currentCard, studyMode]);

  // Fetch all quiz questions for quiz mode
  const fetchAllQuizQuestions = async () => {
    try {
      setLoadingQuizQuestions(true);
      const response = await flashcardAPI.getAllQuizQuestions({ limit: 100 });

      if (response.data.questions && response.data.questions.length > 0) {
        // Shuffle the questions for variety
        const shuffled = response.data.questions.sort(() => Math.random() - 0.5);
        setAllQuizQuestions(shuffled);
        setCurrentQuestion(shuffled[0]);
        setCurrentQuestionIndex(0);
        return true;
      } else {
        setAllQuizQuestions([]);
        setCurrentQuestion(null);
        return false;
      }
    } catch (error) {
      console.error('Failed to fetch quiz questions:', error);
      setAllQuizQuestions([]);
      setCurrentQuestion(null);
      return false;
    } finally {
      setLoadingQuizQuestions(false);
    }
  };

  // Switch study mode and refetch cards
  const switchStudyMode = async (mode) => {
    if (mode === studyMode) return;

    setStudyMode(mode);

    // Reset quiz states
    setCurrentQuestion(null);
    setQuizAnswer('');
    setShowQuizAnswer(false);

    if (mode === 'quiz') {
      // For quiz mode, fetch all available quiz questions
      // Don't depend on due cards - show quiz from any vocabulary
      await fetchAllQuizQuestions();
    } else {
      // For flashcard mode, fetch due cards
      await fetchDueCards(20, false);
    }
  };

  // Handle quiz answer submission
  const handleQuizAnswer = (answer) => {
    setQuizAnswer(answer);
    setShowQuizAnswer(true);
  };

  // Handle quiz next (after seeing answer)
  const handleQuizNext = () => {
    if (!showQuizAnswer || isRatingInProgress) return;

    const isCorrect = quizAnswer === currentQuestion?.correct_answer;

    // Update study stats
    setStudyStats(prev => ({
      ...prev,
      totalAnswers: prev.totalAnswers + 1,
      correctAnswers: prev.correctAnswers + (isCorrect ? 1 : 0),
      cardsStudied: prev.cardsStudied + 1
    }));

    // Move to next quiz question
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < allQuizQuestions.length) {
      setCurrentQuestionIndex(nextIndex);
      setCurrentQuestion(allQuizQuestions[nextIndex]);
      setQuizAnswer('');
      setShowQuizAnswer(false);
    } else {
      // No more questions, shuffle and start over
      const shuffled = allQuizQuestions.sort(() => Math.random() - 0.5);
      setAllQuizQuestions(shuffled);
      setCurrentQuestionIndex(0);
      setCurrentQuestion(shuffled[0]);
      setQuizAnswer('');
      setShowQuizAnswer(false);
    }
  };

  // Keyboard shortcuts
  const handleKeyPress = useCallback((event) => {
    if (showSessionEnd || isRatingInProgress) return;

    // Prevent default for all our shortcuts
    const shortcuts = ['Space', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyS', 'Escape', 'Slash'];
    if (shortcuts.includes(event.code)) {
      event.preventDefault();
    }

    // Global shortcuts
    if (event.code === 'Slash' && event.shiftKey) { // ? key
      setShowShortcutsHelp(!showShortcutsHelp);
      return;
    }

    switch (event.code) {
      case 'Space':
        if (studyMode === 'flashcard') {
          setIsFlipped(!isFlipped);
        } else if (studyMode === 'quiz' && showQuizAnswer) {
          handleQuizNext();
        }
        break;
      case 'Digit1':
        if (studyMode === 'flashcard') {
          handleCardRating(2);  // Map 1 to Hard (rating 2)
        } else if (studyMode === 'quiz' && currentQuestion && !showQuizAnswer) {
          // Select first option in quiz
          if (currentQuestion.options && currentQuestion.options.length > 0) {
            handleQuizAnswer(currentQuestion.options[0]);
          }
        }
        break;
      case 'Digit2':
        if (studyMode === 'flashcard') {
          handleCardRating(3);  // Map 2 to Good (rating 3)
        } else if (studyMode === 'quiz' && currentQuestion && !showQuizAnswer) {
          // Select second option in quiz
          if (currentQuestion.options && currentQuestion.options.length > 1) {
            handleQuizAnswer(currentQuestion.options[1]);
          }
        }
        break;
      case 'Digit3':
        if (studyMode === 'flashcard') {
          handleCardRating(4);  // Map 3 to Easy (rating 4)
        } else if (studyMode === 'quiz' && currentQuestion && !showQuizAnswer) {
          // Select third option in quiz
          if (currentQuestion.options && currentQuestion.options.length > 2) {
            handleQuizAnswer(currentQuestion.options[2]);
          }
        }
        break;
      case 'Digit4':
        if (studyMode === 'quiz' && currentQuestion && !showQuizAnswer) {
          // Select fourth option in quiz
          if (currentQuestion.options && currentQuestion.options.length > 3) {
            handleQuizAnswer(currentQuestion.options[3]);
          }
        }
        break;
      case 'Enter':
        if (studyMode === 'quiz' && showQuizAnswer) {
          handleQuizNext();
        }
        break;
      case 'KeyS':
        handleSkipCard();
        break;
      case 'Escape':
        if (showShortcutsHelp) {
          setShowShortcutsHelp(false);
        } else {
          handleEndSession();
        }
        break;
    }
  }, [isFlipped, showSessionEnd, showShortcutsHelp]);

  useKeyboardShortcuts(handleKeyPress);

  const handleCardRating = async (rating) => {
    if (!currentCard || isRatingInProgress) {
      console.log('No currentCard available or rating already in progress');
      return;
    }

    setIsRatingInProgress(true);

    // Set cardStartTime if it doesn't exist (for immediate rating)
    const startTime = cardStartTime || Date.now();
    const responseTime = Date.now() - startTime;

    try {
      await reviewCard(currentCard.id, rating, responseTime);

      // Track this card for review if it was hard (rating <= 2) or if user wants to review
      const reviewedCard = {
        ...currentCard,
        userRating: rating,
        wasHard: rating <= 2,
        reviewedAt: new Date().toISOString(),
        responseTime: responseTime
      };

      setReviewedCards(prev => [...prev, reviewedCard]);

      // Update stats
      const newCardsStudied = studyStats.cardsStudied + 1;
      setStudyStats(prev => ({
        ...prev,
        cardsStudied: newCardsStudied,
        totalAnswers: prev.totalAnswers + 1,
        correctAnswers: prev.correctAnswers + (rating >= 3 ? 1 : 0),
        newCards: prev.newCards + (currentCard.state === 'new' ? 1 : 0),
        reviewCards: prev.reviewCards + (currentCard.state !== 'new' ? 1 : 0),
      }));

      // Show review page after 10 cards
      if (newCardsStudied % 10 === 0) {
        setShowReview(true);
        return; // Don't continue to next card, show review first
      }

      // Reset for next card
      setIsFlipped(false);
      setCardStartTime(null);

    } catch (error) {
      console.error('Failed to review card:', error);
    } finally {
      setIsRatingInProgress(false);
    }
  };

  const handleSkipCard = () => {
    console.log('Skipping card');

    // Reset state for next card without rating
    setIsFlipped(false);
    setCardStartTime(null);

    // Update stats to show card was studied but not answered
    setStudyStats(prev => ({
      ...prev,
      cardsStudied: prev.cardsStudied + 1,
    }));

    // Actually skip to the next card
    skipCard();
  };


  const handleEndSession = async () => {
    if (!sessionStartTime) return;

    // Only end session if user actually studied cards
    if (studyStats.cardsStudied === 0) {
      // Just navigate back to dashboard if no cards were studied
      navigate('/dashboard');
      return;
    }

    const totalTime = Math.round((Date.now() - sessionStartTime) / 1000);

    try {
      await endSession({
        cardsStudied: studyStats.cardsStudied,
        newCards: studyStats.newCards,
        reviewCards: studyStats.reviewCards,
        totalTime,
        correctAnswers: studyStats.correctAnswers,
        totalAnswers: studyStats.totalAnswers,
      });

      // At session end, go directly to session complete (no review)
      setShowSessionEnd(true);
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  // Show review screen
  if (showReview) {
    const hardCards = reviewedCards.filter(card => card.wasHard);

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                📚 Review Session
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Time to review the cards you found difficult
              </p>
            </div>

            {/* Hard Cards Section */}
            {hardCards.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <span className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 px-3 py-1 rounded-full text-sm font-medium mr-3">
                    Difficult Cards ({hardCards.length})
                  </span>
                </h3>

                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="table-header">Word</th>
                        <th className="table-header">Definition</th>
                        <th className="table-header">Example</th>
                        <th className="table-header">Vietnamese</th>
                        <th className="table-header">Rating</th>
                        <th className="table-header">Response Time</th>
                      </tr>
                    </thead>
                    <tbody className="table-body">
                      {hardCards.map((card, index) => (
                        <tr key={`hard-${index}`}>
                          <td className="table-cell">
                            <div className="flex flex-col">
                              <span className="font-semibold text-gray-900 dark:text-gray-100">
                                {card.words.word}
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {card.words.ipa_pronunciation}
                              </span>
                            </div>
                          </td>
                          <td className="table-cell max-w-xs">
                            <p className="text-gray-700 dark:text-gray-300 text-sm truncate">
                              {card.words.definition}
                            </p>
                          </td>
                          <td className="table-cell max-w-xs">
                            <p className="text-gray-600 dark:text-gray-400 text-sm truncate">
                              "{card.words.example_sentence}"
                            </p>
                          </td>
                          <td className="table-cell max-w-xs">
                            <p className="text-gray-600 dark:text-gray-400 text-sm truncate">
                              {card.words.vietnamese_translation}
                            </p>
                          </td>
                          <td className="table-cell">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              card.userRating === 2 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400' :
                              card.userRating === 1 ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                              'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            }`}>
                              {card.userRating === 2 ? 'Hard' : card.userRating === 1 ? 'Again' : 'Good'}
                            </span>
                          </td>
                          <td className="table-cell">
                            <span className="text-gray-500 dark:text-gray-400 text-sm">
                              {Math.round(card.responseTime / 1000)}s
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* No Hard Cards Message */}
            {hardCards.length === 0 && (
              <div className="text-center mb-8 p-8 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
                  🎉 Great Job!
                </h3>
                <p className="text-green-700 dark:text-green-300">
                  You didn't find any cards difficult in this session. Keep up the excellent work!
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => {
                  setShowReview(false);
                  // Keep reviewed cards for final session review
                  // Reset card flipping state and continue
                  setIsFlipped(false);
                  setCardStartTime(null);
                  setIsRatingInProgress(false);
                }}
                className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 transition-colors"
              >
                Continue Studying
              </button>
              <button
                onClick={() => {
                  setShowReview(false);
                  setShowSessionEnd(true);
                }}
                className="bg-green-600 text-white py-2 px-6 rounded-md hover:bg-green-700 transition-colors"
              >
                Finish Session
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-gray-600 text-white py-2 px-6 rounded-md hover:bg-gray-700 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show session end screen (only after actual studying)
  if (showSessionEnd && studyStats.cardsStudied > 0) {
    const totalTime = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;
    const accuracy = studyStats.totalAnswers > 0 ?
      Math.round((studyStats.correctAnswers / studyStats.totalAnswers) * 100) : 0;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="text-center">
            <Check className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Study Session Complete!
            </h2>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-300">Cards Studied:</span>
                <span className="font-semibold">{studyStats.cardsStudied}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-300">Accuracy:</span>
                <span className="font-semibold text-green-600">{accuracy}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-300">Time:</span>
                <span className="font-semibold">{Math.floor(totalTime / 60)}m {totalTime % 60}s</span>
              </div>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No cards available (only show this if not in quiz mode or quiz has no questions)
  if (!loading && !loadingQuizQuestions &&
      ((studyMode === 'flashcard' && (!dueCards || dueCards.length === 0)) ||
       (studyMode === 'quiz' && (!allQuizQuestions || allQuizQuestions.length === 0)))) {
    return (
      <>
        <Helmet>
          <title>Study Session - Magic English</title>
        </Helmet>

        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header with Mode Toggle */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Study Session
                </h1>

                {/* Mode Toggle */}
                <div className="flex items-center bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => switchStudyMode('flashcard')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      studyMode === 'flashcard'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    Flashcards
                  </button>
                  <button
                    onClick={() => switchStudyMode('quiz')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      studyMode === 'quiz'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    Quiz
                  </button>
                </div>
              </div>

              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400"
                title="Back to Dashboard"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* No Cards Message */}
            <div className="flex items-center justify-center">
              <div className="text-center">
                <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  No Cards Due
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Great job! You've completed all your reviews for today.
                </p>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Show loading spinner
  if (loading || loadingQuizQuestions ||
      (studyMode === 'flashcard' && !currentCard) ||
      (studyMode === 'quiz' && !currentQuestion)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Study Session - Magic English</title>
      </Helmet>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Study Session
              </h1>

              {/* Mode Toggle */}
              <div className="flex items-center bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => switchStudyMode('flashcard')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    studyMode === 'flashcard'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  Flashcards
                </button>
                <button
                  onClick={() => switchStudyMode('quiz')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    studyMode === 'quiz'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  Quiz
                </button>
              </div>

              <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center space-x-1">
                  <BookOpen className="h-4 w-4" />
                  <span>{studyStats.cardsStudied}</span>
                </div>
                <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 font-semibold">
                  <Flame className="h-4 w-4" />
                  <span>
                    {studyMode === 'flashcard'
                      ? `${cardsRemaining} remaining`
                      : `${allQuizQuestions.length - currentQuestionIndex - 1} remaining`}
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-purple-600 dark:text-purple-400">
                  <span className="text-xs">Review in: {10 - (studyStats.cardsStudied % 10)} cards</span>
                </div>
                <div className="flex items-center space-x-1">
                  <BarChart3 className="h-4 w-4" />
                  <span>
                    {studyStats.totalAnswers > 0 ?
                      Math.round((studyStats.correctAnswers / studyStats.totalAnswers) * 100) : 0}%
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>
                    {sessionStartTime ?
                      Math.floor((Date.now() - sessionStartTime) / 60000) : 0}m
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowShortcutsHelp(true)}
                className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
                title="Show Keyboard Shortcuts (?)"
              >
                <HelpCircle className="h-5 w-5" />
              </button>
              <button
                onClick={handleSkipCard}
                className="p-2 text-gray-600 hover:text-yellow-600 dark:text-gray-300 dark:hover:text-yellow-400"
                title="Skip Card (S)"
              >
                <SkipForward className="h-5 w-5" />
              </button>
              <button
                onClick={handleEndSession}
                className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400"
                title="End Session (ESC)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            {studyMode === 'flashcard' ? (
              <FlashCard
                card={currentCard}
                isFlipped={isFlipped}
                onFlip={() => setIsFlipped(!isFlipped)}
                onRate={handleCardRating}
                showRating={true}
                isRatingInProgress={isRatingInProgress}
              />
            ) : (
              // Quiz Mode
              currentQuestion ? (
                <QuizQuestion
                  question={currentQuestion}
                  onAnswer={handleQuizAnswer}
                  showAnswer={showQuizAnswer}
                  onNext={handleQuizNext}
                />
              ) : (
                <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
                  <div className="text-yellow-600 dark:text-yellow-400 mb-4">
                    <HelpCircle className="h-12 w-12 mx-auto" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    No Quiz Questions Available
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    No quiz questions found for your vocabulary. You can still study with flashcards.
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => switchStudyMode('flashcard')}
                      className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Switch to Flashcards
                    </button>
                  </div>
                </div>
              )
            )}

            {/* Help hint */}
            <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
              Press <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">?</kbd> for keyboard shortcuts
              {studyMode === 'quiz' && (
                <span className="ml-4">
                  • <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">1-4</kbd> to select options
                  • <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Space/Enter</kbd> to continue
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsHelp && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowShortcutsHelp(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Keyboard Shortcuts
              </h3>
              <button
                onClick={() => setShowShortcutsHelp(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 gap-2">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1">
                  Flashcard Mode
                </h4>
                <div className="flex justify-between">
                  <span>Flip card:</span>
                  <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Space</kbd>
                </div>
                {studyMode === 'quiz' && (
                  <div className="flex justify-between">
                    <span>Continue (after answer):</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Space/Enter</kbd>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Hard:</span>
                  <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">1</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Good:</span>
                  <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">2</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Easy:</span>
                  <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">3</kbd>
                </div>

                <h4 className="font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1 mt-4">
                  Actions
                </h4>
                <div className="flex justify-between">
                  <span>Skip card:</span>
                  <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">S</kbd>
                </div>

                <h4 className="font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-600 pb-1 mt-4">
                  General
                </h4>
                <div className="flex justify-between">
                  <span>End session:</span>
                  <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Esc</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Show shortcuts:</span>
                  <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">?</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Study;