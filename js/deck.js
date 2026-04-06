/**
 * deck.js — weighted card bag (Reigns-style draw system)
 *
 * Cards are drawn from an eligible pool that is recalculated on every draw.
 * The pool composition shifts as flags change, creating authored-feeling
 * narrative from semi-random selection.
 */

/**
 * Builds the eligible card pool from the full card list and current state.
 *
 * Priority order (checked by the engine before calling buildPool):
 *   1. cardQueue (injected cards) — handled by engine, not this function
 *   2. sequence cards at the current position — included here
 *   3. always + conditional cards matching current flags
 *
 * @param {Object[]} cards — full card list from chapter data
 * @param {Object} state — current game state (flags, seenCards, seenSequencePositions)
 * @returns {{ card: Object, weight: number }[]} Weighted pool
 */
export function buildPool(cards, state) {
  const { flags, seenCards, seenSequencePositions } = state;
  const pool = [];

  for (const card of cards) {
    // Skip one-shot cards already seen
    if (card.one_shot && seenCards.has(card.id)) continue;

    if (card.type === 'sequence') {
      // Only include if this sequence position hasn't been played yet
      if (!seenSequencePositions.has(card.sequence_position)) {
        pool.push({ card, weight: 999 }); // sequence cards always take priority
      }
      continue;
    }

    if (card.type === 'always' || card.type === 'one_shot') {
      // one_shot type means always-eligible but removed after seeing (handled above)
      if (!card.one_shot || !seenCards.has(card.id)) {
        pool.push({ card, weight: card.weight ?? 1 });
      }
      continue;
    }

    if (card.type === 'conditional') {
      if (conditionMet(card.condition, flags, state.clues)) {
        pool.push({ card, weight: card.weight ?? 1 });
      }
    }
  }

  return pool;
}

/**
 * Evaluates whether a card's condition is satisfied.
 * requires_flags may contain flag IDs or clue IDs (both are checked).
 *
 * @param {Object|undefined} condition
 * @param {Set<string>} flags
 * @param {string[]} clues
 * @returns {boolean}
 */
function conditionMet(condition, flags, clues) {
  if (!condition) return true;

  const { requires_flags = [], excludes_flags = [] } = condition;

  for (const flag of requires_flags) {
    if (!flags.has(flag) && !clues.includes(flag)) return false;
  }

  for (const flag of excludes_flags) {
    if (flags.has(flag) || clues.includes(flag)) return false;
  }

  return true;
}

/**
 * Selects a card from the pool using weighted random sampling.
 *
 * @param {{ card: Object, weight: number }[]} pool
 * @returns {Object} Selected card
 * @throws {Error} If pool is empty
 */
export function weightedDraw(pool) {
  if (pool.length === 0) {
    throw new Error('weightedDraw called with empty pool');
  }

  // If any sequence cards are present, take the lowest sequence_position
  const sequenceEntries = pool.filter(e => e.card.type === 'sequence');
  if (sequenceEntries.length > 0) {
    sequenceEntries.sort((a, b) => a.card.sequence_position - b.card.sequence_position);
    return sequenceEntries[0].card;
  }

  // Weighted random pick
  const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0);
  let r = Math.random() * totalWeight;

  for (const entry of pool) {
    r -= entry.weight;
    if (r <= 0) return entry.card;
  }

  // Fallback (floating-point edge case)
  return pool[pool.length - 1].card;
}
