import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Search, RefreshCw, BookOpen, Edit2, Trash2, Plus, Filter, Eye } from 'lucide-react';
import { flashcardAPI, wordsAPI } from '@/lib/api';
import { getCefrColor, getWordTypeColor, formatDate } from '@/lib/utils';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import toast from 'react-hot-toast';

const QuizQuestions = () => {
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [words, setWords] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [generating, setGenerating] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  useEffect(() => {
    loadQuizQuestions();
    loadWords();
  }, []);

  const loadQuizQuestions = async () => {
    try {
      setLoading(true);
      const response = await flashcardAPI.getAllQuizQuestions();

      // Transform the response to match component expectations
      const questions = (response.data.questions || []).map(question => ({
        ...question,
        word: question.words // The API returns word data in 'words' field
      }));

      setQuizQuestions(questions);
    } catch (error) {
      console.error('Failed to load quiz questions:', error);
      toast.error('Failed to load quiz questions');
    } finally {
      setLoading(false);
    }
  };

  const loadWords = async () => {
    try {
      const response = await wordsAPI.getWords({ limit: 1000 });
      const wordsMap = {};
      response.data.words?.forEach(word => {
        wordsMap[word.id] = word;
      });
      setWords(wordsMap);
    } catch (error) {
      console.error('Failed to load words:', error);
    }
  };

  const generateQuizQuestions = async () => {
    try {
      setGenerating(true);
      const response = await wordsAPI.generateQuizQuestions({});

      toast.success(response.data.message || 'Quiz questions generated successfully!');

      // Reload quiz questions
      await loadQuizQuestions();
    } catch (error) {
      console.error('Failed to generate quiz questions:', error);
      toast.error('Failed to generate quiz questions');
    } finally {
      setGenerating(false);
    }
  };

  const regenerateAllQuestions = async () => {
    if (!confirm('Are you sure you want to regenerate ALL quiz questions? This will delete existing questions and create new ones.')) {
      return;
    }

    try {
      setGenerating(true);
      const response = await wordsAPI.generateQuizQuestions({
        regenerateAll: true
      });

      toast.success(response.data.message || 'All quiz questions regenerated successfully!');

      // Reload quiz questions
      await loadQuizQuestions();
    } catch (error) {
      console.error('Failed to regenerate quiz questions:', error);
      toast.error('Failed to regenerate quiz questions');
    } finally {
      setGenerating(false);
    }
  };

  const getQuestionTypeLabel = (type) => {
    switch (type) {
      case 'fill_blank': return 'Fill in the Blank';
      case 'definition_choice': return 'Choose Definition';
      case 'synonym_choice': return 'Choose Synonym';
      case 'context_choice': return 'Choose Context';
      default: return type;
    }
  };

  const getQuestionTypeColor = (type) => {
    switch (type) {
      case 'fill_blank': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'definition_choice': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'synonym_choice': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'context_choice': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const filteredQuestions = useMemo(() => {
    let filtered = quizQuestions;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(q =>
        q.word?.word?.toLowerCase().includes(query) ||
        q.question_text?.toLowerCase().includes(query) ||
        q.correct_answer?.toLowerCase().includes(query)
      );
    }

    // Filter by question type
    if (filterType !== 'all') {
      filtered = filtered.filter(q => q.question_type === filterType);
    }

    return filtered;
  }, [quizQuestions, searchQuery, filterType]);

  const questionTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'fill_blank', label: 'Fill in the Blank' },
    { value: 'definition_choice', label: 'Choose Definition' },
    { value: 'synonym_choice', label: 'Choose Synonym' },
    { value: 'context_choice', label: 'Choose Context' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Quiz Questions - Magic English</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Quiz Questions
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Manage your AI-generated quiz questions for vocabulary learning
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex flex-wrap gap-3">
            <button
              onClick={generateQuizQuestions}
              disabled={generating}
              className="btn-primary"
            >
              {generating ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Generate Missing
            </button>
            <button
              onClick={regenerateAllQuestions}
              disabled={generating}
              className="btn-secondary"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate All
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="card">
          <div className="card-body">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="form-input pl-10"
                  placeholder="Search questions, words, or answers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Filter */}
              <div className="relative">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="form-input pr-10"
                >
                  {questionTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Filter className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="card-body">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {quizQuestions.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Questions
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {quizQuestions.filter(q => q.question_type === 'definition_choice').length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Definition Choice
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {quizQuestions.filter(q => q.question_type === 'synonym_choice').length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Synonym Choice
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {quizQuestions.filter(q => q.question_type === 'fill_blank').length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Fill in the Blank
              </div>
            </div>
          </div>
        </div>

        {/* Questions List */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Questions ({filteredQuestions.length})
            </h3>
          </div>
          <div className="card-body p-0">
            {filteredQuestions.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  {quizQuestions.length === 0
                    ? 'No quiz questions found. Generate some questions for your vocabulary!'
                    : 'No questions match your search criteria.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 p-4">
                {filteredQuestions.map((question) => {
                  const word = words[question.word_id];
                  const isExpanded = expandedQuestion === question.id;

                  return (
                    <div
                      key={question.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      {/* Question Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            {word && (
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {word.word}
                              </div>
                            )}
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getQuestionTypeColor(question.question_type)}`}>
                              {getQuestionTypeLabel(question.question_type)}
                            </span>
                            {word?.cefr_level && (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCefrColor(word.cefr_level)}`}>
                                {word.cefr_level}
                              </span>
                            )}
                          </div>

                          <div className="text-gray-900 dark:text-white font-medium">
                            {question.question_text}
                          </div>

                          <div className="text-sm text-green-600 dark:text-green-400">
                            <strong>Answer:</strong> {question.correct_answer}
                          </div>
                        </div>

                        <button
                          onClick={() => setExpandedQuestion(isExpanded ? null : question.id)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-4"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                          {/* Options */}
                          {question.options && question.options.length > 0 && (
                            <div>
                              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Options:
                              </div>
                              <div className="space-y-1">
                                {question.options.map((option, index) => (
                                  <div
                                    key={index}
                                    className={`text-sm p-2 rounded ${
                                      option === question.correct_answer
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                        : 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                    }`}
                                  >
                                    {index + 1}. {option}
                                    {option === question.correct_answer && (
                                      <span className="ml-2 text-green-600 font-medium">✓</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Explanation */}
                          {question.explanation && (
                            <div>
                              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Explanation:
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                                {question.explanation}
                              </div>
                            </div>
                          )}

                          {/* Word Details */}
                          {word && (
                            <div>
                              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Word Details:
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                {word.definition && (
                                  <div><strong>Definition:</strong> {word.definition}</div>
                                )}
                                {word.example_sentence && (
                                  <div><strong>Example:</strong> {word.example_sentence}</div>
                                )}
                                {word.synonyms && (
                                  <div><strong>Synonyms:</strong> {word.synonyms}</div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Metadata */}
                          <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
                            Created: {formatDate(question.created_at)}
                            {question.usage_count > 0 && (
                              <span className="ml-4">
                                Used {question.usage_count} time{question.usage_count !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default QuizQuestions;