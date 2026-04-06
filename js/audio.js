/**
 * audio.js — Procedural sound system using Web Audio API.
 * All sounds are synthesised at runtime; no audio files are required.
 *
 * Public API:
 *   initAudio()             — must be called once from a user gesture
 *   startAmbient()          — begin looping background atmosphere
 *   stopAmbient()           — fade out and stop background atmosphere
 *   playSwipe(direction)    — 'left' | 'right'
 *   playClueFound()         — rising chime when clue is collected
 *   playWin()               — triumphant arpeggio
 *   playWrongAccusation()   — low dissonant thud
 *   playTimeUp()            — sombre descending toll
 *   setSoundEnabled(bool)   — mute/unmute everything
 *   isSoundEnabled()        — returns current state
 */

const STORAGE_KEY = 'whit-noo-sound';

let ctx              = null;
let masterGain       = null;
let ambientState     = null;  // { noiseSource, rainGain, lfo, lfoGain, melodyId }
let _stopTimeoutId   = null;  // pending _killAmbient timeout
let _enabled         = true;

// ─── Initialisation ──────────────────────────────────────────────────────────

/**
 * Creates the AudioContext.  Must be called inside a user-gesture handler.
 * Safe to call multiple times.
 */
export function initAudio() {
  if (ctx) return;

  // Restore saved preference
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) _enabled = saved === 'true';
  } catch (_) { /* storage unavailable */ }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  ctx = new AudioContext();

  masterGain = ctx.createGain();
  masterGain.gain.value = _enabled ? 1 : 0;
  masterGain.connect(ctx.destination);
}

// ─── Enable / disable ────────────────────────────────────────────────────────

export function setSoundEnabled(enabled) {
  _enabled = enabled;
  try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch (_) {}

  if (!masterGain) return;
  const now = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setTargetAtTime(enabled ? 1 : 0, now, 0.05);

  if (enabled) {
    startAmbient();
  } else {
    _killAmbient();
  }
}

export function isSoundEnabled() {
  return _enabled;
}

// ─── Core helpers ─────────────────────────────────────────────────────────────

/** Resume context if suspended, returns a Promise that resolves when running. */
function ensureRunning() {
  if (!ctx) return Promise.resolve(false);
  if (ctx.state === 'running') return Promise.resolve(true);
  return ctx.resume().then(() => true).catch(() => false);
}

/** Create a GainNode connected to masterGain. */
function makeGain(value = 1) {
  const g = ctx.createGain();
  g.gain.value = value;
  g.connect(masterGain);
  return g;
}

// ─── Ambient atmosphere ───────────────────────────────────────────────────────
//
// Victorian Edinburgh at night:
//   • Quiet rain — white noise through a low-pass filter with a slow, drifting LFO
//   • Distant cobblestone rumble — very low periodic noise burst
//   • Clock tick — a soft periodic transient at ~60 BPM

export function startAmbient() {
  if (!ctx || !_enabled) return;
  // Cancel any in-flight fade-out
  clearTimeout(_stopTimeoutId);
  _stopTimeoutId = null;
  if (ambientState) return;   // already running

  ensureRunning().then(ok => {
    if (!ok || !_enabled || ambientState) return;
    _buildAmbient();
  });
}

