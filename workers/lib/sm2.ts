// SM-2 spaced repetition algorithm
// new interval = current interval * ease% * interval modifier

export interface SM2Card {
  easeFactor: number;   // starts at 2.5, min 1.3
  interval: number;     // days until next review, starts at 1
  repetitions: number;  // how many times reviewed successfully
  nextReview: number;   // Unix timestamp (ms)
}

export type Quality = 0 | 1 | 2 | 3 | 4 | 5;
// 0-1: complete blackout / wrong
// 2:   wrong but answer felt familiar  
// 3:   correct with significant difficulty
// 4:   correct with some hesitation
// 5:   perfect response

export function defaultCard(): SM2Card {
  return {
    easeFactor: 2.5,
    interval: 1,
    repetitions: 0,
    nextReview: Date.now(),
  };
}

export function updateCard(card: SM2Card, quality: Quality): SM2Card {
  const q = quality;

  // If quality < 3, reset repetitions (relearn)
  if (q < 3) {
    return {
      ...card,
      repetitions: 0,
      interval: 1,
      easeFactor: Math.max(1.3, card.easeFactor - 0.2),
      nextReview: Date.now() + 1 * 24 * 60 * 60 * 1000,
    };
  }

  // Update ease factor
  const newEF = Math.max(
    1.3,
    card.easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)
  );

  // Calculate new interval
  let newInterval: number;
  if (card.repetitions === 0) {
    newInterval = 1;
  } else if (card.repetitions === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(card.interval * newEF);
  }

  return {
    easeFactor: newEF,
    interval: newInterval,
    repetitions: card.repetitions + 1,
    nextReview: Date.now() + newInterval * 24 * 60 * 60 * 1000,
  };
}

export function isDue(card: SM2Card): boolean {
  return Date.now() >= card.nextReview;
}