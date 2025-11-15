import express from 'express';
import Joi from 'joi';
import { aiService } from '../services/aiService.js';
import { webScrapingService } from '../services/webScrapingService.js';

const router = express.Router();

// Validation schemas
const analyzeWordSchema = Joi.object({
  word: Joi.string().min(1).max(100).required(),
  autoSave: Joi.boolean().default(false),
  collectionId: Joi.string().uuid(),
});

const analyzeSentenceSchema = Joi.object({
  sentence: Joi.string().min(1).max(1000).required(),
});

const chatSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required(),
  conversationId: Joi.string().uuid().optional(),
});

const analyzeContentSchema = Joi.object({
  url: Joi.string().uri().optional(),
  text: Joi.string().min(1).max(20000).optional(),
  limit: Joi.number().integer().min(1).max(20).default(20),
}).or('url', 'text');

// Analyze word with AI
router.post('/analyze-word', async (req, res, next) => {
  try {
    const { error, value } = analyzeWordSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const { word, autoSave, collectionId } = value;

    // Get AI analysis
    const analysis = await aiService.analyzeWord(word);

    let savedWord = null;
    if (autoSave && analysis) {
      // Save word to database
      const wordData = {
        word: analysis.word || word,
        definition: analysis.definition || '',
        word_type: analysis.wordType || '',
        cefr_level: analysis.cefrLevel || '',
        ipa_pronunciation: analysis.ipaPronunciation || '',
        example_sentence: analysis.exampleSentence || '',
        notes: analysis.notes || '',
        tags: analysis.tags || [],
        vietnamese_translation: analysis.vietnameseTranslation || '',
        synonyms: analysis.synonyms || '',
        user_id: req.user.id,
      };

      const { data: insertedWord, error: insertError } = await req.supabase
        .from('words')
        .insert(wordData)
        .select()
        .single();

      if (insertError) {
        console.error('Failed to auto-save word:', insertError);
        // Check if it's a duplicate word error
        if (insertError.code === '23505' && insertError.message.includes('idx_words_user_word_unique')) {
          // Return the analysis without saving, but indicate it's a duplicate
          return res.json({
            analysis,
            error: 'duplicate_word',
            message: `"${word}" is already in your vocabulary`
          });
        }
      } else {
        savedWord = insertedWord;

        // Add to collection if specified
        if (collectionId) {
          await req.supabase
            .from('word_collections')
            .insert({
              word_id: insertedWord.id,
              collection_id: collectionId,
            });
        }

        // Update user profile stats
        await req.supabase.rpc('increment_words_added', {
          user_id: req.user.id
        });
      }
    }

    res.json({
      analysis,
      ...(savedWord && { savedWord }),
    });
  } catch (error) {
    next(error);
  }
});

// Analyze sentence with AI
router.post('/analyze-sentence', async (req, res, next) => {
  try {
    const { error, value } = analyzeSentenceSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const { sentence } = value;

    const analysis = await aiService.analyzeSentence(sentence);

    // Update user profile stats for sentence scoring
    await req.supabase.rpc('increment_sentences_scored', {
      user_id: req.user.id
    });

    res.json({
      analysis,
    });
  } catch (error) {
    next(error);
  }
});

// Analyze website or text content for vocabulary
router.post('/analyze-content', async (req, res, next) => {
  try {
    const { error, value } = analyzeContentSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const { url, text, limit } = value;

    // Get user's CEFR level from profile
    let userCefrLevel = 'B2'; // Default
    try {
      const { data: profile } = await req.supabase
        .from('profiles')
        .select('cefr_level')
        .eq('id', req.user.id)
        .single();

      if (profile?.cefr_level) {
        userCefrLevel = profile.cefr_level;
      }
    } catch (profileError) {
      console.log('Could not fetch user profile, using default CEFR level');
    }

    let content;
    let sourceType;
    let sourceInfo = {};

    if (url) {
      // Scrape website content
      const scrapingResult = await webScrapingService.scrapeUrl(url);

      if (!scrapingResult.success) {
        return res.status(400).json({
          error: 'website_scraping_failed',
          message: `Failed to extract content from website: ${scrapingResult.error}`
        });
      }

      content = scrapingResult.content;
      sourceType = 'website';
      sourceInfo = {
        url: scrapingResult.url,
        title: scrapingResult.title,
        excerpt: scrapingResult.excerpt
      };
    } else {
      // Process text content
      const textResult = await webScrapingService.processTextContent(text);
      content = textResult.content;
      sourceType = 'text';
      sourceInfo = {
        title: textResult.title,
        excerpt: textResult.excerpt
      };
    }

    if (!content || content.length < 100) {
      return res.status(400).json({
        error: 'insufficient_content',
        message: 'The content is too short to analyze. Please provide more substantial content.'
      });
    }

    // Analyze content with AI
    const vocabulary = await aiService.analyzeWebsiteContent(content, userCefrLevel, { limit });

    if (!vocabulary || vocabulary.length === 0) {
      return res.json({
        vocabulary: [],
        sourceType,
        sourceInfo,
        userCefrLevel,
        message: 'No new vocabulary found in the content that matches your current level.'
      });
    }

    res.json({
      vocabulary,
      sourceType,
      sourceInfo,
      userCefrLevel,
      totalFound: vocabulary.length,
      message: `Found ${vocabulary.length} vocabulary items for your level (${userCefrLevel})`
    });

  } catch (error) {
    console.error('Content analysis error:', error);
    console.error('Error stack:', error.stack);

    // Provide more specific error messages
    let errorMessage = 'Content analysis failed';
    if (error.message.includes('website_scraping_failed')) {
      errorMessage = 'Failed to extract content from website. The site may be blocking automated access.';
    } else if (error.message.includes('insufficient_content')) {
      errorMessage = 'The content is too short to analyze effectively.';
    } else if (error.message.includes('AI service unavailable')) {
      errorMessage = 'AI service is currently unavailable. Please check your API configuration.';
    } else if (error.message.includes('Invalid AI response format')) {
      errorMessage = 'AI service returned an unexpected response format.';
    }

    res.status(400).json({
      error: 'content_analysis_failed',
      message: errorMessage,
      details: error.message
    });
  }
});

// AI chat
router.post('/chat', async (req, res, next) => {
  try {
    const { error, value } = chatSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const { message, conversationId } = value;

    const response = await aiService.chat(message, {
      userId: req.user.id,
      conversationId,
    });

    res.json({
      response,
      conversationId: response.conversationId,
    });
  } catch (error) {
    next(error);
  }
});

// Stream AI chat response
router.post('/chat-stream', async (req, res, next) => {
  try {
    const { error, value } = chatSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const { message, conversationId } = value;

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    let responseId = null;

    try {
      await aiService.chatStream(message, {
        userId: req.user.id,
        conversationId,
        onChunk: (chunk) => {
          if (chunk.type === 'start') {
            responseId = chunk.responseId;
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          } else if (chunk.type === 'chunk') {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        },
      });

      // Send completion event
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        responseId,
        conversationId
      })}\n\n`);
      res.end();
    } catch (streamError) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: streamError.message
      })}\n\n`);
      res.end();
    }
  } catch (error) {
    next(error);
  }
});

// Get AI configuration
router.get('/config', async (req, res, next) => {
  try {
    const config = await aiService.getConfig();

    res.json({
      config: {
        provider: config.provider,
        model: config.model,
        available: config.available,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Test AI connection
router.post('/test-connection', async (req, res, next) => {
  try {
    const result = await aiService.testConnection();

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;