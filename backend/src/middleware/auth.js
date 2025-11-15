import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

export const authMiddleware = async (req, res, next) => {
  try {
    // Skip authentication for OPTIONS requests (CORS preflight)
    if (req.method === 'OPTIONS') {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access denied. No token provided or invalid format.',
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Create a new Supabase client with the user's token for this request
    const authenticatedSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // For Supabase JWT tokens, we can verify using the authenticated client
    const { data: { user }, error } = await authenticatedSupabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'Invalid token.',
      });
    }

    // Replace the supabase client with the authenticated one
    req.supabase = authenticatedSupabase;

    // Attach user info to request object
    req.user = {
      id: user.id,
      email: user.email,
      ...user.user_metadata,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      error: 'Invalid token.',
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await req.supabase.auth.getUser(token);

      if (!error && user) {
        req.user = {
          id: user.id,
          email: user.email,
          ...user.user_metadata,
        };
      }
    }

    next();
  } catch (error) {
    // Optional auth should not fail the request
    next();
  }
};