import React, { useState, useEffect, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { Search, Plus, Download, Upload, Sparkles, Edit2, Trash2, BookOpen } from 'lucide-react'
import { wordsAPI, aiAPI } from '@/lib/api'
import { debounce, getCefrColor, getWordTypeColor, formatDate } from '@/lib/utils'
import LoadingSpinner from '@/components/UI/LoadingSpinner'
import toast from 'react-hot-toast'

const Vocabulary = () => {
  const [words, setWords] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [newWord, setNewWord] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    loadWords()
  }, [])

  const loadWords = async () => {
    try {
      setLoading(true)
      const response = await wordsAPI.getWords()
      setWords(response.data.words || [])
    } catch (error) {
      toast.error('Failed to load vocabulary')
      console.error('Load words error:', error)
    } finally {
      setLoading(false)
    }
  }

  const analyzeWord = async () => {
    if (!newWord.trim()) {
      toast.error('Please enter a word to analyze')
      return
    }

    // Check for duplicate word
    const wordToCheck = newWord.trim().toLowerCase()
    const existingWord = words.find(word => word.word.toLowerCase() === wordToCheck)
    if (existingWord) {
      toast.error(`"${newWord.trim()}" is already in your vocabulary`)
      return
    }

    try {
      setAnalyzing(true)
      const response = await aiAPI.analyzeWord(newWord.trim(), { autoSave: true })

      if (response.data.savedWord) {
        setWords(prev => [response.data.savedWord, ...prev])
        setNewWord('')
        setShowAddForm(false)
        toast.success('Word analyzed and saved successfully!')
      }
    } catch (error) {
      toast.error('Failed to analyze word')
      console.error('Analyze word error:', error)
    } finally {
      setAnalyzing(false)
    }
  }

  const deleteWord = async (id) => {
    if (!confirm('Are you sure you want to delete this word?')) {
      return
    }

    try {
      await wordsAPI.deleteWord(id)
      setWords(prev => prev.filter(word => word.id !== id))
      toast.success('Word deleted successfully')
    } catch (error) {
      toast.error('Failed to delete word')
      console.error('Delete word error:', error)
    }
  }

  const exportWords = async () => {
    try {
      const response = await wordsAPI.bulkOperation({
        operation: 'export'
      })

      const blob = new Blob([JSON.stringify(response.data.words, null, 2)], {
        type: 'application/json'
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'vocabulary.json'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('Vocabulary exported successfully')
    } catch (error) {
      toast.error('Failed to export vocabulary')
      console.error('Export error:', error)
    }
  }

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce((query) => {
      // In a real app, this would trigger an API call
      setSearchQuery(query)
    }, 300),
    []
  )

  const filteredWords = useMemo(() => {
    if (!searchQuery) return words

    const query = searchQuery.toLowerCase()
    return words.filter(word =>
      word.word.toLowerCase().includes(query) ||
      word.definition.toLowerCase().includes(query) ||
      word.example_sentence?.toLowerCase().includes(query) ||
      word.vietnamese_translation?.toLowerCase().includes(query) ||
      word.synonyms?.toLowerCase().includes(query)
    )
  }, [words, searchQuery])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Vocabulary - Magic English</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Vocabulary
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Manage your vocabulary collection
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-3">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Word
            </button>
            <button
              onClick={exportWords}
              className="btn-secondary"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Add Word Form */}
        {showAddForm && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Add New Word with AI Analysis
              </h3>
            </div>
            <div className="card-body">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter a word to analyze..."
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && analyzeWord()}
                  />
                </div>
                <button
                  onClick={analyzeWord}
                  disabled={analyzing || !newWord.trim()}
                  className="btn-primary"
                >
                  {analyzing ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Analyze
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="card">
          <div className="card-body">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="form-input pl-10"
                placeholder="Search words..."
                onChange={(e) => debouncedSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Words List */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Words ({filteredWords.length})
            </h3>
          </div>
          <div className="card-body p-0">
            {filteredWords.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  {words.length === 0
                    ? 'No words in your vocabulary yet. Start by adding some words!'
                    : 'No words match your search.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead className="table-header">
                    <tr>
                      <th className="table-header-cell">Word</th>
                      <th className="table-header-cell">Type</th>
                      <th className="table-header-cell">CEFR</th>
                      <th className="table-header-cell">Definition</th>
                      <th className="table-header-cell">Vietnamese</th>
                      <th className="table-header-cell">Synonyms</th>
                      <th className="table-header-cell">Example</th>
                      <th className="table-header-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {filteredWords.map((word) => (
                      <tr key={word.id}>
                        <td className="table-cell">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {word.word}
                            </div>
                            {word.ipa_pronunciation && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                                /{word.ipa_pronunciation}/
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="table-cell">
                          {word.word_type && (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getWordTypeColor(word.word_type)}`}>
                              {word.word_type}
                            </span>
                          )}
                        </td>
                        <td className="table-cell">
                          {word.cefr_level && (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCefrColor(word.cefr_level)}`}>
                              {word.cefr_level}
                            </span>
                          )}
                        </td>
                        <td className="table-cell max-w-xs">
                          <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                            {word.definition}
                          </p>
                        </td>
                        <td className="table-cell max-w-xs">
                          <p className="text-sm text-gray-900 dark:text-white truncate">
                            {word.vietnamese_translation || '-'}
                          </p>
                        </td>
                        <td className="table-cell max-w-xs">
                          <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                            {word.synonyms || '-'}
                          </p>
                        </td>
                        <td className="table-cell max-w-xs">
                          <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-words">
                            {word.example_sentence}
                          </p>
                        </td>
                        <td className="table-cell">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => deleteWord(word.id)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default Vocabulary