import express from 'express';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const createGroupSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).allow('', null).default(''),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#6366f1'),
  icon: Joi.string().max(50).default('folder'),
});

const updateGroupSchema = Joi.object({
  name: Joi.string().min(1).max(100),
  description: Joi.string().max(500).allow('', null),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
  icon: Joi.string().max(50),
}).min(1); // At least one field required

const listGroupsSchema = Joi.object({
  sortBy: Joi.string().valid('name', 'created_at').default('name'),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
});

// GET /api/groups - List all user's groups with vocabulary counts
router.get('/', async (req, res, next) => {
  try {
    const { error, value } = listGroupsSchema.validate(req.query);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const { sortBy, sortOrder } = value;

    // Fetch groups
    const { data: groups, error: groupsError } = await req.supabase
      .from('collections')
      .select('*')
      .eq('user_id', req.user.id)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (groupsError) return next(groupsError);

    // Get vocabulary counts and words to learn for each group
    const groupsWithCounts = await Promise.all(
      groups.map(async (group) => {
        // Total word count
        const { count } = await req.supabase
          .from('words')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', group.id)
          .eq('user_id', req.user.id);

        // Words to learn count (words with quiz questions due for review)
        const now = new Date().toISOString();
        const { count: toLearnCount } = await req.supabase
          .from('words')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', group.id)
          .eq('user_id', req.user.id)
          .not('quiz_questions', 'is', null)
          .lte('quiz_questions->due', now);

        return {
          ...group,
          vocabularyCount: count || 0,
          wordsToLearn: toLearnCount || 0,
        };
      })
    );

    res.json({ data: groupsWithCounts, total: groupsWithCounts.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/groups/:id - Fetch single group with vocabulary count
router.get('/:id', async (req, res, next) => {
  try {
    const { data: group, error: groupError } = await req.supabase
      .from('collections')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get vocabulary count
    const { count } = await req.supabase
      .from('words')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', group.id)
      .eq('user_id', req.user.id);

    const groupWithCount = {
      ...group,
      vocabularyCount: count || 0,
    };

    res.json({ data: groupWithCount });
  } catch (err) {
    next(err);
  }
});

// POST /api/groups - Create new group
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = createGroupSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const { name, description, color, icon } = value;

    // Check for duplicate name
    const { data: existing } = await req.supabase
      .from('collections')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'Group name already exists' });
    }

    // Create group
    const { data: group, error: createError } = await req.supabase
      .from('collections')
      .insert({
        user_id: req.user.id,
        name,
        description: description || '',
        color,
        icon,
      })
      .select()
      .single();

    if (createError) return next(createError);

    res.status(201).json({ data: { ...group, vocabularyCount: 0 } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/groups/:id - Update group
router.put('/:id', async (req, res, next) => {
  try {
    const { error, value } = updateGroupSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    // Check if name conflict (if name being updated)
    if (value.name) {
      const { data: existing } = await req.supabase
        .from('collections')
        .select('id')
        .eq('user_id', req.user.id)
        .eq('name', value.name)
        .neq('id', req.params.id)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ error: 'Group name already exists' });
      }
    }

    // Update group (RLS auto-enforces user_id)
    const { data: group, error: updateError } = await req.supabase
      .from('collections')
      .update(value)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (updateError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get vocabulary count
    const { count } = await req.supabase
      .from('words')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', group.id)
      .eq('user_id', req.user.id);

    const groupWithCount = {
      ...group,
      vocabularyCount: count || 0,
    };

    res.json({ data: groupWithCount });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/groups/:id - Delete group (orphans words)
router.delete('/:id', async (req, res, next) => {
  try {
    // Count words in group before deletion
    const { count: wordCount } = await req.supabase
      .from('words')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', req.params.id)
      .eq('user_id', req.user.id);

    // Delete group (ON DELETE SET NULL will orphan words)
    const { error: deleteError } = await req.supabase
      .from('collections')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (deleteError) {
      if (deleteError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Group not found' });
      }
      return next(deleteError);
    }

    res.json({
      data: {
        deleted: true,
        orphanedWords: wordCount || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
