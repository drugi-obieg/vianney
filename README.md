# Vianney Content Blocker

A planned browser extension, mainly for YouTube, that hides content you decided against. It runs a small decision model locally, applies rules you write in plain text, and checks subtitles for words and passages you want muted or skipped. The name and the starting idea come from St. Jean-Marie Vianney, the Curé of Ars, on guarding the eyes and the ears.

**Status:** version 0.1 is built and ready to test (Chrome 138 or newer). It is a first build: see "What is tested" below.

- Site: https://vianney.cc/
- [plan.md](plan.md): research findings, architecture, milestones, open questions
- [sermons.md](sermons.md): the sermon passages the project starts from, with sources

## Try it

1. Open `chrome://extensions`, switch on **Developer mode**, click **Load unpacked** and choose the `extension/` folder of this repository (or unzip `npm run pack`'s output and choose that folder).
2. The settings page opens. Each rule has a slider (how confident it must be before it flags), and there is a test box where you can paste a title or some subtitles.
3. Browse YouTube. Cards that match a rule are hidden, the toolbar badge shows how many, and the **Log** section of the settings page says why. On a video page the subtitles are checked: a flagged word is muted, and flagged words in the visible captions are masked.
4. The break reminder: set a short time in the settings (for example 1 minute), play a video for that long, and a card that looks like a recommendation appears in the list.

Nothing leaves your browser, nothing learns from your viewing, and the extension needs no account. The optional on-device AI (Chrome's built-in model) is off until you download it from the settings page; without it, the rules work from their word lists.

## What is tested

- `npm test`: unit tests for the text and word-list matching, the rule parser, the engine (the deterministic stage and the model cascade), sensitivity, the break timer, the caption parser and the Prompt API backend (against a fake of the documented API). Needs Node 20 or newer, no dependencies.
- `tools/e2e-chrome.sh` then `python3 tools/e2e.py`: loads the extension into a throwaway headless Chrome and drives real YouTube pages (feed filtering, the slider, the break card, subtitle muting, the settings page). The test browser starts muted.
- **Not verified yet:** subtitles from a real signed session (an anonymous headless browser gets an empty caption body from YouTube, so this needs a normal profile), and the Prompt API with a real model (this needs the model downloaded).

Not affiliated with or endorsed by YouTube or Google.

## Licence

MIT, see [LICENSE](LICENSE). It covers the project's own text and code. The quoted sermon passages are public domain; the English renderings are working translations by the project.
