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
        timeout: options.timeout || 30000,
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
        const content = response.choices[0].message.content;
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
        const content = response.choices[0].message.content;
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

  async makeRequest(endpoint, data) {
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

    const response = await this.httpRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      timeout: 30000,
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

  generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

export const aiService = new AIService();