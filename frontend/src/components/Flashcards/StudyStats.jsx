import React from 'react';
import {
  BookOpen,
  Flame,
  BarChart3,
  Trophy,
  Calendar,
} from 'lucide-react';

const StudyStats = ({ stats, className = '' }) => {
  if (!stats) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }


  const getStreakColor = (streak) => {
    if (streak >= 30) return 'text-purple-600';
    if (streak >= 14) return 'text-blue-600';
    if (streak >= 7) return 'text-green-600';
    if (streak >= 3) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const statCards = [
    {
      title: 'Current Streak',
      value: stats.userStats?.current_streak || 0,
      unit: 'days',
      icon: Flame,
      color: getStreakColor(stats.userStats?.current_streak || 0),
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    },
    {
      title: 'Cards Studied',
      value: stats.userStats?.total_cards_studied || 0,
      unit: '',
      icon: BookOpen,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      title: 'Words Mastered',
      value: stats.userStats?.words_mastered || 0,
      unit: 'words',
      icon: Trophy,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      title: 'Retention Rate',
      value: `${Math.round((stats.userStats?.average_retention_rate || 0) * 100)}%`,
      unit: '',
      icon: BarChart3,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    },
    {
      title: 'Due Today',
      value: stats.dueToday || 0,
      unit: 'cards',
      icon: Calendar,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
  ];

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
          Study Statistics
        </h3>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {statCards.map((stat, index) => (
            <div
              key={index}
              className={`${stat.bgColor} rounded-lg p-4 border border-gray-200/50 dark:border-gray-700/50`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {stat.title}
                  </p>
                  <div className="mt-1 flex items-baseline space-x-1">
                    <p className={`text-2xl font-bold ${stat.color}`}>
                      {stat.value}
                    </p>
                    {stat.unit && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {stat.unit}
                      </span>
                    )}
                  </div>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </div>
          ))}
        </div>

        {/* Card State Breakdown */}
        {stats.cardCounts && Object.keys(stats.cardCounts).length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Card States
            </h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(stats.cardCounts).map(([state, count]) => (
                <div key={state} className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {count}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                    {state}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily Goal Progress */}
        {stats.userStats?.daily_goal && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
            <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Daily Goal Progress
            </h4>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Cards studied today
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {Math.min(stats.userStats.total_cards_studied, stats.userStats.daily_goal)} / {stats.userStats.daily_goal}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    (stats.userStats.total_cards_studied / stats.userStats.daily_goal) * 100
                  )}%`,
                }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyStats;