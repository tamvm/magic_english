import React from 'react';
import {
  Volume2,
  Heart,
  Clock,
  BookOpen,
} from 'lucide-react';

const FlashCard = ({ card, isFlipped, onFlip, onRate, showRating }) => {
  if (!card || !card.words) {
    return null;
  }

  const word = card.words;
  const nextIntervals = card.nextIntervals || {};

  const getDifficultyColor = (difficulty) => {
    if (difficulty <= 3) return 'text-green-600';
    if (difficulty <= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStateColor = (state) => {
    switch (state) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'learning': return 'bg-yellow-100 text-yellow-800';
      case 'review': return 'bg-green-100 text-green-800';
      case 'relearning': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatInterval = (days) => {
    if (days < 1) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 30) return `${days}d`;
    if (days < 365) return `${Math.round(days / 30)}mo`;
    return `${Math.round(days / 365)}y`;
  };

  const pronunciationAudio = (word) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Card */}
      <div
        className={`relative w-full h-96 cursor-pointer transition-transform duration-300 transform-style-preserve-3d ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
        onClick={onFlip}
      >
        {/* Front Side */}
        <div className="absolute inset-0 w-full h-full backface-hidden">
          <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 flex flex-col justify-center items-center text-center">
            {/* Card State Badge */}
            <div className={`px-3 py-1 rounded-full text-xs font-medium mb-4 ${getStateColor(card.state)}`}>
              {card.state.toUpperCase()}
            </div>

            {/* Word */}
            <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              {word.word}
            </h2>

            {/* Pronunciation */}
            {word.ipa_pronunciation && (
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-lg text-gray-600 dark:text-gray-400">
                  /{word.ipa_pronunciation}/
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    pronunciationAudio(word.word);
                  }}
                  className="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                >
                  <Volume2 className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* Word Type */}
            {word.word_type && (
              <span className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full mb-4">
                {word.word_type}
              </span>
            )}

            {/* Progress Info */}
            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-1">
                <Heart className="h-4 w-4" />
                <span>Difficulty: <span className={getDifficultyColor(card.difficulty)}>{card.difficulty.toFixed(1)}</span></span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>Reps: {card.reps}</span>
              </div>
            </div>

            <p className="text-gray-500 dark:text-gray-400 mt-6 text-sm">
              Press Space to flip
            </p>
          </div>
        </div>

        {/* Back Side */}
        <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180">
          <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 flex flex-col justify-center">
            {/* Definition */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Definition
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {word.definition}
              </p>
            </div>

            {/* Example Sentence */}
            {word.example_sentence && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Example
                </h3>
                <p className="text-gray-700 dark:text-gray-300 italic">
                  "{word.example_sentence}"
                </p>
              </div>
            )}

            {/* Vietnamese Translation */}
            {word.vietnamese_translation && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Vietnamese
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {word.vietnamese_translation}
                </p>
              </div>
            )}

            {/* Synonyms */}
            {word.synonyms && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Synonyms
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {word.synonyms}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rating Buttons */}
      {showRating && (
        <div className="mt-6 grid grid-cols-4 gap-4">
          <button
            onClick={() => onRate(1)}
            className="bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-lg transition-colors flex flex-col items-center"
          >
            <span className="font-bold">1</span>
            <span className="text-xs">Again</span>
            {nextIntervals[1] && (
              <span className="text-xs opacity-80">{formatInterval(nextIntervals[1].interval)}</span>
            )}
          </button>

          <button
            onClick={() => onRate(2)}
            className="bg-orange-500 hover:bg-orange-600 text-white py-3 px-4 rounded-lg transition-colors flex flex-col items-center"
          >
            <span className="font-bold">2</span>
            <span className="text-xs">Hard</span>
            {nextIntervals[2] && (
              <span className="text-xs opacity-80">{formatInterval(nextIntervals[2].interval)}</span>
            )}
          </button>

          <button
            onClick={() => onRate(3)}
            className="bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg transition-colors flex flex-col items-center"
          >
            <span className="font-bold">3</span>
            <span className="text-xs">Good</span>
            {nextIntervals[3] && (
              <span className="text-xs opacity-80">{formatInterval(nextIntervals[3].interval)}</span>
            )}
          </button>

          <button
            onClick={() => onRate(4)}
            className="bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg transition-colors flex flex-col items-center"
          >
            <span className="font-bold">4</span>
            <span className="text-xs">Easy</span>
            {nextIntervals[4] && (
              <span className="text-xs opacity-80">{formatInterval(nextIntervals[4].interval)}</span>
            )}
          </button>
        </div>
      )}

      {/* CSS for 3D flip effect */}
      <style jsx>{`
        .transform-style-preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </div>
  );
};

export default FlashCard;