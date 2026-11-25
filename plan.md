# The plan

Status: working draft, 2026-11-25. No extension code exists yet.

How to read the tags. **[verified]** means read on the source page or measured in an experiment during this research (sources are listed at the end). **[unverified]** means a secondary source, or not yet tested. **[choice]** means a design decision that can be changed.

---

## 1. Goal and principles

- **Goal.** Let the user hide problematic content instead of being at the mercy of YouTube's recommendation engine. The primary action is to remove an item before it is seen. Rating, warning and statistics are secondary.
- **Origin.** The project starts from St. Jean-Marie Vianney's teaching on guarding the eyes and the ears. The passages and their sources are on the [sermons page](sermons.md). The eyes map to feed filtering. The ears map to subtitles and audio, which is the harder half.
- **Surfaces.** These are the places where YouTube's recommender decides what appears: the Home feed, search results, the "up next" sidebar and autoplay, Shorts, the Subscriptions feed, end cards, and later comments.
- **Principles.**
  - **Local only.** Models and rules run on the user's machine. No cloud calls by default and no telemetry.
  - **Deterministic.** No online learning. The same input, rules, model version and backend give the same verdict. A generative backend runs with fixed greedy settings (whether the Prompt API is then truly repeatable is untested). Floating-point differences between WASM and WebGPU, or between devices, can shift a probability slightly, so thresholds need a margin. **[choice]**
  - **Deterministic filters first, models second.** Models only decide what plain rules cannot.
  - **Combine approaches.** A cheap deterministic stage, a local model, and a second opinion on uncertain cases (section 4.2).
  - **Honest doubt.** Every verdict carries a probability and a reason. Uncertain cases are shown as uncertain. In feeds the fail-safe default is to show the item. On a playing video it is to warn.
  - **No guessing.** Every number comes from a source or from a measurement on a labelled set, or it is marked as a choice.
  - **Personal tool.** Not a paid product. Distributed from the project's own website first.

---

## 2. Decisions so far

- **First-draft backend:** Chrome's built-in Prompt API (Gemini Nano). Nothing to bundle, nothing to download by hand.
- **Second model:** a local English decision model, picked by a spike on our own labelled set (section 8). The first idea was English Laya (ModernBERT-large, 421M). The research changed the order: Laya is near chance zero-shot, and Kev-0.6B has a ready browser build (section 3.1).
- **Non-English text:** detect the language and translate titles and subtitles to English with Chrome's on-device Translator API before classifying (section 4.4).
- **Deterministic filter** (channel lists, keyword lists, regexes) in front of every model.
- **No continuous learning.** Thresholds and rules are edited by hand.
- **Distribution:** the project's own website first (a zip for "Load unpacked"; a signed add-on for Firefox), with the model downloaded on first run (section 3.9). A store listing is optional and later.
- **Combine approaches** for accuracy (section 4.2).
- **Extras:** an attention-calming module for Shorts, thumbnails and clickbait titles (section 4.5), and page-structure discovery that survives YouTube layout changes (section 4.3).

---

## 3. Research findings

### 3.1 Decision models (the Jev family)

- **Jev** (TypeSafe AI, early access since 2026-09-15) **[verified]**
  - Proprietary and hosted. It is a discriminative model: it returns probabilities and does not generate text.
  - Input is a "state" plus typed questions: `noul` (true/false), `choice` (pick one) and `score` (ordered scale). Questions in one request are answered in parallel and cannot depend on each other.
  - Not usable offline.
- **Microsoft-Decision-1** **[verified from several comparison pages, none primary]**
  - Announced 2026-10-09, post-trained from Qwen3.5-9B, closed weights, hosted. Not usable offline.
- **Google "Decisions API"** **[partly verified]**
  - Hosted. No downloadable weights found. Google's Gemma team also published a recipe for a Jev-like model on DiffusionGemma with vLLM, which is server-side tooling.
- **Laya** (Convai Innovations, 2026-09-18, Apache-2.0) **[verified from the model card and its community threads]**
  - Open-weight encoder decision model with `noul` / `choice` / `score` questions. Three official checkpoints: English ModernBERT-large (421M), multilingual mmBERT-base (322M, 1,024-token context) and a typed-decisions fine-tune. Nothing smaller and English-only exists in the official family. (English-only is not automatically smaller: the multilingual checkpoint has fewer parameters.)
  - **Zero-shot quality is poor.** The card says "base checkpoints are near chance on typed-decisions zero-shot" (0.362 for the English one, against 0.461 for always answering the majority class) and calls it "a fast base to specialise, not a zero-shot decision engine". An independent comparison on 1,190 cases (single reviewer, English checkpoint) scored 0.686 against Jev's 0.907. The "84.7% against 89.5%" figures on the card belong to its newer learning engine, not to this checkpoint.
  - **Known defects.** `noul` can return a confident "no" on clearly positive input; the card's workaround is a two-option `choice` with neutral keys. It ships over-confident (mean calibration error 0.466, down to 0.081 after fitting one temperature per question type on the user's own data). Only about 320 of the 512 tokens are left for the text, because the options are paid first.
  - **Browser builds** (third party, none run by us yet): int8 524 MB (WASM only, because the WebGPU kernel supports only 2-bit and 4-bit weights), 4-bit 337 MB (WebGPU), fp16 843 MB (WebGPU). Reported speed: about 0.3 s per question at 43 tokens, 0.9 s at 195 and 2.4 s at 512 for the int8 build on WASM (Apple silicon, 8 threads), and about 1 s per state for fp16 on WebGPU (M3 Pro).
  - **Quantization.** Plain dynamic int8 breaks the model (69% agreement with fp32). Weight-only int8 kept 26 of 26 answers on a small test. Two 4-bit measurements disagree (96.7% and 84.6% agreement), so 4-bit has to be measured on our own questions.
  - **Threads.** The int8 build needs cross-origin isolation for multiple threads, and its author reports hangs with workers in a production bundle. Whether this works in an MV3 offscreen document is untested.
  - Its "continuous learning" add-on is not used (decision: no learning).
- **jevos** (`feder-cr/jev`, MIT) **[verified]**
  - Open yes/no/choice/score model for native CPU use (OpenVINO or llama.cpp GGUF). About 1 GB RAM, 8,192-token context, English only, no browser build found.
  - Their own numbers: 0.76 to 0.95 accuracy on rule and scenario tasks, and more wrong "yes" answers than wrong "no" answers (152 against 91 on 999 questions).
