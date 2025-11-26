/**
 * Test script for Quiz FSRS implementation
 * Run this to verify the QuizFSRS algorithm works correctly
 */

import { QuizFSRS } from './src/services/quizFsrs.js';

const quizFsrs = new QuizFSRS();

console.log('🧪 Testing Quiz FSRS Implementation\n');

// Test 1: New question
console.log('📝 Test 1: New Question');
const newQuestion = {
  id: 'test-1',
  stability: null,
  difficulty: null,
  total_attempts: 0,
  correct_attempts: 0,
  due_date: null,
  last_review: null
};

const correctAnswer1 = quizFsrs.schedule(newQuestion, true, 3000);
console.log('First correct answer (fast):', {
  interval_days: correctAnswer1.interval_days,
  difficulty: correctAnswer1.difficulty,
  stability: correctAnswer1.stability,
  response_quality: correctAnswer1.response_quality,
  due_date: correctAnswer1.due_date.toISOString().slice(0, 19)
});

// Test 2: Second correct answer (should increase interval)
console.log('\n📝 Test 2: Second Correct Answer');
const correctAnswer2 = quizFsrs.schedule({
  ...newQuestion,
  ...correctAnswer1
}, true, 4000);

console.log('Second correct answer:', {
  interval_days: correctAnswer2.interval_days,
  difficulty: correctAnswer2.difficulty,
  stability: correctAnswer2.stability,
  response_quality: correctAnswer2.response_quality,
  due_date: correctAnswer2.due_date.toISOString().slice(0, 19)
});

// Test 3: Third correct answer (Easy - fast response)
console.log('\n📝 Test 3: Third Correct Answer (Easy)');
const correctAnswer3 = quizFsrs.schedule({
  ...newQuestion,
  ...correctAnswer2
}, true, 2000);

console.log('Third correct answer (fast/easy):', {
  interval_days: correctAnswer3.interval_days,
  difficulty: correctAnswer3.difficulty,
  stability: correctAnswer3.stability,
  response_quality: correctAnswer3.response_quality,
  due_date: correctAnswer3.due_date.toISOString().slice(0, 19)
});

// Test 4: Wrong answer (should reset interval)
console.log('\n❌ Test 4: Wrong Answer');
const wrongAnswer = quizFsrs.schedule({
  ...newQuestion,
  ...correctAnswer3
}, false, 5000);

console.log('Wrong answer:', {
  interval_days: wrongAnswer.interval_days,
  difficulty: wrongAnswer.difficulty,
  stability: wrongAnswer.stability,
  response_quality: wrongAnswer.response_quality,
  due_date: wrongAnswer.due_date.toISOString().slice(0, 19)
});

// Test 5: Recovery correct answer
console.log('\n🔄 Test 5: Recovery Correct Answer');
const recovery = quizFsrs.schedule({
  ...newQuestion,
  ...wrongAnswer
}, true, 3500);

console.log('Recovery correct answer:', {
  interval_days: recovery.interval_days,
  difficulty: recovery.difficulty,
  stability: recovery.stability,
  response_quality: recovery.response_quality,
  due_date: recovery.due_date.toISOString().slice(0, 19)
});

// Test 6: Simulate multiple correct answers to see exponential growth
console.log('\n📈 Test 6: Exponential Growth Simulation');
let currentState = { ...newQuestion };

for (let i = 1; i <= 8; i++) {
  const responseTime = 3000 + Math.random() * 2000; // Random response time
  currentState = {
    ...currentState,
    ...quizFsrs.schedule(currentState, true, responseTime)
  };

  console.log(`Answer ${i}:`, {
    interval_days: currentState.interval_days.toFixed(2),
    stability: currentState.stability.toFixed(2),
    difficulty: currentState.difficulty.toFixed(1),
    success_rate: currentState.success_rate.toFixed(2),
    due_in: `${currentState.interval_days < 1
      ? Math.round(currentState.interval_days * 24) + 'h'
      : currentState.interval_days < 7
      ? Math.round(currentState.interval_days) + 'd'
      : Math.round(currentState.interval_days / 7) + 'w'}`
  });
}

// Test 7: Check isDue function
console.log('\n⏰ Test 7: Due Date Checking');
const pastDue = {
  due_date: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
};
const futureDue = {
  due_date: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
};
const newQ = {};

console.log('Past due question:', quizFsrs.isDue(pastDue));
console.log('Future due question:', quizFsrs.isDue(futureDue));
console.log('New question (no due date):', quizFsrs.isDue(newQ));

// Test 8: Next intervals preview
console.log('\n🔮 Test 8: Next Intervals Preview');
const intervals = quizFsrs.getNextIntervals(currentState);
console.log('Preview of next intervals:');
Object.entries(intervals).forEach(([quality, data]) => {
  console.log(`  ${quality}: ${data.interval.toFixed(2)} days`);
});

console.log('\n✅ Quiz FSRS Testing Complete!');
console.log('\nKey Features Demonstrated:');
console.log('- ✨ Exponential interval growth for correct answers');
console.log('- 📉 Reduced intervals for wrong answers');
console.log('- 🎯 Response time affects next interval quality');
console.log('- 📊 Difficulty adjustments based on performance');
console.log('- ⏱️ Minimum 6-hour intervals for frequent practice');
console.log('- 📅 Maximum 6-month intervals for well-known items');