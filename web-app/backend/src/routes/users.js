import express from 'express';
import Joi from 'joi';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Validation schemas
const signUpSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  fullName: Joi.string().min(1).max(100),
});

const signInSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Sign up
router.post('/signup', async (req, res, next) => {
  try {
    const { error, value } = signUpSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const { email, password, fullName } = value;

    const { data, error: signUpError } = await req.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      return res.status(400).json({
        error: signUpError.message,
      });
    }

    res.status(201).json({
      message: 'User created successfully. Please check your email for verification.',
      user: {
        id: data.user?.id,
        email: data.user?.email,
        fullName: data.user?.user_metadata?.full_name,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Sign in
router.post('/signin', async (req, res, next) => {
  try {
    const { error, value } = signInSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const { email, password } = value;

    const { data, error: signInError } = await req.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return res.status(401).json({
        error: signInError.message,
      });
    }

    res.json({
      message: 'Sign in successful',
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.user_metadata?.full_name,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Sign out
router.post('/signout', authMiddleware, async (req, res, next) => {
  try {
    const { error } = await req.supabase.auth.signOut();

    if (error) {
      return res.status(400).json({
        error: error.message,
      });
    }

    res.json({
      message: 'Sign out successful',
    });
  } catch (error) {
    next(error);
  }
});

// Get current user profile
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const { data: user, error } = await req.supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return next(error);
    }

    res.json({
      user,
    });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/me', authMiddleware, async (req, res, next) => {
  try {
    const updateSchema = Joi.object({
      fullName: Joi.string().min(1).max(100),
      email: Joi.string().email(),
    });

    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const { data, error: updateError } = await req.supabase
      .from('users')
      .update({
        full_name: value.fullName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (updateError) {
      return next(updateError);
    }

    res.json({
      message: 'Profile updated successfully',
      user: data,
    });
  } catch (error) {
    next(error);
  }
});

// Refresh session
router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        error: 'Refresh token is required',
      });
    }

    const { data, error } = await req.supabase.auth.refreshSession({
      refresh_token,
    });

    if (error) {
      return res.status(401).json({
        error: error.message,
      });
    }

    res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;