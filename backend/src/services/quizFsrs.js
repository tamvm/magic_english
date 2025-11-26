/**
 * Quiz FSRS (Simplified FSRS for Quiz Questions)
 * A lightweight spaced repetition algorithm for quiz questions
 * Based on FSRS but simplified for frequent practice scenarios
 */

class QuizFSRS {
  constructor(parameters = null) {
    // Simplified parameters for quiz questions
    this.parameters = parameters || {
      // More aggressive scheduling than regular FSRS (for more frequent practice)
      requestRetention: 0.85,      // Lower target retention (85% vs 90%)
      maximumInterval: 180,        // Max 6 months (vs 100 years for flashcards)
      minimumInterval: 0.25,       // 6 hours minimum (vs 1 day for flashcards)

      // Simplified coefficients (subset of full FSRS)
      // These control how intervals grow based on performance
      easyMultiplier: 2.5,         // Easy answer multiplier
      goodMultiplier: 1.3,         // Good answer multiplier
      hardMultiplier: 0.8,         // Hard answer multiplier
      againMultiplier: 0.5,        // Again answer multiplier

      // Decay factors
      stabilityDecay: 0.85,        // How much stability decays for wrong answers
      difficultyIncrement: 0.15,   // How much difficulty increases for wrong answers
      difficultyDecrement: 0.05,   // How much difficulty decreases for correct answers
    };
  }

  /**
   * Calculate initial stability for new quiz questions
   */
  initStability(correctness = null) {
    // Start with shorter intervals for quiz questions
    if (correctness === null) return 1; // 1 day for new questions

    // If we have initial performance data
    return correctness ? 2 : 0.5; // 2 days if correct, 12 hours if incorrect
  }

  /**
   * Calculate initial difficulty (1-10 scale, 5 is average)
   */
  initDifficulty() {
    return 5; // Start with medium difficulty
  }

  /**
   * Calculate next stability based on current performance
   */
  nextStability(currentStability, difficulty, isCorrect, responseQuality = 'good') {
    if (!isCorrect) {
      // Wrong answer - reduce stability significantly
      return Math.max(
        this.parameters.minimumInterval,
        currentStability * this.parameters.stabilityDecay
      );
    }

    // Correct answer - increase stability based on quality
    let multiplier;
    switch (responseQuality) {
      case 'easy':   // Answered quickly and correctly
        multiplier = this.parameters.easyMultiplier;
        break;
      case 'good':   // Standard correct answer
        multiplier = this.parameters.goodMultiplier;
        break;
      case 'hard':   // Correct but took long time
        multiplier = this.parameters.hardMultiplier;
        break;
      default:
        multiplier = this.parameters.goodMultiplier;
    }

    // Difficulty affects growth (easier questions grow faster)
    const difficultyFactor = (11 - difficulty) / 10; // Range: 0.1 to 1.0

    const newStability = currentStability * multiplier * difficultyFactor;

    return Math.min(this.parameters.maximumInterval,
                   Math.max(this.parameters.minimumInterval, newStability));
  }

  /**
   * Calculate next difficulty based on performance
   */
  nextDifficulty(currentDifficulty, isCorrect) {
    if (isCorrect) {
      // Correct answer - slightly decrease difficulty
      return Math.max(1, currentDifficulty - this.parameters.difficultyDecrement);
    } else {
      // Wrong answer - increase difficulty
      return Math.min(10, currentDifficulty + this.parameters.difficultyIncrement);
    }
  }

  /**
   * Calculate interval from stability
   */
  calculateInterval(stability) {
    // Convert stability to actual interval with some randomness to avoid bunching
    const baseInterval = stability * Math.log(this.parameters.requestRetention) / Math.log(0.8);

    // Add small random factor (±10%) to spread out reviews
    const randomFactor = 0.9 + Math.random() * 0.2;
    const interval = Math.round(baseInterval * randomFactor * 24) / 24; // Round to nearest hour

    return Math.max(this.parameters.minimumInterval,
                   Math.min(this.parameters.maximumInterval, interval));
  }

