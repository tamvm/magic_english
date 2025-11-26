# Quiz FSRS Implementation

## Overview

Successfully implemented exponential spaced repetition for quiz questions using a simplified FSRS (Free Spaced Repetition System) algorithm specifically designed for frequent quiz practice.

## Key Features

### 🚀 Exponential Growth
- Quiz questions answered correctly multiple times now have **exponentially increasing intervals**
- Unlike the old 24-hour fixed system, intervals can grow from hours → days → weeks → months
- Maximum interval: **180 days** (6 months) vs unlimited for flashcards
- Minimum interval: **6 hours** vs 24 hours for better practice frequency

### 🎯 Performance-Based Scheduling
- **Response Quality Detection**: Fast answers = "Easy", slow answers = "Hard"
- **Difficulty Adaptation**: Questions get easier/harder based on performance
- **Smart Prioritization**: Wrong answers appear immediately, correct answers wait longer

### 📊 Algorithm Parameters
```javascript
{
  requestRetention: 0.85,      // 85% target retention (vs 90% for flashcards)
  maximumInterval: 180,        // 6 months max interval
  minimumInterval: 0.25,       // 6 hours minimum interval
  easyMultiplier: 2.5,         // Growth rate for easy answers
  goodMultiplier: 1.3,         // Growth rate for good answers
  hardMultiplier: 0.8,         // Growth rate for hard answers
  againMultiplier: 0.5         // Reset rate for wrong answers
}
```

## Database Changes

### New Fields Added to `quiz_questions` Table
```sql
-- FSRS scheduling fields
stability REAL DEFAULT 1.0,              -- Memory strength
difficulty REAL DEFAULT 5.0,             -- Question difficulty (1-10)
total_attempts INTEGER DEFAULT 0,         -- Total attempts
correct_attempts INTEGER DEFAULT 0,       -- Correct attempts
interval_days REAL DEFAULT 1.0,          -- Current review interval
due_date TIMESTAMP WITH TIME ZONE,       -- When next review is due
last_review TIMESTAMP WITH TIME ZONE,    -- Last review date
avg_response_time INTEGER DEFAULT 5000   -- Average response time
```

### Migration Script
- **Location**: `/backend/sql/9_quiz_fsrs_fields.sql`
- **Status**: Created, needs to be run in Supabase dashboard
- **Includes**: Constraints, indexes, and data migration for existing questions

## API Changes

### Updated Endpoints

#### 1. `POST /api/flashcards/quiz/:questionId/answer`
**Enhanced with FSRS scheduling**
- Calculates new intervals based on correctness and response time
- Updates all FSRS fields in database
- Returns detailed scheduling information

**New Response Format**:
```json
{
  "isCorrect": true,
  "correctAnswer": "example",
  "explanation": "...",
  "fsrs": {
    "stability": 2.5,
    "difficulty": 4.2,
    "interval_days": 3.5,
    "due_date": "2025-11-29T12:00:00Z",
    "response_quality": "good",
    "success_rate": 0.85,
    "next_intervals": {
      "again": { "interval": 0.25, "dueDate": "..." },
      "hard": { "interval": 1.2, "dueDate": "..." },
      "good": { "interval": 3.5, "dueDate": "..." },
      "easy": { "interval": 8.7, "dueDate": "..." }
    }
  },
  "spaced_repetition": {
    "will_repeat_soon": false,
    "priority": "low",
    "next_review": "2025-11-29T12:00:00Z",
    "interval_description": "3 days"
  }
}
```

#### 2. `GET /api/flashcards/quiz-questions`
**Completely rewritten for FSRS**
- Filters questions by actual due dates (not 24-hour rule)
- Prioritizes based on difficulty and overdue status
- Returns FSRS information for each question

**New Response Format**:
```json
{
  "questions": [
    {
      "id": "...",
      "question_text": "...",
      "options": ["..."],
      "fsrs_info": {
        "stability": 2.5,
        "difficulty": 4.2,
        "interval_days": 3.5,
        "due_date": "2025-11-29T12:00:00Z",
        "success_rate": 0.85,
        "total_attempts": 12
      },
      "is_new": false,
      "is_due": true,
      "priority": 2,
      "hours_overdue": 1.5
    }
  ],
  "fsrs_info": {
    "new_questions": 5,
    "overdue_questions": 3,
    "avg_interval": 2.8
  }
}
```

## Implementation Files

### Core Algorithm
- **📁 `/backend/src/services/quizFsrs.js`** - Main QuizFSRS class
- **📁 `/backend/test_quiz_fsrs.js`** - Test suite demonstrating functionality

### API Integration
- **📁 `/backend/src/routes/flashcards.js`** - Updated endpoints
- **📁 `/backend/sql/9_quiz_fsrs_fields.sql`** - Database migration

## Comparison: Old vs New System

| Feature | Old System | New System |
|---------|------------|------------|
| **Interval Growth** | Fixed 24 hours | Exponential (6h → 6 months) |
| **Wrong Answers** | Always appear | Immediate appearance |
| **Correct Answers** | Hidden 24h | Hidden for calculated interval |
| **Difficulty Tracking** | Static | Dynamic adjustment |
| **Response Time** | Ignored | Affects next interval |
| **Algorithm** | Simple time filter | Full FSRS implementation |
| **Personalization** | None | Adapts to individual performance |

## Example Progression

A quiz question answered correctly multiple times:
1. **First correct**: 1 day interval
2. **Second correct**: 2.5 days interval
3. **Third correct**: 6 days interval
4. **Fourth correct**: 15 days interval
5. **Fifth correct**: 35 days interval
6. **Sixth correct**: 80 days interval

If answered incorrectly, interval resets to ~6-12 hours depending on difficulty.

## Setup Instructions

### 1. Run Database Migration
```sql
-- Execute in Supabase SQL Editor
\i /backend/sql/9_quiz_fsrs_fields.sql
```

### 2. Restart Backend Server
```bash
cd backend
npm run dev
```

### 3. Test the System
```bash
cd backend
node test_quiz_fsrs.js
```

## Benefits

### For Users
- **🎯 Optimized Learning**: See difficult questions more frequently
- **⏰ Efficient Practice**: Don't waste time on well-known items
- **📈 Progress Tracking**: Clear intervals show mastery level
- **🧠 Better Retention**: Science-based spacing improves memory

### For the App
- **📊 Rich Analytics**: Detailed performance metrics
- **🔄 Self-Improving**: Algorithm adapts to user patterns
- **⚡ Performance**: Efficient database queries with proper indexing
- **🔬 Research-Based**: Built on proven FSRS methodology

## Next Steps

1. **Deploy Migration**: Run the SQL migration in production Supabase
2. **Monitor Performance**: Watch for any database performance issues
3. **User Testing**: Gather feedback on the new scheduling behavior
4. **Fine-tuning**: Adjust parameters based on real usage data

---

**Status**: ✅ Implementation Complete - Ready for Database Migration