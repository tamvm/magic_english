import https from 'https';
import http from 'http';

class AIService {
  constructor() {
    this.providers = {
      'ollama-cloud': {
        baseUrl: 'https://api.ollama.cloud/v1',
        defaultModel: 'gpt-oss:20b-cloud',
      },
      'openai': {
        baseUrl: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o-mini',
      },
      'ollama-local': {
        baseUrl: 'http://localhost:11434',
        defaultModel: 'llama3.2:latest',
      },
    };

    this.config = {
      provider: process.env.AI_PROVIDER || 'openai',
      apiKey: process.env.AI_API_KEY || '',
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      localHost: process.env.OLLAMA_LOCAL_HOST || 'http://localhost:11434',
    };
  }

  async httpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const req = protocol.request(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 90000, // Increased to 90 seconds for AI requests
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            text: () => Promise.resolve(data),
            json: () => Promise.resolve(JSON.parse(data)),
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  async analyzeWord(word) {
    if (!word || typeof word !== 'string') {
      throw new Error('Word must be a non-empty string');
    }

    const prompt = `Analyze the English word "${word}" and provide a comprehensive analysis in the following JSON format:

{
  "word": "${word}",
  "definition": "Clear, concise definition",
  "wordType": "noun/verb/adjective/adverb/etc",
  "cefrLevel": "A1/A2/B1/B2/C1/C2",
  "ipaPronunciation": "IPA pronunciation",
  "exampleSentence": "Example sentence using the word",
  "notes": "Additional notes about usage, etymology, or context",
  "tags": ["tag1", "tag2"],
  "vietnameseTranslation": "Vietnamese translation of the word",
  "synonyms": "Comma-separated list of synonym words or phrases"
}

Ensure the response is valid JSON only, without any additional text or explanations.`;

    try {
      const response = await this.makeRequest('chat/completions', {
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      if (response.choices && response.choices[0]) {
        let content = response.choices[0].message.content;

        // Clean up the response - remove markdown code blocks if present
        content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();

        try {
          return JSON.parse(content);
        } catch (parseError) {
          console.error('Failed to parse AI response:', content);
          throw new Error('Invalid AI response format');
        }
      }

      throw new Error('No response from AI service');
    } catch (error) {
      console.error('AI word analysis error:', error);

      // Provide a basic fallback response when AI service is unavailable
      return {
        word: word,
        definition: "Unable to provide definition - AI service unavailable",
        wordType: "unknown",
        cefrLevel: "Unknown",
        ipaPronunciation: "",
        exampleSentence: `Example sentence with "${word}".`,
        notes: "AI analysis temporarily unavailable. Please check your AI service configuration.",
        tags: ["fallback"],
        vietnameseTranslation: "",
        synonyms: ""
      };
    }
  }

  async analyzeWebsiteContent(content, userCefrLevel = 'B2', options = {}) {
    const { limit = 20 } = options;

    if (!content || typeof content !== 'string') {
      throw new Error('Content must be a non-empty string');
    }

    const prompt = `You are an experienced English teacher.
My English level: ${userCefrLevel} (CEFR).
Analyze the content below and extract terms or expressions I probably don't know, to help me expand my English vocabulary.

🎯 Extraction Rules
Include: idioms, phrasal verbs, advanced/uncommon vocabulary, cultural references, technical terms
Exclude: proper names (people, places, brands, organizations)

✅ Focus on quality over quantity — include only useful and memorable items.
🪄 Make translations natural in Vietnamese, and sentences practical for memory.
🔤 Use standard British IPA transcription (e.g., /ˈvɒk.jʊ.lə.ri/).

Content to analyze:
"""
${content.substring(0, 8000)} ${content.length > 8000 ? '...' : ''}
"""

Return a JSON array of vocabulary items (maximum ${limit} items), each with:
{
  "word": "vocabulary item or phrase",
  "definition": "clear English definition",
  "wordType": "noun/verb/adjective/phrase/idiom/etc",
  "cefrLevel": "estimated CEFR level (A1-C2)",
  "ipaPronunciation": "British IPA pronunciation",
  "exampleSentence": "natural example sentence for memorization",
  "vietnameseTranslation": "natural Vietnamese translation",
  "synonyms": "comma-separated list of synonyms",
  "notes": "usage notes or cultural context if relevant",
  "tags": ["tag1", "tag2"]
}

Provide only valid JSON array without additional text. Focus on words that are challenging but learnable for a ${userCefrLevel} level student.`;

    try {
      const response = await this.makeRequest('chat/completions', {
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }, {
        timeout: 120000, // 2 minutes timeout for website analysis
      });

      if (response.choices && response.choices[0]) {
        let content = response.choices[0].message.content;

        // Clean up the response - remove markdown code blocks if present
        content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();

        try {
          const vocabulary = JSON.parse(content);

          // Validate that it's an array
          if (!Array.isArray(vocabulary)) {
            throw new Error('Response is not an array');
          }

          // Validate each item and apply limits
          const validatedVocabulary = vocabulary
            .slice(0, limit)
            .map(item => ({
              word: item.word || '',
              definition: item.definition || '',
              wordType: item.wordType || 'unknown',
              cefrLevel: item.cefrLevel || 'B2',
              ipaPronunciation: item.ipaPronunciation || '',
              exampleSentence: item.exampleSentence || '',
              vietnameseTranslation: item.vietnameseTranslation || '',
              synonyms: item.synonyms || '',
              notes: item.notes || '',
              tags: Array.isArray(item.tags) ? item.tags : []
            }))
            .filter(item => item.word && item.definition);

          return validatedVocabulary;
        } catch (parseError) {
          console.error('Failed to parse AI response:', content);
          throw new Error('Invalid AI response format');
        }
      }

      throw new Error('No response from AI service');
    } catch (error) {
      console.error('AI website content analysis error:', error);
      throw new Error(`Website analysis failed: ${error.message}`);
    }
  }

  async analyzeSentence(sentence) {
    if (!sentence || typeof sentence !== 'string') {
      throw new Error('Sentence must be a non-empty string');
    }

    const prompt = `Analyze and score the following English sentence: "${sentence}"

Provide a comprehensive analysis in JSON format:

{
  "sentence": "${sentence}",
  "overallScore": 85,
  "grammar": {
    "score": 90,
    "issues": ["List any grammar issues"],
    "suggestions": ["Suggestions for improvement"]
  },
  "vocabulary": {
    "score": 80,
    "level": "B2",
    "complexWords": ["word1", "word2"],
    "suggestions": ["Vocabulary improvement suggestions"]
  },
  "style": {
    "score": 85,
    "clarity": "Good/Fair/Poor",
    "formality": "Formal/Informal/Neutral",
    "suggestions": ["Style improvement suggestions"]
  },
  "corrections": [
    {
      "original": "original phrase",
      "corrected": "corrected phrase",
      "reason": "explanation"
    }
  ],
  "feedback": "Overall feedback and encouragement"
}

Provide only valid JSON without additional text.`;

    try {
      const response = await this.makeRequest('chat/completions', {
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      });

      if (response.choices && response.choices[0]) {
        let content = response.choices[0].message.content;

        // Clean up the response - remove markdown code blocks if present
        content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();

        try {
          return JSON.parse(content);
        } catch (parseError) {
          console.error('Failed to parse AI response:', content);
          throw new Error('Invalid AI response format');
        }
      }

      throw new Error('No response from AI service');
    } catch (error) {
      console.error('AI sentence analysis error:', error);
      throw new Error('AI service unavailable');
    }
  }

  async chat(message, options = {}) {
    if (!message || typeof message !== 'string') {
      throw new Error('Message must be a non-empty string');
    }

    const systemPrompt = `You are an AI assistant specialized in English language learning. Help users with vocabulary, grammar, pronunciation, and general English language questions. Be encouraging, informative, and provide practical examples.`;

    try {
      const response = await this.makeRequest('chat/completions', {
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: message,
          },
        ],
        temperature: 0.8,
        max_tokens: 2000,
      });

      if (response.choices && response.choices[0]) {
        return {
          message: response.choices[0].message.content,
          conversationId: options.conversationId || this.generateId(),
          timestamp: new Date().toISOString(),
        };
      }

      throw new Error('No response from AI service');
    } catch (error) {
      console.error('AI chat error:', error);
      throw new Error('AI service unavailable');
    }
  }

  async chatStream(message, options = {}) {
    if (!message || typeof message !== 'string') {
      throw new Error('Message must be a non-empty string');
    }

    const systemPrompt = `You are an AI assistant specialized in English language learning. Help users with vocabulary, grammar, pronunciation, and general English language questions. Be encouraging, informative, and provide practical examples.`;

    const responseId = this.generateId();
    const conversationId = options.conversationId || this.generateId();

    if (options.onChunk) {
      options.onChunk({
        type: 'start',
        responseId,
        conversationId,
      });
    }

    try {
      // Note: This is a simplified streaming implementation
      // In a real implementation, you'd use the streaming endpoints of your AI provider
      const response = await this.makeRequest('chat/completions', {
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: message,
          },
        ],
        temperature: 0.8,
        max_tokens: 2000,
        stream: false, // For now, simulate streaming
      });

      if (response.choices && response.choices[0]) {
        const content = response.choices[0].message.content;

        // Simulate streaming by breaking content into chunks
        const words = content.split(' ');
        for (let i = 0; i < words.length; i += 5) {
          const chunk = words.slice(i, i + 5).join(' ');
          if (options.onChunk) {
            options.onChunk({
              type: 'chunk',
              content: chunk + (i + 5 < words.length ? ' ' : ''),
              responseId,
            });
          }
          // Add small delay to simulate real streaming
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      return {
        responseId,
        conversationId,
      };
    } catch (error) {
      console.error('AI chat stream error:', error);
      throw new Error('AI service unavailable');
    }
  }

  async makeRequest(endpoint, data, options = {}) {
    const provider = this.providers[this.config.provider];
    if (!provider) {
      throw new Error(`Unknown AI provider: ${this.config.provider}`);
    }

    const url = `${provider.baseUrl}/${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
    };

    // Add authentication based on provider
    if (this.config.provider === 'ollama-cloud' || this.config.provider === 'openai') {
      if (!this.config.apiKey) {
        throw new Error('API key is required for this provider');
      }
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    // Use extended timeout for complex operations like website analysis
    const timeout = options.timeout || 30000;

    const response = await this.httpRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      timeout,
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`AI service error: ${response.status} ${errorData}`);
    }

    return await response.json();
  }

  async testConnection() {
    try {
      const provider = this.providers[this.config.provider];
      if (!provider) {
        return {
          success: false,
          message: `Unknown provider: ${this.config.provider}`,
        };
      }

      let testEndpoint;
      const headers = {};

      if (this.config.provider === 'ollama-local') {
        testEndpoint = `${provider.baseUrl}/api/tags`;
      } else {
        testEndpoint = `${provider.baseUrl}/models`;
        if (!this.config.apiKey) {
          return {
            success: false,
            message: 'API key is required',
          };
        }
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await this.httpRequest(testEndpoint, {
        headers,
        timeout: 10000,
      });

      if (response.ok) {
        return {
          success: true,
          message: 'Connection successful',
          provider: this.config.provider,
          model: this.config.model,
        };
      } else {
        return {
          success: false,
          message: `Connection failed: ${response.status}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  getConfig() {
    return {
      provider: this.config.provider,
      model: this.config.model,
      available: !!this.config.apiKey || this.config.provider === 'ollama-local',
    };
  }

  async generateBatchQuizQuestions(words) {
    if (!words || !Array.isArray(words) || words.length === 0) {
      throw new Error('Words array must be a non-empty array');
    }

    const prompt = `Generate quiz questions for the following English words. For each word, create exactly ONE quiz question of a randomly chosen type from: fill_blank, definition_choice, synonym_choice, or context_choice.

Words to generate questions for:
${words.map((word, index) => `${index + 1}. "${word.word}"
   - Definition: ${word.definition}
   - Type: ${word.word_type || 'unknown'}
   - Level: ${word.cefr_level || 'B2'}
   - Example: ${word.example_sentence || ''}
   - Vietnamese: ${word.vietnamese_translation || ''}
   - Synonyms: ${word.synonyms || ''}`).join('\n\n')}

For each word, create one quiz question following these guidelines:
- fill_blank: Create a sentence with a blank where the word should go
- definition_choice: Ask "What does [word] mean?" with 4 definition options
- synonym_choice: Ask "Which word is closest in meaning to [word]?" with 4 word options
- context_choice: Ask "In which sentence is [word] used correctly?" with 2 sentence options
- All multiple choice questions should have exactly 4 options (except context_choice which has 2)
- Difficulty should match the word's CEFR level
- Options should be plausible distractors

Return a JSON array with one question per word:
[
  {
    "word_id": "${words[0]?.id || 'word1'}",
    "question_type": "fill_blank|definition_choice|synonym_choice|context_choice",
    "question_text": "Question text here",
    "correct_answer": "Correct answer",
    "options": ["option1", "option2", "option3", "option4"],
    "explanation": "Brief explanation of the correct answer"
  }
]

For fill_blank questions, use empty array for options: "options": []
For context_choice questions, use exactly 2 sentence options: "options": ["correct sentence", "incorrect sentence"]

Provide only valid JSON array without additional text.`;

    try {
      const response = await this.makeRequest('chat/completions', {
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }, {
        timeout: 60000, // 60 seconds timeout for batch processing
      });

      if (response.choices && response.choices[0]) {
        let content = response.choices[0].message.content;

        // Clean up the response - remove markdown code blocks if present
        content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();

        try {
          const questions = JSON.parse(content);

          // Validate that it's an array
          if (!Array.isArray(questions)) {
            throw new Error('Response is not an array');
          }

          // Validate and clean up each question
          const validatedQuestions = questions.map((question, index) => {
            const word = words[index];
            if (!word) return null;

            // Map AI response question types to database types
            let questionType = question.question_type || 'definition_choice';
            if (questionType === 'multiple_choice') {
              questionType = 'definition_choice'; // Default fallback
            }

            // Ensure question type is valid
            const validTypes = ['fill_blank', 'definition_choice', 'synonym_choice', 'context_choice'];
            if (!validTypes.includes(questionType)) {
              questionType = 'definition_choice'; // Safe fallback
            }

            return {
              word_id: word.id,
              question_type: questionType,
              question_text: question.question_text || '',
              correct_answer: question.correct_answer || '',
              options: Array.isArray(question.options) ? question.options : [],
              explanation: question.explanation || '',
            };
          }).filter(q => q && q.question_text && q.correct_answer);

          return validatedQuestions;
        } catch (parseError) {
          console.error('Failed to parse AI batch quiz response:', content);
          throw new Error('Invalid AI response format for batch quiz questions');
        }
      }

      throw new Error('No response from AI service');
    } catch (error) {
      console.error('AI batch quiz generation error:', error);
      throw new Error(`Batch quiz generation failed: ${error.message}`);
    }
  }

  generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

export const aiService = new AIService();