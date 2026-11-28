# The plan

Status: working draft, 2026-11-25. Version 0.2 of the extension is built (see section 10 and the README); the plan below is still the reference.

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
  - **Personal tool.** Not a paid product, and MIT-licensed. Distributed from the project's own website first.

---

## 2. Decisions so far

- **First-draft backend:** Chrome's built-in Prompt API (Gemini Nano). Nothing to bundle, nothing to download by hand.
- **Second model:** a local English decision model, picked by a spike on our own labelled set (section 8). The first idea was English Laya (ModernBERT-large, 421M). The research changed the order: Laya is near chance zero-shot, and Kev-0.6B has a ready browser build (section 3.1).
- **Non-English text:** detect the language and translate titles and subtitles to English with Chrome's on-device Translator API before classifying (section 4.4).
- **Deterministic filter** (channel lists, keyword lists, regexes) in front of every model.
- **No continuous learning, but one offline fit is fine.** Nothing learns after release. A one-time fit on the labelled set (calibration, thresholds, presets, or a small head) is accepted, and its result ships as a frozen file (section 8).
- **Distribution:** the project's own website first (a zip for "Load unpacked"; a signed add-on for Firefox), with the model downloaded on first run (section 3.9). A store listing is optional and later.
- **Combine approaches** for accuracy (section 4.2).
- **Sensitivity per rule.** Every rule has a control for how confident it must be before it flags, shown as a slider or a dropdown, so that a rule that flags too much or too little can be adjusted by the user (section 7).
- **Break reminder.** After the user has watched for N hours, something that looks exactly like a video (in a list) or a comment (under a video) tells them, quietly and in a random place, how long they have been watching and to take a break (section 4.6).
- **Licence:** MIT.
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
  - **A browser build exists.** `kev-0.6b` (base Qwen3-0.6B) is 0.34 GB at q4f16 (0.38 GB at q4) through the `open-jev` package on Transformers.js with WebGPU and a WASM fallback. A 4B build is 2.3 GB. **Correction (2026-11-26, from its `config.json`):** the graph accepts 8,192 tokens, but this model was trained on states of at most 384 tokens and questions of at most 1,024 (`trained_max_state_tokens`, `trained_max_branch_tokens`); longer inputs run and are untested. The 8,192-token validated context belongs to Kev-0.8B. The extension cuts the text to 384 tokens.
  - Questions are typed (`noul`, `choice`, `score`) with an `instructions` string and optional `criteria`, which is the rule format of section 5.
  - Accuracy: the Kev-0.8B card shows 0.586 on 14 held-out public sets against Jev's 0.757 and says that out of domain it is "markedly less accurate than Kev-4B". The 0.6B PyTorch checkpoint's card publishes 0.801 in domain and 0.620 out of domain on its development sets (0.808 and 0.642 on the locked test), and says that held-out policy reasoning fails; no number exists for the quantised browser build. It sits on an older base than the current cards. English only, trained on a handful of domains. On the rule author's own examples it is only slightly better than the word lists (research/kev-accuracy-smoke.md).
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
- **Images and audio.** The API accepts image and audio input. Version 0.2 uses it for the experimental image and audio checks: see section 3.10. On the machine used here, availability with image input is "downloadable" and with audio input "unavailable", and no real model has been run. **[measured, availability only]**
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
- None of them offers user-written doctrinal rules with a sensitivity control for each rule. Their code was not reviewed.

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

### 3.10 Images & Audio (experimental, version 0.2)

- **What was asked.** An experimental option that judges the thumbnail of every video in the same classifier style (immodesty, and all pornography), and the audio of a video, with Chrome's on-device model. Every part has to be configurable, in case the classifiers misfire.
- **What is built** (off until switched on in the settings; no new permission)
  - Two new surfaces for rules, `thumbnail` and `audio`. A rule on them has an `ask noul` question and no word list, and cannot also look at text. They ship in `extension/rules/vianney.media.en.rules`: nudity and pornography (hide the card), immodest images (blur), gore (off), explicit audio (pause behind a warning), coarse language in the audio (mute until a clean window), the Lord's name in the audio (off).
  - A score is the share of 1 to 3 differently worded prompts that answered yes (the "votes" setting). With 2 votes it is 0, 0.5 or 1. So "flag at 0.3" means any prompt says yes, 0.6 means most agree, 0.9 means all agree. These numbers are choices, not measurements.
  - A refusal by the browser's safety filter (`NotReadableError`, "unsafe response") counts as a flag only for rules that say `refusal: flag`, and only while the setting "treat a refusal as a flag" is on. That default is a guess in the cautious direction: it has not been seen happen.
  - Thumbnails: the service worker fetches the image from `i.ytimg.com` and gives it to the model with the question. Cards near the screen go first, a page has a budget (60 by default), and verdicts are kept for 30 days. A thumbnail can be held invisible until it was checked; it is shown anyway after a few seconds when the model is slow (0 seconds means never), and always when the model is unavailable, so the page never stays broken.
  - Audio: the player's audio is recorded in windows of a few seconds (`video.captureStream()` and `MediaRecorder`), decoded to 16 kHz mono and sent as a WAV clip. A window is judged after it has played, so an audio check can only react to what comes next. It can pause the video, mute it until a window comes back clean, or show a label. If the model is slower than the audio, at most two windows wait and older ones are dropped and counted. Silence is not sent to the model. Ads are skipped. By default it stays idle when the captions were read, because the subtitle rules cover speech then.
  - Remembered audio verdicts: a video flagged by audio is remembered with the score, and a feed hides (or dims, or labels) it next time. The verdict is made again from the stored score, so moving a slider changes it.
  - For misfires: a switch and a slider per rule, a switch per part, allow and block lists that always win (allow beats block), a "Show" button on a blurred thumbnail, "Allow" and "Block" buttons on activity entries, and a rule test that analyzes an image or an audio file from disk.
- **Measured here** **[measured, 2026-11-25; 8 GB Apple-silicon laptop, headless Chrome 158]**
  - `LanguageModel.availability()` with image input answered "downloadable", with audio input "unavailable". No model was downloaded (Chrome wants 22 GB free, and this machine has about 13 GB), so no real model has judged an image or audio here.
  - `i.ytimg.com` answers with `access-control-allow-origin: *`, so the service worker can read thumbnails without a host permission. A 320 by 180 `mqdefault.jpg` is 7 to 10 KB. Pages use `/vi/<id>/hq720.jpg`, `/vi/<id>/hqdefault.jpg` and the localised `/vi_lc/<id>/hqdefault_de.jpg`. Channel avatars come from `yt3.ggpht.com`.
  - Recording the audio of a playing video works from a content script without a user gesture, and also while the browser itself is muted (`--mute-audio`) or the element is muted. A 4-second window arrived as a 126 KB WAV with real signal. A real-time `AudioContext` stays suspended without user activation, which is why the recorder is decoded offline.
