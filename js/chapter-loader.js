/**
 * chapter-loader.js — fetch, validate, and normalise chapter JSON
 */

/**
 * Returns the base URL for asset loading, correctly handling both
 * local file serving and GitHub Pages subdirectory deployment.
 * @returns {string}
 */
export function getBasePath() {
  return new URL('.', document.baseURI).href;
}

/**
 * Fetches and parses the chapter index.
 * @returns {Promise<Array>} Array of chapter metadata objects
 */
export async function fetchChapterIndex() {
  const url = getBasePath() + 'chapters/chapter-index.json';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch chapter index: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetches and parses a chapter JSON file.
 * @param {string} path — path relative to site root (e.g. 'chapters/body-in-the-close/chapter.json')
 * @returns {Promise<Object>} Parsed chapter data
 */
export async function fetchChapter(path) {
  const url = getBasePath() + path;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch chapter at ${path}: ${response.status}`);
  }
  const data = await response.json();
  const { valid, warnings } = validateChapter(data);
  if (!valid) {
    throw new Error(`Invalid chapter at ${path}: ${warnings.join('; ')}`);
  }
  if (warnings.length) {
    warnings.forEach(w => console.warn(`[chapter-loader] ${w}`));
  }
  return mergeDefaults(data);
}

/**
 * Validates chapter data structure.
 * Returns { valid: boolean, warnings: string[] }.
 * @param {Object} data
 * @returns {{ valid: boolean, warnings: string[] }}
 */
export function validateChapter(data) {
  const warnings = [];
  let valid = true;

  const required = ['meta', 'characters', 'solution', 'clues', 'cards', 'endings', 'briefing'];
  for (const field of required) {
    if (!data[field]) {
      warnings.push(`Missing required field: ${field}`);
      valid = false;
    }
  }

  if (data.meta) {
    for (const f of ['id', 'title', 'max_turns']) {
      if (data.meta[f] == null) warnings.push(`meta.${f} is missing`);
    }
  }

  if (data.solution) {
    for (const f of ['suspect', 'motive', 'method']) {
      if (!data.solution[f]) warnings.push(`solution.${f} is missing`);
    }
  }

  if (data.cards && data.cards.length === 0) {
    warnings.push('Chapter has no cards');
    valid = false;
  }

  if (data.endings) {
    for (const e of ['win', 'wrong_accusation', 'time_up']) {
      if (!data.endings[e]) warnings.push(`endings.${e} is missing`);
    }
  }

  return { valid, warnings };
}

/**
 * Fills in default values for optional fields.
 * @param {Object} data
 * @returns {Object} Chapter data with defaults merged
 */
export function mergeDefaults(data) {
  // Default card fields
  if (data.cards) {
    data.cards = data.cards.map(card => ({
      weight:   1,
      one_shot: false,
      sprite:   'detective',
      ...card,
    }));
  }

  // Default clue fields
  if (data.clues) {
    data.clues = data.clues.map(clue => ({
      is_red_herring: false,
      sprite: 'document',
      ...clue,
    }));
  }

  // Default palette from variables.css values
  if (!data.palette) {
    data.palette = {
      primary:    '#2B1B17',
      accent:     '#D4A017',
      danger:     '#8B0000',
      background: '#0D0D0D',
      card:       '#F5E6C8',
      text:       '#2B1B17',
    };
  }

  return data;
}
