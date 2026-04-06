# Whit Noo?

**A swipe-based whodunnit card game set in Victorian Edinburgh.**

*"Whit Noo?"* is Scots for *"What now?"* — the question a detective asks at every turn.

Swipe left or right through encounters in the gas-lit closes of Auld Reekie. Collect clues. Piece together the truth. Make your accusation before time runs out — but be warned, you only get one shot.

## Play

**[Play Whit Noo!](https://federicoandreis.github.io/whit-noo/)**

Works on mobile (touch to swipe) and desktop (click and drag).

## About

You play as **Inspector James McLevy**, one of Edinburgh's first real-life detectives. McLevy served from 1833 to the 1860s, solved over 2,200 cases, and published his own casebooks — which likely inspired Arthur Conan Doyle's Sherlock Holmes. His writings are in the public domain.

This game is an original work of interactive fiction inspired by McLevy's world and by the mechanics of games like *Reigns*, *80 Days*, and the board game *221B Baker Street*.

## How to Play

- **Swipe left or right** (or click and drag) to make choices
- Each swipe costs time — **watch the clock**
- **Collect clues** to piece together the mystery
- Tap **Clues** at any time to review what you've found
- When you're ready, tap **Accuse** to name the killer, motive, and method
- **You only get one accusation** — make it count

## Chapters

| Chapter | Difficulty | Estimated Time |
|---|---|---|
| *The Body in the Close* | Standard | ~12 min |

More chapters coming. Want to write one? See below.

## Write Your Own Chapter

Whit Noo? is designed to be extensible. Each mystery is a self-contained JSON file — no code changes needed.

See [`chapters/template/README.md`](chapters/template/README.md) for the full authoring guide.

## Technical

- **Pure HTML/CSS/JavaScript** — no framework, no build step
- **Hosted on GitHub Pages** — static files only
- **Mobile-first** responsive design, tested at 360px to 1440px
- Pixel art sprites with a Victorian colour palette
- Procedural atmospheric audio via the Web Audio API (no audio files)
- Reigns-style weighted card draw system

See [`PRD.md`](PRD.md) for the full product requirements document and [`CLAUDE.md`](CLAUDE.md) for development guidelines.

## Links

- **Source code:** [github.com/federicoandreis/whit-noo](https://github.com/federicoandreis/whit-noo)
- **Support the project:** [buymeacoffee.com/stats_fede](https://buymeacoffee.com/stats_fede)

## Credits & Licence

- **Game design & development:** Federico Andreis
- **Historical inspiration:** James McLevy, *Curiosities of Crime in Edinburgh* (1861) — public domain
- **Mechanical inspirations:** *Reigns* (Nerial), *80 Days* (inkle), *221B Baker Street* (board game), *Lone Wolf* (Joe Dever)

This project is open source. The game engine is released under the MIT Licence. Chapter content may have its own licence — check individual chapter files.
