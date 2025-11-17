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
import LoadingSpinner from '../components/UI/LoadingSpinner';
import FlashCard from '../components/Flashcards/FlashCard';

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
    loading,
    error,
    cardsRemaining
  } = useFlashcards();

  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [cardStartTime, setCardStartTime] = useState(null);
  const [showSessionEnd, setShowSessionEnd] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

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
    if (currentCard) {
      setCardStartTime(Date.now());
      setIsFlipped(false);
    }
  }, [currentCard]);

  // Keyboard shortcuts
  const handleKeyPress = useCallback((event) => {
    if (showSessionEnd) return;

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
        setIsFlipped(!isFlipped);
        break;
      case 'Digit1':
        handleCardRating(1);
        break;
      case 'Digit2':
        handleCardRating(2);
        break;
      case 'Digit3':
        handleCardRating(3);
        break;
      case 'Digit4':
        handleCardRating(4);
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
    if (!currentCard) {
      console.log('No currentCard available');
      return;
    }

    // Set cardStartTime if it doesn't exist (for immediate rating)
    const startTime = cardStartTime || Date.now();
    const responseTime = Date.now() - startTime;

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

  const handleSkipCard = () => {
    console.log('Skipping card');

    // Reset state for next card without rating
    setIsFlipped(false);
    setCardStartTime(null);
    setShowAnswer(false);

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
                <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 font-semibold">
                  <Flame className="h-4 w-4" />
                  <span>{cardsRemaining} remaining</span>
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
            <FlashCard
              card={currentCard}
              isFlipped={isFlipped}
              onFlip={() => setIsFlipped(!isFlipped)}
              onRate={handleCardRating}
              showRating={true}
            />

            {/* Help hint */}
            <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
              Press <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">?</kbd> for keyboard shortcuts
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
                <div className="flex justify-between">
                  <span>Again:</span>
                  <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">1</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Hard:</span>
                  <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">2</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Good:</span>
                  <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">3</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Easy:</span>
                  <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">4</kbd>
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