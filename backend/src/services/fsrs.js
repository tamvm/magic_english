/**
 * FSRS (Free Spaced Repetition Scheduler) Algorithm Implementation
 * Based on the FSRS algorithm by Jarrett Ye
 * https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 */

class FSRS {
  constructor(parameters = null) {
    // Default FSRS parameters (can be customized per user)
    this.parameters = parameters || {
      // Learning parameters
      requestRetention: 0.9,      // Target retention rate
      maximumInterval: 36500,     // Maximum interval in days (100 years)

      // FSRS coefficients (optimized for general use)
      w: [
        0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61
      ]
    };
  }

  /**
   * Calculate initial difficulty based on first rating
   */
  initDifficulty(rating) {
    return Math.max(1, Math.min(10, this.parameters.w[4] - Math.exp(this.parameters.w[5] * (rating - 1))));
  }

  /**
   * Calculate initial stability for new cards
   */
  initStability(rating) {
    return Math.max(0.1, this.parameters.w[rating - 1]);
  }

  /**
   * Calculate difficulty after review
   */
  nextDifficulty(difficulty, rating) {
    const deltaD = -this.parameters.w[6] * (rating - 3);
    const newDifficulty = difficulty + deltaD;
    return Math.max(1, Math.min(10, newDifficulty));
  }

  /**
   * Calculate stability for learning/relearning state
   */
  nextRecallStability(difficulty, stability, retrievability, rating) {
    const hardPenalty = rating === 2 ? this.parameters.w[15] : 1;
    const easyBonus = rating === 4 ? this.parameters.w[16] : 1;

    return stability * (
      Math.exp(this.parameters.w[8]) *
      (11 - difficulty) *
      Math.pow(stability, -this.parameters.w[9]) *
      (Math.exp((1 - retrievability) * this.parameters.w[10]) - 1) *
      hardPenalty * easyBonus
    );
  }

  /**
   * Calculate stability for forgot cards
   */
  nextForgetStability(difficulty, stability, retrievability) {
    return this.parameters.w[11] * Math.pow(difficulty, -this.parameters.w[12]) *
           (Math.pow(stability + 1, this.parameters.w[13]) - 1) *
           Math.exp((1 - retrievability) * this.parameters.w[14]);
  }

  /**
   * Calculate retrievability (probability of recall)
   */
  calculateRetrievability(elapsedDays, stability) {
    if (stability <= 0) return 0;
    return Math.exp(-elapsedDays / stability);
  }

  /**
   * Calculate interval from stability
   */
  calculateInterval(stability) {
    const interval = Math.round(stability * Math.log(this.parameters.requestRetention) / Math.log(0.9));
    return Math.max(1, Math.min(this.parameters.maximumInterval, interval));
  }

  /**
   * Main scheduling function - returns next review parameters
   * @param {Object} card - Current card state
   * @param {number} rating - User rating (1=Again, 2=Hard, 3=Good, 4=Easy)
   * @param {Date} reviewDate - Date of review
   * @returns {Object} Updated card parameters
   */
  schedule(card, rating, reviewDate = new Date()) {
    const elapsedDays = card.lastReview ?
      Math.max(0, Math.floor((reviewDate - new Date(card.lastReview)) / (1000 * 60 * 60 * 24))) : 0;

    let newState = card.state;
    let newStability = card.stability;
    let newDifficulty = card.difficulty;
    let newReps = card.reps;
    let newLapses = card.lapses;

    // Calculate retrievability for existing cards
    const retrievability = card.lastReview ?
      this.calculateRetrievability(elapsedDays, card.stability) : 1;

    switch (card.state) {
      case 'new':
        // First time seeing this card
        newDifficulty = this.initDifficulty(rating);
        newStability = this.initStability(rating);
        newReps = 1;

        if (rating === 1) {
          newState = 'learning';
        } else if (rating === 2) {
          newState = 'learning';
        } else {
          newState = 'review';
        }
        break;

      case 'learning':
      case 'relearning':
        newReps += 1;

        if (rating === 1) {
          // Again - reset to learning
          newLapses += 1;
          newState = card.state === 'learning' ? 'learning' : 'relearning';
          newStability = this.nextForgetStability(newDifficulty, newStability, retrievability);
        } else {
          // Hard, Good, or Easy - move to review
          newState = 'review';
          newStability = this.nextRecallStability(newDifficulty, newStability, retrievability, rating);
        }

        newDifficulty = this.nextDifficulty(newDifficulty, rating);
        break;

      case 'review':
        newReps += 1;

        if (rating === 1) {
          // Again - move to relearning
          newLapses += 1;
          newState = 'relearning';
          newStability = this.nextForgetStability(newDifficulty, newStability, retrievability);
        } else {
          // Hard, Good, or Easy - stay in review
          newState = 'review';
          newStability = this.nextRecallStability(newDifficulty, newStability, retrievability, rating);
        }

        newDifficulty = this.nextDifficulty(newDifficulty, rating);
        break;
    }

    // Calculate next review interval
    const interval = this.calculateInterval(newStability);
    const dueDate = new Date(reviewDate);
    dueDate.setDate(dueDate.getDate() + interval);

    return {
      stability: Math.max(0.1, newStability),
      difficulty: newDifficulty,
      state: newState,
      reps: newReps,
      lapses: newLapses,
      elapsedDays: elapsedDays,
      scheduledDays: interval,
      dueDate: dueDate,
      lastReview: reviewDate,
      retrievability: retrievability
    };
  }

  /**
   * Get next review intervals for all ratings (for preview)
   * @param {Object} card - Current card state
   * @returns {Object} Intervals for each rating
   */
  getNextIntervals(card) {
    const intervals = {};

    for (let rating = 1; rating <= 4; rating++) {
      const result = this.schedule(card, rating, new Date());
      intervals[rating] = {
        interval: result.scheduledDays,
        state: result.state,
        dueDate: result.dueDate
      };
    }

    return intervals;
  }

  /**
   * Calculate optimal retention rate based on user data
   * This can be used to adjust parameters for individual users
   */
  optimizeRetention(reviewHistory, studyTimePerDay = 20) {
    // Simplified optimization - in practice, this would use more complex algorithms
    if (reviewHistory.length < 30) {
      return this.parameters.requestRetention;
    }

    const recentReviews = reviewHistory.slice(-100);
    const correctReviews = recentReviews.filter(review => review.rating >= 3).length;
    const currentRetention = correctReviews / recentReviews.length;

    // Adjust target retention based on current performance
    if (currentRetention > 0.95) {
      return Math.max(0.8, this.parameters.requestRetention - 0.05);
    } else if (currentRetention < 0.8) {
      return Math.min(0.95, this.parameters.requestRetention + 0.05);
    }

    return this.parameters.requestRetention;
  }
}

/**
 * Rating definitions for FSRS
 */
const RATING = {
  AGAIN: 1,   // Completely forgot, needs to restart learning
  HARD: 2,    // Remembered with difficulty, but got it right
  GOOD: 3,    // Remembered correctly with some effort
  EASY: 4     // Remembered easily and quickly
};

/**
 * Card states in FSRS
 */
const CARD_STATE = {
  NEW: 'new',           // Never studied
  LEARNING: 'learning',  // Currently learning (first time)
  REVIEW: 'review',      // In review phase (mastered)
  RELEARNING: 'relearning' // Relearning after forgetting
};

export {
  FSRS,
  RATING,
  CARD_STATE
};