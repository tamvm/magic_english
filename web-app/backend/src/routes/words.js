import express from 'express';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const createWordSchema = Joi.object({
  word: Joi.string().min(1).max(100).required(),
  definition: Joi.string().max(1000).default(''),
  wordType: Joi.string().max(50).default(''),
  cefrLevel: Joi.string().valid('A1', 'A2', 'B1', 'B2', 'C1', 'C2', '').default(''),
  ipaPronunciation: Joi.string().max(200).default(''),
  exampleSentence: Joi.string().max(500).default(''),
  notes: Joi.string().max(1000).default(''),
  tags: Joi.array().items(Joi.string().max(50)).default([]),
  collectionId: Joi.string().uuid().optional(),
});

const updateWordSchema = Joi.object({
  word: Joi.string().min(1).max(100),
  definition: Joi.string().max(1000),
  wordType: Joi.string().max(50),
  cefrLevel: Joi.string().valid('A1', 'A2', 'B1', 'B2', 'C1', 'C2', ''),
  ipaPronunciation: Joi.string().max(200),
  exampleSentence: Joi.string().max(500),
  notes: Joi.string().max(1000),
  tags: Joi.array().items(Joi.string().max(50)),
});

const searchSchema = Joi.object({
  q: Joi.string().min(1).max(100),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
  collection: Joi.string().uuid(),
  sortBy: Joi.string().valid('created_at', 'word', 'updated_at').default('created_at'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

// Get all words
router.get('/', async (req, res, next) => {
  try {
    const { error, value } = searchSchema.validate(req.query);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const { q, limit, offset, collection, sortBy, sortOrder } = value;

    let query = req.supabase
      .from('words')
      .select(`
        *,
        word_collections!inner(
          collection_id,
          collections!inner(name)
        )
      `)
      .eq('user_id', req.user.id);

    // Add search filter
    if (q) {
      query = query.or(
        `word.ilike.%${q}%,definition.ilike.%${q}%,example_sentence.ilike.%${q}%`
      );
    }

    // Add collection filter
    if (collection) {
      query = query.eq('word_collections.collection_id', collection);
    }

    // Add sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Add pagination
    query = query.range(offset, offset + limit - 1);

    const { data: words, error: wordsError } = await query;

    if (wordsError) {
      return next(wordsError);
    }

    // Get total count for pagination
    let countQuery = req.supabase
      .from('words')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    if (q) {
      countQuery = countQuery.or(
        `word.ilike.%${q}%,definition.ilike.%${q}%,example_sentence.ilike.%${q}%`
      );
    }

    if (collection) {
      countQuery = countQuery
        .eq('word_collections.collection_id', collection);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      return next(countError);
    }

    res.json({
      words,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get word by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { data: word, error } = await req.supabase
      .from('words')
      .select(`
        *,
        word_collections(
          collection_id,
          collections(id, name)
        )
      `)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Word not found' });
      }
      return next(error);
    }

    res.json({ word });
  } catch (error) {
    next(error);
  }
});

// Create new word
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = createWordSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const { collectionId, ...wordData } = value;

    // Insert word
    const { data: word, error: insertError } = await req.supabase
      .from('words')
      .insert({
        ...wordData,
        user_id: req.user.id,
        cefr_level: wordData.cefrLevel,
        word_type: wordData.wordType,
        ipa_pronunciation: wordData.ipaPronunciation,
        example_sentence: wordData.exampleSentence,
      })
      .select()
      .single();

    if (insertError) {
      return next(insertError);
    }

    // Add to collection if specified
    if (collectionId) {
      const { error: collectionError } = await req.supabase
        .from('word_collections')
        .insert({
          word_id: word.id,
          collection_id: collectionId,
        });

      if (collectionError) {
        // If collection assignment fails, we could either rollback or continue
        console.error('Failed to add word to collection:', collectionError);
      }
    } else {
      // Add to user's default collection
      const { data: defaultCollection } = await req.supabase
        .from('collections')
        .select('id')
        .eq('user_id', req.user.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (defaultCollection) {
        await req.supabase
          .from('word_collections')
          .insert({
            word_id: word.id,
            collection_id: defaultCollection.id,
          });
      }
    }

    // Update user profile stats
    const { error: profileError } = await req.supabase.rpc(
      'increment_words_added',
      { user_id: req.user.id }
    );

    if (profileError) {
      console.error('Failed to update profile stats:', profileError);
    }

    res.status(201).json({
      message: 'Word created successfully',
      word,
    });
  } catch (error) {
    next(error);
  }
});

// Update word
router.put('/:id', async (req, res, next) => {
  try {
    const { error, value } = updateWordSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const { data: word, error: updateError } = await req.supabase
      .from('words')
      .update({
        ...value,
        cefr_level: value.cefrLevel,
        word_type: value.wordType,
        ipa_pronunciation: value.ipaPronunciation,
        example_sentence: value.exampleSentence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Word not found' });
      }
      return next(updateError);
    }

    res.json({
      message: 'Word updated successfully',
      word,
    });
  } catch (error) {
    next(error);
  }
});

// Delete word
router.delete('/:id', async (req, res, next) => {
  try {
    const { data: word, error } = await req.supabase
      .from('words')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Word not found' });
      }
      return next(error);
    }

    res.json({
      message: 'Word deleted successfully',
      word,
    });
  } catch (error) {
    next(error);
  }
});

// Bulk operations
router.post('/bulk', async (req, res, next) => {
  try {
    const bulkSchema = Joi.object({
      operation: Joi.string().valid('import', 'export', 'delete').required(),
      words: Joi.array().items(createWordSchema).when('operation', {
        is: 'import',
        then: Joi.required(),
      }),
      ids: Joi.array().items(Joi.string().uuid()).when('operation', {
        is: 'delete',
        then: Joi.required(),
      }),
      collectionId: Joi.string().uuid(),
    });

    const { error, value } = bulkSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const { operation, words, ids, collectionId } = value;

    switch (operation) {
      case 'import':
        const wordsToInsert = words.map(word => ({
          ...word,
          user_id: req.user.id,
          cefr_level: word.cefrLevel,
          word_type: word.wordType,
          ipa_pronunciation: word.ipaPronunciation,
          example_sentence: word.exampleSentence,
        }));

        const { data: insertedWords, error: insertError } = await req.supabase
          .from('words')
          .insert(wordsToInsert)
          .select();

        if (insertError) {
          return next(insertError);
        }

        res.status(201).json({
          message: `${insertedWords.length} words imported successfully`,
          words: insertedWords,
        });
        break;

      case 'export':
        const { data: exportWords, error: exportError } = await req.supabase
          .from('words')
          .select('*')
          .eq('user_id', req.user.id);

        if (exportError) {
          return next(exportError);
        }

        res.json({
          words: exportWords,
          exportedAt: new Date().toISOString(),
        });
        break;

      case 'delete':
        const { data: deletedWords, error: deleteError } = await req.supabase
          .from('words')
          .delete()
          .eq('user_id', req.user.id)
          .in('id', ids)
          .select();

        if (deleteError) {
          return next(deleteError);
        }

        res.json({
          message: `${deletedWords.length} words deleted successfully`,
          deletedWords,
        });
        break;

      default:
        res.status(400).json({ error: 'Invalid operation' });
    }
  } catch (error) {
    next(error);
  }
});

export default router;