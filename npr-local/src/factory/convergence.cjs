/**
 * Convergence Detector
 * 
 * Detects information stasis in feedback loops:
 * - Fixed Points (Output X -> Output X)
 * - Cycles (Output A -> Output B -> Output A)
 * 
 * Stops the factory run if stability is reached.
 */

const crypto = require('crypto');

class ConvergenceDetector {
  constructor(windowSize = 5) {
    this.history = [];
    this.windowSize = windowSize;
  }

  /**
   * Check the new output hash against history.
   * @param {string} output - The raw output string.
   * @returns {Object} - { status: 'converging' | 'fixed-point' | 'cycle-detected', hash: string }
   */
  check(output) {
    const hash = crypto.createHash('sha256').update(output).digest('hex');
    
    // Push new hash
    this.history.push(hash);
    if (this.history.length > this.windowSize) {
      this.history.shift(); // Keep only last N steps
    }

    const last = this.history[this.history.length - 2]; // The one before this

    // 1. Fixed Point Check: Is this exactly the same as the previous step?
    if (last && hash === last) {
      return { status: 'fixed-point', hash, reason: 'Output identical to previous step' };
    }

    // 2. Cycle Check: Have we seen this hash before in the window?
    for (let i = 0; i < this.history.length - 2; i++) {
      if (this.history[i] === hash) {
        return { status: 'cycle-detected', hash, reason: `Cyclic pattern found at step ${this.history.length - i}` };
      }
    }

    return { status: 'converging', hash, reason: 'New state detected' };
  }

  /**
   * Reset history (start a new chain).
   */
  reset() {
    this.history = [];
  }
}

module.exports = ConvergenceDetector;
