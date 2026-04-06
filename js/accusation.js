/**
 * accusation.js — accusation UI: build selectors, validate, resolve
 *
 * The accusation dropdowns are populated ONLY from:
 * - Encountered characters (for suspect) — never reveals unseen suspects
 * - Collected clues (for motive and method) — player must find evidence first
 */

/**
 * Renders the accusation form into the overlay body.
 * @param {Object} state — current game state (from engine.getState())
 * @param {Object} chapterData — loaded chapter data
 */
export function renderAccusationScreen(state, chapterData) {
  const body = document.getElementById('overlay-accusation-body');
  if (!body) return;

  const { encounteredCharacters, clues: collectedClueIds } = state;
  const { characters, clues: allClues } = chapterData;

  // Suspects: all encountered characters — the player accuses anyone they've met;
  // is_suspect is internal authoring metadata, not a player-facing filter
  const suspects = characters.filter(c =>
    encounteredCharacters.has(c.id)
  );

  // If no suspects encountered yet, show a warning
  if (suspects.length === 0) {
    body.innerHTML = `
      <p class="accusation__warning">
        Ye haven't encountered any suspects yet.<br>
        Keep investigating before making an accusation.
      </p>
    `;
    return;
  }

  // Collected clue definitions (for motive and method selectors)
  const collectedClues = collectedClueIds
    .map(id => allClues.find(c => c.id === id))
    .filter(Boolean);

  if (collectedClues.length === 0) {
    body.innerHTML = `
      <p class="accusation__warning">
        Ye have no clues yet.<br>
        Gather evidence before making yer accusation.
      </p>
    `;
    return;
  }

  body.innerHTML = `
    <p class="accusation__warning">
      Ye only get one chance.<br>
      Choose carefully, Inspector.
    </p>
    <form class="accusation-form" id="accusation-form" novalidate>
      <div class="accusation-field">
        <label class="accusation-field__label" for="acc-suspect">Who committed the murder?</label>
        <select class="accusation-field__select" id="acc-suspect" required>
          <option value="">— Select a suspect —</option>
          ${suspects.map(s =>
            `<option value="${_escape(s.id)}">${_escape(s.name)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="accusation-field">
        <label class="accusation-field__label" for="acc-motive">What was the motive?</label>
        <select class="accusation-field__select" id="acc-motive" required>
          <option value="">— Select a clue as evidence —</option>
          ${collectedClues.map(c =>
            `<option value="${_escape(c.id)}">${_escape(c.name)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="accusation-field">
        <label class="accusation-field__label" for="acc-method">What was the method?</label>
        <select class="accusation-field__select" id="acc-method" required>
          <option value="">— Select a clue as evidence —</option>
          ${collectedClues.map(c =>
            `<option value="${_escape(c.id)}">${_escape(c.name)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="accusation__submit">
        <button type="submit" class="btn btn--danger" style="width:100%">
          Submit Accusation
        </button>
      </div>
    </form>
  `;
}

/**
 * Wires the accusation form submit button.
 * @param {(suspectId: string, motiveId: string, methodId: string) => void} onSubmit
 */
export function attachAccusationEvents(onSubmit) {
  const form = document.getElementById('accusation-form');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();

    const suspect = document.getElementById('acc-suspect')?.value;
    const motive  = document.getElementById('acc-motive')?.value;
    const method  = document.getElementById('acc-method')?.value;

    if (!suspect || !motive || !method) {
      _showFormError('Please make a selection for all three fields.');
      return;
    }

    _showConfirmDialog(suspect, motive, method, onSubmit);
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _showFormError(message) {
  const existing = document.getElementById('acc-error');
  if (existing) existing.remove();

  const err = document.createElement('p');
  err.id = 'acc-error';
  err.style.cssText = 'color:var(--accent-red);font-family:var(--font-pixel);font-size:var(--text-xs);text-align:center;margin-top:0.5rem;line-height:1.8;';
  err.textContent = message;

  const form = document.getElementById('accusation-form');
  form?.appendChild(err);
}

function _showConfirmDialog(suspect, motive, method, onSubmit) {
  const dialog = document.createElement('dialog');
  dialog.innerHTML = `
    <div class="confirm-dialog">
      <p class="confirm-dialog__text">
        Are ye sure?<br>
        Ye only get one chance.<br>
        This cannot be undone.
      </p>
      <div class="confirm-dialog__actions">
        <button class="btn btn--ghost" id="confirm-cancel">Go Back</button>
        <button class="btn btn--danger" id="confirm-submit">Aye, I'm Sure</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);
  dialog.showModal();

  dialog.querySelector('#confirm-cancel').addEventListener('click', () => {
    dialog.close();
    dialog.remove();
  });

  dialog.querySelector('#confirm-submit').addEventListener('click', () => {
    dialog.close();
    dialog.remove();
    onSubmit(suspect, motive, method);
  });

  dialog.addEventListener('cancel', () => dialog.remove());
}

function _escape(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
