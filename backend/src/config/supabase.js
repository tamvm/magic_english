import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please check SUPABASE_URL and SUPABASE_ANON_KEY');
}

export const createSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });
};

// Database schema setup SQL
export const setupDatabase = async (supabase) => {
  const { error: usersError } = await supabase.rpc('create_users_table');
  const { error: wordsError } = await supabase.rpc('create_words_table');
  const { error: profilesError } = await supabase.rpc('create_profiles_table');

  if (usersError) console.error('Error creating users table:', usersError);
  if (wordsError) console.error('Error creating words table:', wordsError);
  if (profilesError) console.error('Error creating profiles table:', profilesError);
};