- **Kev** (open-weight family of decision models, Apache-2.0, English only) **[verified from the model card and the open-jev catalog]**
  - Sizes 0.8B, 4B, 9B and 27B on Qwen bases. Kev-0.8B is a LoRA plus a pointer head on a frozen Qwen3.5-0.8B base, with a validated context of 8,192 tokens.
  - **A browser build exists.** `kev-0.6b` (base Qwen3-0.6B) is 0.34 GB at q4f16 (0.38 GB at q4) with 8,192 tokens of context, through the `open-jev` package on Transformers.js with WebGPU and a WASM fallback. A 4B build is 2.3 GB.
  - Questions are typed (`noul`, `choice`, `score`) with an `instructions` string and optional `criteria`, which is the rule format of section 5.
  - Accuracy: the Kev-0.8B card shows 0.586 on 14 held-out public sets against Jev's 0.757 and says that out of domain it is "markedly less accurate than Kev-4B". The accuracy of the 0.6B browser build is not published, and it sits on an older base than the current cards. English only, trained on a handful of domains.
- **GLiNER2.5-Decide** (Fastino Labs, 340M, English, Apache-2.0) **[verified from the card; vendor-run numbers]**
  - DeBERTa-v3-large plus a small head. A yes/no question is a two-label set, and labels can carry descriptions. On the vendor's own 17-domain suite: 60.2%, against 57.6% for JevK5 and 46.6% for Laya Router. No browser build found, and the context length is not published.
- **open-jev DeBERTa-v3-large encoder** (`onnx-community/open-jev-deberta-v3-large-ONNX`): 0.35 GB at q4f16, 512-token context, English. Its model card (licence, training data, accuracy) was not read. **[unverified]**
- **Zero-shot NLI classifiers (the baseline to beat)** **[sizes verified, fit unverified]**
  - `Xenova/nli-deberta-v3-xsmall`: 87 MB int8. `MoritzLaurer/deberta-v3-xsmall-zeroshot-v1.1-all-33`: MIT, 22M backbone, built for transformers.js. `ModernBERT-base-zeroshot-v2.0`: 151 MB int8 (int8 quality unverified for ModernBERT). GLiClass edge: 32.7M parameters.
  - A rule has to be rewritten as a hypothesis sentence, and the entailment score is not a calibrated probability.
- **Liquid d1-omni-600M** (587M including vision and audio towers, 16K context, its own licence, GGUF and MLX only): no browser build, not planned.
- **Granite Guardian (IBM)** **[verified from model cards]**
  - Versions: 3.0 (2B, 8B), 3.2 (3B-A800M mixture of experts, 5B), 3.3 (8B), 4.1 (8B), and an October 2026 library of LoRA adapters ("Guardian Core") for granite-4.0-micro and granite-4.1-3b, 8b and 30b. Bring-your-own-criteria is documented for 4.1-8B. The 3.2-3B-A800M card says custom definitions "require testing".
  - The verdict is the first generated token (Yes or No), so a probability can be read from the logits. This is documented for 3.2.
  - Smallest criteria-capable build found: 3.2-3B-A800M at 2.02 GB (Q4_K_M). No ONNX, WebGPU or transformers.js build of any 2B to 8B Guardian exists. The prompts are shaped for LLM guardrails, not for "is this title about gossip".
  - Verdict: too large and with no browser path. At most an optional power-user backend.
- **Memory on the client** **[mostly NOT FOUND]**
  - No published measurement of RAM or VRAM for any of these in a browser tab. Documented limits: a WebAssembly heap of 4 GB and Chrome's ArrayBuffer limit of about 2 GB. Download sizes: 87 to 151 MB (NLI), 337 to 524 MB (Laya), 340 to 380 MB (Kev-0.6B).
  - Chrome's built-in Gemini Nano: a third party measured the model folder at about 4 GB on disk (Chrome 147, Windows). The 22 GB in the docs is free space needed to start the download. No measured inference memory exists.
  - So whether a machine with 8 GB of RAM is comfortable cannot be answered from published data. It is spike 2 in M0.
- **Take-away.** The Jev-style interface (typed questions, a probability, a confidence) is the right shape for user-written rules. The model behind it must be open-weight. Small models are overconfident, so every rule needs a threshold measured on our own labelled set (section 9).

### 3.2 Cactus and Needle

