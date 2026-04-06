/**
 * engine.js — game state machine
 *
 * Owns the single gameState object. All other modules read state via getState()
 * and drive changes through the exported functions.
 */

import { buildPool, weightedDraw } from './deck.js';

/** @type {Object} */
let gameState = createInitialState();

function createInitialState() {
  return {
    chapter:               null,
    turnsRemaining:        0,
    turnsTotal:            0,
    clues:                 [],   // collected clue IDs
    flags:                 new Set(),
    seenCards:             new Set(),
    seenSequencePositions: new Set(),
    cardQueue:             [],   // force-queued card IDs (from inject_cards)
    currentCard:           null,
    encounteredCharacters: new Set(), // character IDs seen on shown cards
    phase: 'menu',               // 'menu'|'briefing'|'playing'|'ending'
    ending:                null,
    accusationMade:        false,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialises game state from loaded chapter data and transitions to 'briefing'.
 * @param {Object} chapterData
 */
export function startChapter(chapterData) {
  gameState = createInitialState();
  gameState.chapter        = chapterData;
  gameState.turnsRemaining = chapterData.meta.max_turns;
  gameState.turnsTotal     = chapterData.meta.max_turns;
  gameState.phase          = 'briefing';
}

/**
 * Transitions from briefing to playing.
 */
export function beginPlaying() {
  gameState.phase = 'playing';
}

/**
 * Draws the next card from the queue or weighted pool.
 * @returns {Object} The drawn card
 * @throws {Error} If no cards are available
 */
export function drawNextCard() {
  const chapter = gameState.chapter;

  // 1. Check forced queue first
  while (gameState.cardQueue.length > 0) {
    const id   = gameState.cardQueue.shift();
    const card = chapter.cards.find(c => c.id === id);
    if (card) {
      gameState.currentCard = card;
      return card;
    }
  }

  // 2. Build eligible pool
  const pool = buildPool(chapter.cards, gameState);

  if (pool.length === 0) {
    // No cards available — end with time_up as a safe fallback
    console.warn('[engine] Card pool is empty; triggering time_up ending');
    _triggerEnding('time_up');
    return null;
  }

  // 3. Weighted draw
  const card = weightedDraw(pool);
  gameState.currentCard = card;
  return card;
}

/**
 * Records that a card has been displayed (marks as seen, tracks character).
 * Call this when the card element is shown to the player.
 * @param {Object} card
 */
export function markCardSeen(card) {
  gameState.seenCards.add(card.id);

  if (card.type === 'sequence') {
    gameState.seenSequencePositions.add(card.sequence_position);
  }

  // Track encountered characters for accusation dropdown population.
  // Only use the explicit 'character' field — never infer from sprite, because
  // multiple characters can share a sprite (e.g. urchin = jeannie + rab_mcnair,
  // lady = agnes_brodie + mrs_dalrymple) which would leak suspects prematurely.
  if (card.character) {
    gameState.encounteredCharacters.add(card.character);
  }
}

/**
 * Applies the outcome of a left or right swipe.
 * @param {Object} card
 * @param {'left'|'right'} direction
 * @returns {{ cluesGained: string[], clueNames: string[], endingTriggered: string|null }}
 */
export function resolveOutcome(card, direction) {
  const outcome = card[direction]?.outcome;
  if (!outcome) return { cluesGained: [], clueNames: [], endingTriggered: null };

  // Turn cost
  const cost = typeof outcome.turn_cost === 'number' ? outcome.turn_cost : 1;
  gameState.turnsRemaining = Math.max(0, gameState.turnsRemaining - cost);

  // Grant clues
  const cluesGained = [];
  const clueNames   = [];
  if (Array.isArray(outcome.grant_clues)) {
    for (const clueId of outcome.grant_clues) {
      if (!gameState.clues.includes(clueId)) {
        gameState.clues.push(clueId);
        // Also set the clue ID as a flag so conditions can reference it
        gameState.flags.add(clueId);
        cluesGained.push(clueId);
        const clueDef = gameState.chapter.clues.find(c => c.id === clueId);
        if (clueDef) clueNames.push(clueDef.name);
      }
    }
  }

  // Remove clues
  if (Array.isArray(outcome.remove_clues)) {
    for (const clueId of outcome.remove_clues) {
      gameState.clues = gameState.clues.filter(id => id !== clueId);
      gameState.flags.delete(clueId);
    }
  }

  // Set flags
  if (Array.isArray(outcome.set_flags)) {
    for (const flag of outcome.set_flags) {
      gameState.flags.add(flag);
    }
  }

  // Clear flags
  if (Array.isArray(outcome.clear_flags)) {
    for (const flag of outcome.clear_flags) {
      gameState.flags.delete(flag);
    }
  }

  // Inject cards to queue
  if (Array.isArray(outcome.inject_cards)) {
    gameState.cardQueue.unshift(...outcome.inject_cards);
  }

  // Trigger ending directly
  const endingTriggered = outcome.trigger_ending || null;
  if (endingTriggered) {
    _triggerEnding(endingTriggered);
  }

  return { cluesGained, clueNames, endingTriggered };
}

/**
 * Checks whether end conditions are met after resolving an outcome.
 * @returns {'time_up'|null} Ending ID if triggered, null if game continues
 */
export function checkEndConditions() {
  if (gameState.turnsRemaining <= 0) {
    _triggerEnding('time_up');
    return 'time_up';
  }
  return null;
}

/**
 * Processes the player's accusation.
 * @param {string} suspectId
 * @param {string} motiveClueId
 * @param {string} methodClueId
 * @returns {'win'|'wrong_accusation'}
 */
export function makeAccusation(suspectId, motiveClueId, methodClueId) {
  if (gameState.accusationMade) return 'wrong_accusation';
  gameState.accusationMade = true;

  const sol = gameState.chapter.solution;
  const correct = (
    suspectId    === sol.suspect &&
    motiveClueId === sol.motive  &&
    methodClueId === sol.method
  );

  const endingKey = correct ? 'win' : 'wrong_accusation';
  _triggerEnding(endingKey);
  return endingKey;
}

/**
 * Returns a safe snapshot of the current game state.
 * Arrays and Sets are copied so callers cannot accidentally mutate engine state.
 * The chapter object is passed by reference (read-only by convention).
 * @returns {Object}
 */
export function getState() {
  return {
    chapter:               gameState.chapter,          // read-only reference
    turnsRemaining:        gameState.turnsRemaining,
    turnsTotal:            gameState.turnsTotal,
    clues:                 [...gameState.clues],        // copy — IDs only, never definitions
    flags:                 new Set(gameState.flags),
    seenCards:             new Set(gameState.seenCards),
    cardQueue:             [...gameState.cardQueue],
    currentCard:           gameState.currentCard,
    encounteredCharacters: new Set(gameState.encounteredCharacters),
    phase:                 gameState.phase,
    ending:                gameState.ending,
    accusationMade:        gameState.accusationMade,
  };
}

/** Fully resets state (e.g. for "Play Again"). */
export function resetState() {
  gameState = createInitialState();
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _triggerEnding(endingKey) {
  const endings = gameState.chapter?.endings;
  if (!endings) return;

  const ending = endings[endingKey] || endings['time_up'];
  gameState.ending = { ...ending, key: endingKey };
  gameState.phase  = 'ending';
}
