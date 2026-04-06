/**
 * ui.js — DOM helpers: screen routing, card rendering, toasts, overlays
 */

import { getSprite } from './sprites.js';

// ─── Screen management ────────────────────────────────────────────────────────

/**
 * Shows one screen and hides all others.
 * @param {'menu'|'briefing'|'game'|'ending'} id
 */
export function showScreen(id) {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(s => s.classList.remove('screen--active'));
  const target = document.getElementById(`screen-${id}`);
  if (target) target.classList.add('screen--active');
}

// ─── Overlay management ───────────────────────────────────────────────────────

/**
 * Opens a dialog overlay.
 * @param {'clues'|'accusation'|'help'|'hamburger'} id
 */
export function showOverlay(id) {
  const dialog = document.getElementById(`overlay-${id}`);
  if (dialog && !dialog.open) {
    dialog.showModal();
  }
}

/**
 * Closes a specific overlay.
 * @param {string} id
 */
export function hideOverlay(id) {
  const dialog = document.getElementById(`overlay-${id}`);
  if (dialog && dialog.open) dialog.close();
}

/** Closes all open overlays. */
export function hideAllOverlays() {
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
}

// ─── Toast notifications ──────────────────────────────────────────────────────

let _toastTimeout = null;

/**
 * Shows a brief toast notification.
 * @param {string} message
 * @param {'clue'|'info'|'warning'} [type]
 */
export function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  clearTimeout(_toastTimeout);
  toast.textContent = message;
  toast.className   = `toast toast--${type}`;
  // Force reflow to restart animation
  void toast.offsetWidth;
  toast.classList.add('visible');

  _toastTimeout = setTimeout(() => {
    toast.classList.remove('visible');
  }, 2500);
}

// ─── Clock ────────────────────────────────────────────────────────────────────

/**
 * Updates the clock display in the top bar.
 * @param {number} remaining
 * @param {number} total
 */
export function updateClock(remaining, total) {
  const el = document.getElementById('clock-display');
  if (!el) return;
  el.textContent = `⏱ ${remaining}/${total}`;
  el.classList.toggle('urgent', remaining <= Math.ceil(total * 0.2));
}

/**
 * Updates the clue count badge on the Clues button.
 * @param {number} count
 */
export function updateClueCount(count) {
  const el = document.getElementById('clue-count');
  if (el) el.textContent = `🔍 Clues (${count})`;
}

// ─── Outcome panel ────────────────────────────────────────────────────────────

/**
 * Shows the outcome panel with result text and optional clue toasts.
 * @param {string} text
 * @param {string[]} cluesGained — array of clue names (for toasts)
 * @param {() => void} onDismiss
 */
export function showOutcomePanel(text, cluesGained, onDismiss) {
  const panel = document.getElementById('outcome-panel');
  if (!panel) return;

  panel.innerHTML = `
    <p class="outcome__text">${escapeHtml(text)}</p>
    <span class="outcome__tap-hint">Tap anywhere to continue</span>
  `;
  panel.classList.add('visible');

  // Show clue toasts sequentially
  cluesGained.forEach((name, i) => {
    setTimeout(() => showToast(`+🔍 ${name}`, 'clue'), 300 + i * 600);
  });

  function dismiss() {
    panel.removeEventListener('click', dismiss);
    panel.classList.remove('visible');
    onDismiss();
  }

  setTimeout(() => panel.addEventListener('click', dismiss), 400);
}

/** Hides the outcome panel immediately. */
export function hideOutcomePanel() {
  const panel = document.getElementById('outcome-panel');
  if (panel) panel.classList.remove('visible');
}

// ─── Card rendering ───────────────────────────────────────────────────────────

/**
 * Creates and returns a card DOM element.
 * Does NOT insert it into the DOM — caller does that.
 * @param {Object} card — card data from chapter JSON
 * @param {Object} chapterData — full chapter data (for sprite lookup)
 * @returns {HTMLElement}
 */
export function renderCard(card, chapterData) {
  const el = document.createElement('div');
  el.className = 'card entering';
  el.setAttribute('role', 'main');
  el.setAttribute('aria-label', 'Current encounter card');

  // Tint overlays (for drag colour effect)
  const tintLeft  = document.createElement('div');
  const tintRight = document.createElement('div');
  tintLeft.className  = 'card__tint-left';
  tintRight.className = 'card__tint-right';

  // Portrait
  const portrait = document.createElement('div');
  portrait.className = 'card__portrait';
  const spriteCanvas = getSprite(card.sprite || 'detective', 128);
  portrait.appendChild(spriteCanvas);

  // Narrative
  const narrative = document.createElement('div');
  narrative.className = 'card__narrative';
  narrative.textContent = card.narrative || '';

  // Choice labels
  const choices = document.createElement('div');
  choices.className = 'card__choices';

  const choiceLeft  = document.createElement('div');
  const choiceRight = document.createElement('div');
  choiceLeft.className  = 'card__choice-left';
  choiceRight.className = 'card__choice-right';
  choiceLeft.textContent  = card.left?.label  || '←';
  choiceRight.textContent = card.right?.label || '→';

  choices.appendChild(choiceLeft);
  choices.appendChild(choiceRight);

  el.appendChild(tintLeft);
  el.appendChild(tintRight);
  el.appendChild(portrait);
  el.appendChild(narrative);
  el.appendChild(choices);

  return el;
}