function _buildAmbient() {
  // ── Rain / wind layer ──────────────────────────────────────────────────
  const NOISE_SECONDS = 4;
  const bufferSize    = ctx.sampleRate * NOISE_SECONDS;
  const noiseBuffer   = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data          = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  noiseSource.loop   = true;

  const rainFilter = ctx.createBiquadFilter();
  rainFilter.type            = 'lowpass';
  rainFilter.frequency.value = 700;
  rainFilter.Q.value         = 0.8;

  const hpFilter = ctx.createBiquadFilter();
  hpFilter.type            = 'highpass';
  hpFilter.frequency.value = 80;

  // Slow drift LFO — gusts vary the rain texture
  const lfo = ctx.createOscillator();
  lfo.type            = 'sine';
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 250;
  lfo.connect(lfoGain);
  lfoGain.connect(rainFilter.frequency);

  const rainGain = makeGain(0);
  noiseSource.connect(rainFilter);
  rainFilter.connect(hpFilter);
  hpFilter.connect(rainGain);

  noiseSource.start();
  lfo.start();
  rainGain.gain.setTargetAtTime(0.055, ctx.currentTime, 1.6);

  // ── Sparse music-box melody ────────────────────────────────────────────
  //
  // A slow, melancholic phrase in A natural minor, as if heard through a
  // wall from a parlour next door.  Plays once, then waits 20–28 seconds
  // before repeating — so it feels discovered rather than looped.
  //
  // ── Delay/echo node shared by all melody notes ────────────────────────────
  // Simulates the sound of music heard through a wall — distant, slightly echoey.
  const echoDelay = ctx.createDelay(1.0);
  echoDelay.delayTime.value = 0.28;

  const echoFeedback = ctx.createGain();
  echoFeedback.gain.value = 0.22;   // gentle decay

  const echoWet = ctx.createGain();
  echoWet.gain.value = 0.28;        // subtle — mostly dry signal

  echoDelay.connect(echoFeedback);
  echoFeedback.connect(echoDelay);   // feedback loop
  echoDelay.connect(echoWet);
  echoWet.connect(masterGain);

  // playMelodyNote — vel scales the peak gain for expressive phrasing
  function playMelodyNote(freq, when, vel = 1.0) {
    if (!ambientState) return;

    const peak1 = 0.062 * vel;
    const peak2 = 0.020 * vel;

    // Triangle for the music-box body
    const g1 = ctx.createGain();
    g1.gain.value = 0;
    const o1 = ctx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = freq;
    g1.gain.setValueAtTime(0, when);
    g1.gain.linearRampToValueAtTime(peak1, when + 0.008);
    g1.gain.exponentialRampToValueAtTime(0.001, when + 1.35);
    o1.connect(g1);
    // Dry path → master, wet path → echo
    g1.connect(masterGain);
    g1.connect(echoDelay);
    o1.start(when);
    o1.stop(when + 1.4);

    // Soft sine an octave below — warmth, dry only
    const g2 = ctx.createGain();
    g2.gain.value = 0;
    g2.connect(masterGain);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq / 2;
    g2.gain.setValueAtTime(0, when);
    g2.gain.linearRampToValueAtTime(peak2, when + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.001, when + 1.05);
    o2.connect(g2);
    o2.start(when);
    o2.stop(when + 1.1);
  }

  // ── Five phrases in A natural minor, all languid ──────────────────────────
  //
  // Format: [Hz, gap-to-next in seconds, velocity 0–1]
  // Velocity lets inner notes be softer for a natural phrase shape.
  //
  // G4=392  A4=440  B4=493.9  C5=523.3  D5=587.3  E5=659.3  F5=698.5  A5=880

  const PHRASES = [
    [ // A — descending lament, stronger on beat notes
      [659.3, 0.72, 1.0], [523.3, 0.62, 0.7], [587.3, 0.68, 0.8],
      [440,   0.78, 1.0], [493.9, 0.62, 0.6], [440,   0.68, 0.7],
      [392,   0.72, 0.8], [440,   0,    0.9],
    ],
    [ // B — questioning rise, left unresolved
      [440,   0.68, 0.8], [523.3, 0.62, 0.7], [659.3, 0.78, 1.0],
      [587.3, 0.68, 0.8], [523.3, 0.62, 0.6], [493.9, 0.72, 0.7],
      [440,   0,    0.9],
    ],
    [ // C — ♭VI modal colour (F5), most mournful
      [440,   0.72, 0.8], [523.3, 0.65, 0.7], [587.3, 0.70, 0.8],
      [698.5, 0.62, 1.0], [659.3, 0.68, 0.8], [587.3, 0.80, 0.7],
      [440,   0,    0.9],
    ],
    [ // D — wide leaps, night-watchman feel
      [659.3, 0.85, 1.0], [587.3, 0.68, 0.7], [523.3, 0.78, 0.8],
      [440,   0.72, 0.9], [493.9, 0.85, 0.6], [392,   0.65, 0.7],
      [440,   0.72, 0.8], [493.9, 0.70, 0.7], [440,   0,    0.9],
    ],
    [ // E — ultra-sparse, four notes, like something left unfinished
      [440,   1.0,  0.9], [659.3, 0.9, 1.0],
      [587.3, 1.1,  0.7], [523.3, 0,   0.8],
    ],
  ];

  function schedulePhrase() {
    if (!ambientState) return;

    const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    let cursor   = ctx.currentTime;

    for (const [freq, gap, vel] of phrase) {
      playMelodyNote(freq, cursor, vel);
      cursor += gap;
    }

    // After phrase ends, wait 22–34 s — silence longer than the music
    const phraseDuration = phrase.reduce((s, [, g]) => s + g, 0);
    const rest           = 22000 + Math.random() * 12000;
    const id             = setTimeout(schedulePhrase, phraseDuration * 1000 + rest);
    ambientState.melodyId = id;
  }

  ambientState = {
    noiseSource,
    rainGain,
    lfo,
    lfoGain,
    echoFeedback,   // stored so _killAmbient can zero the feedback loop
    melodyId: null,
  };

  // First phrase after 7–12 s — let the rain settle in first
  ambientState.melodyId = setTimeout(schedulePhrase, 7000 + Math.random() * 5000);
}

