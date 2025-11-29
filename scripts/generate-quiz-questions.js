#!/usr/bin/env node

/**
 * Script to generate quiz questions for existing words
 *
 * Usage:
 *   node scripts/generate-quiz-questions.js [options]
 *
 * Options:
 *   --regenerate-all    Regenerate questions for all words (delete existing)
 *   --user-email       Generate only for specific user email
 *   --batch-size       Number of words to process per batch (default: 10)
 *   --dry-run          Show what would be processed without making changes
 *   --help             Show this help message
 *
 * Examples:
 *   node scripts/generate-quiz-questions.js
 *   node scripts/generate-quiz-questions.js --regenerate-all
 *   node scripts/generate-quiz-questions.js --user-email john@example.com
 *   node scripts/generate-quiz-questions.js --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { quizService } from '../backend/src/services/quizService.js';
import { aiService } from '../backend/src/services/aiService.js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend directory
config({ path: path.join(__dirname, '../backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const aiApiKey = process.env.AI_API_KEY;
const aiProvider = process.env.AI_PROVIDER;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

if (!aiApiKey) {
  console.error('❌ Missing AI_API_KEY environment variable');
  console.error('   AI_API_KEY is required for generating quiz questions');
  process.exit(1);
}

// Initialize AI service with proper configuration
aiService.config.apiKey = aiApiKey;
aiService.config.provider = aiProvider || 'openai';

// Create Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    regenerateAll: false,
    userEmail: null,
    batchSize: 10,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--regenerate-all':
        options.regenerateAll = true;
        break;
      case '--user-email':
        options.userEmail = args[++i];
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i], 10) || 10;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        options.help = true;
        break;
      default:
        console.warn(`⚠️  Unknown option: ${arg}`);
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Quiz Question Generator Script

Usage:
  node scripts/generate-quiz-questions.js [options]

Options:
  --regenerate-all    Regenerate questions for all words (delete existing)
  --user-email       Generate only for specific user email
  --batch-size       Number of words to process per batch (default: 10)
  --dry-run          Show what would be processed without making changes
  --help             Show this help message

Examples:
  node scripts/generate-quiz-questions.js
  node scripts/generate-quiz-questions.js --regenerate-all
  node scripts/generate-quiz-questions.js --user-email john@example.com
  node scripts/generate-quiz-questions.js --dry-run
`);
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  console.log('🚀 Quiz Question Generator');
  console.log('===========================');

  if (options.dryRun) {
    console.log('🏃‍♂️ DRY RUN MODE - No changes will be made');
  }

  console.log(`📊 Options:
    - Regenerate all: ${options.regenerateAll}
    - User filter: ${options.userEmail || 'All users'}
    - Batch size: ${options.batchSize}
    - Dry run: ${options.dryRun}
`);

  try {
    // Get words to process
    let wordsQuery = supabase
      .from('words')
      .select(`
        id, word, definition, word_type, cefr_level,
        example_sentence, vietnamese_translation, synonyms,
        user_id, created_at
      `);

    // Filter by user email if specified
    if (options.userEmail) {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', options.userEmail);

      if (userError || !users || users.length === 0) {
        console.error(`❌ User not found: ${options.userEmail}`);
        return;
      }

      wordsQuery = wordsQuery.eq('user_id', users[0].id);
    }

    const { data: allWords, error: wordsError } = await wordsQuery;

    if (wordsError) {
      throw wordsError;
    }

    if (!allWords || allWords.length === 0) {
      console.log('📭 No words found to process');
      return;
    }

    console.log(`📚 Found ${allWords.length} total words`);

    // Group words by user
    const wordsByUser = {};
    allWords.forEach(word => {
      if (!wordsByUser[word.user_id]) {
        wordsByUser[word.user_id] = [];
      }
      wordsByUser[word.user_id].push(word);
    });

    let totalProcessed = 0;
    let totalGenerated = 0;
    let totalSaved = 0;
    let totalErrors = 0;

    // Process each user's words
    for (const [userId, userWords] of Object.entries(wordsByUser)) {
      console.log(`\n👤 Processing ${userWords.length} words for user ${userId.substring(0, 8)}...`);

      if (options.dryRun) {
        console.log(`   📝 Would process ${userWords.length} words`);
        totalProcessed += userWords.length;
        continue;
      }

      let wordsToProcess = userWords;

      // Check existing quiz questions if not regenerating all
      if (!options.regenerateAll) {
        const { data: existingQuestions } = await supabase
          .from('quiz_questions')
          .select('word_id')
          .in('word_id', userWords.map(w => w.id));

        const existingWordIds = new Set(existingQuestions?.map(q => q.word_id) || []);
        wordsToProcess = userWords.filter(word => !existingWordIds.has(word.id));

        if (wordsToProcess.length === 0) {
          console.log(`   ✅ All words already have quiz questions`);
          continue;
        }

        console.log(`   📋 ${wordsToProcess.length} words need quiz questions`);
      } else {
        console.log(`   🔄 Regenerating questions for all ${wordsToProcess.length} words`);

        // Delete existing questions
        const { error: deleteError } = await supabase
          .from('quiz_questions')
          .delete()
          .in('word_id', userWords.map(w => w.id));

        if (deleteError) {
          console.error(`   ❌ Error deleting existing questions:`, deleteError);
          continue;
        }
      }

      // Generate quiz questions
      try {
        const result = await quizService.generateAndSaveQuizQuestions(wordsToProcess, supabase);

        console.log(`   ✅ Result: Generated ${result.generated}, Saved ${result.saved}, Errors ${result.errors}`);
        if (result.error) {
          console.error(`   ⚠️  Error: ${result.error}`);
        }

        totalProcessed += wordsToProcess.length;
        totalGenerated += result.generated;
        totalSaved += result.saved;
        totalErrors += result.errors;

      } catch (error) {
        console.error(`   ❌ Failed to process user's words:`, error.message);
        totalErrors += wordsToProcess.length;
      }

      // Add delay between users
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    console.log('\n📊 SUMMARY');
    console.log('===========');
    console.log(`Total users processed: ${Object.keys(wordsByUser).length}`);
    console.log(`Total words processed: ${totalProcessed}`);

    if (!options.dryRun) {
      console.log(`Quiz questions generated: ${totalGenerated}`);
      console.log(`Quiz questions saved: ${totalSaved}`);
      console.log(`Errors: ${totalErrors}`);
      console.log(`Success rate: ${totalProcessed > 0 ? Math.round((totalSaved / totalProcessed) * 100) : 0}%`);
    }

    console.log('\n✅ Script completed successfully!');

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Handle script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { main };