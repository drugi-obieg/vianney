# Vianney Content Blocker

A browser extension, mainly for YouTube, that hides content you decided against. It applies rules you write in plain text: word lists decide first, Chrome's built-in on-device model is an optional second opinion, and subtitles are checked for words and passages you want muted or skipped. The name and the starting idea come from St. Jean-Marie Vianney, the Curé of Ars, on guarding the eyes and the ears.

**Status:** version 0.2 is built and ready to test (Chrome 138 or newer). It is a test build: see "What is tested" below.

- Site: https://vianney.cc/
- [plan.md](plan.md): research findings, architecture, milestones, open questions
- [sermons.md](sermons.md): the sermon passages the project starts from, with sources

## Try it

The short way: download the zip from the [install page](https://vianney.cc/install.html) and follow the steps there. From a clone of the repository:

1. Open `chrome://extensions`, switch on **Developer mode**, click **Load unpacked** and choose the `extension/` folder of this repository (or unzip the zip that `npm run pack` writes into a folder of its own and choose that folder; the files are at the top level of the zip, so Chrome also accepts the zip dropped onto the extensions page).
2. The settings page opens. Each rule has a slider (how confident it must be before it flags), and there is a test box where you can paste a title or some subtitles.
3. Browse YouTube. Cards that match a rule are hidden, the toolbar badge shows how many, and the **Log** section of the settings page says why. On a video page the subtitles are checked: a flagged word is muted, and flagged words in the visible captions are masked.
4. The break reminder: set a short time in the settings (for example 1 minute), play a video for that long, and a card that looks like a recommendation appears in the list.
5. Experimental, off by default: the **Pictures and sound** section judges thumbnails and the sound of a playing video with Chrome's on-device model (it must offer picture and sound input). Every part has a switch, every rule a slider, and allow and block lists win over the model.

Nothing leaves your browser, nothing learns from your viewing, and the extension needs no account. The optional on-device AI (Chrome's built-in model) is off until you download it from the settings page; without it, the rules work from their word lists.

## What is tested

- `npm test`: unit tests for the text and word-list matching, the rule parser (and that the shipped rule files join into one clean pack), the engine (the deterministic stage, the model cascade, pictures and sound), sensitivity, allow and block lists, the sound-window planner and WAV encoder, the break timer, the caption parser and the Prompt API backend (against a fake of the documented API). Needs Node 20 or newer, no dependencies.
- `tools/e2e-chrome.sh` then `python3 tools/e2e.py`: loads the extension into a throwaway headless Chrome and drives real YouTube pages (feed filtering, the slider, false alarms on religious searches, the break card, subtitle muting, the settings page, and the picture and sound checks). The test browser starts muted. For the sound check it needs `E2E_EXTRA_FLAGS="--autoplay-policy=no-user-gesture-required"`.
- The picture and sound checks are tested with a stand-in for Chrome's model that is put into the service worker: real thumbnails and real recorded sound go through the whole path, only the model's yes or no is scripted.
- **Not verified yet:** subtitles from a real signed session (an anonymous headless browser gets an empty caption body from YouTube, so this needs a normal profile), the Prompt API with a real model, and any accuracy or speed figure for the picture and sound checks (this needs the model downloaded, and the test machine cannot hold it).

Not affiliated with or endorsed by YouTube or Google.

## Licence

MIT, see [LICENSE](LICENSE). It covers the project's own text and code. The quoted sermon passages are public domain; the English renderings are working translations by the project.