- **What it is** **[verified from the README, the Cactus docs and the Hugging Face repository]**
  - Python package `cactus-compute`, Apache-2.0 for the engine and the Needle weights. **Needle 3** is a 121M-parameter model for tool calling, structured extraction and text embedding, in a ladder of subnetworks from 2 to 20 layers (25M to 121M parameters). The vendor quotes 29 MB for the 20-layer file. The file served on Hugging Face is 35.3 MB, and the training checkpoint is 242 MB. **Whistle** is speech-to-text with word timestamps, and **Mirage** describes images.
  - **WASM runtime.** `cactus.wasm` is 1.27 MB and `cactus.js` is 62 KB. It is single-threaded, needs no `SharedArrayBuffer` or cross-origin isolation (confirmed on the vendor's live demo), and caps its heap at 2 GiB. The model bytes are copied into that heap. The script has no `eval`, so it should run in an MV3 offscreen document with `'wasm-unsafe-eval'`. The vendor demo imports the script from a Blob URL, which an extension's CSP would block, so the script has to be bundled. It has not been run inside a real extension yet.
- **Fit for this project.** A yes/no judgment is a tool call with a boolean or enum argument, and the vendor documents classification as "extraction with an enum". Decoding is grammar-constrained, so the answer cannot leave its set. Needle is therefore a real candidate for a very small, fast first stage, but only after fine-tuning on our labelled set:
  - Untuned, its published scores are modest: about 62 on tool-call suites and about 33 on extraction suites (read off the vendor's chart, plus or minus one point). No classification accuracy is published and no third-party evaluation exists.
  - Fine-tuning is documented: LoRA through `cactus-compute[train]` (JAX), JSONL examples, and "a few hundred clean examples measurably improve which tool gets picked". The vendor's reported gains are for its own hosted fine-tunes, on its own task. Local training on a small machine is untested.
- **No probabilities.** There are no logprobs. The `confidence` field is the minimum of a calibrated head and the decoding probability. It exists only for the base model and for hosted fine-tunes, and locally fine-tuned weights return none. The engine also withholds any call below 0.1, repairs arguments deterministically (a step designed for device control), and has "grounding gates" that can drop a required enum value the request never names. Any of these could corrupt a yes/no label, so they must be tested on real titles.
- **Ways to get a threshold.** Use the hard label and measure precision and recall on the labelled set. Or take the `embed()` vector and fit our own logistic-regression head offline, which gives a real probability. Or vote across depths or prompt variants.
- **Language.** The tokenizer has 8,192 pieces and is English-centric: non-English text costs about 1.7 times the tokens, and the vendor measured a calibrated score of 0.0 on correct Spanish calls. This fits the decision to translate to English first.
- **Telemetry.** The Python package sends anonymous usage counts (opt out with `CACTUS_TELEMETRY=0`). The WASM glue contains no analytics code.
- **Cheapest spike (half a day).** Load the engine in an offscreen document, run 100 labelled titles through the base model with one enum tool, and record the raw JSON, memory (`peak_ram_mb`), time per title and the suppressed or refused rate.
- **Size.** A 35 MB model fits in any store package, so the distribution problem in section 3.9 does not apply to Needle.

### 3.3 Chrome built-in AI

- **Prompt API (Gemini Nano)** **[verified from the Chrome docs, updated 2026-10-21]**
  - Stable for extensions since Chrome 138 (web pages since Chrome 148). The model is downloaded and managed by Chrome.
  - Requirements: Windows 10/11, macOS 13+ or Linux; at least 22 GB free on the profile volume (the model is removed if free space falls below 10 GB); a GPU with more than 4 GB VRAM, or a CPU with at least 16 GB RAM and 4 cores; an unmetered connection for the first download.
  - Structured output through `responseConstraint` (a JSON Schema or a RegExp, since Chrome 137). The documented classification example is `{ "type": "boolean" }`. `enum` is not mentioned in the docs, so a RegExp such as `/^(none|mild|heavy)$/` is the documented fallback.
  - **No probabilities.** The API has no logprob, probability or seed field. **[verified from the explainer and the IDL]**
- **Where it can run** **[verified from the docs, the explainer and the Chromium source, except where marked inferred]**
  - Supported: the extension service worker and extension pages (popup, side panel, options). Not available in Web Workers. Content scripts and offscreen documents are not documented, so both need a spike. A cross-origin iframe, such as an embedded player, is blocked unless it carries `allow="language-model"`.
  - So the Prompt API host must be an extension page or the service worker, not a worker. (onnxruntime-web can still use a worker.) Content scripts send text to the host by message.
  - Starting the model download needs a user gesture on an extension page, and a service worker cannot receive one (inferred). Once the model is available, no gesture is needed.
  - Keep one session alive, because the model is unloaded when no session exists. Keep a base session that holds the rule text, clone it once per question, and destroy each clone afterwards.
- **Languages and limits** **[verified]**
  - Supported input languages: en, ja, es, de and fr. Other languages may throw `NotSupportedError`, so declare `expectedInputs` and let `create()` fail early.
  - The docs give no context size. One third-party measurement (M4 Pro) reported 9,216 tokens shared between input and output, so read `contextWindow` at runtime. New member names are `contextWindow`, `contextUsage` and `measureContextUsage`. The old `inputQuota` names are deprecated.
  - `topK` and `temperature` (extension-only, deprecated, and they must be set together) accept `topK: 1, temperature: 0`. No page promises identical output for them, so determinism has to be tested.
- **Offensive text.** No page says that the model refuses or sanitizes profane or blasphemous input. Chromium does have a safety pipeline that can reject output with `NotReadableError` ("The execution yielded an unsafe response."), and what it screens, and with which thresholds, is not documented. The first spike must feed it offensive and quoted subtitle lines and record the answers and the exception names. The deterministic stage runs first, so a lexicon hit never depends on the model accepting the text.
- **Throughput.** No documented numbers. One third-party measurement (M4 Pro): about 50 tokens per second decoding and about 1,000 per second prefill, which makes a title-length question roughly a quarter of a second. **[unverified]**
- **Memory and disk.** About 4 GB on disk (a third party measured 4,072 MiB) and no documented RAM or VRAM use. The model is removed when free disk falls below 10 GB, after 30 days of ineligibility, by enterprise policy (`GenAILocalFoundationalModelSettings`) or by a user setting. So "unavailable" can appear at any time.
- **Images and audio.** The API accepts image and audio input. Whether this works inside extensions is untested. It could later allow thumbnail checks. **[unverified]**
- **Other browsers.** Edge ships its own experimental Prompt API (a 2.3B model called Aion Instruct, Edge 158 and later). Firefox has no Prompt API, but offers `browser.trial.ml`, an extension API that runs Transformers.js and ONNX models in Firefox's own runtime, which may replace bundling onnxruntime-web in a Firefox build. Safari has no equivalent and its vendor opposes the API. For Brave, nothing was found.
- **Spot check on a small machine** **[measured, 2026-11-25]**. On an 8 GB Apple-silicon laptop with Chrome 158, in an ordinary page of a throwaway headless profile, `LanguageModel.availability()` answered "downloadable", `Translator.availability()` for German to English answered "downloadable", and `LanguageDetector.availability()` answered "available". Nothing was downloaded and no session was created. So the APIs are exposed in current Chrome, and this machine was not rejected at the availability stage, although it is below the documented 16 GB RAM figure. Whether a session can actually be created and run is untested.
- **Consequence.** The documented requirements (16 GB RAM or more than 4 GB VRAM, 22 GB free disk) exclude some machines, and Chrome can remove the model at any time. So the Prompt API can be the first-draft backend but not the only one, and "unavailable" must be a normal, handled state.

### 3.4 What an extension can read from YouTube (measured)

All measurements below were made on 2026-11-25 in an anonymous headless Chrome with a throwaway profile, using same-origin `fetch` from a `youtube.com` tab. That is the same position as an extension content script. It is also the least trusted kind of session, so results can differ in a normal logged-in profile.

- **Metadata for any video ID, without opening it.** Fetching `/watch?v=<id>` for a video that is not open returned the full watch page (about 1.8 million characters of HTML for the test video). It contained the title, channel name and ID, duration, the full description, keywords and the list of caption tracks. **[verified]**
  - Cost: roughly 1.8 MB per video. So fetch lazily, only for items that pass the cheap stage, and cache by video ID. Lighter JSON endpoints were not measured.
- **Feed JSON.** BlockTube filters the JSON that YouTube returns before it renders, which also avoids a flash of the unwanted card. **[verified from its README]**

### 3.5 Captions: what works and what does not

The question was whether subtitles can be fetched when a video merely appears in the feed, the way services such as DownSub fetch them for any video URL.

- **How DownSub does it.** No source found in this research describes its method. Services of this kind run on servers. **[unverified inference]**
- **What yt-dlp documents** **[verified]**
  - YouTube binds a proof-of-origin (PO) token to the video ID, so each video needs its own token.
  - The web client needs a PO token for subtitle requests. The yt-dlp source comments that this policy is "in rollout, currently detected via experiment" and that Premium users do require it.
  - Its wiki lists the `tv`, `web_embedded` and `android_vr` clients as not needing a subtitle token. Server-side tools can use those clients. In our test they met other barriers (below).
- **Our tests** **[measured]**
  1. The caption URL of the open video, fetched as is or with `fmt=json3`: HTTP 200 with an empty body. The URL carried no `pot` parameter.
  2. The same for another video's caption URL taken from its watch-page HTML: HTTP 200, empty.
  3. `get_transcript` (the endpoint behind "Show transcript"), using parameters from the page's own data, for the open video and for another one: HTTP 400 `FAILED_PRECONDITION`. A youtubei.js issue from December 2025 reports the same and attributes it to new bot detection.
  4. `youtubei/v1/player` for the other video under other client identities: WEB and MWEB answered "The page needs to be reloaded", TVHTML5 and ANDROID_VR answered "Sign in to confirm you're not a bot", WEB_EMBEDDED answered "video unavailable".
  5. A hidden same-origin embed player (`/embed/<id>?cc_load_policy=1`): the player showed error 152-4 and made no caption request.
- **Reading of the results.** Tests 1 to 3 are consistent with the sources: caption bodies and the transcript endpoint are gated by anti-bot attestation. Tests 4 and 5 are inconclusive, because a clean anonymous headless session is the least trusted kind.
- **Routes**
  - **A. Capture the player's own request at watch time.** Works by design, because the player holds a valid token. SilentShield does this by watching for `timedtext` requests and auto-enabling captions. This is the baseline.
  - **B. Other client identities from a normal profile.** Needs a spike in a real, logged-in browser.
  - **C. Mint a PO token in the page** with BotGuard (BgUtils is the reference implementation; yt-dlp has plugins that do this). Bound to the video ID, an arms race, and a terms-of-service question. Only as an optional enhancement.
  - **D. A hosted caption service.** Rejected: it would send viewing history to a third party.
- **Plan.** Feed-time decisions use metadata (title, description, keywords, channel). Watch-time decisions use route A. The spike in M0 tests B and C. If one works, caption prefetch becomes an enhancement behind a switch, and nothing else in the plan depends on it.
- **Audio fallback.** For videos without captions, on-device speech recognition is possible: Profanity Muter bundles Whisper `base.en` (about 280 MB), catches about 90% of profanity, and covers regular videos only. **[verified from README]**

### 3.6 Page structure and selectors

- **Prototype: card discovery without YouTube element names.** Every link whose `href` matches `/watch?v=<id>` or `/shorts/<id>` yields an ID. The card of an ID is the largest ancestor that contains links to that ID only. Titles come from `title` or `aria-label`, and YouTube's own element names were used only to grade the result. **[measured]**
  - Search results (logged out), first run: 45 IDs gave 45 distinct containers. YouTube's own renderers on the page were 19 `ytd-video-renderer`, 11 `yt-lockup-view-model` and 15 Shorts lockups, which also adds up to 45.
  - Search results after scrolling: 78 IDs gave 77 distinct containers. Two cards mapped to the same page-sized wrapper (1112 by 15954 px), and a size guard rejected them.
  - Watch-page sidebar: partly wrong. Links in the video description and page-level wrappers produce oversized containers. A size guard based on the median fails when most candidates are wrong.
  - The Home feed is empty for an anonymous headless session, so it was not tested.
  - Channel names are often plain text, not links (sidebar lockups), so metadata should come from the JSON, not from the DOM.
- **Conclusion.** ID-anchored discovery works as a fallback and as a diagnostic. It needs a test that a candidate is one of several repeated siblings, and it must never hide a container that looks page-sized.

### 3.7 Prior art

- LLM-based feed filters: YouTube Focus, Dehook, Syte (Gemini Nano on Shorts), Clean Feed for YouTube. **[verified from store listings]**
- Caption and audio muting: SilentShield (open source), Profanity Muter (open source, Whisper), ContentAngel, NoBadWords AI, Bleepster, Streaming Word Filter. **[verified from listings and READMEs]**
- Generic blocking: BlockTube (JSON filtering), Unhook.
- None of them offers user-written doctrinal rules with per-rule thresholds and a strictness setting. Their code was not reviewed.

### 3.8 Brave and other built-in features

- **Shorts blocking: true, opt-in** **[verified from Brave's issue tracker, filter-list catalog and list sources]**
  - Desktop: Settings > Shields > Content filtering > "YouTube Shorts blocker" (earlier called "YouTube Anti-Shorts"). Android: Settings > Media > "Block YouTube Shorts" (shipped in 1.66.x). iOS: three toggles in Settings > Media since 1.81.x. It is off by default, and the product owner wrote that blocking "should be user initiated".
  - It is a cosmetic filter list: element hiding only, with no model and no AI. A direct `/shorts/` URL still opens and plays. The list was fixed at least 15 times between 2024-02 and 2026-09 because YouTube's selectors change, which supports the plan's choice not to rely on selectors alone.
- **Thumbnail blocking: true, opt-in.** "YouTube thumbnail image blocker" on the same settings page. It is a cosmetic list taken from EasyList, and Brave announced it on 2026-03-27. It also stops hover previews.
- **Title rewriting: not found.** None of the 62 entries in Brave's filter-list catalog rewrites text, and the desktop release notes from 1.67 to 1.100 mention no such feature. An open, unassigned request asks Brave to integrate extensions such as DeArrow. The claim could not be confirmed, and it is probably a mix-up with extensions: DeArrow (crowd-sourced titles and thumbnails) and Unbait (LLM rewrite).
- **Other opt-in toggles** in the same catalog: Playables, autodubbed videos, end-video elements and members-only videos, and on mobile recommendations and distracting elements.
- **Other browsers.** No built-in equivalent was found in Chrome, Edge, Firefox or Safari (one search, unverified).
- **Implications.**
  - The overlap holds for Shorts, thumbnails, recommendations and end cards. It does not hold for title rewriting, which is a real gap and a reason to build that part.
  - Brave's features are list toggles and not an API, so the extension cannot reliably detect them. Hiding must be idempotent, so that double-hiding is harmless.
  - EasyList's Shorts and no-thumbnails lists are a maintained selector source for the fallback path. Their licence was not checked.

### 3.9 Distribution

- **A personal website (first target)** **[verified from the docs, except where marked]**
  - Chrome on macOS and Windows: "Load unpacked" with Developer mode on at `chrome://extensions`, which is the route Google itself points developers to. The `--load-extension` flag was removed from Chrome-branded builds in Chrome 137 (it still works in Chromium and Chrome for Testing), so installation cannot be scripted and the user picks the folder.
  - Self-hosted `.crx` files and policy installs: on Windows and macOS the docs say external installs must come from the Chrome Web Store, and force-install policies work only on managed devices. Linux still allows a local `.crx` through an external-extensions JSON file. Dragging a `.crx` onto the extensions page was not tested.
  - Edge: "Load unpacked" at `edge://extensions` is documented. Brave: assumed to be the same, **[unverified]**.
  - Firefox: sign the add-on through addons.mozilla.org as "unlisted" and host the signed file with the content type `application/x-xpinstall`. Release Firefox refuses unsigned add-ons. ESR, Developer Edition and Nightly allow turning the check off.
  - Unpacked installs do not update themselves, so updates are manual.
- **Size limits**
  - Firefox: a 200 MB limit at signing was reported for the official page (search result only, **[unverified]**). A 340 to 520 MB model cannot be inside a signed Firefox package, so it has to be downloaded after install.
  - Chrome Web Store: no official package-size figure was found. An informal 2023 answer in the Chromium extensions group says there is no fixed limit below 4 GB per uploaded file. **[unverified]**
- **Chrome Web Store and model files** **[verified from the docs]**
  - Google's extensions-and-AI guidance says to download larger client-side models after the extension is installed, to manage the model's life cycle separately from the extension, and that "models are not considered remote hosted code".
  - The store's MV3 policy text lets an extension "reference and load data and other information sources that are external to the extension, but these external resources must not contain any logic", and forbids building an interpreter for remotely fetched commands. A weights file loaded by a bundled runtime is data under that text, so a first-run download is plausible. A reviewer could still call an ONNX graph "logic", and no store text mentions ML models, so only a real submission settles it.
  - Remote hosted code means anything the browser executes that is loaded from outside the package, such as JavaScript and WASM. So the runtime (scripts and the onnxruntime WASM files) must be bundled.
  - One reply in the Chromium extensions group said "It must be bundled with the extension." That is an informal answer from one person and is stricter than the policy text.
  - The "Unlisted" visibility (anyone with the link can install) exists, and goes through the same review as a public listing.
- **Storing a downloaded model.** The `unlimitedStorage` permission lifts the quota for IndexedDB, Cache Storage and the Origin Private File System (without it `chrome.storage.local` holds 10 MB). Chromium lets an origin use up to 60% of the disk. Firefox's best-effort quota is the smaller of 10% of the disk or 10 GiB, and persistent storage can use up to 50%. Real free disk space is the practical limit.
- **Recommended design.** A small extension that holds only the runtime and the code, plus a model downloaded on first run from the project's website, pinned by SHA-256 and stored in OPFS, with `unlimitedStorage`. This avoids size limits in both stores. Whether the Chrome Web Store accepts it should be tested with one unlisted submission before anything depends on it. The model version is pinned in a manifest with a checksum, so updates stay controlled.

---

## 4. Architecture

### 4.1 Pipeline

Page adapter, then signals, then rules, then decision backends, then actions.

- **Page adapter (YouTube).** TypeScript. A main-world script reads the feed JSON before render. A content script finds and hides cards (section 4.3). On the watch page it captures captions and controls the player.
- **Signals.** Cards: title, channel, badges, duration. Watch page: title, description, keywords, channel, and the transcript split into overlapping windows with timestamps.
- **Rule engine.** Parses the rule text, runs the deterministic stage, batches questions for the model, and caches verdicts by video ID, rule-set version and model version. Language: Rust compiled to WASM, or TypeScript. **[choice, open]**
- **Backends, cheapest first.**
  1. Deterministic stage: allow and deny lists, keyword and regex lists.
  2. Chrome Prompt API (first draft).
  3. A local English decision model (section 8), through onnxruntime-web or Transformers.js, on WebGPU if present and otherwise WASM, in an offscreen document.
  4. Optional experiments: Needle, Granite Guardian (section 8).
- **Hosted decision APIs.** Not built. They send content off the machine. **[choice]**
- **Settings UI.** A rule editor, per-rule thresholds, a strictness setting, an event log ("why was this hidden?") and a test box where a pasted title or transcript shows the model's answers.
- **MV3 notes** **[verified]**: ship the onnxruntime WASM files inside the extension, use `'wasm-unsafe-eval'` in the CSP, and run onnxruntime-web inference in an offscreen document or a worker, not in the service worker. The Prompt API and the Translator cannot run in a worker: host them in an extension page or the service worker.

### 4.2 Combining approaches

The aim is accuracy without a bigger model: independent signals that fail in different ways.

- **Stage 0, deterministic.** User-maintained allow lists (trusted channels pass without scanning) and deny lists (blocked channels and video IDs), keyword and regex lists on title and description, and the language check. These produce verdicts with no model at all.
- **Stage 1, one model per question.** The first backend returns a probability. Above the high threshold the rule fires. Below the low threshold the item passes. Between the two, the item is "uncertain".
- **Stage 2, a second opinion on uncertain items only.** A model from a different family (the Prompt API against the local model) answers the same question. How the two answers combine depends on the severity of the action:
  - Hiding a feed card fires on either answer above the high threshold, or on both above the low one.
  - Muting a word needs a lexicon hit and context agreement.
  - A disagreement stays "uncertain" and follows the fail-safe default.
- **Signals add up.** Card metadata, a per-channel tally (videos analysed, videos flagged; plain counters, not learning), and transcript windows at watch time. A channel with a high flagged share can be offered for the deny list, and the user confirms.
- **Why this should help.** A published team that checks drafts with several decision models reports that no single model separated its good and bad sets cleanly, that three together caught all but one of 22 bad items, and that screening with a decision model and sending only doubtful claims to a large model was cheaper and better than the large model alone. **[verified from that article; hosted models, so the evidence is indirect]**
- **No accuracy claim** is made until it is measured on the labelled set (section 9).

### 4.3 A page adapter that survives layout changes

- **Layer 1: JSON.** Decisions are made on the feed JSON, keyed by video ID, found by a shape-agnostic walk that looks for objects holding a video ID and nearby title and channel text, so renamed renderer types do not break it. **[choice]**
- **Layer 2: ID-anchored DOM mapping.** To hide an ID, find its links and walk up to the card using the structural tests from section 3.6 (largest single-ID ancestor, repeated siblings, plausible size). No YouTube element names are used.
- **Layer 3: a self-test.** On each page type the adapter checks that discovery finds cards. When it does not, it logs a visible diagnostic and degrades to a safe action (dim the thumbnail link only) instead of hiding a page-sized container.
- **Outside the extension.** A scheduled headless run against a live search page (which works logged out) reports when discovery drifts. Selector data, but not code, may be updated remotely under store policy; for a self-distributed build this is not a constraint. **[unverified]**

### 4.4 Non-English text

- Detect the language of each title and subtitle track. If it is not English, translate to English on-device, then classify. Subtitles are translated in chunks and cached.
- The classifier then needs to know only English, which keeps models small.
- Translation quality bounds classification quality. Verdicts on translated text should carry a flag.
- **Translator API and Language Detector API** (Chrome 138, desktop only) **[verified from the docs; some points come from single sessions]**
  - The Translator supports 39 languages: ar, bg, bn, cs, da, de, el, en, es, fi, fr, he, hi, hr, hu, id, it, ja, kn, ko, lt, mr, nl, no, pl, pt, ro, ru, sk, sl, sv, ta, te, th, tr, uk, vi, zh and zh-Hant. German, French, Spanish, Italian, Portuguese and Polish are included. **Latin is not.**
  - The Prompt API itself accepts en, ja, es, de and fr, so German, French and Spanish need no translation step. Polish, Italian and Portuguese go through the Translator first.
  - Both are unavailable in Web Workers. The extension service worker, content scripts and offscreen documents are not documented, and the Language Detector had a service-worker bug in 2024. This needs a spike.
  - Each language pair is a separate pack with a hidden size (progress is normalised) and needs a user gesture to download. It works offline afterwards.
  - Translations run one after another, so subtitles must be split into chunks. Read `inputQuota` and, on `QuotaExceededError`, halve the chunk. One session reported about 30 ms per sentence once the pack was local. **[unverified]**
  - No independent quality evaluation was found.
  - Take the source language from the language code of the caption track, which YouTube provides, and use the Language Detector only as a fallback. Very short texts are detected badly.
  - **Latin text** cannot be translated. The rule for it is lexicon only, or skip.

### 4.5 Attention-calming module

- **Features.** Hide Shorts shelves and the Shorts tab, hide or blur thumbnails, and rewrite attention-grabbing titles (strip ALL CAPS, emoji and stock clickbait phrases by rule, with an optional model rewrite).
- **Why.** It costs little, many people do not know such features exist, and it reduces the pull of the feed even for items that pass the rules.
- **Overlap.** Brave ships Shorts, thumbnail and recommendation blocking natively, as opt-in list toggles (section 3.8), but no title rewriting. The module therefore hides idempotently, and title rewriting is its real addition.

---

## 5. Rules in plain text

Rules are plain text in the same typed-question shape as Jev and Laya. Parsing is deterministic and needs no model. The syntax below is a **[choice]** to be refined.

```
# Vianney rules v1

rule gossip
  where: watch
  ask score: "How much of this talks about the private faults of a named real person?"
    levels: none, mild, heavy
  block if level >= heavy
  action: warn-overlay

rule indifferentism
  where: feed-card
  ask noul: "Does this say all religions are equally true or equally valid paths?"
  block if p >= 0.70 and confidence >= 0.4
  action: blank

rule lords_name
  where: subtitles
  lexicon: lords_name_terms
  ask noul: "Is the name of God or of Jesus used here as an exclamation or a curse, and not in prayer, quotation or discussion?"
  mute if p >= 0.6
  action: mute-word
```

- Each rule has: where it applies, a deterministic part (lexicon, lists), one or more typed questions (`noul`, `choice`, `score`), a threshold, and an action.
- Questions are evaluated in parallel. A question that depends on another one runs in a second pass.
- `p` is backend-specific. Decision models return a probability. The Prompt API returns none, so there `p` is the fraction of differently worded prompts that agree, which is a vote and not a calibrated probability.
- Every decision is logged with the question, `p`, confidence and threshold.
- **Starter pack.** The Lord's-name rules start from the six categories in the Curé's sermon: oaths, blasphemies, renunciations, imprecations, curses and coarse words ([sermons page](sermons.md), section 4). The questions themselves are drafts for the rule author to correct, and the pack says so in its header.

---

## 6. Actions

- **Feed cards.**
  - `blank`: an empty placeholder of the same size, so the layout does not jump.
  - `hide`: remove the card.
  - `hide+refill`: remove the card and load more items until the visible slots are full. **[choice]** Hard caps: a maximum number of refills per scroll, a time limit, and a stop when nothing new arrives.
  - `dim` and `label`: show the reason instead of hiding, for tuning.
- **Watch page.** `warn-overlay` (reason and a "watch anyway" button, optionally after a delay), `pause-before` (pause shortly before the first flagged segment), `close`.
- **Subtitle level.** `mute-word` (exact timespan of the word, which needs word-level timing, available for auto-generated captions), `skip-segment`, `censor-caption`.
- **Attention module.** `hide-shorts`, `blur-thumbnail`, `rewrite-title`.
- **Autoplay.** The "up next" and autoplay target are filtered like any other card, and a blocked target is skipped.

---

## 7. Subtitles, the Lord's name, gossip, strictness

- **Profanity.** Lexicon first. Ambiguous cases go to a context question.
- **The Lord's name.** The words alone do not decide it: "Jesus Christ" in a homily, a prayer or a hymn title is not a violation, and the same words as an exclamation are. So: lexicon match, then a context window of about 20 words either side, then a `noul` question. The taxonomy comes from the sermon.
- **Blasphemy.** The same two steps, with a question about mockery or contempt of God, the Church or the saints.
- **Gossip.** A video-level `score` question over transcript windows, aggregated by duration. The sermon treats the listener as an accomplice, which is the basis for hiding rather than merely warning. A small model will find this hard, so expect mediocre accuracy and tune thresholds.
- **Strictness and scrupulosity. Interpretation to confirm (section 12).**
  - One strictness dial (lax, normal, strict) shifts all thresholds and decides what happens on uncertainty (show, warn or hide).
  - An anti-scrupulosity guard: a cap on warnings per hour or day, a "this was a false alarm" button that adds the item to the allow list, short calm reason text, and no streaks or counters by default.
  - The design principle is the Curé's own: accuse the doubtful as doubtful and the certain as certain, and avoid the useless accusations that wear everyone out (sermons page, section 6).
- **No-caption videos.** Judge on title and description only, or opt in to on-device speech recognition (Whisper `base.en`, about 280 MB, trails the playhead).

---

## 8. Model plan

- **Phase 1, first draft: the deterministic stage plus Chrome's Prompt API.** Nothing to download or bundle. Greedy decoding and constrained output (a boolean schema, or a RegExp for a small set of values). No probabilities are available, so the "uncertain" band comes from asking the same question in two or three differently worded prompts, or from an ordinal score (for example 0 to 4) with a RegExp constraint, and counting agreement. **[choice, tested in spike 1]**
- **Phase 2: a local English decision model as the second opinion.** Candidates, to be run on the same labelled set:
  1. **Kev-0.6B** through open-jev. The only small English decision model with a ready browser build, and its 8,192-token context holds a whole subtitle window.
  2. **Laya English, only after fitting** its temperatures or a small head on the labelled set. Zero-shot it is near chance.
  3. **A zero-shot NLI baseline** (DeBERTa-xsmall or ModernBERT-base). Small and cheap. It is a floor the others must beat and a possible pre-filter.
  4. **GLiNER2.5-Decide**, if a browser export appears. Best vendor-reported accuracy at its size.
- **Fitting on the labelled set** (temperatures, thresholds, or a small head) is an offline, one-time step. The result is a frozen file that ships with the extension, so verdicts stay repeatable. This is not continuous learning, but it is training, so it needs explicit agreement. **[choice, open question 10]**
- **Experiments, not tiers.** Needle (section 3.2) as a very small fine-tuned classifier, with its own logistic-regression head on `embed()` vectors if a probability is needed, and Granite Guardian only as an optional power-user backend.
- **Selection rule.** A model is adopted only if, on the labelled set, it beats the NLI floor and the Prompt API at the chosen operating point of the rule, and fits the memory budget measured in spike 2.

---

## 9. Evaluation

- Every number in the system is either measured on a labelled set or marked as a choice.
- The labelled set: titles, descriptions and transcript windows from YouTube, labelled per rule by the project's author, including hard negatives (a priest saying the Holy Name in a sermon, a Passion play, a documentary about a heresy).
- Per rule: precision and recall at the chosen threshold, and the calibration curve of the model's probability.
- A rule ships only with its threshold and measured error rates recorded next to it.
- A regression run repeats the whole set on every model, quantization or prompt change. Because the system is deterministic, a changed verdict always has a cause.

---

## 10. Milestones

- **M0, spikes (before real code)**
  1. Prompt API and Translator on a low-end laptop (8 GB): `availability()` inside an offscreen document, a side panel and the service worker of a throwaway extension; `create({topK: 1, temperature: 0})`; boolean, `enum` and RegExp constraints; identical answers on repeated runs; 50 to 100 offensive and quoted subtitle lines with the answers and exception names logged (and `chrome://on-device-internals` open); 100 timed classification calls; one 50-chunk translation run; memory with and without a live session.
  2. Local decision models in the browser (Kev-0.6B through open-jev, Laya English, an NLI baseline): size, latency and memory on a low-end laptop, with and without WebGPU, and accuracy on a first labelled set.
  3. Captions: routes B and C on a normal logged-in profile, and whether word timing arrives.
  4. A selector-discovery health check against a live search page.
  5. Needle, a half-day spike: the engine in an offscreen document, 100 labelled titles through the base model with one enum tool, the raw JSON, `peak_ram_mb`, time per title and the suppressed rate. Fine-tuning is considered only after that.
  6. Translator pairs (de, fr, es, it, pt, pl to en): availability per pair, size of the download, latency, and quality on a sample of titles. Whether Latin can be detected.
  7. One unlisted Chrome Web Store submission whose extension downloads its model on first run, to see whether review accepts it.
- **M1, feed filter.** JSON interception, ID-anchored DOM hiding, the deterministic stage, the Prompt API backend, the rule parser, an event log and a test box. Actions: hide, blank, refill.
- **M2, watch page.** Caption capture through the player's own request, lexicon plus context, mute and skip, overlay.
- **M3, second opinion.** The local decision model chosen in the spike, translation, the labelled set and calibration tooling.
- **M4, polish.** Strictness dial, warning cap, starter rule pack, attention module, packaging for download from the project website.
- **M5, optional.** Firefox, caption prefetch, thumbnails, comments.

---

## 11. Risks

- **Model quality on doctrine.** A small model reading a title is a weak judge of "contrary to Catholic teaching". The honest expectation is a useful first filter, not a theologian. Expect many "uncertain" results, and let the deterministic stage and the user's lists carry weight.
- **Calibration and zero-shot quality.** Small decision models are overconfident (jevos gives more wrong yeses than wrong noes) and Laya English is near chance zero-shot. Vendor numbers are on generic public suites, not on doctrinal or profanity-in-context questions. Thresholds and the model choice must be measured on our own labelled set.
- **YouTube changes.** Selectors, JSON shapes and caption access change. The layered adapter reduces the damage and does not remove it.
- **Caption access.** PO-token enforcement may tighten further. The plan depends only on the player's own request.
- **Terms of service.** Local page modification is common practice. Minting PO tokens or prefetching captions is a gray area and stays optional.
- **Memory and disk.** Many users have 8 GB RAM. A 500 MB model plus the runtime must be measured on such a machine. The Prompt API needs 22 GB free disk.
- **Distribution.** Chrome and Edge install an extension from a website only through developer-mode "Load unpacked", with no scripted install since Chrome 137. Firefox needs add-on signing and has a signing-size limit. Updates are manual. Early users need some patience (section 3.9).
- **The Prompt API may not run.** It can be unavailable on small machines, can be removed by Chrome at any time, and may reject offensive input through its safety pipeline. Its extension-only sampling parameters are deprecated. The extension must work, with less accuracy, without it.
- **Wrongly hiding good content** such as Scripture, sermons and sacred music is the failure that would cost the most trust, so false positives weigh more when choosing thresholds.

---

## 12. Open questions

1. **"Scrupulosity filter."** Is the reading in section 7 right (strictness dial plus anti-scrupulosity guard), or a stricter level that flags more borderline material?
2. **Hosted decision APIs.** Never, or an opt-in "ask a hosted model when the local ones disagree"? The plan assumes never.
3. **Languages at launch.** English only, or English plus German, French and Spanish (no translation step), and later Polish, Italian and Portuguese through the Translator? Latin cannot be translated.
4. **Rule engine language.** Rust compiled to WASM, or TypeScript throughout? The model runtime is JavaScript either way. Whether a Rust runtime can run ModernBERT-large in a browser fast enough is **[unverified]**.
5. **Starter rule pack.** Who writes the questions? They should be clearly marked as the author's.
6. **"Reload until no more."** Read here as: after hiding a card, load more items until the visible slots are full, with hard caps. Correct?
7. **Which browsers first.** Chrome, Edge and Brave share an engine, but only Chrome and Edge ship a built-in Prompt API. Firefox has `browser.trial.ml` instead, and its WebGPU support is limited.
8. **PO-token routes.** Test them at all, given the terms-of-service question?
9. **Sites beyond YouTube.** The adapter design allows it. When?
10. **Offline fitting.** Is a one-time, offline fit of thresholds or a small head on the labelled set acceptable, given that nothing learns after release? Without it, Laya English is not usable.
11. **Needle fine-tuning.** If Needle is tried, locally (JAX, untested on small machines) or through the vendor's hosted service (paid, hosted, calibrated head)? The plan assumes local only.

---

## 13. Sources

Decision models
- [Jev (Wikipedia)](https://en.wikipedia.org/wiki/Jev_%28AI_model%29)
- [Microsoft-Decision-1 vs Jev](https://systemonemodels.org/compare/jev-vs-microsoft-decision-1/)
- [Four decision models compared (panel and cascade evidence)](https://www.techfabric.com/blog/ai-decision-models-compared-jev-clef-kev-microsoft)
- [Google Decisions API vs Jev](https://dev.to/rare_matt/google-decisions-api-vs-jev-which-is-better-212d)
- [Laya model card](https://huggingface.co/convaiinnovations/laya)
- [Laya int8 for the browser](https://huggingface.co/nvkudva/laya-onnx-q8)
- [Laya 4-bit for the browser](https://github.com/dockndevai/laya-models)
- [jevos](https://github.com/feder-cr/jev)

Cactus
- [github.com/cactus-compute/cactus](https://github.com/cactus-compute/cactus)
- [cactuscompute.com/blog/needle-supported-devices](https://cactuscompute.com/blog/needle-supported-devices)
- [Needle product page and charts](https://cactuscompute.com/needle)
- [Needle confidence](https://cactuscompute.com/blog/needle-confidence)
- [Fine-tuning Needle](https://cactuscompute.com/blog/finetuning-needle)
- [Structured extraction and enums](https://cactuscompute.com/blog/structured-extraction-with-needle)
- [Needle Python docs](https://cactuscompute.com/blog/needle-python-docs)
- [Needle 3 weights and config](https://huggingface.co/Cactus-Compute/needle3)

Brave
- [Filter-list catalog](https://raw.githubusercontent.com/brave/adblock-resources/master/filter_lists/list_catalog.json)
- [Shorts list](https://raw.githubusercontent.com/brave/adblock-lists/master/brave-lists/yt-shorts.txt)
- [Android Shorts toggle](https://github.com/brave/brave-browser/issues/36465)
- [iOS toggles](https://github.com/brave/brave-browser/issues/37966)
- [Request to integrate extensions such as DeArrow](https://github.com/brave/brave-browser/issues/56658)
- [EasyList thumbnail list](https://raw.githubusercontent.com/easylist/easylist/refs/heads/master/custom-lists/youtube-nothumbnails.txt)

Distribution
- [Chrome team notice on `--load-extension` and Load unpacked](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/1-g8EFx2BBY/m/S0ET5wPjCAAJ)
- [Installing extensions outside the store](https://developer.chrome.com/docs/extensions/how-to/distribute/install-extensions)
- [Edge sideloading](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading)
- [Firefox self-distribution](https://extensionworkshop.com/documentation/publish/self-distribution/)
- [Chrome Web Store MV3 policy](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)
- [Chrome Web Store distribution options](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)
- [`unlimitedStorage` and other permissions](https://developer.chrome.com/docs/extensions/reference/permissions-list)
- [Storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

Small decision models
- [Kev-0.8B card](https://huggingface.co/jaredpalmer/kev-0.8b)
- [open-jev demo and model catalog (Kev and DeBERTa browser builds)](https://github.com/nico-martin/open-jev-demo)
- [Laya independent comparison](https://huggingface.co/convaiinnovations/laya/discussions/20)
- [Laya agent-guard test](https://huggingface.co/convaiinnovations/laya/discussions/15)
- [Laya browser int8 build and its measurements](https://huggingface.co/nvkudva/laya-onnx-q8)
- [GLiNER2.5-Decide](https://huggingface.co/fastino/GLiNER2.5-Decide)
- [Granite Guardian 4.1-8B](https://huggingface.co/ibm-granite/granite-guardian-4.1-8b)
- [Granite Guardian 3.2-3B-A800M](https://huggingface.co/ibm-granite/granite-guardian-3.2-3b-a800m)
- [Granite Guardian adapters library](https://huggingface.co/ibm-granite/granitelib-guardian-r1.0)
- Zero-shot NLI: [huggingface.co/MoritzLaurer/deberta-v3-xsmall-zeroshot-v1.1-all-33](https://huggingface.co/MoritzLaurer/deberta-v3-xsmall-zeroshot-v1.1-all-33) and [huggingface.co/MoritzLaurer/ModernBERT-base-zeroshot-v2.0](https://huggingface.co/MoritzLaurer/ModernBERT-base-zeroshot-v2.0)
- [ONNX Runtime Web memory limits](https://onnxruntime.ai/docs/tutorials/web/large-models.html)
- [Gemini Nano on-disk size (third-party measurement)](https://dev.to/jacquesgariepy/inside-chromes-edges-silent-4gb-ai-install-a-complete-hands-on-investigation-54g2)

In-browser inference and Chrome
- [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api)
- [Prompt API explainer (contexts, renamed members, no probabilities)](https://github.com/webmachinelearning/prompt-api)
- [Structured output for the Prompt API](https://developer.chrome.com/docs/ai/structured-output-for-prompt-api)
- [Built-in model management](https://developer.chrome.com/docs/ai/understand-built-in-model-management)
- [Chromium error mapping, including the safety errors](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/ai/exception_helpers.cc)
- [Translator API](https://developer.chrome.com/docs/ai/translator-api)
- [Language Detector API](https://developer.chrome.com/docs/ai/language-detection)
- [Extensions and AI (download large models after install; models are not remote hosted code)](https://developer.chrome.com/docs/extensions/ai)
- [Edge Prompt API](https://learn.microsoft.com/en-us/microsoft-edge/web-ai/prompt-api)
- [Firefox `browser.trial.ml`](https://firefox-source-docs.mozilla.org/toolkit/components/ml/extensions.html)
- [Running LLMs in an MV3 extension](https://awflow.io/blog/running-llms-inside-a-chrome-extension)
- [Offscreen documents](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
- [Remote hosted code](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code)
- [Model bundling answer (Chromium extensions group)](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/JkZqzaom0JI)

YouTube and captions
- [yt-dlp PO token guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide)
- [yt-dlp client definitions and subtitle policy comment](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/_base.py)
- [youtubei.js, `get_transcript` failing with 400 (December 2025)](https://github.com/LuanRT/YouTube.js/issues/1102)
- [Caption URL needs a `pot` parameter](https://stackoverflow.com/questions/79668836/youtube-caption-extract-timedtext-api-pot-parameter)
- [BlockTube](https://github.com/amitbl/blocktube)
- [SilentShield](https://github.com/deboorn/silent-shield)
- [Profanity Muter](https://github.com/profanity-muter/profanity-muter)

The sermons and their sources are on the [sermons page](sermons.md).
