/**
 * main.js — entry point and wiring layer
 *
 * Imports all modules, wires event listeners, and drives the game loop.
 * Contains no game logic — it delegates entirely to engine, ui, clues, accusation.
 */

import { initialiseSpriteCanvas } from './sprites.js';
import { fetchChapterIndex, fetchChapter } from './chapter-loader.js';
import {
  startChapter, beginPlaying, drawNextCard, markCardSeen,
  resolveOutcome, checkEndConditions, makeAccusation,
  getState, resetState,
} from './engine.js';
import { attachSwipe } from './swipe.js';
import {
  showScreen, showOverlay, hideOverlay, hideAllOverlays,
  showToast, showOutcomePanel, hideOutcomePanel,
  updateClock, updateClueCount, renderBriefing,
  renderChapterList, renderEndingScreen, renderCard, renderHelp,
} from './ui.js';
import { renderCluePanel } from './clues.js';
import { renderAccusationScreen, attachAccusationEvents } from './accusation.js';
import {
  initAudio, startAmbient, stopAmbient,
  playSwipe, playClueFound, playWin, playWrongAccusation, playTimeUp,
  setSoundEnabled, isSoundEnabled,
} from './audio.js';

// ─── State ────────────────────────────────────────────────────────────────────

let _currentChapterMeta = null;  // selected chapter meta from index
let _swipeHandle        = null;  // current swipe listener handle
let _inputLocked        = false; // prevents double-swipe during animations
let _audioReady         = false; // initAudio() called at least once

// ─── Initialisation ───────────────────────────────────────────────────────────

async function init() {
  initialiseSpriteCanvas();
  renderHelp();
  wireStaticListeners();
  _syncSoundToggleUI();

  try {
    const chapters = await fetchChapterIndex();
    renderChapterList(chapters, onChapterSelected);
  } catch (err) {
    console.error('[main] Failed to load chapter index:', err);
    showToast('Failed to load chapters. Please refresh.', 'warning');
  }

  showScreen('menu');
}

// ─── Audio helpers ────────────────────────────────────────────────────────────

function _ensureAudio() {
  // Always call initAudio() from each gesture — on iOS Safari the synchronous
  // ctx.resume() inside initAudio() is what actually unlocks the AudioContext.
  // The _audioReady guard is kept only to skip re-loading saved preferences.
  initAudio();
  _audioReady = true;
}

function _playEndingSound(endingType) {
  switch (endingType) {
    case 'win':               return playWin();
    case 'wrong_accusation':  return playWrongAccusation();
    case 'time_up':           return playTimeUp();
  }
}

function _syncSoundToggleUI() {
  const on = isSoundEnabled();
  // Menu toggle
  const menuIcon  = document.getElementById('menu-sound-icon');
  const menuState = document.getElementById('menu-sound-state');
  if (menuIcon)  menuIcon.textContent  = on ? '♪' : '♪̶';
  if (menuState) menuState.textContent = on ? 'On' : 'Off';
  const menuBtn = document.getElementById('menu-sound-toggle');
  if (menuBtn) menuBtn.setAttribute('aria-pressed', String(on));

  // Hamburger toggle
  const hamIcon  = document.getElementById('ham-sound-icon');
  const hamLabel = document.getElementById('ham-sound-label');
  if (hamIcon)  hamIcon.textContent  = on ? '♪' : '♪̶';
  if (hamLabel) hamLabel.textContent = on ? 'Sound: On' : 'Sound: Off';
  const hamBtn = document.getElementById('ham-sound');
  if (hamBtn) hamBtn.setAttribute('aria-pressed', String(on));
}

function _onSoundToggle() {
  _ensureAudio();
  const newState = !isSoundEnabled();
  setSoundEnabled(newState);
  _syncSoundToggleUI();
}

// ─── Static event wiring ──────────────────────────────────────────────────────

function wireStaticListeners() {
  // Top bar
  document.getElementById('btn-menu')?.addEventListener('click', () => {
    showOverlay('hamburger');
  });
  document.getElementById('btn-help')?.addEventListener('click', () => {
    showOverlay('help');
  });

  // Bottom bar
  document.getElementById('btn-clues')?.addEventListener('click', onCluesPanelOpen);
  document.getElementById('btn-accuse')?.addEventListener('click', onAccusationOpen);

  // Briefing screen
  document.getElementById('btn-begin')?.addEventListener('click', onBeginPlaying);
  document.getElementById('btn-back-to-menu')?.addEventListener('click', onReturnToMenu);

  // Ending screen
  document.getElementById('btn-play-again')?.addEventListener('click', onPlayAgain);
  document.getElementById('btn-menu-from-ending')?.addEventListener('click', onReturnToMenu);

  // Overlay close buttons
  document.getElementById('overlay-clues')?.addEventListener('cancel', () => hideOverlay('clues'));
  document.getElementById('overlay-accusation')?.addEventListener('cancel', () => hideOverlay('accusation'));
  document.getElementById('overlay-help')?.addEventListener('cancel', () => hideOverlay('help'));
  document.getElementById('overlay-hamburger')?.addEventListener('cancel', () => hideOverlay('hamburger'));

  document.getElementById('close-clues')?.addEventListener('click', () => hideOverlay('clues'));
  document.getElementById('close-accusation')?.addEventListener('click', () => hideOverlay('accusation'));
  document.getElementById('close-help')?.addEventListener('click', () => hideOverlay('help'));
  document.getElementById('close-hamburger')?.addEventListener('click', () => hideOverlay('hamburger'));

  // Hamburger menu actions
  document.getElementById('ham-menu')?.addEventListener('click', () => {
    hideOverlay('hamburger');
    onReturnToMenu();
  });
  document.getElementById('ham-restart')?.addEventListener('click', () => {
    hideOverlay('hamburger');
    onRestartChapter();
  });
  document.getElementById('ham-help')?.addEventListener('click', () => {
    hideOverlay('hamburger');
    showOverlay('help');
  });

  // Sound toggles
  document.getElementById('ham-sound')?.addEventListener('click', _onSoundToggle);
  document.getElementById('menu-sound-toggle')?.addEventListener('click', _onSoundToggle);
}