- **Tested with a stand-in model.** The browser tests put a fake `LanguageModel` into the service worker. Real thumbnails are fetched, real audio is recorded from a playing video, and only the model's yes or no is scripted. They show that the whole path works: fetch, message, votes, engine, hold, hide, lists, cache, mute, pause overlay and the remembered verdict.
- **After version 0.2.1, not released yet** (details in section 3.12)
  - A thumbnail action `blackout`: the image is drawn with brightness 0 (pure black; a screenshot of its middle reads 0 of 255), and the card and its title stay. A "Show" button reveals it again, and the reveal survives later scans of the feed.
  - A choice of what to do for every rule and surface on the settings page (for example `blackout` instead of `blur`), stored in the settings and applied by the engine, so the rule text does not have to be edited.
  - A model check on the settings page: one row each for rule questions, images and audio, with Chrome's status, what it means, and a "Download" button where Chrome says the model can be downloaded (no confirmation dialog first, because Chrome lets a download start only while the click's user activation is fresh); what the computer reports (browser, threads, memory, graphics; free disk space and video memory cannot be read by a page); advice; a link to `chrome://on-device-internals`; and the benchmark above. There is one model path (Chrome's), so the panel says there is nothing else to choose between yet.
  - A fix: every text rule card showed the word "null" (a `null` passed to the DOM `append`), in 0.2.0 and 0.2.1.
  - The hover preview follows the card, and matching cards are hidden before they are painted (section 3.12).
  - A settings page in the style of macOS System Settings: one window, centred and at most 800 px wide, with a sidebar with search and icon tiles, compact rows, one page per rule with examples, plain wording, and (?) popovers instead of explanatory paragraphs. Light and dark follow the system; a narrow window stacks the sidebar on top. Icons are from Lucide (ISC licence). The type is Calmet UI, a face traced from the 1732 print of Calmet's commentary (it has no bold, so the hierarchy is made with size; its "ct" ligature is used in headings only). The app icon is a black-and-white cut of the portrait of St. Jean-Marie Vianney (public domain, Wikimedia Commons).
  - The website in the same style: one window that keeps still (the page inside it scrolls, not the document), a sidebar of pages (Idea, Features, Install, Source) with a search box that narrows them, and back and forward buttons. Idea is two quotations (English only) and one line for each thing the extension does, each leading to its place on the Features page; Features shows each of them as a block of the real settings page, as HTML (`tools/make-feature-options.py` copies the markup into `_data/options.json`; `tools/make-options-css.mjs` writes its CSS from `options.css`), next to a picture of how it looks on YouTube once a filter has worked (`tools/make-feature-scenes.py`, WebP in light and dark), by category of what it can hide; Install is a download, a Copy SHA-256 button and five steps. The rules, sermons and plan texts stay in the repository and are not published. Only the background and the icons are credited, at the bottom of the Idea page.
  - The type is dedicated to the public domain (CC0 1.0): version 0.2 of the font is the traced face only, 100 code points (the italic 105), without the accents, symbols and spaces that version 0.1 had drawn after Source Serif 4 (Adobe, SIL OFL 1.1), which had put the whole file under the OFL. The UI sets `%`, `+`, `·`, `−`, `/`, `_`, `é`, `è` and `✓` in places (measured on the settings page, the popup and the site); the next font of the stack sets them. `tools/make-font-cc0.py` writes the build.
  - Every rule has a plain name, a one-sentence description, a group and examples of what it catches and what it leaves alone; the tests run each example through the real rules and word lists.
  - A fix: gossip was on by default but could never fire (section 3.12).
  - Clean up (section 3.13) and a toolbar popup in the manner of iOS: the switches that change most (Clean up, Scope, break reminder with a stepper) and the recent activity with "Allow" and "Block", without opening the full settings page.
  - Comments and recommended videos (asked 2026-11-26): two more surfaces with a switch, an action and a sensitivity of their own. `related` is a recommended video next to the one you watch (a card: the action of the rule's `feed-card` unless the rule says otherwise); `comment` is a comment under a video (a rule that applies to subtitles, i.e. to what is said, applies to what is written; the default action is `blur`, with a Show button, so that a false alarm costs one click and the conversation stays whole; `hide` takes the whole thread). `content/comments.js` finds `ytd-comment-view-model`, reads `#content-text`, and judges at once (word lists) or asks the model for a weak cue. A bug found while testing it, and fixed in `content/discover.js`: the player holds links to the first eleven or so recommendations (its Next button and the grid of stills of its end screen), which spread each of those videos over the whole page, so they were no cards and were never filtered; the player's copies are now cards of their own and its buttons are none. The break card also gets the colours of a dark YouTube (it was dark on dark), and is never put in the player.
  - The wording of the settings page, the popup, the pages drawn into YouTube, the rule texts and the website was rewritten to one vocabulary (Sensitivity, Flagged, Audio, Images, Allow & Block, Actions, Test rules, Reset to defaults), with no developer notes in the interface. The examples of the rules are real sentences, and the interface masks the vulgar words (`f***`): `core/censor.js`, tested against the word lists.
  - The website: shorter pages, a Copy SHA-256 button, the painting of the month from the calendar of the Très Riches Heures as the desktop behind the window (12 plates of 1088 to 1248 px, AVIF, about 1.1 MB; they look soft on large screens, because the scan of a miniature has no more detail), and on a phone the list of pages with the page sliding over it (view transitions), as in iOS Settings. 31 cut-out characters and `assets/months/stage.js` are ready for lifting some of them in front of the window with a z-index (`?lift=overlap` previews it, `?month=3` shows another month; `lift_months` in `_data/wallpaper.yml` will list the months where they are lifted by default, none chosen yet); the stage is tested in `assets/months/stage-test.html` (not published).
  - Links from the install page into the extension: `manifest.json` carries a public `key`, so the ID is fixed (`node tools/extension-id.mjs`; it is in `_data/extension.yml`). `chrome-extension://<id>/src/options/options.html#log` opens Activity, and only `https://vianney.cc/*` and `https://www.vianney.cc/*` may open the settings page (`web_accessible_resources`). A web page cannot open `chrome://` addresses, so a click on `chrome://extensions` copies it. Checked in the test browser, with a copy of the manifest that also names the local site: a click on the link opens the log. An install made before the key had another ID, so its settings do not carry over; the private key was not kept.
- **Not verified**
  - The accuracy and the speed of the real model on images and on audio. Each image rule asks one question per prompt wording for every thumbnail, so a feed is slow even when the model is fast.
  - Whether Chrome takes a WAV blob as audio input in the documented message shape. The code follows the documented shape and was only run against the stand-in.
  - Whether the safety filter refuses explicit images, or answers them.

### 3.11 Judging or blacking out the frames of a video (asked 2026-11-25, not built)

- **The question.** Replace a flagged thumbnail by a black image (built after version 0.2.0, see 3.10), and do the same for the short moments of a playing video where something immodest comes up. Is the model fast enough?
- **Not feasible: frame by frame, live.** A video shows 24 to 60 frames a second. How long the on-device model needs for one image question is not documented, and it cannot be measured on the test machine, which cannot hold the model. The only third-party figures are for text (about 50 tokens per second decoding and 1,000 per second prefill, one machine, **[unverified]**). Judging live also always reacts after the frame has been seen, as the audio check does, so it could black out what follows a flagged frame and never the frame itself.
- **What YouTube provides ahead of playback: storyboards** **[measured, 2026-11-25; 10 public videos; headless Chrome 158, anonymous session]**
  - The player response of a watch page holds a storyboard spec: a template address and up to four levels of preview frames, packed into sheets of tiles. The sheets are ordinary images on `i.ytimg.com/sb/...` and weigh about 20 KB each. One loaded as an image was 960 by 540 pixels (3 by 3 tiles of 320 by 180).
  - Reading the bytes: `fetch()` from the page works. The server answers only the origin `https://www.youtube.com` (a request with an extension origin gets no permission header), so a content script can read a sheet, and the service worker or an extension page cannot.
  - Spacing and tile size depend on the video:
    - Shorts of 15 to 67 s: one frame per second, tiles 101 by 180 (portrait), or 50 by 90 for the smallest.
    - A 3.5-minute music video: one frame every 2 s, tiles up to 320 by 180 (108 frames, 12 sheets).
    - Videos of 43 to 63 minutes: one frame every 10 s, tiles of 160 by 90 or 320 by 180 (260 to 380 frames).
    - A 19-second video: no storyboard at all.
  - So a timeline of where something comes up can exist before the playhead gets there, at a spacing of 1 to 10 seconds, from images that are 90 to 180 pixels high.
- **What a pre-pass would cost.** One prompt per rule and wording for every tile. With 2 rules and 2 wordings that is 432 prompts for the 3.5-minute video and more than 1,500 for an hour. To stay ahead of playback at normal speed the model would have to answer one prompt in under half a second for that short video, and its real speed is unknown. One combined question with one wording needs a quarter of that. The pre-pass would start at the playhead and move forward, and the first seconds could be held back (black) until the first tiles are judged.
- **What it could not do.** One frame per 10 seconds misses any scene shorter than that on long videos, and tiles of 50 to 160 pixels may be too small for the model to tell swimwear from a beach. It would be a best-effort screen, not a guarantee, and the settings would have to say so.
- **How to black out a moment once a timeline exists.** The mechanism is the one that mutes a word by caption time: a list of spans, a scheduler that follows the playhead, an action per span. The new action would draw the player with brightness 0 for the span (audio kept or muted), or skip the span. Only the source of the spans differs (images instead of captions).
- **Live sampling as a fallback.** Draw the playing `<video>` onto a canvas now and then and judge the frame. Reactive and late by the sampling interval plus the model's time.
- **What would settle the speed.** The settings page now has a "Benchmark" button (On-device AI, built after version 0.2.0): it sends test prompts (a made-up image at 160 by 90, 320 by 180 and 640 by 360 pixels, a made-up audio clip, one text question), measures the time per prompt on the user's own computer, and says what that means for thumbnails, audio and a pre-pass over preview frames of a 3.5-minute, a 10-minute and a one-hour video, under the current settings. Its arithmetic is tested; the numbers it will show on a real model are not known yet. See open question 11.

### 3.12 What real use showed (2026-11-25, after version 0.2.1)

A user reported that the filter "does not seem to work properly on search results, only when I hover over it". The browser tests had only loaded search addresses directly. Searching the way a person does (typing into YouTube's own box on the home page), hovering, and slowing the processor found three real problems. All were reproduced before they were fixed.

- **Matching results were painted before they were hidden.** The feed filter waited until the page had been quiet for 250 ms before it scanned (a debounce). YouTube changes its page continuously while it renders, so the scan was postponed. **[measured]** After a search from YouTube's box, version 0.2.1 painted cards with the searched words in 34 frames over 1.4 seconds, with a run of 26 frames in a row; with the processor slowed four times, 47 frames over 2.5 seconds. The fix: the scan runs in `requestAnimationFrame` (right before the next paint), later changes join a scan that is already due instead of postponing it, and a card that the word lists flag is hidden synchronously in that same task. With the fix, 0 of about 450 painted frames showed a matching card, at normal speed and with the processor slowed four times. A heartbeat every 1.5 seconds and observers for late title changes (`title`, `aria-label`, `href`, text) cover pages that change without adding cards.
- **The hover preview showed the real video.** When the mouse rests on a thumbnail, YouTube plays a muted preview. That `<video>` is in one shared element, `ytd-video-preview`, placed over the thumbnail but not inside the card, so a card that was blacked out or blurred still played its real preview on hover (pixel mean 127 of 255 under a blackout). The same held for thumbnails that were still being judged. **[measured]** The fix finds the card under the preview by position and gives the preview the same look: black for a blackout or an unchecked image (and paused), blurred for a blur, faded for a dimmed card. A preview of a clean card is untouched.
- **Gossip could never fire.** It is on by default with "flag at: heavy" (1.0), so the model band started at 0.8, but its strongest word-list cues weigh 0.75, so the model was never asked. The ten rules on by default were checked: it was the only one. The fix: a rule may widen its band with `band: <number>` (gossip uses 0.5), and a unit test now fails if a rule that is on by default can never fire.
- **How it is tested now.** The scenario `searchflow` searches from the YouTube box, records every painted frame (it samples in a timeout that runs right after each frame), repeats with the processor slowed four times, hovers, and scrolls for more results; it fails on the released 0.2.1 and passes on the fix. The scenario `hoverpreview` checks the preview of a blacked-out, a blurred, a clean, a revealed, a not-yet-judged and a dimmed card, by computed style and by the pixels of a screenshot.
- **Still open.** A real model may take seconds per image, and then thumbnails that are held back stay empty until the hold ends (6 seconds by default). "Benchmark" on the settings page shows the speed on a given computer.

### 3.13 Clean up: the extras around videos (asked 2026-11-26)

Asked for: hide "Von YouTube empfohlen", Shorts, games, movies and the rest of the extra junk. Built as the first part of the attention-calming module (section 4.5): seven switches and a list of shelf titles, all on by default, in the settings (Clean up) and, for the switches, in the toolbar popup.

- **How the page was read.** The selectors were measured on the real pages in a German interface (signed out, headless Chrome 158, 2026-11-26), so that nothing depends on English words. **[measured]**
  - Sidebar: `ytd-guide-entry-renderer` holds an `a` with a `title`. Shorts has `title="Shorts"` and no `href`. Gaming is `/gaming`, Playables `/playables`, Movies & TV `/feed/storefront?...`, Music and Live link to fixed channels (`/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ`, `/channel/UC4R8DWoMoI7CAwX8_LjQHig`), Premium is `/premium`. The "Explore" section is the `ytd-guide-section-renderer` that holds the Music entry.
  - Shelves: `ytd-reel-shelf-renderer` (Shorts, in search and beside a video), `ytd-rich-shelf-renderer[is-shorts]` (home), `grid-shelf-view-model` with `ytm-shorts-lockup-view-model` cards (Shorts in search), `ytd-shelf-renderer` with `ytd-grid-movie-renderer` cards (the Primetime movie shelf), `ytd-mini-game-card-view-model` (Playables), `ytd-feed-nudge-renderer` ("Die Empfehlungen passen nicht ganz?").
- **Rules that avoid words.** The stylesheet matches element names, what a shelf contains, and where a link goes. Only the Shorts entry is found by its name (the same in every language), and only shelves that the user names are matched by their title.
- **"Von YouTube empfohlen" was not found.** It appeared on none of the signed-out German pages that were searched (home, search, watch, subscriptions, Shorts, movies, gaming, podcasts, music), neither as text nor in the page data. It is probably part of a personalised feed. It is therefore on the title list from the start, together with "Recommended by YouTube", and the list is editable.
- **No flash.** The stylesheet is loaded by the manifest at document_start and every rule waits for an attribute on `<html>` that `early.js` sets from the stored settings, so a page never shows the extras first. The content script keeps the attribute in step with the settings, marks shelves by title, and opens a `/shorts/` address in the normal player.
- **Tested** on the real pages (scenario `cleanup`): each switch alone, with everything else left alone; the Shorts shelf of a search, the movie shelf, a shelf picked by title in capitals, the redirect of a Shorts address, the master switch. Two checks are skipped when YouTube shows no such element that day (the Shorts shelf beside a video, the nudge).
- **Not included:** advertisements (a different problem, with tools of its own).

---

### 3.14 Gemini Nano setup, Firefox and Safari (asked 2026-11-28)

The request: the extension and the website should say, with links and checks, what Chrome's model needs and why it does not download; and there should be a Firefox package and a Safari Web Extension for iOS. Built: `core/nanocheck.js` and `shared/nanoprobe.js` (the checklist and its measurements), the page `nano.html`, `tools/build.mjs` (Firefox and Safari from the one source), `kev-host.js` (the model's host, in a page of its own where there is no offscreen document), `tools/safari.sh` and the workflow `safari.yml`, `tools/sign-firefox.sh`, `tools/firefox-smoke.py`. Bugs fixed on the same day: one row of the activity log for each thing (`core/logmerge.js`), no counter on the toolbar icon, the allow list wins over a model answer that arrives late, a channel is found by handle, id or address as well as by name, and the popup offers the channel next to the video.

- **Measured [live, Chromium 158.0.8127.88, Linux Mint, 2026-11-28].**
  - A web page, and an extension, can call `LanguageModel.availability()`; both said "unavailable" with 44 GiB free. `LanguageModel.create()` then throws `NotSupportedError` with Chrome's own reason ("The feature flag gating model execution was disabled."), which the checklist shows. It said the same with `--enable-features=OptimizationGuideModelExecution,OptimizationGuideOnDeviceModel,AIPromptAPI`: Chromium cannot run the model.
  - `chrome://on-device-internals` shows "Internal debugging pages are currently disabled" until `chrome://chrome-urls` has been used ("Enable internal debugging pages"). Its Broker State then lists: Enabled by feature flag, Enabled by enterprise policy, Enabled by user setting (false in Chromium: the switch is in Google Chrome's settings only), Enough disk space to install ("45303 MiB available, 20480 MiB required"), Enough disk space to retain (5120 MiB), the use cases with an "Unavailable Reason", and a device performance class ("GPU blocked" here; the profile of the machine says class 8, 0 MB video memory).
  - The flags that exist: `#prompt-api`, `#prompt-api-multimodal-input`, `#prompt-api-tool-use`, `#prompt-api-sampling-mode`, `#gemma4-for-built-in-ai`, `#writer-api`, `#rewriter-api`, `#proofreader-api`, `#summarizer-api`, `#built-in-ai-mtp`. `#prompt-api-for-gemini-nano` and `#optimization-guide-on-device-model` do not.
  - An extension with `unlimitedStorage` has `navigator.storage.estimate()` quota equal to what it stores plus the free space of the profile's drive (47289504350 = 86622 + 47289417728, the same as `chrome.system.storage.getAvailableCapacity`): the free disk space, without a permission. A web page's quota is a cap (exactly 10 GiB in a clean profile) and says nothing about the disk.
  - `chrome.tabs.create` opens `chrome://flags/#...`, `chrome-urls`, `on-device-internals`, `settings/ai`, `components`, `management/policy`, `version` and `extensions`. A web page cannot: a link, `target=_blank`, `window.open` and `location.assign` to `chrome://extensions` were all refused. A message to the extension (`externally_connectable`, `onMessageExternal`) works: the page, on the origin of the site, found the extension, showed the measured disk space, and had `chrome://on-device-internals` opened.
- **From the source and the documentation [not run, no Google Chrome here].** No flag is needed in Chrome 154 and newer; `#optimization-guide-on-device-model` ("Enabled BypassPerfRequirement") existed to 153 and `#prompt-api-for-gemini-nano` was renamed `#prompt-api` in 151. The install check is 20 GiB free (a constant, not a parameter), the keep check 5 GiB; the documentation says 22 GB and 10 GB. Without a graphics chip: 15000 MiB of memory and 4 cores. The model is part of Google Chrome only (`build_with_internal_optimization_guide = is_chrome_branded`). With 5 to 20 GiB free the manifest broker does not register the download: no error, `availability()` stays "downloadable" or "downloading" with no progress. **Unverified:** that last behaviour, whether the default model in 158 is Gemini Nano or Gemma 4, Brave, and the wording of the messages other than the one above.
- **Firefox [live, Firefox 161].** Manifest V3 with `background.scripts` (`type: module`; Firefox has no service workers), `browser_specific_settings.gecko` with an ID and `data_collection_permissions: {required: ["none"]}` (AMO asks for it since 2025-11-03; the least Firefox is 140, on Android 142). `web-ext lint`: no errors; the warnings are the feature-detected `chrome.offscreen` calls, the vendored libraries and one `innerHTML` whose markup is fixed. In a real Firefox the add-on installs, the content script starts (a dynamic `import()` of extension files works), and the local model downloads (383 MB, hashes checked), loads in 11.8 s and answers on WebAssembly in the background page. No WebGPU on Firefox for Linux; extension pages are not cross-origin isolated, so one thread. A normal Firefox needs a Mozilla signature: `tools/sign-firefox.sh`. **Not run:** YouTube itself, and the signing.
- **Safari / iOS [documentation only; no Mac, no device].** The tool is `safari-web-extension-packager` (formerly `-converter`), macOS only; without a Mac only a workflow on GitHub's Macs, or Xcode Cloud through App Store Connect with a paid account. Safari 18 has `world: "MAIN"` content scripts; an event page needs `persistent: false` on iOS; there is no `offscreen`, no `externally_connectable` to rely on. An iOS extension process has no published memory limit and reports of 80 MB to a stricter jetsam limit exist: the local model (350 to 590 MB) is switched off in this build (`target.js`). An iPhone opens `m.youtube.com`, not matched by `www.youtube.com/*`; iPadOS asks for desktop sites by default. The build matches `m.youtube.com` too, **untested**; the cards are found by their links, so it may work. Free Apple accounts run an app for 7 days on a device; TestFlight and the App Store need the paid program.
- **Open.** Test the Safari build on a device, and the mobile site. Run the checklist in Google Chrome with the model. Decide how the Firefox add-on is distributed (the store, or unlisted and signed, with or without `update_url`: that decision comes before the first signing). A listing in the Chrome Web Store would end the first step of the install page, which no website can make easier: a page cannot open `chrome://extensions`.

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
- **Settings UI.** A rule editor, a sensitivity slider or dropdown for every rule (section 7), the break-reminder settings, an event log ("why was this hidden?", with a preview of what would change at another sensitivity) and a test box where a pasted title or transcript shows the model's answers.
- **MV3 notes** **[verified]**: ship the onnxruntime WASM files inside the extension, use `'wasm-unsafe-eval'` in the CSP, and run onnxruntime-web inference in an offscreen document or a worker, not in the service worker. The Prompt API and the Translator cannot run in a worker: host them in an extension page or the service worker.

### 4.2 Combining approaches

The aim is accuracy without a bigger model: independent signals that fail in different ways.

- **Stage 0, deterministic.** User-maintained allow lists (trusted channels pass without scanning) and deny lists (blocked channels and video IDs), keyword and regex lists on title and description, and the language check. These produce verdicts with no model at all.
- **Stage 1, one model per question.** The first backend returns a probability. Above the high threshold, which is the rule's sensitivity setting (section 7), the rule fires. Below the low threshold the item passes. Between the two, the item is "uncertain".
- **Stage 2, a second opinion on uncertain items only.** A model from a different family (the Prompt API against the local model) answers the same question. How the two answers combine depends on the severity of the action:
  - Hiding a feed card fires on either answer above the high threshold, or on both above the low one.
  - Muting a word needs a lexicon hit and context agreement.
  - A disagreement stays "uncertain" and follows the fail-safe default.
- **A veto for what the words cannot tell apart (built 2026-11-26).** For a rule that flags an ideology but must spare what warns against it from the Catholic side (Freemasonry, Communism, Modernism, Spiritism), the words are the same on both sides. Such a rule says `confirm: model`: when a model is there, a strong word-list hit is shown to it too, and a clear no (below VETO_BELOW = 0.35, a choice, sensitivity.js) overrules the hit. Without a model the word list decides alone, as before. The cards that the words flag are still hidden at once, and put back if the model overrules them (feed.js `handle`).
- **The life of an author is not his books (built 2026-11-26).** The six rules on authors of the Index flag the books and ideas and spare a title about the person's life: `spare words: life_words` lowers a strong hit (a title with biography, born, died, exile, "influence on") into the band, and `confirm: model` lets a model overrule the hits without such a word.
- **Music videos (built 2026-11-26, Clean up, off by default).** The owner: "make an option to ban music videos, so anything that has a 'song' mark behind it is usually not a good idea to watch - YT has a special flag for these 'music creators'". YouTube draws the flag itself, so no list is needed (core/musicmark.js, content/discover.js): a note in front of the length on the thumbnail (every video of the Music category has it, no other kind: measured on 47 duration badges of search results and recommendations, signed out), and the "official artist channel" badge beside a channel name (also on live streams, which have no length). The feed filter hides such a card with the reason "Music video" (via `mark` in the Activity log); the allow list wins. A Mix or a playlist has an icon too but no length, so it is not matched. Real e2e: `python3 tools/e2e.py music`.
- **The card finder found every link of a video as ONE card (fixed 2026-11-26).** A video that appears in two places of a page (the first results of a music search also stand in a Mix lower down) had a common ancestor that was most of the page, so neither place was a card and no rule could hide it. Each link now finds its own card (`cardElementOf` in content/discover.js): the thumbnail and the title of a card climb to the same element, and a second place is a second card.
- **A Catholic channel spares a card (built 2026-11-26).** The rules about an error (the beliefs and ideologies, not the books) have `spare channel: catholic_channels`: when the channel name hits that word list, a strong word-list hit is lowered to just under the flag level, into the band where the model decides (with none, the card is not flagged). The owner's reading: a Catholic-related channel talking about the topic of an "against" rule is most likely a warning. Measured on the 1,066 titles of four channels he named: research/owner-channels.md.
- **Examples inside the question (built 2026-11-26).** The rule author's `example:` and `spared:` lines are shown to the model beside the question, the nearest ones to the text (core/shots.js, `settings.ai.shots` per side, default 3, a choice to be measured with `tools/eval-kev.mjs`). The owner's own counter examples (real titles from channels he knows that warn against these ideologies) go in as `spared:` lines. A line that is the text itself is left out when a rule's own lines are checked, so the model never sees its own answer.
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
- **Built (2026-11-26):** hiding Shorts, Games, Movies & TV, the Explore part of the sidebar, banners and shelves by title: section 3.13. Not built: thumbnail blurring as a general setting (the experimental image check does it by rule) and title rewriting.

### 4.6 Break reminder

- **What it does.** After the user has watched for N hours, the extension puts one item into the page that is drawn exactly like a video in a list of videos, or exactly like a comment under a video, and tells them how long they have been watching and that this is a good moment to take a break. N is set by the user. The reasons for the design are the owner's four messages of 2026-11-26: "I want this to be exactly like a video, with random-ish titles like 'You wouldn't BELIEVE what happens if you take a BREAK NOW!', basically satirized clickbait titles"; "it should show up in random places, not directly obvious, in comments sections, in video titles: the user can ignore it, the system should just subtly tell it to take a break and how long he's been watching"; "the only indication that this is a fake comment is that it should have a picture of vianney as the channel icon or thumbnail or similar"; "so you go 'huh, what was that?' and it's not a 'popup in your face'". This replaces the labelled card and the banner of the first version.
- **What counts as watching.** The time a video is actually playing, not time with a tab open. It is summed over all YouTube tabs by the extension's service worker and kept in extension storage on the machine. The period can be defined in two selectable ways: a session (it ends after a gap of M minutes without playback) or a calendar day. The values of N and M are the user's. **[choice]**
- **Where it appears.** One item at a time, only while a reminder is due, never as a popup and never as a fixed element: it sits in the flow of the page between real items, so that you go "huh, what was that?" and can ignore it. Two switches: "In video lists" (`brk.showCard`) and "In comments" (`brk.showComment`), both on by default.
  - **A video** among the videos of a list: the home page, search results, a channel, and the recommendations next to a video. It has the three shapes that YouTube has (a column with the round channel picture, a row with a large picture and a description, and the compact card of a recommendation), in the light and in the dark theme, and it takes the shape of the real cards next to it.
  - **A comment** among the comments under a video (only once they have loaded).
  - **Which place.** At a random index 1..7 of the videos of the list (the first is never used; a channel's card or an advertisement in the list is not counted), or 1..10 of the loaded comments; nothing is placed before the page has three of them. A video page flips a coin between the recommendations and the comments, or takes the one that exists. The choice is made once per place on the site (a change of address, or YouTube's `yt-navigate-finish`; a time written into the address of a video does not count) and is kept: the loop of 1.5 s only puts the item back where it was if YouTube removed it, and rewrites the times in place.
  - **Not planned any more:** a banner over the player, a slot in the up-next list, and a stand-in for the autoplay target.
- **How it looks.** The same size, layout, fonts, colours and spacing as the real item next to it: a rounded 16:9 thumbnail with a length badge, the round channel picture, a title, the channel name and a line of metadata; a comment has the round picture, the handle, the age, the text and the like, dislike and reply buttons. The numbers were measured in the real page (computed styles and rectangles, listed at the top of `content/breakcard.js`) and the sizes that change with the width of the window are read again from the real neighbour at every loop. It is drawn inside its own shadow DOM, so it copies none of YouTube's markup. **The only tell is the portrait of St. Jean-Marie Vianney**, as the round channel picture and on the thumbnail (a sunburst with a clickbait caption such as "BREAK?!"); nothing visible says "reminder" or "extension", it has no border, and only its `aria-label` says what it is, for screen readers. The portrait is a small data URI in `content/vianney-image.js` (made by `tools/make-break-image.py`), so that no web-accessible file lets YouTube see that the extension is installed. **[choice]**
- **What it says.** The video has a title chosen at random once per appearance from `core/breaktitles.js` (more than 30 satirised clickbait titles, at most 100 characters, with capitals, `!` and brackets, wholesome, nothing about the faith, no insult to the viewer), "Watching for 1 hour 7 minutes" where the views are, and the watched time as its length (1:07:00). The comment is "@Vianney", "1 minute ago" (it grows while the comment stays) and "You've been watching for 1 hour 7 minutes." followed by the user's own message, or by "This is a good moment to take a break." **[choice]** A click on the thumbnail or the title does what "Remind me later" does and never opens anything; the three dots open a small menu with "Remind me later" (a snooze whose length the user sets) and "Dismiss". It does not link to any video.
- **Optional escalation, all off by default.** Pause autoplay while the reminder is up, and a second, longer threshold that covers the player with a pause screen. **[choice]**
- **Calm.** No streaks, no guilt wording, and a limit on how often it repeats (the same principle as in section 7).
- **Placement.** Among the repeated sibling cards that the structure test of section 4.3 finds: the main list of the page (the group of cards with one parent that lies in rows, so that a shelf that you scroll sideways is none), of the kind that most of them are, and only plain videos (with a length on the picture: a mix, a playlist or a live stream is skipped). The comment goes between the top-level threads of `ytd-comments`.
- **Local only.** Watch time never leaves the machine and is not collected.
- **Shorts.** The Shorts feed has no list, so nothing is shown there. Later.

---

## 5. Rules in plain text

Rules are plain text in the same typed-question shape as Jev and Laya. Parsing is deterministic and needs no model. The syntax below is a **[choice]** to be refined.

```
# Vianney rules v1

rule gossip
  where: watch
  ask score: "How much of this talks about the private faults of a named real person?"
    levels: none, mild, heavy
  flag at: heavy
  action: warn-overlay

rule indifferentism
  where: feed-card
  ask noul: "Does this say all religions are equally true or equally valid paths?"
  flag at: 0.70
  action: blank

rule lords_name
  where: subtitles
  lexicon: lords_name_terms
  ask noul: "Is the name of God or of Jesus used here as an exclamation or a curse, and not in prayer, quotation or discussion?"
  flag at: 0.60
  action: mute-word
```

- Each rule has: where it applies, a deterministic part (lexicon, lists), one or more typed questions (`noul`, `choice`, `score`), a default `flag at` level, and an action.
- **Sensitivity.** `flag at` is only the default. The settings page shows every rule with a slider (for `noul` questions: how confident the model must be, from "flag only when very sure" to "flag when in doubt") or a dropdown (for `score` and `choice` questions: which level counts). The user's setting overrides the default and is stored locally. Section 7 describes how the slider is mapped.
- The keys of the shipped rule files (`extension/rules/*.rules`): `title` and `name` (the traditional and the plain name), `plain` (one sentence), `group`, `example:` (a title the rule catches; repeatable) and `spared:` (a title that looks similar but is a false alarm and must not be flagged; repeatable), both run through the real engine by the tests, `source`, `where:` (the surfaces: `feed-card` a video in a list, `related` a recommended video next to the one you watch, `comment`, `watch-meta`, `subtitles`, and for pictures and sound `thumbnail` and `audio`), `lexicon:` (the word-list files, `extension/lexicon/<name>.txt`, one `weight | entry` per line), `ask noul:`/`ask score:`, `gate`, `flag at`, `band`, `action:` (`feed-card=hide, related=dim, comment=blur, watch-meta=warn-overlay, subtitles=mute-word`) and `enabled`. The format is plain text, close to YAML but not YAML; the Features page of the site shows one rule in it.
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
- **Break reminder.** `inject-card` (the card of section 4.6) and `pause-autoplay`.
- **Autoplay.** The "up next" and autoplay target are filtered like any other card, and a blocked target is skipped.

---

## 7. Subtitles, the Lord's name, gossip, sensitivity

- **Profanity.** Lexicon first. Ambiguous cases go to a context question.
- **The Lord's name.** The words alone do not decide it: "Jesus Christ" in a homily, a prayer or a hymn title is not a violation, and the same words as an exclamation are. So: lexicon match, then a context window of about 20 words either side, then a `noul` question. The taxonomy comes from the sermon.
- **Blasphemy.** The same two steps, with a question about mockery or contempt of God, the Church or the saints.
- **Gossip.** A video-level `score` question over transcript windows, aggregated by duration. The sermon treats the listener as an accomplice, which is the basis for hiding rather than merely warning. A small model will find this hard, so expect mediocre accuracy and tune thresholds.
- **Sensitivity, the strictness dial** **[decided]**
  - Every rule has a control for how confident it must be before it flags: a slider for yes/no rules and a dropdown for rules with levels. The user moves it when a rule flags too much or too little.
  - The slider position is a confidence on a common scale. The offline fit (section 8) calibrates each rule so that the same position means the same thing for every backend. It also records what the rule did on the labelled set at a few positions: how many items it flagged, its precision and its recall. The settings page shows those measured numbers next to the slider and offers three named presets (strict, balanced, lenient), which are three measured positions. **[choice]**
  - The slider moves the rule's flag threshold. The lower edge of the "uncertain" band (section 4.2) follows at a fixed offset chosen during the fit, so there is no second setting to keep in step. **[choice]**
  - **Preview.** The event log lists recent items with their `p` for the rule. For a candidate slider position it shows which of them would change, so the effect is visible before saving. Nothing adjusts itself: a "this was a false alarm" or "this should have been flagged" button in the log only proposes a new position, and the user confirms it.
  - An optional master dial moves all rules together by one step. **[choice]**
- **Calm by default** **[choice, not yet confirmed]**: short, plain reason text, no streaks or counters, and an optional cap on warnings per hour. The design principle is the Curé's own: say "certain" when sure and "doubtful" when not (sermons page, section 6).
- **No-caption videos.** Judge on title and description only, or opt in to on-device speech recognition (Whisper `base.en`, about 280 MB, trails the playhead).

---

## 8. Model plan

- **Phase 1, first draft: the deterministic stage plus Chrome's Prompt API.** Nothing to download or bundle. Greedy decoding and constrained output (a boolean schema, or a RegExp for a small set of values). No probabilities are available, so the "uncertain" band comes from asking the same question in two or three differently worded prompts, or from an ordinal score (for example 0 to 4) with a RegExp constraint, and counting agreement. **[choice, tested in spike 1]**
- **Phase 2: a local English decision model as the second opinion.** Candidates, to be run on the same labelled set:
  1. **Kev-0.6B**, built in (extension/src/ai/, no open-jev dependency). The only small English decision model with a ready browser build. Its tested range is 384 tokens of text (not 8,192: see section 3.1), which holds a title, a comment or the subtitle window that the engine asks about (24 words either side of a cue), not a whole transcript.
  2. **Laya English, only after fitting** its temperatures or a small head on the labelled set. Zero-shot it is near chance.
  3. **A zero-shot NLI baseline** (DeBERTa-xsmall or ModernBERT-base). Small and cheap. It is a floor the others must beat and a possible pre-filter.
  4. **GLiNER2.5-Decide**, if a browser export appears. Best vendor-reported accuracy at its size.
- **Offline fit (agreed).** A one-time fit on the labelled set is accepted: the calibration of each rule's probability, its default level and presets, and where needed a small head, such as Laya's temperatures or a logistic-regression head on Needle's `embed()` vectors. The result is a frozen file that ships with the extension, so verdicts stay repeatable. It is training, but it happens before release and nothing learns afterwards. The fit uses one part of the labelled set and the reported numbers come from a held-out part. **[choice]**
- **Experiments, not tiers.** Needle (section 3.2) as a very small fine-tuned classifier, with its own logistic-regression head on `embed()` vectors if a probability is needed, and Granite Guardian only as an optional power-user backend.
- **Selection rule.** A model is adopted only if, on the labelled set, it beats the NLI floor and the Prompt API at the chosen operating point of the rule, and fits the memory budget measured in spike 2.

---

## 9. Evaluation

- Every number in the system is either measured on a labelled set or marked as a choice.
- The labelled set: titles, descriptions and transcript windows from YouTube, labelled per rule by the project's author, including hard negatives (a priest saying the Holy Name in a sermon, a Passion play, a documentary about a heresy).
- Per rule: precision and recall at several slider positions (the presets), and the calibration curve of the model's probability, measured on the held-out part of the labelled set.
- A rule ships only with its default `flag at` level and the measured error rates of its presets recorded next to it.
- A regression run repeats the whole set on every model, quantization or prompt change. Because the system is deterministic, a changed verdict always has a cause.

---

## 10. Milestones

- **Built so far (version 0.2, 2026-11-25; version 0.1 was the same without the starter pack, lists and the image and audio checks)**
  - The rule text format with a parser, word lists with weights, the cascade engine (lexicon first, a model only inside the uncertain band), per-rule sensitivity and an event log. 93 unit tests pass.
  - The starter pack: 30 text rules traced to verbatim passages of the Curé d'Ars (the rules page of the site), 10 on by default, with 31 word lists. On 2026-11-26 the rule author added ten rules on belief, the Church and the occult (among them Judaism and Freemasonry, added later that day) and turned on the atheism rule: then 40 text rules (31 traced to a sermon, 9 his choice), 21 on by default, with 41 word lists. The same day (part two) he renamed the group "Faith and superstition" "Anti-Catholicism" (group `anticatholic`), moved Freemasonry into it and had it reworked to flag its contents and not the Catholic videos against it, and had nine rules added: Communism and socialism, Modernism, Spiritism and six categories of the books of the Index of Forbidden Books (anti-religious writers, critical lives of Jesus, Modernists on, philosophers, historians, novelists off). The ideology rules flag what presents or defends the thing and spare Catholic warnings; the book rules flag any video about those authors. Now 49 text rules (31 traced to a sermon, 18 his choice or resting on texts of the Church and on the Index), 27 on by default, with 52 word lists; 55 rules with the six image and audio rules. The evidence is in `research/index-of-forbidden-books.md` and `rules.md`.
  - Allow and block lists for videos and channels, which always win over a rule or a model.
  - The feed filter with structure-based card discovery (hide, blank, dim, label), re-evaluated at once when a slider moves.
  - The video page: a check of title, description and keywords with a warning overlay; capture of the player's own caption request; mute, skip and masking of visible captions.
  - The break reminder: a video in a list or a comment under a video, at a random place (section 4.6), with watch-time counting across tabs.
  - A settings page with a slider or dropdown per rule, the rule text editor, break and subtitle settings, an AI panel, the activity log (with "Allow" and "Block" buttons) and a rule test.
  - The Prompt API backend, written to the documentation and tested only against a fake of the API.
  - **The local model Kev-0.6B (2026-11-26, see research/kev-progress.md).** Downloaded on the user's click from huggingface.co (346 MB for WebGPU with `shader-f16`, 383 MB otherwise) into the extension's private file system (OPFS): resumable with `Range`, every file checked against a pinned SHA-256 while it is written, Pause, Cancel and a two-click Delete on the settings page. It runs in an offscreen document with the vendored Transformers.js and ONNX Runtime (`extension/vendor/`, about 41 MB: the extension zip grew from 0.1 to 10.7 MB), on WebGPU (about 0.12 s per question, measured on an Apple M2) or on the processor through WebAssembly (about 1.8 s per question), and is unloaded after five idle minutes. It is the first layer; Chrome's built-in model (Gemini Nano) is the second look when Kev's answer is not sure (core/layered.js, ai/ai-router.js). The settings page has a panel that runs every rule's example and spared lines through the real rules with and without the models. **Calibration, not yet done:** Gemini Nano's p is a vote fraction (0, 1/3, 2/3, 1) and Kev's is a continuous probability that differs by a few hundredths between the browser and Node and between half and full precision; the rules' `flag at` levels are shared by both and were not retuned (section 8).
  - The experimental image and audio checks (section 3.10), off by default.
  - End-to-end checks in a real Chrome 158 with the extension loaded (`Extensions.loadUnpacked`), on real YouTube pages: 97 checks pass. They cover finding cards, hiding, the slider moving the outcome in both directions without a reload, no false alarms on eight religious searches, the break reminder as a video (the three shapes, in both themes, measured against the real neighbours) and as a comment, its menu, its snooze and its dismissal, planned muting following the playhead, caption masking, the settings page, and the image and audio checks with a stand-in model (real thumbnails, real recorded audio).
  - The Prompt API object exists in an extension page and in the extension service worker of Chrome 158, and both answered `availability()`. Sessions were not created.
  - A downloadable build and an install page on the site (`npm run release`).
- **Not verified yet:** captions from a real signed session (the anonymous headless test got an empty body from YouTube, even for the player's own request), the Prompt API with a real model (also for images and audio: accuracy and speed), and Firefox.
- **Not built yet:** translation, the offline fit and the measured presets, the "would change" preview on real data, caption prefetch, the Shorts interstitial, judging or blacking out the frames of a playing video.
- **M0, spikes (before real code)**
  1. Prompt API and Translator on a low-end laptop (8 GB): `availability()` inside an offscreen document, a side panel and the service worker of a throwaway extension; `create({topK: 1, temperature: 0})`; boolean, `enum` and RegExp constraints; identical answers on repeated runs; 50 to 100 offensive and quoted subtitle lines with the answers and exception names logged (and `chrome://on-device-internals` open); 100 timed classification calls; one 50-chunk translation run; memory with and without a live session.
  2. Local decision models in the browser (Kev-0.6B through open-jev, Laya English, an NLI baseline): size, latency and memory on a low-end laptop, with and without WebGPU, and accuracy on a first labelled set.
  3. Captions: routes B and C on a normal logged-in profile, and whether word timing arrives.
  4. A selector-discovery health check against a live search page.
  5. Needle, a half-day spike: the engine in an offscreen document, 100 labelled titles through the base model with one enum tool, the raw JSON, `peak_ram_mb`, time per title and the suppressed rate. Fine-tuning is considered only after that.
  6. Translator pairs (de, fr, es, it, pt, pl to en): availability per pair, size of the download, latency, and quality on a sample of titles. Whether Latin can be detected.
  7. One unlisted Chrome Web Store submission whose extension downloads its model on first run, to see whether review accepts it.
- **M1, feed filter.** JSON interception, ID-anchored DOM hiding, the deterministic stage, the Prompt API backend, the rule parser, a sensitivity slider per rule, an activity log and a rule test. Actions: hide, blank, refill.
- **M2, watch page.** Caption capture through the player's own request, lexicon plus context, mute and skip, overlay.
- **M3, second opinion.** The local decision model chosen in the spike, translation, the labelled set, and the offline fit that turns each rule's slider into measured presets.
- **M4, polish.** The measured presets and the "would change" preview for the sliders, the break reminder, the optional warning cap, the starter rule pack, the attention module, and packaging for download from the project website.
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
- **The injected item.** A video or a comment added to YouTube's list could break the layout or be mistaken for real content. That it is taken for real content at a glance is the aim (the owner's choice of 2026-11-26); it is drawn in its own shadow DOM, with the sizes read from the real neighbours, in the flow of the page (no fixed element), and the portrait of Vianney and its `aria-label` are what tell it (section 4.6).
- **Wrongly hiding good content** such as Scripture, sermons and sacred music is the failure that would cost the most trust, so false positives weigh more when choosing thresholds.

---

## 12. Open questions

1. **Hosted decision APIs.** Never, or an opt-in "ask a hosted model when the local ones disagree"? The plan assumes never.
2. **Languages at launch.** English only, or English plus German, French and Spanish (no translation step), and later Polish, Italian and Portuguese through the Translator? Latin cannot be translated.
3. **Rule engine language.** Rust compiled to WASM, or TypeScript throughout? The model runtime is JavaScript either way. Whether a Rust runtime can run ModernBERT-large in a browser fast enough is **[unverified]**.
4. **Starter rule pack.** Who writes the questions? They should be clearly marked as the author's.
5. **"Reload until no more."** Read here as: after hiding a card, load more items until the visible slots are full, with hard caps. Correct?
6. **Which browsers first.** Chrome, Edge and Brave share an engine, but only Chrome and Edge ship a built-in Prompt API. Firefox has `browser.trial.ml` instead, and its WebGPU support is limited.
7. **PO-token routes.** Test them at all, given the terms-of-service question?
8. **Sites beyond YouTube.** The adapter design allows it. When?
9. **Needle fine-tuning.** If Needle is tried, locally (JAX, untested on small machines) or through the vendor's hosted service (paid, hosted, calibrated head)? The plan assumes local only.
10. **Break reminder details.** What counts as watching (only time a video is playing, summed over all tabs?) and when a period resets (a gap of M minutes, or a calendar day). Settled on 2026-11-26: the reminder carries no label; it looks exactly like a video or a comment and the portrait of Vianney is the only tell.
11. **Frames of a playing video.** Section 3.11: judging them live is not feasible, and a pre-pass over YouTube's preview frames could run ahead of playback only if the model is fast enough, which is unknown. Build the benchmark button first (it tells the speed on the user's machine), then the pre-pass with a `blackout` span action for the player? Or leave video frames out for now?

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