  /**
   * Determine response quality based on response time and correctness
   */
  determineResponseQuality(responseTime, isCorrect, averageResponseTime = 5000) {
    if (!isCorrect) return 'again';

    // For correct answers, determine quality based on speed
    if (responseTime < averageResponseTime * 0.7) {
      return 'easy';  // Fast and correct
    } else if (responseTime < averageResponseTime * 1.3) {
      return 'good';  // Normal speed
    } else {
      return 'hard';  // Slow but correct
    }
  }

  /**
   * Main scheduling function for quiz questions
   * @param {Object} questionState - Current question state
   * @param {boolean} isCorrect - Whether answer was correct
   * @param {number} responseTime - Response time in milliseconds
   * @param {Date} reviewDate - Date of review
   * @returns {Object} Updated question parameters
   */
  schedule(questionState, isCorrect, responseTime = 5000, reviewDate = new Date()) {
    const currentStability = questionState.stability || this.initStability();
    const currentDifficulty = questionState.difficulty || this.initDifficulty();
    const totalAttempts = (questionState.total_attempts || 0) + 1;
    const correctAttempts = questionState.correct_attempts || 0;

    // Determine response quality
    const avgResponseTime = questionState.avg_response_time || 5000;
    const responseQuality = this.determineResponseQuality(responseTime, isCorrect, avgResponseTime);

    // Calculate new parameters
    const newStability = this.nextStability(currentStability, currentDifficulty, isCorrect, responseQuality);
    const newDifficulty = this.nextDifficulty(currentDifficulty, isCorrect);
    const newCorrectAttempts = isCorrect ? correctAttempts + 1 : correctAttempts;

    // Calculate interval and due date
    const interval = this.calculateInterval(newStability);
    const dueDate = new Date(reviewDate);
    dueDate.setTime(dueDate.getTime() + (interval * 24 * 60 * 60 * 1000)); // Convert days to milliseconds

    // Calculate new average response time
    const newAvgResponseTime = questionState.avg_response_time
      ? (questionState.avg_response_time * (totalAttempts - 1) + responseTime) / totalAttempts
      : responseTime;

    return {
      stability: Number(newStability.toFixed(3)),
      difficulty: Number(newDifficulty.toFixed(2)),
      total_attempts: totalAttempts,
      correct_attempts: newCorrectAttempts,
      success_rate: Number((newCorrectAttempts / totalAttempts).toFixed(3)),
      interval_days: Number(interval.toFixed(3)),
      due_date: dueDate,
      last_review: reviewDate,
      avg_response_time: Math.round(newAvgResponseTime),
      response_quality: responseQuality
    };
  }

  /**
   * Get preview of next intervals for different response qualities
   */
  getNextIntervals(questionState) {
    const intervals = {};
    const responseQualities = ['again', 'hard', 'good', 'easy'];

    for (const quality of responseQualities) {
      const isCorrect = quality !== 'again';
      const mockResponseTime = quality === 'easy' ? 2000 : quality === 'hard' ? 8000 : 5000;

      const result = this.schedule(questionState, isCorrect, mockResponseTime);
      intervals[quality] = {
        interval: result.interval_days,
        dueDate: result.due_date,
        stability: result.stability
      };
    }

    return intervals;
  }

  /**
   * Check if a question is due for review
   */
  isDue(questionState, currentDate = new Date()) {
    if (!questionState.due_date) return true; // New questions are always due

    const dueDate = new Date(questionState.due_date);
    return currentDate >= dueDate;
  }
}

/**
 * Response quality definitions for Quiz FSRS
 */
const QUIZ_RESPONSE = {
  AGAIN: 'again',  // Wrong answer
  HARD: 'hard',    // Correct but slow
  GOOD: 'good',    // Correct at normal speed
  EASY: 'easy'     // Correct and fast
};

export {
  QuizFSRS,
  QUIZ_RESPONSE
};