// ─── Chapter selection ────────────────────────────────────────────────────────

async function onChapterSelected(meta) {
  _ensureAudio();
  _currentChapterMeta = meta;
  try {
    const chapterData = await fetchChapter(meta.file);
    startChapter(chapterData);
    renderBriefing(chapterData.briefing);
    showScreen('briefing');
  } catch (err) {
    console.error('[main] Failed to load chapter:', err);
    showToast('Failed to load chapter. Please try again.', 'warning');
  }
}

// ─── Briefing ─────────────────────────────────────────────────────────────────

function onBeginPlaying() {
  _ensureAudio();
  beginPlaying();
  showScreen('game');
  updateHUD();
  startAmbient();
  drawAndShowCard();
}

// ─── Card loop ────────────────────────────────────────────────────────────────

function drawAndShowCard() {
  const state = getState();
  if (state.phase === 'ending') {
    showEndingScreen();
    return;
  }

  const card = drawNextCard();
  if (!card) {
    showEndingScreen();
    return;
  }

  markCardSeen(card);
  mountCard(card);
  updateHUD();
}

function mountCard(card) {
  const slot = document.getElementById('card-slot');
  if (!slot) return;

  // Detach previous swipe handler
  if (_swipeHandle) {
    _swipeHandle.detach();
    _swipeHandle = null;
  }

  // Remove existing card
  const existing = slot.querySelector('.card');
  if (existing) existing.remove();

  const state = getState();
  const el    = renderCard(card, state.chapter);
  slot.appendChild(el);
  _inputLocked = false;

  _swipeHandle = attachSwipe(el, {
    onCommitLeft:  () => onSwipeCommit(card, 'left'),
    onCommitRight: () => onSwipeCommit(card, 'right'),
    onCancel:      () => { _inputLocked = false; },
    onDragUpdate:  () => {},
  });
}

function onSwipeCommit(card, direction) {
  if (_inputLocked) return;
  _inputLocked = true;

  // Re-unlock audio on every swipe gesture — required on iOS WebKit
  // where the AudioContext can silently re-suspend between interactions.
  initAudio();
  playSwipe(direction);

  const { cluesGained, clueNames, endingTriggered } = resolveOutcome(card, direction);

  if (cluesGained.length > 0) playClueFound();

  const outcome = card[direction]?.outcome;
  const outcomeText = outcome?.text || '';

  // Update HUD after resolving outcome
  updateHUD();

  if (endingTriggered) {
    _playEndingSound(endingTriggered);
    stopAmbient();
    if (outcomeText) {
      showOutcomePanel(outcomeText, clueNames, () => {
        hideOutcomePanel();
        showEndingScreen();
      });
    } else {
      showEndingScreen();
    }
    return;
  }

  // Check time-up
  const ended = checkEndConditions();
  if (ended) {
    _playEndingSound('time_up');
    stopAmbient();
    if (outcomeText) {
      showOutcomePanel(outcomeText, clueNames, () => {
        hideOutcomePanel();
        showEndingScreen();
      });
    } else {
      showEndingScreen();
    }
    return;
  }

  // Show outcome, then draw next card
  showOutcomePanel(outcomeText, clueNames, () => {
    hideOutcomePanel();
    drawAndShowCard();
  });
}

// ─── HUD updates ──────────────────────────────────────────────────────────────

function updateHUD() {
  const state = getState();
  updateClock(state.turnsRemaining, state.turnsTotal);
  updateClueCount(state.clues.length);
}

// ─── Clue panel ───────────────────────────────────────────────────────────────

function onCluesPanelOpen() {
  const state = getState();
  if (!state.chapter) return;
  renderCluePanel(state.clues, state.chapter.clues);
  showOverlay('clues');
}

// ─── Accusation ───────────────────────────────────────────────────────────────

function onAccusationOpen() {
  const state = getState();
  if (!state.chapter) return;

  if (state.accusationMade) {
    showToast('Ye have already made yer accusation.', 'warning');
    return;
  }

  renderAccusationScreen(state, state.chapter);
  attachAccusationEvents(onAccusationSubmit);
  showOverlay('accusation');
}

function onAccusationSubmit(suspectId, motiveId, methodId) {
  hideOverlay('accusation');
  const result = makeAccusation(suspectId, motiveId, methodId);
  _playEndingSound(result);
  stopAmbient();
  showEndingScreen();
}

// ─── Ending screen ────────────────────────────────────────────────────────────

function showEndingScreen() {
  const state = getState();
  if (!state.ending) return;
  renderEndingScreen(state.ending);
  showScreen('ending');
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function onReturnToMenu() {
  hideAllOverlays();
  stopAmbient();
  resetState();
  _currentChapterMeta = null;
  if (_swipeHandle) { _swipeHandle.detach(); _swipeHandle = null; }
  showScreen('menu');
}

async function onRestartChapter() {
  if (!_currentChapterMeta) {
    onReturnToMenu();
    return;
  }
  stopAmbient();
  resetState();
  if (_swipeHandle) { _swipeHandle.detach(); _swipeHandle = null; }
  await onChapterSelected(_currentChapterMeta);
}

async function onPlayAgain() {
  if (!_currentChapterMeta) {
    onReturnToMenu();
    return;
  }
  resetState();
  await onChapterSelected(_currentChapterMeta);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
