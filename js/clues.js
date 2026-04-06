/**
 * clues.js — clue inventory: render panel, handle expansion
 */

import { getSprite } from './sprites.js';

/**
 * Renders the clue list into the clue panel overlay body.
 * @param {string[]} collectedClueIds — IDs of clues the player has collected
 * @param {Object[]} allClues — full clue definitions from chapter data
 */
export function renderCluePanel(collectedClueIds, allClues) {
  const container = document.getElementById('overlay-clues-body');
  if (!container) return;

  if (collectedClueIds.length === 0) {
    container.innerHTML = '<p class="clue-panel__empty">No clues collected yet. Keep investigating.</p>';
    return;
  }

  const list = document.createElement('ul');
  list.className = 'clue-list';

  for (const id of collectedClueIds) {
    const clue = allClues.find(c => c.id === id);
    if (!clue) continue;

    const item = document.createElement('li');
    item.className = 'clue-item';
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.setAttribute('aria-expanded', 'false');

    const icon = getSprite(clue.sprite || 'document', 32);
    icon.className = 'clue-item__icon';

    const info = document.createElement('div');
    info.innerHTML = `
      <div class="clue-item__name">${_escape(clue.name)}</div>
      <div class="clue-item__desc">${_escape(clue.description)}</div>
      <div class="clue-item__detail">${_escape(clue.detail || '')}</div>
    `;

    item.appendChild(icon);
    item.appendChild(info);
    list.appendChild(item);
  }

  container.innerHTML = '';
  container.appendChild(list);
  attachCluePanelEvents();
}

/**
 * Wires tap-to-expand behaviour on clue items.
 * Safe to call multiple times (uses event delegation).
 */
export function attachCluePanelEvents() {
  const container = document.getElementById('overlay-clues-body');
  if (!container) return;

  // Use event delegation on the container
  container.addEventListener('click', _onClueClick);
  container.addEventListener('keydown', _onClueKeydown);
}

function _onClueClick(e) {
  const item = e.target.closest('.clue-item');
  if (!item) return;
  _toggleClue(item);
}

function _onClueKeydown(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    const item = e.target.closest('.clue-item');
    if (!item) return;
    e.preventDefault();
    _toggleClue(item);
  }
}

function _toggleClue(item) {
  const expanded = item.classList.toggle('expanded');
  item.setAttribute('aria-expanded', String(expanded));
}

function _escape(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
