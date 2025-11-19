import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  Info,
} from 'lucide-react';

const QuizQuestion = ({ question, onAnswer, showAnswer, onNext }) => {
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset selected answer only when question changes or when starting a new question (showAnswer becomes false)
  useEffect(() => {
    setSelectedAnswer('');
    setIsProcessing(false);
  }, [question]);

  // Reset when showAnswer becomes false (new question starts)
  useEffect(() => {
    if (!showAnswer) {
      setSelectedAnswer('');
      setIsProcessing(false);
    }
  }, [showAnswer]);

  if (!question) {
    return (
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <div className="text-center text-gray-500 dark:text-gray-400">
          Loading question...
        </div>
      </div>
    );
  }

  const handleAnswerSelect = (answer) => {
    if (showAnswer) return;

    setSelectedAnswer(answer);
    onAnswer(answer);
  };

  const isCorrect = showAnswer && selectedAnswer === question.correct_answer;
  const isIncorrect = showAnswer && selectedAnswer !== question.correct_answer;

  const getQuestionTypeLabel = (type) => {
    switch (type) {
      case 'fill_blank': return 'Fill in the Blank';
      case 'definition_choice': return 'Choose Definition';
      case 'synonym_choice': return 'Choose Synonym';
      case 'context_choice': return 'Choose Context';
      default: return 'Quiz Question';
    }
  };

  const getOptionStyle = (option) => {
    if (!showAnswer) {
      return selectedAnswer === option
        ? 'bg-blue-100 border-blue-500 text-blue-900 dark:bg-blue-900/20 dark:border-blue-400 dark:text-blue-100'
        : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700';
    }

    if (option === question.correct_answer) {
      return 'bg-green-100 border-green-500 text-green-900 dark:bg-green-900/20 dark:border-green-400 dark:text-green-100';
    }

    if (option === selectedAnswer && option !== question.correct_answer) {
      return 'bg-red-100 border-red-500 text-red-900 dark:bg-red-900/20 dark:border-red-400 dark:text-red-100';
    }

    return 'bg-gray-50 border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300';
  };

  const getOptionIcon = (option) => {
    if (!showAnswer) return null;

    if (option === question.correct_answer) {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    }

    if (option === selectedAnswer && option !== question.correct_answer) {
      return <XCircle className="h-5 w-5 text-red-600" />;
    }

    return null;
  };

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
      {/* Question Type Badge */}
      <div className="flex items-center justify-between mb-6">
        <span className="bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 px-3 py-1 rounded-full text-sm font-medium">
          {getQuestionTypeLabel(question.question_type)}
        </span>
        {question.difficulty_level && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Difficulty: {question.difficulty_level}/5
          </span>
        )}
      </div>

      {/* Question Text */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {question.question_text}
        </h2>
      </div>

      {/* Answer Options */}
      <div className="space-y-3 mb-6">
        {question.question_type === 'fill_blank' ? (
          // Fill in the blank - text input
          <div>
            <input
              type="text"
              value={selectedAnswer}
              onChange={(e) => setSelectedAnswer(e.target.value)}
              disabled={showAnswer}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type your answer here..."
              onKeyPress={(e) => {
                if (e.key === 'Enter' && selectedAnswer.trim() && !showAnswer) {
                  handleAnswerSelect(selectedAnswer.trim());
                }
              }}
            />
            {!showAnswer && (
              <button
                onClick={() => handleAnswerSelect(selectedAnswer.trim())}
                disabled={!selectedAnswer.trim()}
                className="mt-3 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Submit Answer
              </button>
            )}
          </div>
        ) : (
          // Multiple choice options
          question.options?.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswerSelect(option)}
              disabled={showAnswer}
              className={`w-full p-4 border-2 rounded-lg text-left transition-colors flex items-center justify-between ${getOptionStyle(option)}`}
            >
              <div className="flex items-center space-x-3">
                <span className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </span>
                <span>{option}</span>
              </div>
              {getOptionIcon(option)}
            </button>
          ))
        )}
      </div>

      {/* Result and Explanation */}
      {showAnswer && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          {/* Result */}
          <div className={`mb-4 p-4 rounded-lg ${
            isCorrect
              ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          }`}>
            <div className="flex items-center space-x-2 mb-2">
              {isCorrect ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              <span className="font-semibold">
                {isCorrect ? 'Correct!' : 'Incorrect'}
              </span>
            </div>

            {!isCorrect && (
              <div className="space-y-1 text-sm">
                <div>
                  <span className="font-medium">Your answer:</span> <span className="bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded">{selectedAnswer}</span>
                </div>
                <div>
                  <span className="font-medium">Correct answer:</span> <span className="bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded font-semibold">{question.correct_answer}</span>
                </div>
              </div>
            )}

            {isCorrect && (
              <div className="text-sm">
                <span className="font-medium">Your answer:</span> <span className="bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded font-semibold">{selectedAnswer}</span>
              </div>
            )}
          </div>

          {/* Explanation */}
          {question.explanation && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-2">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Explanation
                  </h4>
                  <p className="text-blue-800 dark:text-blue-200">
                    {question.explanation}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Next Button */}
          <button
            onClick={() => {
              if (isProcessing) return;
              setIsProcessing(true);
              onNext();
              // Reset processing state after a short delay to allow next question to load
              setTimeout(() => setIsProcessing(false), 300);
            }}
            disabled={isProcessing}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isProcessing ? 'Processing...' : 'Continue (Press any number key or space)'}
          </button>
        </div>
      )}

      {/* Keyboard Hints */}
      {!showAnswer && question.options && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          Press 1-{question.options.length} to select an option
        </div>
      )}
    </div>
  );
};

export default QuizQuestion;