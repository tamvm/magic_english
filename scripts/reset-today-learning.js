#!/usr/bin/env node

/**
 * Reset Today's Learning Script
 *
 * This script resets all flashcards that were studied today back to their
 * previous state, effectively undoing today's learning progress.
 *
 * Usage:
 *   node scripts/reset-today-learning.js
 *
 * Options:
 *   --dry-run    Show what would be reset without actually doing it
 *   --user-id    Specify a specific user ID (optional)
 *   --help       Show this help message
 */

import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase configuration');
  console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Command line argument parsing
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  userId: args.find(arg => arg.startsWith('--user-id='))?.split('=')[1],
  help: args.includes('--help')
};

function showHelp() {
  console.log(`
🔄 Reset Today's Learning Script

This script resets all flashcards that were studied today back to their
previous state, effectively undoing today's learning progress.

Usage:
  node scripts/reset-today-learning.js [options]

Options:
  --dry-run         Show what would be reset without actually doing it
  --user-id=<id>    Reset learning for a specific user only
  --help            Show this help message

Examples:
  node scripts/reset-today-learning.js
  node scripts/reset-today-learning.js --dry-run
  node scripts/reset-today-learning.js --user-id=123 --dry-run

⚠️  Warning: This action cannot be undone. Use --dry-run first to preview changes.
`);
}

async function getTodaysStudiedCards(userId = null) {
  try {
    // Get today's date range (start and end of today in UTC)
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    console.log(`🔍 Looking for cards studied today (${todayStart.toISOString().split('T')[0]})`);

    // Build query for flashcards that were reviewed today
    let query = supabase
      .from('cards')
      .select(`
        id,
        user_id,
        word_id,
        last_review,
        stability,
        difficulty,
        reps,
        state,
        due_date,
        words (
          word,
          definition
        )
      `)
      .gte('last_review', todayStart.toISOString())
      .lt('last_review', todayEnd.toISOString())
      .not('last_review', 'is', null);

    // Filter by user if specified
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: cards, error } = await query;

    if (error) {
      throw error;
    }

    return cards || [];
  } catch (error) {
    console.error('❌ Error fetching today\'s studied cards:', error.message);
    return [];
  }
}

async function getTodaysReviewHistory(userId = null) {
  try {
    // Get today's date range
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    let query = supabase
      .from('review_history')
      .select('*')
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', todayEnd.toISOString());

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: reviews, error } = await query;

    if (error) {
      throw error;
    }

    return reviews || [];
  } catch (error) {
    console.error('❌ Error fetching today\'s review history:', error.message);
    return [];
  }
}

