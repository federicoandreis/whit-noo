# Writing a Chapter for Whit Noo?

This guide explains how to create a new mystery chapter for the game.

## Quick Start

1. Copy `chapter-template.json` to a new folder under `chapters/` (e.g., `chapters/your-chapter-name/chapter.json`)
2. Fill in the fields following the schema below
3. Add your chapter to `chapters/chapter-index.json`
4. Playtest it!

## Structure

A chapter is a single JSON file with these top-level sections:

- **`meta`** — Title, author, settings, difficulty, turn budget
- **`characters`** — All named characters (including suspects)
- **`solution`** — The correct answer (suspect, motive, method)
- **`clues`** — All discoverable clues, including red herrings
- **`cards`** — The narrative encounters the player swipes through
- **`endings`** — At minimum: `win`, `wrong_accusation`, `time_up`
- **`briefing`** — The introduction shown before play begins

## Design Guidelines

### Turn Budget
Set `max_turns` to roughly 80–90% of your total unique cards. This ensures the player can't see everything in one run, encouraging replay.

### Clue Balance
- Every solution field must be reachable through at least one clue path
- Include 3–4 red herring clues that point away from the real solution
- Not every card should grant a clue — some are purely narrative or atmospheric

### Card Types
- `sequence` — shown in fixed order (use for the opening and pivotal moments)
- `always` — always in the draw pool, weighted by `weight` (higher = more likely)
- `conditional` — only appears when specific flags are set (and optionally, others are NOT set)
- `one_shot` — like `always` or `conditional`, but removed after being seen once

### Writing Style
- Second person, present tense ("Ye enter the close...")
- Light Scots dialect for Edinburgh flavour (ye, yer, aye, nae, cannae, dinnae, wee)
- Keep card text concise — 2–4 sentences for the narrative, 1–3 sentences per outcome
- Choice labels should be short and clear (4–6 words)

### Testing Your Chapter
Play through it multiple times:
- Can you reach the correct solution within the turn budget?
- Are there enough red herrings to make the first attempt uncertain?
- Do conditional cards appear at the right times?
- Does the difficulty feel right? (Target: ~35% first-attempt win rate)

## Sprites

If you want custom art for your chapter, include a `sprites.png` in your chapter folder and define the `sprites` mapping in your JSON. Otherwise, the engine falls back to the default sprite set.

The default sprites available (use these names in card `sprite` fields):
`detective`, `gentleman`, `lady`, `urchin`, `constable`, `barkeep`, `merchant`, `doctor`, `close`, `tavern`, `street`, `docks`, `courthouse`, `graveyard`, `market`, `interior`, `letter`, `knife`, `bottle`, `coin`, `key`, `book`, `handkerchief`, `watch`, `footprint`, `document`, `ring`, `hat`, `newspaper`, `photograph`, `skull`, `candle`