// ─── Chapter select ───────────────────────────────────────────────────────────

/**
 * Renders the chapter select list.
 * @param {Object[]} chapters — array of chapter metadata
 * @param {(meta: Object) => void} onSelect
 */
export function renderChapterList(chapters, onSelect) {
  const container = document.getElementById('chapter-list');
  if (!container) return;
  container.innerHTML = '';

  chapters.forEach(meta => {
    const btn = document.createElement('button');
    btn.className = 'chapter-card';
    btn.innerHTML = `
      <div class="chapter-card__title">${escapeHtml(meta.title)}</div>
      <div class="chapter-card__subtitle">${escapeHtml(meta.subtitle || '')}</div>
      <div class="chapter-card__meta">
        <span>${escapeHtml(meta.difficulty || 'standard')}</span>
        <span>~${meta.estimated_minutes || '?'} min</span>
      </div>
    `;
    btn.addEventListener('click', () => onSelect(meta));
    container.appendChild(btn);
  });
}

// ─── Briefing screen ──────────────────────────────────────────────────────────

/**
 * Populates and shows the briefing screen.
 * @param {Object} briefing — chapter.briefing object
 */
export function renderBriefing(briefing) {
  const title = document.getElementById('briefing-title');
  const text  = document.getElementById('briefing-text');
  const list  = document.getElementById('briefing-objectives');

  if (title) title.textContent = briefing.title || '';
  if (text)  text.textContent  = briefing.text  || '';

  if (list && briefing.objectives) {
    list.innerHTML = briefing.objectives
      .map(o => `<li>${escapeHtml(o)}</li>`)
      .join('');
  }
}

// ─── Ending screen ────────────────────────────────────────────────────────────

/**
 * Renders the ending screen with title, text, and portrait sprite.
 * @param {Object} ending — ending data object from chapter.endings
 */
export function renderEndingScreen(ending) {
  const title    = document.getElementById('ending-title');
  const text     = document.getElementById('ending-text');
  const portrait = document.getElementById('ending-portrait');

  if (title) title.textContent = ending.title || '';
  if (text)  text.textContent  = ending.text  || '';

  if (portrait) {
    portrait.innerHTML = '';
    const canvas = getSprite(ending.sprite || 'detective', 128);
    canvas.className = 'ending__portrait';
    portrait.appendChild(canvas);
  }
}

// ─── Help overlay ─────────────────────────────────────────────────────────────

/** Populates the help overlay (static content, called once on init). */
export function renderHelp() {
  const body = document.getElementById('overlay-help-body');
  if (!body) return;

  body.innerHTML = `
    <div class="help-section">
      <h3 class="help-section__title">How to Play</h3>
      <ul>
        <li>Swipe left or right to make choices — each card is an encounter, a witness, a lead</li>
        <li>Every swipe costs time. Watch the clock — when it hits zero, the trail goes cold</li>
        <li>Collect clues by choosing wisely. Some leads are red herrings</li>
        <li>Tap 🔍 Clues at any time to review your evidence (costs no turns)</li>
        <li>When you're ready, tap ⚖ Accuse to name the killer, motive, and method — but ye only get one chance, so make it count</li>
      </ul>
    </div>
    <div class="help-section">
      <h3 class="help-section__title">About</h3>
      <p>Whit Noo? is set in the world of James McLevy, Edinburgh's first detective (1833–1860s). His published casebooks are in the public domain and likely inspired Arthur Conan Doyle's Sherlock Holmes. This game is an original work of interactive fiction inspired by McLevy's world.</p>
    </div>
    <div class="help-section">
      <h3 class="help-section__title">Links</h3>
      <ul>
        <li><a href="https://github.com/federicoandreis/whit-noo" target="_blank" rel="noopener">View the source code on GitHub</a></li>
        <li><a href="https://buymeacoffee.com/stats_fede" target="_blank" rel="noopener">Support the project — Buy Me a Coffee</a></li>
      </ul>
    </div>
  `;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