async function resetCardToPreviousState(cardId) {
  try {
    // Get the card's review history to find the previous state
    const { data: history, error: historyError } = await supabase
      .from('review_history')
      .select('*')
      .eq('card_id', cardId)
      .order('created_at', { ascending: false })
      .limit(2); // Get last 2 reviews

    if (historyError) {
      throw historyError;
    }

    if (!history || history.length === 0) {
      // No history, reset to initial state
      const { error: updateError } = await supabase
        .from('cards')
        .update({
          last_review: null,
          stability: 0,
          difficulty: 0,
          reps: 0,
          lapses: 0,
          state: 'new',
          due_date: new Date().toISOString(),
          elapsed_days: 0,
          scheduled_days: 0,
          total_study_time: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', cardId);

      if (updateError) {
        throw updateError;
      }

      return { action: 'reset_to_new', previousState: null };
    }

    // If only one review (today's), reset to new state
    if (history.length === 1) {
      const { error: updateError } = await supabase
        .from('cards')
        .update({
          last_review: null,
          stability: 0,
          difficulty: 0,
          reps: 0,
          lapses: 0,
          state: 'new',
          due_date: new Date().toISOString(),
          elapsed_days: 0,
          scheduled_days: 0,
          total_study_time: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', cardId);

      if (updateError) {
        throw updateError;
      }

      return { action: 'reset_to_new', previousState: null };
    }

    // Restore to previous state (the review before today's)
    const previousReview = history[1]; // Second most recent (before today's)

    const { error: updateError } = await supabase
      .from('cards')
      .update({
        last_review: previousReview.created_at,
        stability: previousReview.old_stability,
        difficulty: previousReview.old_difficulty,
        state: previousReview.old_state,
        due_date: previousReview.old_due_date,
        updated_at: new Date().toISOString()
      })
      .eq('id', cardId);

    if (updateError) {
      throw updateError;
    }

    return {
      action: 'restored_to_previous',
      previousState: {
        reviewed_at: previousReview.created_at,
        stability: previousReview.old_stability,
        difficulty: previousReview.old_difficulty,
        state: previousReview.old_state,
        due_date: previousReview.old_due_date
      }
    };

  } catch (error) {
    console.error(`❌ Error resetting card ${cardId}:`, error.message);
    return { action: 'error', error: error.message };
  }
}

async function deleteTodaysReviewHistory(reviewIds) {
  try {
    const { error } = await supabase
      .from('review_history')
      .delete()
      .in('id', reviewIds);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('❌ Error deleting review history:', error.message);
    return false;
  }
}

async function resetTodayLearning() {
  try {
    console.log('🚀 Starting reset process...\n');

    // Get today's studied cards
    const cards = await getTodaysStudiedCards(options.userId);

    if (cards.length === 0) {
      console.log('✅ No cards were studied today. Nothing to reset.');
      return;
    }

    console.log(`📚 Found ${cards.length} cards studied today:\n`);

    // Display cards that will be affected
    cards.forEach((card, index) => {
      console.log(`${index + 1}. "${card.words.word}" - ${card.words.definition.substring(0, 50)}...`);
      console.log(`   Current: ${card.state}, reps: ${card.reps}, difficulty: ${card.difficulty}`);
    });

    if (options.dryRun) {
      console.log('\n🔍 DRY RUN MODE - No changes will be made');
      console.log('Remove --dry-run flag to actually reset the cards');
      return;
    }

    // Confirm before proceeding
    console.log('\n⚠️  WARNING: This will reset all these cards to their previous state.');
    console.log('This action cannot be undone!');

    // In a real script, you might want to add readline for confirmation
    // For now, we'll proceed automatically (you can modify this)

    console.log('\n🔄 Proceeding with reset...\n');

    let successCount = 0;
    let errorCount = 0;

    // Reset each card
    for (const card of cards) {
      try {
        console.log(`Resetting: "${card.words.word}"`);
        const result = await resetCardToPreviousState(card.id);

        if (result.action === 'error') {
          console.log(`  ❌ Failed: ${result.error}`);
          errorCount++;
        } else if (result.action === 'reset_to_new') {
          console.log(`  ✅ Reset to new card state`);
          successCount++;
        } else if (result.action === 'restored_to_previous') {
          console.log(`  ✅ Restored to previous state (${result.previousState.state})`);
          successCount++;
        }
      } catch (error) {
        console.log(`  ❌ Failed: ${error.message}`);
        errorCount++;
      }
    }

    // Get and delete today's review history
    console.log('\n🗑️  Cleaning up today\'s review history...');
    const reviews = await getTodaysReviewHistory(options.userId);

    if (reviews.length > 0) {
      const reviewIds = reviews.map(r => r.id);
      const historyDeleted = await deleteTodaysReviewHistory(reviewIds);

      if (historyDeleted) {
        console.log(`✅ Deleted ${reviews.length} review history entries`);
      } else {
        console.log(`❌ Failed to delete review history`);
      }
    }

    // Summary
    console.log('\n📊 Reset Summary:');
    console.log(`✅ Successfully reset: ${successCount} cards`);
    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount} cards`);
    }
    console.log('\n🎉 Reset complete! Your learning progress for today has been undone.');

  } catch (error) {
    console.error('❌ Fatal error during reset:', error.message);
    process.exit(1);
  }
}

// Main execution
async function main() {
  if (options.help) {
    showHelp();
    return;
  }

  console.log('🔄 Magic English - Reset Today\'s Learning\n');

  if (options.dryRun) {
    console.log('🔍 Running in DRY RUN mode - no changes will be made\n');
  }

  if (options.userId) {
    console.log(`👤 Resetting for user ID: ${options.userId}\n`);
  }

  await resetTodayLearning();
}

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});