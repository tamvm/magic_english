import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Flame,
  ArrowRight,
  BarChart3,
} from 'lucide-react';

import { useFlashcards } from '../../hooks/useFlashcards';
import LoadingSpinner from '../UI/LoadingSpinner';

const StudyCard = ({ className = '' }) => {
  const { sessionStats, loading, error, getStats } = useFlashcards();

  useEffect(() => {
    if (!sessionStats) {
      getStats();
    }
  }, []);

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <LoadingSpinner size="md" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
        <div className="text-center text-red-600 dark:text-red-400">
          <p>Failed to load study stats</p>
          <button
            onClick={() => getStats()}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mt-2"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const stats = sessionStats || {};
  const userStats = stats.userStats || {};
  const dueToday = stats.dueToday || 0;
  const currentStreak = userStats.current_streak || 0;
  const wordsM = userStats.words_mastered || 0;


  const getStreakColor = (streak) => {
    if (streak >= 30) return 'text-purple-600';
    if (streak >= 14) return 'text-blue-600';
    if (streak >= 7) return 'text-green-600';
    if (streak >= 3) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Study Progress
          </h3>
          <Link
            to="/study"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
          >
            View all
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                  Current Streak
                </p>
                <p className={`text-2xl font-bold ${getStreakColor(currentStreak)}`}>
                  {currentStreak}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">days</p>
              </div>
              <Flame className="h-8 w-8 text-orange-500" />
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  Due Today
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {dueToday}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">cards</p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-500" />
            </div>
          </div>


          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                  Mastered
                </p>
                <p className="text-2xl font-bold text-purple-600">
                  {wordsM}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">words</p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Study Button */}
        <Link
          to="/study"
          className={`w-full flex items-center justify-center px-4 py-3 rounded-lg text-white font-medium transition-colors ${
            dueToday > 0
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {dueToday > 0 ? (
            <>
              <BookOpen className="h-5 w-5 mr-2" />
              Study {dueToday} Cards
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          ) : (
            <>
              <BookOpen className="h-5 w-5 mr-2" />
              No Cards Due Today
            </>
          )}
        </Link>

        {/* Retention Rate */}
        {userStats.average_retention_rate > 0 && (
          <div className="mt-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300">Retention Rate</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {Math.round(userStats.average_retention_rate * 100)}%
              </span>
            </div>
            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round(userStats.average_retention_rate * 100)}%`,
                }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyCard;