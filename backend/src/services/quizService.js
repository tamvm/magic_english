/**
 * Quiz Question Generation Service
 * Uses AI to generate various types of quiz questions for vocabulary learning
 */

import { aiService } from './aiService.js';

class QuizService {
  constructor() {
    this.questionTypes = {
      FILL_BLANK: 'fill_blank',
      DEFINITION_CHOICE: 'definition_choice',
      SYNONYM_CHOICE: 'synonym_choice',
      CONTEXT_CHOICE: 'context_choice'
    };
  }

  /**
   * Generate multiple quiz questions for a word
   * @param {Object} word - Word object from database
   * @param {Array} questionTypes - Array of question types to generate
   * @param {number} count - Number of questions per type
   * @returns {Array} Array of generated questions
   */
  async generateQuizQuestions(word, questionTypes = null, count = 1) {
    if (!word || !word.word) {
      throw new Error('Valid word object is required');
    }

    // Default to all question types if none specified
    questionTypes = questionTypes || Object.values(this.questionTypes);

    const allQuestions = [];

    for (const questionType of questionTypes) {
      try {
        for (let i = 0; i < count; i++) {
          const question = await this.generateQuestionByType(word, questionType);
          if (question) {
            allQuestions.push({
              ...question,
              word_id: word.id,
              question_type: questionType,
              difficulty_level: this.estimateQuestionDifficulty(word.cefr_level),
              created_at: new Date().toISOString()
            });
          }
        }
      } catch (error) {
        console.error(`Failed to generate ${questionType} question for word ${word.word}:`, error);
        // Continue with other question types even if one fails
      }
    }

    return allQuestions;
  }

  /**
   * Generate a specific type of question
   * @param {Object} word - Word object
   * @param {string} questionType - Type of question to generate
   * @returns {Object} Generated question
   */
  async generateQuestionByType(word, questionType) {
    switch (questionType) {
      case this.questionTypes.FILL_BLANK:
        return await this.generateFillBlankQuestion(word);
      case this.questionTypes.DEFINITION_CHOICE:
        return await this.generateDefinitionChoiceQuestion(word);
      case this.questionTypes.SYNONYM_CHOICE:
        return await this.generateSynonymChoiceQuestion(word);
      case this.questionTypes.CONTEXT_CHOICE:
        return await this.generateContextChoiceQuestion(word);
      default:
        throw new Error(`Unknown question type: ${questionType}`);
    }
  }

