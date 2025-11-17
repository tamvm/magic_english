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
  RotateCcw,
} from 'lucide-react';

import { useFlashcards } from '../hooks/useFlashcards';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import FlashCard from '../components/Flashcards/FlashCard';
import QuizQuestion from '../components/Flashcards/QuizQuestion';
import StudyStats from '../components/Flashcards/StudyStats';

const Study = () => {
  const navigate = useNavigate();
  const {
    dueCards,
    currentCard,
    sessionStats,
    reviewCard,
    startSession,
    endSession,
    getQuizQuestions,
    submitQuizAnswer,
    loading,
    error
  } = useFlashcards();

  const [studyMode, setStudyMode] = useState('flashcard'); // 'flashcard' or 'quiz'
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [cardStartTime, setCardStartTime] = useState(null);
  const [showSessionEnd, setShowSessionEnd] = useState(false);

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
    startSession();
    setSessionStartTime(Date.now());
    return () => {
      if (sessionStartTime) {
        handleEndSession();
      }
    };
  }, []);

  // Set card start time when new card appears
  useEffect(() => {
    if (currentCard && !cardStartTime) {
      setCardStartTime(Date.now());
      setIsFlipped(false);
      setShowAnswer(false);
    }
  }, [currentCard]);

  // Keyboard shortcuts
  const handleKeyPress = useCallback((event) => {
    if (showSessionEnd) return;

    // Prevent default for all our shortcuts
    const shortcuts = ['Space', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyF', 'KeyQ', 'Escape'];
    if (shortcuts.includes(event.code)) {
      event.preventDefault();
    }

    if (studyMode === 'flashcard') {
      switch (event.code) {
        case 'Space':
          if (!isFlipped) {
            setIsFlipped(true);
          }
          break;
        case 'Digit1':
          if (isFlipped) handleCardRating(1);
          break;
        case 'Digit2':
          if (isFlipped) handleCardRating(2);
          break;
        case 'Digit3':
          if (isFlipped) handleCardRating(3);
          break;
        case 'Digit4':
          if (isFlipped) handleCardRating(4);
          break;
        case 'KeyF':
          setIsFlipped(!isFlipped);
          break;
        case 'KeyQ':
          handleSwitchMode();
          break;
        case 'Escape':
          handleEndSession();
          break;
      }
    } else if (studyMode === 'quiz') {
      switch (event.code) {
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Digit4':
          if (currentQuiz && !showAnswer) {
            const optionIndex = parseInt(event.code.slice(-1)) - 1;
            if (currentQuiz.options && optionIndex < currentQuiz.options.length) {
              handleQuizAnswer(currentQuiz.options[optionIndex]);
            }
          } else if (showAnswer) {
            handleNextCard();
          }
          break;
        case 'KeyF':
          setStudyMode('flashcard');
          break;
        case 'Escape':
          handleEndSession();
          break;
      }
    }
  }, [isFlipped, studyMode, currentQuiz, showAnswer, showSessionEnd]);

  useKeyboardShortcuts(handleKeyPress);

  const handleCardRating = async (rating) => {
    if (!currentCard || !cardStartTime) return;

    const responseTime = Date.now() - cardStartTime;

    try {
      await reviewCard(currentCard.id, rating, responseTime);

      // Update stats
      setStudyStats(prev => ({
        ...prev,
        cardsStudied: prev.cardsStudied + 1,
        totalAnswers: prev.totalAnswers + 1,
        correctAnswers: prev.correctAnswers + (rating >= 3 ? 1 : 0),
        newCards: prev.newCards + (currentCard.state === 'new' ? 1 : 0),
        reviewCards: prev.reviewCards + (currentCard.state !== 'new' ? 1 : 0),
      }));

      // Reset for next card
      setIsFlipped(false);
      setCardStartTime(null);
      setShowAnswer(false);

    } catch (error) {
      console.error('Failed to review card:', error);
    }
  };

  const handleSwitchMode = async () => {
    if (!currentCard) return;

    if (studyMode === 'flashcard') {
      // Switch to quiz mode
      try {
        const questions = await getQuizQuestions(currentCard.id);
        if (questions.length > 0) {
          setCurrentQuiz(questions[0]);
          setStudyMode('quiz');
          setShowAnswer(false);
          setCardStartTime(Date.now());
        }
      } catch (error) {
        console.error('Failed to get quiz questions:', error);
      }
    } else {
      // Switch to flashcard mode
      setStudyMode('flashcard');
      setCurrentQuiz(null);
      setIsFlipped(false);
      setShowAnswer(false);
    }
  };

  const handleQuizAnswer = async (answer) => {
    if (!currentQuiz || !currentCard || !cardStartTime) return;

    const responseTime = Date.now() - cardStartTime;

    try {
      const result = await submitQuizAnswer(currentQuiz.id, answer, responseTime, currentCard.id);

      setShowAnswer(true);

      // Update stats
      setStudyStats(prev => ({
        ...prev,
        totalAnswers: prev.totalAnswers + 1,
        correctAnswers: prev.correctAnswers + (result.isCorrect ? 1 : 0),
      }));

    } catch (error) {
      console.error('Failed to submit quiz answer:', error);
    }
  };

  const handleNextCard = () => {
    setStudyMode('flashcard');
    setCurrentQuiz(null);
    setIsFlipped(false);
    setShowAnswer(false);
    setCardStartTime(null);
  };

  const handleEndSession = async () => {
    if (!sessionStartTime) return;

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

      setShowSessionEnd(true);
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  // Show session end screen
  if (showSessionEnd) {
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

  // No cards available
  if (!loading && (!dueCards || dueCards.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
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
    );
  }

  if (loading || !currentCard) {
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
              <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center space-x-1">
                  <BookOpen className="h-4 w-4" />
                  <span>{studyStats.cardsStudied}</span>
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
                onClick={handleSwitchMode}
                className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                title={studyMode === 'flashcard' ? 'Switch to Quiz (Q)' : 'Switch to Flashcard (F)'}
              >
                <RotateCcw className="h-5 w-5" />
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
                showRating={isFlipped}
              />
            ) : (
              <QuizQuestion
                question={currentQuiz}
                onAnswer={handleQuizAnswer}
                showAnswer={showAnswer}
                onNext={handleNextCard}
              />
            )}

            {/* Keyboard Shortcuts Help */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-3">Keyboard Shortcuts</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="flex justify-between">
                    <span>Flip card:</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Space</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Again:</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">1</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Hard:</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">2</kbd>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between">
                    <span>Good:</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">3</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Easy:</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">4</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Quiz mode:</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Q</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Study;