export function stopAmbient() {
  if (!ambientState) return;
  const { rainGain } = ambientState;
  // Fade rain out over ~3 seconds then hard-kill
  rainGain.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
  clearTimeout(_stopTimeoutId);
  _stopTimeoutId = setTimeout(_killAmbient, 3500);
}

function _killAmbient() {
  clearTimeout(_stopTimeoutId);
  _stopTimeoutId = null;
  if (!ambientState) return;
  const { noiseSource, lfo, echoFeedback, melodyId } = ambientState;
  clearTimeout(melodyId);
  // Kill echo feedback loop before disconnecting so it doesn't ring on
  if (echoFeedback) echoFeedback.gain.setValueAtTime(0, ctx.currentTime);
  try { noiseSource.stop(); } catch (_) {}
  try { lfo.stop(); }         catch (_) {}
  ambientState = null;
}

// ─── Interaction sounds ───────────────────────────────────────────────────────

/**
 * Swipe commit — a soft cloth/paper slide sound.
 */
export function playSwipe(direction = 'right') {
  if (!ctx || !_enabled) return;
  ensureRunning().then(ok => {
    if (!ok || !_enabled) return;

    const bufLen = Math.floor(ctx.sampleRate * 0.12);
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d      = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.6;

    const now      = ctx.currentTime;
    const fromFreq = direction === 'right' ? 600  : 1200;
    const toFreq   = direction === 'right' ? 1200 : 600;
    filter.frequency.setValueAtTime(fromFreq, now);
    filter.frequency.exponentialRampToValueAtTime(toFreq, now + 0.12);

    const g = makeGain(0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    src.connect(filter);
    filter.connect(g);
    src.start(now);
    src.stop(now + 0.15);
  });
}

/**
 * Clue found — a small bell chime, like a Victorian hand bell.
 */
export function playClueFound() {
  if (!ctx || !_enabled) return;
  ensureRunning().then(ok => {
    if (!ok || !_enabled) return;

    const notes = [880, 1108.7, 1318.5];  // A5, C#6, E6 — A major triad
    const now   = ctx.currentTime;

    notes.forEach((freq, i) => {
      const g   = makeGain(0);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      // Bell decay — triangle + very fast attack, long tail
      const t = now + i * 0.09;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.75);
    });
  });
}

/**
 * Win — a short triumphant peal, like church bells in A major.
 */
export function playWin() {
  if (!ctx || !_enabled) return;
  ensureRunning().then(ok => {
    if (!ok || !_enabled) return;

    const freqs = [440, 550, 659, 880, 1100];  // A4, C#5, E5, A5, C#6
    const now   = ctx.currentTime;

    freqs.forEach((freq, i) => {
      const g   = makeGain(0);
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const t = now + i * 0.14;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

      osc.connect(g);
      osc.start(t);
      osc.stop(t + 1.0);
    });
  });
}

/**
 * Wrong accusation — a low, hollow toll, like a funeral bell.
 */
export function playWrongAccusation() {
  if (!ctx || !_enabled) return;
  ensureRunning().then(ok => {
    if (!ok || !_enabled) return;

    const now = ctx.currentTime;

    // Low bell toll
    [110, 138.6].forEach((freq, i) => {  // A2, C#3 — minor-ish interval
      const g   = makeGain(0);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const t = now + i * 0.18;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(i === 0 ? 0.3 : 0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);

      osc.connect(g);
      osc.start(t);
      osc.stop(t + 2.0);
    });

    // Add a brief noise thud underneath
    const bufLen = Math.floor(ctx.sampleRate * 0.06);
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d      = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;

    const src    = ctx.createBufferSource();
    src.buffer   = buf;
    const filter = ctx.createBiquadFilter();
    filter.type            = 'lowpass';
    filter.frequency.value = 180;
    const g = makeGain(0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.4, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    src.connect(filter); filter.connect(g);
    src.start(now); src.stop(now + 0.13);
  });
}

/**
 * Time up — three slow descending church-bell tolls.
 */
export function playTimeUp() {
  if (!ctx || !_enabled) return;
  ensureRunning().then(ok => {
    if (!ok || !_enabled) return;

    const freqs = [220, 196, 164.8];  // A3, G3, E3 — descending
    const now   = ctx.currentTime;

    freqs.forEach((freq, i) => {
      const g   = makeGain(0);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const t = now + i * 0.7;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);

      osc.connect(g);
      osc.start(t);
      osc.stop(t + 1.5);
    });
  });
}