  /**
   * Generate fill-in-the-blank questions
   */
  async generateFillBlankQuestion(word) {
    const prompt = `Create a fill-in-the-blank question for the word "${word.word}".

Word details:
- Definition: ${word.definition}
- Type: ${word.word_type}
- Level: ${word.cefr_level}
- Example: ${word.example_sentence}
- Vietnamese: ${word.vietnamese_translation}
- Synonyms: ${word.synonyms}

Create a sentence where "${word.word}" or one of its synonyms is replaced with a blank (______).
The sentence should:
- Be natural and contextually appropriate
- Make the meaning clear enough to guess the word
- Be at an appropriate difficulty for ${word.cefr_level} level

Return JSON format:
{
  "question_text": "The sentence with ______ where the word should go",
  "correct_answer": "${word.word}",
  "explanation": "Brief explanation of why this word fits"
}

Provide only valid JSON without additional text.`;

    try {
      const response = await aiService.makeRequest('chat/completions', {
        model: aiService.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      });

      if (response.choices && response.choices[0]) {
        let content = response.choices[0].message.content.trim();
        content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Error generating fill blank question:', error);
    }

    return null;
  }

  /**
   * Generate multiple choice definition questions
   */
  async generateDefinitionChoiceQuestion(word) {
    const prompt = `Create a multiple choice question asking for the definition of "${word.word}".

Word details:
- Definition: ${word.definition}
- Type: ${word.word_type}
- Level: ${word.cefr_level}
- Vietnamese: ${word.vietnamese_translation}

Create 4 options:
- 1 correct definition (the actual definition, possibly paraphrased)
- 3 plausible distractors (wrong but believable for the word type and level)

The question should ask: "What does '${word.word}' mean?"

Return JSON format:
{
  "question_text": "What does '${word.word}' mean?",
  "correct_answer": "The correct definition",
  "options": [
    "The correct definition",
    "Distractor 1 - believable but wrong",
    "Distractor 2 - believable but wrong",
    "Distractor 3 - believable but wrong"
  ],
  "explanation": "Brief explanation of the correct meaning"
}

Ensure options are shuffled and all seem plausible. Provide only valid JSON.`;

    try {
      const response = await aiService.makeRequest('chat/completions', {
        model: aiService.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 600,
      });

      if (response.choices && response.choices[0]) {
        let content = response.choices[0].message.content.trim();
        content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
        const result = JSON.parse(content);

        // Shuffle the options
        if (result.options && Array.isArray(result.options)) {
          result.options = this.shuffleArray(result.options);
        }

        return result;
      }
    } catch (error) {
      console.error('Error generating definition choice question:', error);
    }

    return null;
  }

  /**
   * Generate synonym/meaning choice questions
   */
  async generateSynonymChoiceQuestion(word) {
    const prompt = `Create a multiple choice question asking for the best synonym or closest meaning to "${word.word}".

Word details:
- Definition: ${word.definition}
- Type: ${word.word_type}
- Level: ${word.cefr_level}
- Known synonyms: ${word.synonyms}

Create 4 options:
- 1 correct synonym or very close meaning
- 3 distractors (same word type, but different meanings)

The question should ask: "Which word is closest in meaning to '${word.word}'?"

Return JSON format:
{
  "question_text": "Which word is closest in meaning to '${word.word}'?",
  "correct_answer": "The best synonym",
  "options": [
    "The best synonym",
    "Distractor 1 - same word type, different meaning",
    "Distractor 2 - same word type, different meaning",
    "Distractor 3 - same word type, different meaning"
  ],
  "explanation": "Why this word is the closest synonym"
}

Make sure distractors are the same part of speech. Provide only valid JSON.`;

    try {
      const response = await aiService.makeRequest('chat/completions', {
        model: aiService.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 600,
      });

      if (response.choices && response.choices[0]) {
        let content = response.choices[0].message.content.trim();
        content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
        const result = JSON.parse(content);

        // Shuffle the options
        if (result.options && Array.isArray(result.options)) {
          result.options = this.shuffleArray(result.options);
        }

        return result;
      }
    } catch (error) {
      console.error('Error generating synonym choice question:', error);
    }

    return null;
  }

  /**
   * Generate context choice questions
   */
  async generateContextChoiceQuestion(word) {
    const prompt = `Create a context choice question for the word "${word.word}".

Word details:
- Definition: ${word.definition}
- Type: ${word.word_type}
- Level: ${word.cefr_level}
- Example: ${word.example_sentence}

Create 2 sentences:
- 1 where "${word.word}" fits naturally and correctly
- 1 where "${word.word}" doesn't fit well (wrong context, grammar, or meaning)

Both sentences should be at ${word.cefr_level} level and seem plausible at first glance.

Ask: "In which sentence is '${word.word}' used correctly?"

Return JSON format:
{
  "question_text": "In which sentence is '${word.word}' used correctly?",
  "correct_answer": "Sentence where the word is used correctly",
  "options": [
    "Sentence where the word is used correctly",
    "Sentence where the word is NOT used correctly"
  ],
  "explanation": "Why the correct sentence uses the word properly"
}

Provide only valid JSON without additional text.`;

    try {
      const response = await aiService.makeRequest('chat/completions', {
        model: aiService.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 600,
      });

      if (response.choices && response.choices[0]) {
        let content = response.choices[0].message.content.trim();
        content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
        const result = JSON.parse(content);

        // Shuffle the options for context questions too
        if (result.options && Array.isArray(result.options)) {
          result.options = this.shuffleArray(result.options);
        }

        return result;
      }
    } catch (error) {
      console.error('Error generating context choice question:', error);
    }

    return null;
  }

  /**
   * Generate questions for multiple words at once using efficient batching
   * @param {Array} words - Array of word objects
   * @param {Object} options - Generation options
   * @returns {Array} Array of all generated questions
   */
  async generateBatchQuestions(words, options = {}) {
    const { batchSize = 10, useLegacyMethod = false } = options;

    if (!words || !Array.isArray(words) || words.length === 0) {
      return [];
    }

    // Use legacy method if requested (for backwards compatibility)
    if (useLegacyMethod) {
      return this.generateBatchQuestionsLegacy(words, options);
    }

    const allQuestions = [];

    // Process words in batches for efficient AI requests
    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);

      try {
        console.log(`Generating quiz questions for batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(words.length/batchSize)} (${batch.length} words)`);

        const batchQuestions = await aiService.generateBatchQuizQuestions(batch);
        allQuestions.push(...batchQuestions);

        console.log(`Successfully generated ${batchQuestions.length} questions for batch`);

        // Add small delay between batches to avoid overwhelming the AI service
        if (i + batchSize < words.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Failed to generate batch questions for words ${batch.map(w => w.word).join(', ')}:`, error);

        // Fallback: try individual generation for this batch
        console.log('Falling back to individual question generation for this batch...');
        for (const word of batch) {
          try {
            const questions = await this.generateQuizQuestions(word, [this.questionTypes.DEFINITION_CHOICE], 1);
            allQuestions.push(...questions);
          } catch (individualError) {
            console.error(`Failed to generate question for word ${word.word}:`, individualError);
          }
        }
      }
    }

    return allQuestions;
  }

  /**
   * Legacy method for generating batch questions (one by one)
   * @param {Array} words - Array of word objects
   * @param {Object} options - Generation options
   * @returns {Array} Array of all generated questions
   */
  async generateBatchQuestionsLegacy(words, options = {}) {
    const {
      questionTypes = [this.questionTypes.DEFINITION_CHOICE], // Default to just one type
      questionsPerType = 1,
      maxConcurrency = 3
    } = options;

    const allQuestions = [];

    // Process words in batches to avoid overwhelming the AI service
    for (let i = 0; i < words.length; i += maxConcurrency) {
      const batch = words.slice(i, i + maxConcurrency);

      const promises = batch.map(word =>
        this.generateQuizQuestions(word, questionTypes, questionsPerType)
          .catch(error => {
            console.error(`Failed to generate questions for word ${word.word}:`, error);
            return []; // Return empty array on error
          })
      );

      const results = await Promise.all(promises);
      results.forEach(questions => allQuestions.push(...questions));

      // Add small delay between batches
      if (i + maxConcurrency < words.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return allQuestions;
  }

  /**
   * Generate and save quiz questions for words that don't have any
   * @param {Array} words - Array of word objects
   * @param {Object} supabase - Supabase client
   * @returns {Object} Results summary
   */
  async generateAndSaveQuizQuestions(words, supabase) {
    if (!words || !Array.isArray(words) || words.length === 0) {
      return { generated: 0, saved: 0, errors: 0 };
    }

    try {
      // Filter words that don't have quiz questions yet
      const { data: existingQuestions, error: queryError } = await supabase
        .from('quiz_questions')
        .select('word_id')
        .in('word_id', words.map(w => w.id));

      if (queryError) {
        throw queryError;
      }

      const existingWordIds = new Set(existingQuestions?.map(q => q.word_id) || []);
      const wordsNeedingQuestions = words.filter(word => !existingWordIds.has(word.id));

      if (wordsNeedingQuestions.length === 0) {
        return { generated: 0, saved: 0, errors: 0, message: 'All words already have quiz questions' };
      }

      console.log(`Generating quiz questions for ${wordsNeedingQuestions.length} words without questions`);

      // Generate questions in batches
      const questions = await this.generateBatchQuestions(wordsNeedingQuestions);

      if (questions.length === 0) {
        return { generated: 0, saved: 0, errors: wordsNeedingQuestions.length };
      }

      // Save questions to database
      const { data: savedQuestions, error: saveError } = await supabase
        .from('quiz_questions')
        .insert(questions)
        .select();

      if (saveError) {
        console.error('Error saving quiz questions:', saveError);
        return { generated: questions.length, saved: 0, errors: questions.length };
      }

      return {
        generated: questions.length,
        saved: savedQuestions?.length || 0,
        errors: Math.max(0, questions.length - (savedQuestions?.length || 0)),
        message: `Successfully generated and saved ${savedQuestions?.length || 0} quiz questions`
      };

    } catch (error) {
      console.error('Error in generateAndSaveQuizQuestions:', error);
      return { generated: 0, saved: 0, errors: words.length, error: error.message };
    }
  }

  /**
   * Estimate question difficulty based on word's CEFR level
   * @param {string} cefrLevel - CEFR level (A1, A2, B1, B2, C1, C2)
   * @returns {number} Difficulty level (1-5)
   */
  estimateQuestionDifficulty(cefrLevel) {
    const levelMap = {
      'A1': 1,
      'A2': 2,
      'B1': 3,
      'B2': 4,
      'C1': 5,
      'C2': 5
    };

    return levelMap[cefrLevel] || 3;
  }

  /**
   * Shuffle an array (Fisher-Yates algorithm)
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled array
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Validate a generated question
   * @param {Object} question - Question object to validate
   * @returns {boolean} True if valid
   */
  validateQuestion(question) {
    if (!question || typeof question !== 'object') {
      return false;
    }

    const required = ['question_text', 'correct_answer'];
    for (const field of required) {
      if (!question[field] || typeof question[field] !== 'string') {
        return false;
      }
    }

    // Check if multiple choice questions have options
    const multipleChoiceTypes = [
      this.questionTypes.DEFINITION_CHOICE,
      this.questionTypes.SYNONYM_CHOICE,
      this.questionTypes.CONTEXT_CHOICE
    ];

    if (multipleChoiceTypes.includes(question.question_type)) {
      if (!question.options || !Array.isArray(question.options) || question.options.length < 2) {
        return false;
      }

      // Check if correct answer is in options
      if (!question.options.includes(question.correct_answer)) {
        return false;
      }
    }

    return true;
  }
}

export const quizService = new QuizService();