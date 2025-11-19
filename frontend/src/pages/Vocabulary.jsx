import React, { useState, useEffect, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { Search, Plus, Download, Upload, Sparkles, Edit2, Trash2, BookOpen, Link, FileText, Globe, Type } from 'lucide-react'
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
  const [showContentForm, setShowContentForm] = useState(false)
  const [contentAnalysisMode, setContentAnalysisMode] = useState('url') // 'url', 'text', or 'file'
  const [contentUrl, setContentUrl] = useState('')
  const [contentText, setContentText] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [analyzingContent, setAnalyzingContent] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState({ step: 0, message: '', percentage: 0 })
  const [vocabularyResults, setVocabularyResults] = useState([])
  const [selectedWords, setSelectedWords] = useState(new Set())
  const [savingSelected, setSavingSelected] = useState(false)

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

      if (response.data.error === 'duplicate_word') {
        toast.error(response.data.message)
      } else if (response.data.savedWord) {
        setWords(prev => [response.data.savedWord, ...prev])
        setNewWord('')
        setShowAddForm(false)
        toast.success('Word analyzed and saved successfully! Quiz question is being generated in the background.')
      } else if (response.data.analysis) {
        // Word was analyzed but not saved (could be due to autoSave: false or other reasons)
        toast.success('Word analyzed successfully!')
      }
    } catch (error) {
      toast.error('Failed to analyze word')
      console.error('Analyze word error:', error)
    } finally {
      setAnalyzing(false)
    }
  }

  const analyzeContent = async () => {
    if (contentAnalysisMode === 'url' && !contentUrl.trim()) {
      toast.error('Please enter a URL to analyze')
      return
    }
    if (contentAnalysisMode === 'text' && !contentText.trim()) {
      toast.error('Please enter text content to analyze')
      return
    }
    if (contentAnalysisMode === 'file' && !selectedFile) {
      toast.error('Please select a file to analyze')
      return
    }

    try {
      setAnalyzingContent(true)
      setVocabularyResults([])
      setSelectedWords(new Set())

      const totalSteps = contentAnalysisMode === 'url' ? 8 : contentAnalysisMode === 'file' ? 7 : 6;

      // Step 1: Initialize
      setAnalysisProgress({
        step: 1,
        message: `Preparing to analyze ${contentAnalysisMode === 'url' ? 'website' : contentAnalysisMode === 'file' ? 'file' : 'text'} content...`,
        percentage: Math.round((1/totalSteps) * 100)
      })
      await new Promise(resolve => setTimeout(resolve, 800))

      const analysisData = {}
      if (contentAnalysisMode === 'url') {
        // Step 2: Starting browser
        setAnalysisProgress({
          step: 2,
          message: 'Starting browser and navigation...',
          percentage: Math.round((2/totalSteps) * 100)
        })
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Step 3: Fetching website
        setAnalysisProgress({
          step: 3,
          message: `Loading website: ${new URL(contentUrl.trim()).hostname}`,
          percentage: Math.round((3/totalSteps) * 100)
        })
        analysisData.url = contentUrl.trim()

        await new Promise(resolve => setTimeout(resolve, 1500))

        // Step 4: Extracting content
        setAnalysisProgress({
          step: 4,
          message: 'Extracting main article content...',
          percentage: Math.round((4/totalSteps) * 100)
        })
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Step 5: Processing content
        setAnalysisProgress({
          step: 5,
          message: 'Processing extracted text...',
          percentage: Math.round((5/totalSteps) * 100)
        })
        await new Promise(resolve => setTimeout(resolve, 800))
      } else if (contentAnalysisMode === 'file') {
        // Step 2: Upload file
        setAnalysisProgress({
          step: 2,
          message: 'Uploading file to server...',
          percentage: Math.round((2/totalSteps) * 100)
        })
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Step 3: Processing file
        setAnalysisProgress({
          step: 3,
          message: `Processing ${selectedFile.name}...`,
          percentage: Math.round((3/totalSteps) * 100)
        })
        await new Promise(resolve => setTimeout(resolve, 800))

        // Step 4: Extracting content
        setAnalysisProgress({
          step: 4,
          message: 'Extracting text from file...',
          percentage: Math.round((4/totalSteps) * 100)
        })

        // Create FormData for file upload
        const formData = new FormData()
        formData.append('file', selectedFile)
        analysisData.file = formData

        await new Promise(resolve => setTimeout(resolve, 1000))

        // Step 5: Preparing content
        setAnalysisProgress({
          step: 5,
          message: 'Preparing content for analysis...',
          percentage: Math.round((5/totalSteps) * 100)
        })
        await new Promise(resolve => setTimeout(resolve, 600))
      } else {
        // Step 2: Processing text content
        setAnalysisProgress({
          step: 2,
          message: 'Validating text content...',
          percentage: Math.round((2/totalSteps) * 100)
        })
        analysisData.text = contentText.trim()
        await new Promise(resolve => setTimeout(resolve, 800))

        // Step 3: Preparing content
        setAnalysisProgress({
          step: 3,
          message: 'Preparing content for analysis...',
          percentage: Math.round((3/totalSteps) * 100)
        })
        await new Promise(resolve => setTimeout(resolve, 600))
      }

      // AI Analysis Step
      const aiStepNumber = contentAnalysisMode === 'url' ? 6 : contentAnalysisMode === 'file' ? 6 : 4;
      setAnalysisProgress({
        step: aiStepNumber,
        message: 'AI analyzing vocabulary for your level...',
        percentage: Math.round((aiStepNumber/totalSteps) * 100)
      })

      const response = await aiAPI.analyzeContent(analysisData)

      // Step: Processing AI results
      const resultStepNumber = contentAnalysisMode === 'url' ? 7 : contentAnalysisMode === 'file' ? 7 : 5;
      setAnalysisProgress({
        step: resultStepNumber,
        message: 'Processing AI analysis results...',
        percentage: Math.round((resultStepNumber/totalSteps) * 100)
      })
      await new Promise(resolve => setTimeout(resolve, 700))

      // Final step
      setAnalysisProgress({
        step: totalSteps,
        message: 'Analysis complete! 🎉',
        percentage: 100
      })

      if (response.data.vocabulary && response.data.vocabulary.length > 0) {
        setVocabularyResults(response.data.vocabulary)
        toast.success(response.data.message || `Found ${response.data.vocabulary.length} vocabulary items`)
      } else {
        setVocabularyResults([])
        toast.info(response.data.message || 'No new vocabulary found')
      }
    } catch (error) {
      setAnalysisProgress({ step: 0, message: 'Analysis failed', percentage: 0 })

      // Provide user-friendly error messages
      let errorMessage = 'Failed to analyze content'
      if (error.message.includes('timeout')) {
        errorMessage = 'Analysis timed out. The website might be taking too long to load. Please try again or use "From Text" mode instead.'
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Network connection issue. Please check your internet connection and try again.'
      } else if (error.message.includes('blocked')) {
        errorMessage = 'The website is blocking automated access. Try copying the text and using "From Text" mode instead.'
      } else if (error.message.includes('AI service unavailable')) {
        errorMessage = 'AI service is temporarily unavailable. Please try again in a few moments.'
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error occurred. Please try again or contact support if the issue persists.'
      }

      toast.error(errorMessage)
      console.error('Content analysis error:', error)
    } finally {
      setAnalyzingContent(false)
      // Reset progress after a short delay
      setTimeout(() => {
        setAnalysisProgress({ step: 0, message: '', percentage: 0 })
      }, 2000)
    }
  }

  const toggleWordSelection = (index) => {
    const newSelectedWords = new Set(selectedWords)
    if (newSelectedWords.has(index)) {
      newSelectedWords.delete(index)
    } else {
      newSelectedWords.add(index)
    }
    setSelectedWords(newSelectedWords)
  }

  const selectAllWords = () => {
    if (selectedWords.size === vocabularyResults.length) {
      setSelectedWords(new Set())
    } else {
      setSelectedWords(new Set(vocabularyResults.map((_, index) => index)))
    }
  }

  const saveSelectedWords = async () => {
    if (selectedWords.size === 0) {
      toast.error('Please select at least one word to save')
      return
    }

    const wordsToSave = Array.from(selectedWords).map(index => {
      const item = vocabularyResults[index]
      return {
        word: item.word,
        definition: item.definition,
        wordType: item.wordType,
        cefrLevel: item.cefrLevel,
        ipaPronunciation: item.ipaPronunciation,
        exampleSentence: item.exampleSentence,
        notes: item.notes,
        tags: item.tags || [],
        vietnameseTranslation: item.vietnameseTranslation,
        synonyms: item.synonyms
      }
    })

    try {
      setSavingSelected(true)

      const response = await wordsAPI.bulkOperation({
        operation: 'import',
        words: wordsToSave
      })

      if (response.data.words) {
        setWords(prev => [...response.data.words, ...prev])
        toast.success(`${response.data.words.length} words saved successfully! Quiz questions are being generated in the background.`)

        // Clear the content form and results
        setShowContentForm(false)
        setContentUrl('')
        setContentText('')
        setSelectedFile(null)
        setVocabularyResults([])
        setSelectedWords(new Set())
      }
    } catch (error) {
      toast.error('Failed to save selected words')
      console.error('Save selected words error:', error)
    } finally {
      setSavingSelected(false)
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
          <div className="mt-4 sm:mt-0 flex flex-wrap gap-3">
            <button
              onClick={() => {
                setShowAddForm(!showAddForm)
                setShowContentForm(false)
              }}
              className="btn-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Word
            </button>
            <button
              onClick={() => {
                setShowContentForm(!showContentForm)
                setShowAddForm(false)
              }}
              className="btn-primary"
            >
              <Globe className="h-4 w-4 mr-2" />
              Add from Content
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

        {/* Content Analysis Form */}
        {showContentForm && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Analyze Content for Vocabulary
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Extract vocabulary from websites or text based on your English level
              </p>
            </div>
            <div className="card-body space-y-4">
              {/* Mode Selection */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => {
                    setContentAnalysisMode('url')
                    setContentText('')
                    setSelectedFile(null)
                  }}
                  className={`flex items-center justify-center p-3 rounded-lg border-2 transition-all ${
                    contentAnalysisMode === 'url'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Link className="h-4 w-4 mr-2" />
                  From URL
                </button>
                <button
                  onClick={() => {
                    setContentAnalysisMode('text')
                    setContentUrl('')
                    setSelectedFile(null)
                  }}
                  className={`flex items-center justify-center p-3 rounded-lg border-2 transition-all ${
                    contentAnalysisMode === 'text'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Type className="h-4 w-4 mr-2" />
                  From Text
                </button>
                <button
                  onClick={() => {
                    setContentAnalysisMode('file')
                    setContentUrl('')
                    setContentText('')
                  }}
                  className={`flex items-center justify-center p-3 rounded-lg border-2 transition-all ${
                    contentAnalysisMode === 'file'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  From File
                </button>
              </div>

              {/* Input Fields */}
              <div className="space-y-4">
                {contentAnalysisMode === 'url' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Website URL
                    </label>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://example.com/article"
                      value={contentUrl}
                      onChange={(e) => setContentUrl(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && analyzeContent()}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Enter a URL to extract and analyze vocabulary from the main content
                    </p>
                  </div>
                )}

                {contentAnalysisMode === 'text' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Text Content
                    </label>
                    <textarea
                      className="form-input min-h-[120px]"
                      placeholder="Paste your text content here..."
                      value={contentText}
                      onChange={(e) => setContentText(e.target.value)}
                      rows={6}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Paste any English text to extract vocabulary suitable for your level
                    </p>
                  </div>
                )}

                {contentAnalysisMode === 'file' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Upload File
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".txt,.pdf,.docx"
                        onChange={(e) => {
                          const file = e.target.files[0]
                          if (file) {
                            // Check file size (5MB limit)
                            const maxSize = 5 * 1024 * 1024 // 5MB in bytes
                            if (file.size > maxSize) {
                              toast.error('File size must be less than 5MB')
                              e.target.value = ''
                              return
                            }
                            setSelectedFile(file)
                          } else {
                            setSelectedFile(null)
                          }
                        }}
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                          selectedFile
                            ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700'
                            : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          {selectedFile ? (
                            <>
                              <FileText className="w-8 h-8 mb-2 text-green-500" />
                              <p className="mb-1 text-sm text-green-700 dark:text-green-300 font-medium">
                                {selectedFile.name}
                              </p>
                              <p className="text-xs text-green-600 dark:text-green-400">
                                {(selectedFile.size / 1024).toFixed(1)} KB • Click to change
                              </p>
                            </>
                          ) : (
                            <>
                              <Upload className="w-8 h-8 mb-2 text-gray-400" />
                              <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
                                <span className="font-semibold">Click to upload</span> or drag and drop
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                TXT, PDF, DOCX (max 5MB)
                              </p>
                            </>
                          )}
                        </div>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Upload a document to extract vocabulary suitable for your level
                    </p>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {analyzingContent && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                      Step {analysisProgress.step}/{contentAnalysisMode === 'url' ? '8' : contentAnalysisMode === 'file' ? '7' : '6'}: {analysisProgress.message}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold text-lg">
                      {analysisProgress.percentage}%
                    </span>
                  </div>
                  <div className="relative">
                    <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden"
                        style={{ width: `${analysisProgress.percentage}%` }}
                      >
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                      </div>
                    </div>

                    {/* Step indicators */}
                    <div className="flex justify-between mt-2">
                      {Array.from({ length: contentAnalysisMode === 'url' ? 8 : contentAnalysisMode === 'file' ? 7 : 6 }, (_, i) => (
                        <div
                          key={i}
                          className={`h-2 w-2 rounded-full transition-all duration-300 ${
                            i + 1 <= analysisProgress.step
                              ? 'bg-blue-500 scale-110'
                              : i + 1 === analysisProgress.step + 1
                              ? 'bg-blue-300 animate-pulse'
                              : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-center space-x-3 text-sm">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-bounce"></div>
                      <div className="h-2 w-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                      <div className="h-2 w-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                    </div>
                    <span className="text-gray-600 dark:text-gray-300 font-medium">
                      Analyzing content with AI...
                    </span>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="flex justify-end">
                <button
                  onClick={analyzeContent}
                  disabled={
                    analyzingContent ||
                    (contentAnalysisMode === 'url' && !contentUrl.trim()) ||
                    (contentAnalysisMode === 'text' && !contentText.trim()) ||
                    (contentAnalysisMode === 'file' && !selectedFile)
                  }
                  className="btn-primary"
                >
                  {!analyzingContent && (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {analyzingContent ? 'Analyzing...' : 'Analyze Content'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vocabulary Results */}
        {vocabularyResults.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-4 duration-300">
              <div className="card-header bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-white bg-opacity-20 p-2 rounded-full">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">
                        🎉 Found {vocabularyResults.length} New Vocabulary Items!
                      </h3>
                      <p className="text-blue-100 text-sm">
                        Select the words you want to add to your vocabulary collection
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setVocabularyResults([])
                      setSelectedWords(new Set())
                    }}
                    className="text-white hover:text-gray-200 p-2"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="bg-blue-100 dark:bg-blue-800 px-4 py-2 rounded-full">
                      <span className="text-blue-800 dark:text-blue-200 font-medium">
                        {selectedWords.size} selected
                      </span>
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 text-sm">
                      Choose vocabulary that matches your learning goals
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={selectAllWords}
                      className="btn-secondary bg-white shadow-md"
                    >
                      {selectedWords.size === vocabularyResults.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <button
                      onClick={saveSelectedWords}
                      disabled={selectedWords.size === 0 || savingSelected}
                      className="btn-primary shadow-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    >
                      {savingSelected ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <BookOpen className="h-4 w-4 mr-2" />
                          Save Selected ({selectedWords.size})
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="table">
                  <thead className="table-header">
                    <tr>
                      <th className="table-header-cell w-12">
                        <input
                          type="checkbox"
                          checked={selectedWords.size === vocabularyResults.length && vocabularyResults.length > 0}
                          onChange={selectAllWords}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="table-header-cell">Word</th>
                      <th className="table-header-cell">Type</th>
                      <th className="table-header-cell">CEFR</th>
                      <th className="table-header-cell">Definition</th>
                      <th className="table-header-cell">Vietnamese</th>
                      <th className="table-header-cell">Example</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {vocabularyResults.map((item, index) => (
                      <tr key={index} className={selectedWords.has(index) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
                        <td className="table-cell">
                          <input
                            type="checkbox"
                            checked={selectedWords.has(index)}
                            onChange={() => toggleWordSelection(index)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="table-cell">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {item.word}
                            </div>
                            {item.ipaPronunciation && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                                /{item.ipaPronunciation}/
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="table-cell">
                          {item.wordType && (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getWordTypeColor(item.wordType)}`}>
                              {item.wordType}
                            </span>
                          )}
                        </td>
                        <td className="table-cell">
                          {item.cefrLevel && (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCefrColor(item.cefrLevel)}`}>
                              {item.cefrLevel}
                            </span>
                          )}
                        </td>
                        <td className="table-cell max-w-xs">
                          <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                            {item.definition}
                          </p>
                        </td>
                        <td className="table-cell max-w-xs">
                          <p className="text-sm text-gray-900 dark:text-white break-words">
                            {item.vietnameseTranslation || '-'}
                          </p>
                        </td>
                        <td className="table-cell max-w-xs">
                          <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-words">
                            {item.exampleSentence || '-'}
                          </p>
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                  </div>
                </div>
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