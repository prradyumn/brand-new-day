# Integers: Rise and Fall — How to Play + Levels 1–3

This is a plain HTML, CSS and JavaScript game with no build step and no libraries. It follows **"Integers_Rise and Fall - Story V3.csv"** (2026-10-13: the story, How to Play, the Level 2 and Level 3 transitions and the Story End) and **"Integers_Rise and Fall - Game V3 (2).csv"** (Levels 1–3; the same as Game V3 (1)), word for word. The layout matches **Figma → Integers → page "LBD" → Section 2** (Slide 16:9 – 16 / 18 / 19 / 20).

**Content rule:** every spoken line and every piece of on-screen text comes from the CSV (in Hindi: from its translation in `js/lang-hi.js`). `data.js` copies it verbatim, with speaker labels ("Guddu Bhaiya:") and quote marks removed. The engine adds no dialogue or captions of its own. Buttons use the CSV's "Start" or icons (▶ ↻ ⏸).

---

## 1. Run it

Open `index.html` in a browser. To serve it locally from VS Code, pick one:

```bash
npx serve .            # or
python3 -m http.server 8000
```

or use the VS Code "Live Server" extension. The only network request is the **Nunito** font from Google Fonts (voice clips and music are local files). Offline, the game falls back to a system font.

## 2. Files

The game lives at the **repository root** (so Vercel serves `index.html` directly):

```
brand-new-day/        (repo root)
├── index.html        DOM for the 1920×1080 stage (every element is here, hidden or shown by JS)
├── css/style.css     All visuals, positions (Figma px), water, focus glass, animations
├── js/data.js        CONTENT ONLY: config + every VO/OST/feedback line + question list
├── js/fx.js          Helpers: sleep, voice-over (TTS), sparkles, badges, confetti
├── js/game.js        Engine: flow, marker drag, scale scrolling, keypad, feedback
├── assets/           PNGs harvested from Figma (see §7), sfx/, music/ (Lyria 3 loop), vo/ (Gemini TTS clips + manifest.js)
├── tools/generate-audio.mjs  Re-records the voice-over / music with the Gemini API (see §8)
├── CONTEXT.md        This file
├── Integers_LBD_assets/  Raw Figma exports (source art, not used by the game; excluded from Vercel by .vercelignore)
├── .vercelignore     Keeps the deploy to the game files
└── .gitignore
```

**Deploy (Vercel):** static site, no build step. Framework preset "Other", Root Directory empty (the repo root), no build or output command.

Script load order matters: `data.js` → `assets/vo/manifest.js` → `fx.js` → `game.js`.

## 2a. Languages: English and Hindi

* **Choosing:** the language button (top right, `#btnLang`: a globe and the language in use, "English" / "हिंदी") switches language **in place, with no reload** (2026-10-19 QA Bugs 2, 16): `js/lang.js` swaps every line in `GAME_DATA` (it keeps an English copy to switch back), updates the page text and the address (`?lang=hi`, `history.replaceState`) and the stored choice, and sends `langchange`; `game.js` then plays the current step again in the new language (a question: its instruction again). `?lang=hi|en` still picks the language on load.
* **How it works:** `js/lang.js` runs before the game. For Hindi it swaps every line of `GAME_DATA` (VO, OST, correct and wrong lines, idle prompts, buttons, `ui`) for its Hindi line from `js/lang-hi.js`, so `game.js` runs exactly the same. The page's own text (title, Check) uses `data-i18n`. The equation cue words are per language too (`cues`, and `steps` for P2, P3).
* **`js/lang-hi.js`:** `exact` holds the one-off lines and `patterns` the lines that differ only by their numbers. Equations ("(+4) + 3 = ?") stay as they are. A line with no translation is logged as `[lang] no translation for: …` and shows in English: add it to `lang-hi.js`. The current script translates completely.
* **Hindi teaching choices** (the header of `lang-hi.js` has the full list):
  * Maths words as Hindi-medium textbooks use them: पूर्णांक, धनात्मक / ऋणात्मक संख्याएँ.
  * The voice reads +2 as "धन 2", −3 as "ऋण 3" and 0 as "शून्य". The screen keeps + − 0.
  * The words pair up: बढ़ता है → जोड़ते हैं, घटता है → घटाते हैं.
  * The game's levels are "लेवल" and the water's level is "स्तर", so the two are never confused.
  * The learner is "तुम", with gender-neutral sentences.
* **Pari's voice (2026-10-07):** Leda on Gemini 3.8 Flash with a stronger child brief ("a real young child's voice: high, light and bright, a little breathy, bubbly…") and her own director's notes (`NOTES_PARI`). It was picked by ear from 13 candidates: 5 voices on Flash and on Flash Lite, plus pitch-lifted Leda. Gemini has no true child voice; a real child's voice would need a consented recording plus voice conversion (Seed-VC) or cloning (IndicF5).
* **Hindi voice:** recorded by `tools/generate-audio.mjs` together with English, using the same voices cast for natural Uttar Pradesh / Delhi Hindi (`VOICES_HI`, `NOTES_HI`, language `hi-IN`). Each take is transcribed in Devanagari and compared word by word, with spelling variants folded together. The manifest holds both languages, keyed by the line itself.
* **Font:** Devanagari uses Baloo 2 (Google Fonts, after Nunito in the font stack).

## 3. Coordinate system

* `#stage` is a fixed **1920 × 1080** box, the same size as the Figma frame. `fitStage()` scales it to the window with letterboxing, using CSS `zoom` (the `#viewport` grid centres it). A `scale()` transform is only the fallback for browsers without `zoom`: with a transform, Chrome captures the frosted-glass backdrop at the wrong size, and part of the game showed up mirrored behind the blur.
* Every `left/top/width/height` in `style.css` is a **Figma pixel**. To match a Figma change, copy the new x/y/w/h straight in.
* Pointer events are converted back to stage pixels in `toStage()`, using the stage's measured on-screen size (`stageK()`), so it works with zoom and with the transform.

Key positions (from Figma "Slide 16:9 - 16"):

| Element | Figma layer | x, y, w, h |
|---|---|---|
| Narrator box | Group 18 | 23, 16, 1067×138 |
| Number plate | Group 20 | 273, 265, 501×167 (centred on the keypad, x 523.5) |
| Keypad panel | Group 19 | 214, 451, 619×498 |
| Level 2/3 layout (level mode, Figma slide 18–20) | — | plate y=205 · keypad 214, 371, 619×628 · equation strip 270, 433, 507×146 on top of the keys |
| "Water Level Marked!" / "Level Complete!" board | — | 173.5, 259.5 (level mode 199.5), 700×178: centred over the display |
| Start button | — | 313.5, 480, 420 wide |
| Tank (empty glass) | Group 16 image | 1039, 16, 747×1119 |
| Inlet / outlet pipe | instances | 1172,-168,363×273 / 1595,868,217×163 |
| Lever track | Group 21 | 1094, 102, 114×945 |
| ▲ / ▼ buttons | image 5 / image 6 | 1078,43 / 1078,952 |
| Marker (yellow arrow) | Line 13 | x 1128, 140 wide |
| Scale | Frame 3 / Frame 4 | level 0 at **y = 570**, **75 px per level** |

## 3b. Cover (start screen)

* **The art:** `assets/cover.jpg` (1920×1080 web copy; the 2752×1536 source is `assets/cover_source.jpg`, kept out of the Vercel upload). It was made with Gemini "Nano Banana Pro" (`gemini-3-pro-image`) on 2026-10-08, using scenes p12, p11 and p04 as style and character references, and chosen from three takes. The image has no text in it. Guddu points down and Pari points up (rise and fall), and the left third is open sky for the title.
* **The page** (`#startScreen.cover`, built in HTML/CSS on top of the art, so it stays sharp and switches language):
  * The title is the existing `data-i18n="title"` (पूर्णांक / उतार और चढ़ाव in Hindi), on a soft light veil.
  * The Start button is the game's glossy green, with a play disc; its label is the CSV's "Start" (`data-i18n="start"`, शुरू करो).
  * Motion: a slow drift on the art, sun rays, bubbles rising in the tank, and a gentle pulse and light sweep on the button. All of it is off with reduced motion.
* **Testing note:** the button never stops pulsing, so automated clicks need `{ force: true }`.

## 3a. Screens, copying and sound outside the tab

* **Every screen size:** the 1920×1080 stage scales to fit and is letterboxed (`fitStage()`). It refits on resize, on rotation and when a phone's URL bar shows or hides (`visualViewport`). Pointer input is converted back to stage pixels, so dragging works at any size. Tested at 390×844, 844×390, 820×1180, 1366×768, 900×900 and 2560×1080.
* **Phone held upright** (portrait, under 700 px wide): a "turn your phone" card covers the game (`#rotate`, an animated phone icon with no text, under the content rule). Tablets held upright play letterboxed.
* **No zoom or pull-to-refresh:** `touch-action: none`, `overscroll-behavior: none` and `user-scalable=no`. The QA jumper list is the only part that scrolls by touch.
* **The art isn't for copying:** no text selection, no right-click menu, no image dragging, no copy or cut, and no "Save image" on a long press (`-webkit-touch-callout`). This stops casual copying. Anything a browser shows can still be saved with developer tools, which no web page can prevent.
* **Sound only in the game's tab:** when the tab is hidden or the window loses focus, the voice, browser voice, sound effects and music all stop at once (`onPresence()` in `fx.js`; the music no longer fades on a timer that hidden tabs slow down). The current line starts again when the learner comes back. Closing or reloading the tab silences everything (`pagehide`).

## 3c. Feedback and water polish (2026-10-08, no new assets)

* **Lock moment** (`lockBurst()`): when the marker locks on an answer (the lever part, Level 3's automatic lever, the How to Play demo), two ripple rings spread over the water surface and the number on the scale pops.
* **Progress drops:** one water drop per question (an inline SVG, `dropSvg()`). It fills from the bottom with water when the question is done, and the current one is lifted with a yellow rim.
* **Level Complete** (`waterSparkle()`): the tank's water brightens, its light patterns speed up, and sparkles rise across it.
* **Livelier water:** soft light patterns drift under the surface (`#water .caustics`, brightest near the top) and a glint runs along the surface (`.glint`). Both sit inside `#water`, so they move with the level. The inlet splash (ripples and droplets where the stream lands) was already there. All of it is still with reduced motion.
* **End screen:** the cover art again, with the completion badge (a gold ★ disc), the title and a round ↻ button that reloads at the cover in the same language (`?step=` is dropped). Confetti is raised above it.

## 4. Game flow

```
Start screen (▶ = user gesture, unlocks speech; the first story scene sits behind it)
  Story        ST1–ST10  full-screen scenes (CSV Intro, Teaching, Game start), speech bubbles + VO
  ── chapter break: the screen floods, "How to Play" card, tap ▶, the water drains ──
  How to Play  H1–H5  guided demo (blur + spotlight + hand): ▲/▼ taps, drag to +4, pick + then type 4 (sign first), Check
  ── level card ("Level 1", flood, ~2 s) ──
  Level 1      L1T    tutorial, learner plays (blur + spotlight): +2 → 0, then enter 0
               TR1    "Start" button → tank scale and dial become active
               Q1…Q6  0→+2, +2→+6, +6→+3, +3→−1, −1→+3, +3→−2   (marker, then keypad)
  ── level card ("Level 1", flood, ~2 s) ──
  Level 2      P1–P4  teaching rows (Story V3): P1 "Let's see where the water level reaches", P2 (+1) + 2 = +3 and
                      P3 (+3) − 5 = −2 written in the equation panel as the marker moves, P4 Pari "rises → add, goes down → subtract"
               TR2    Pari: "Let's calculate the water levels exactly!" (OST "Calculate the Water Level!"); tap to continue; the water goes to 0, the equation panel shows 0 + 3 = ? and Guddu reads it
               A0     tutorial 0 + 3, no incorrect feedback
               A1…A6  (+2) + 3, (−2) + 4, (+3) − 5, (−2) − 3, (−5) + 2, (−3) − 4
                      (in A0–A6 the equation follows the lever: 0 + 1 → 0 + 2 → 0 + 3)
               E2     "Level Complete!" board + confetti
  ── level card ("Level 1", flood, ~2 s) ──
  Level 3      R2–R6  "the lever isn't working now": ▲/▼ switch off, keypad glows, first challenge appears (S0 "Let's mark some more water levels." removed, 2026-10-14)
               B1…B7  0 + 4, (+4) + 3, (+3) − 6, (−1) + 5, (−6) − 2, (+6) + 3, 0 − 5  (keypad, full feedback ladder;
                      the lever moves by itself)
  Story End    Z1     display glows (at the Level 3 tank)
               ── chapter break: the screen floods and drains (no card) ──
               Z2–Z5  full-screen scenes: celebration + confetti, integers highlighted, lever sweeps − → 0 → +,
                      zoom out to the village + completion badge
End screen (confetti, ↻ = reload)
```

**Step types** (`data.js`): `scene` (a full-screen story scene: the intro and Story End Z2–Z5), `demo` (How to Play), `question`, `gate` (transition dialogue that waits for Start or a tap), `say` (a spoken row plus the animation in its Scene Description). `section` decides the dive: a new section = dive into the tank. The Story End plays on at the Level 3 tank (no dive): Z1 is on the game screen, then `storyEnter()` floods the screen into the Story End scenes.

**Speakers:** `guddu` (default), `pari`, `narrator`. The banner avatar changes with the speaker; "Narrator:" lines have no face. Pari's voice is pitched a little higher. All feedback lines are Guddu Bhaiya's.

**Talking characters (lip-sync).**
* **The art is frame strips** in `assets/char/`. Every frame is the same picture except the mouth, or the eyes for a blink. They were cut from the ChatGPT sheets in `assets/char/src/`, aligned to within 1 px with phase correlation, and packed into strips:
  * Avatars (`AVATARS` in `game.js`), 360 × 360 per frame: `avatar-guddu-happy` (closed, half, wide, blink), `avatar-guddu-sad` and `avatar-guddu-think` (closed, open), `avatar-pari-happy` (closed, half, wide, blink).
  * Full-size Guddu (`POSES`), 708 × 1320 per frame, feet on the same spot: `guddu-talk` (3), `guddu-point` (2), `guddu-thumbs` (2).
* **Driving the mouth:** `lipLoop()` runs every animation frame and asks `FX.mouth()` how open the mouth should be. For a recorded clip that's its loudness at the playhead, from `assets/vo/lipsync.js` (one digit per 50 ms, made by `tools/make-lipsync.mjs`). For the browser voice, or when muted, it's a talking rhythm for the reading time. The loop shows closed / half / wide, holding each frame for at least 70 ms so it doesn't flicker, and the avatars blink every 2.6–5.4 s between words.
* **Guddu as the game's host:** in guided steps (How to Play, the Level 1 tutorial), full-size Guddu stands in the bottom-left corner, cropped at the knees by the screen edge, with a soft light behind him (`#charGlow`). He pops up with a spring, breathes while he talks and ducks down when he's done.
  * **Where he stands:** he stands over the part of the screen that isn't lit and points at the part that is (`look` in `narrate()`).
    * Tank lines: he stands on the left, over the blurred keypad.
    * Keypad lines (`look: "pad"`, H3, H4, the L1T keypad line): the keypad **and the tank** are lit (2026-10-12 review: "when asked to write the number, the tank should be visible"), so there is nowhere blurred to stand. These lines are spoken from the narrator box, Guddu's face talking, and nothing covers the keypad or the marker. (Before, he stood mirrored in front of the blurred tank.)
    * H5 "Great!…" (`look: "padTank"`): he stays on the left, thumbs up, because that only covers the keys after Check has been pressed.
    * The bubble's tail follows him: `POSES[…].tip`.
  * **One Guddu at a time:** while he's on screen, `#stage.host` hides the narrator box (and closes its spotlight), and his line shows in the story's clean speech bubble beside his head (`#hostBubble`, drawn by the same `placeBubble()` as the story). Each pose sets where the tail points (`POSES[…].tip`). When he leaves, the narrator box comes back with the on-screen instruction.
* **Gestures:** in guided steps, the full-size Guddu's gesture comes from `pose` in `data.js`: `talk` (default), `point` (H3, H4, the L1T marker line) or `thumbs` (H5).
* **No shimmer between frames:** ChatGPT redraws the whole picture in every frame, with slightly different hair and outlines. So each frame after the first is rebuilt as frame 0 plus only the part that really changes (the mouth, the eyes or brows), blended in with a feathered mask. Everything else is pixel-identical across a set. The two outer pixel columns of every frame are cleared, so a neighbouring frame can't bleed in when the stage is scaled.
* **Smooth timing:** `lipLoop()` smooths the loudness (opens fast, closes a little slower), uses a little hysteresis, holds each shape at least 85 ms and only moves one step at a time (never closed ↔ wide in one jump). It was tuned on all 157 clips: about 9 changes a second, 25% closed, 32% half, 43% wide. Guddu's breathing only moves him up and down, never resizing, so the art stays crisp.
* **New art:** any new frame must keep the same canvas and the same head position, or the head will jump between frames.

### Story (`runScene()` in `game.js`)

Ten scenes from the CSV story rows, word for word, before How to Play, and four more for the Story End (Z2–Z5, table below). Scene art: `assets/story/scene-pXX.jpg` (web copies of `assets/scene_pXX_background_clean.png`, 5 MB instead of 23 MB).

| Step | Art | Speaker | CSV row |
|---|---|---|---|
| ST1 | p01 | narrator (caption) | Intro 1, camera moves towards the tank |
| ST2 | p02 | Guddu | "Pari, can you help me mark the water levels?" |
| ST3 | p03 | Pari | "Yes! Let's fix it." |
| ST4 | p06 | Guddu | "Look Pari, 0 shows…" (0 glows) |
| ST5 / ST7 | p07 | Guddu | above 0 (+1, +2, +3 light one by one; ST7 adds the "+" sign) |
| ST6 | p08 | Guddu | "Below 0, there is less water…" (−1, −2, −3 light one by one) |
| ST8 | p09 | Guddu | "…negative numbers." (+ "−" sign) |
| ST9 | p10 | Pari | "Oh! so, below 0 is negative…" (all levels light) |
| ST10 | p04 | Guddu | Game start: "Correct, Let's mark the correct water level now." (0 glows) |

Story End scenes (`p11` and `p12` were made for the ending: sunny, the rain has stopped):

| Step | Art | Speaker | CSV row |
|---|---|---|---|
| Z1 | game screen | Guddu | "Great work! …" (display glows, sparkle) |
| Z2 | p11 | Pari | "We did it! …" (confetti, `fx: "celebrate"`) |
| Z3 | p11 | Guddu | "…are called integers." (−1, −2, −3, then 0, then +1, +2, +3 light) |
| Z4 | p11 | Pari | "So integers helped us…" (`sweep`: a lever marker slides −3 → 0 → +3, lighting each mark) |
| Z5 | p12 | Guddu | "Excellent! …" (camera `from: 1.5` zooms out to the village, completion badge, `fx: "badge"`) |

* `p11` scale marks (stage px): x ≈ 920, +3 … −3 at y 310 / 400 / 482 / 553 / 653 / 743 / 842. The water is at −1, the last Level 3 answer.
* A scene step can take `fx` (`celebrate`, `badge`); it runs through `sayFx()` while the line plays. `#fxLayer`, `#medal` and `#confetti` sit above `#story` (z-index 72–74) for this.
* Z5's zoom is centred on the bubble's tail tip, so the bubble keeps pointing at Guddu while the camera pulls back. After Z5 the end card appears over the village scene.

* **Speech bubbles** use the two artworks as they are, never stretched: `asset_speech_bubble_blank.png` (round, tail bottom-left) and `asset_p09_overlay_….png` (wide, tail bottom-right). `BUBBLES` in `game.js` holds their measured tail tip and inner text area. A scene sets `bubble: { shape, tail, w, tip }`: the width, and the point the tail aims at (the speaker). A tail on the other side mirrors the artwork only, never the text. The text is bold black and centred in the inner area, and its font shrinks to fit (50 → 20 px), so the bubble never changes shape.
* **Narrator line (ST1)** is a caption straight on the scene, as in `dialogue_p01.png`, with a soft white halo. It sits just under the HUD row (⏸ ⏮ हिंदी ⏭ 🔊), so no button covers it.
* **Highlights** (`glow`) are halo rings around the numbers painted in the art, yellow above 0 and blue below, lit one by one while the line plays. `camera` is a slow zoom toward a point ("camera moves upward/closer").
* The baked-text images (`dialogue_p01–p06.png`) are references only. Their wording differs from the CSV in places (p01 drops "reading", p04 and p06 are different lines), so the game shows the CSV text.
* **Chapter breaks** (`floodWipe()` in `game.js`, `#flood`):
  * Water floods up from the bottom of the screen (waves, bubbles, fill sound), and on story → game, a title card with the CSV section name floats up in it (`DATA.ui.howTo`). Then the card floats off and the water drains away (drain sound), revealing what was set up underneath.
  * **Story → game:** "How to Play", and the learner taps ▶ to go on.
  * **Game → Story End:** no card. The water rises and drains straight into the ending.
  * Level changes use the same flood with the level's name on the card ("Level 1", `DATA.ui.level1`…), up for 2 s with no tap (2026-10-19 QA Bugs 5, 9: the old zoom-in dive was abrupt and the screens around it went by too fast). With reduce-motion on, the flood is a quick fade.
* **Moving water in the story (ST5–ST9).** These scenes use empty-tank versions of the art (`scene-p07e/p08e/p09e/p10e.jpg`, from `assets/scene_pXX_tank_empty.png`). The game draws the water, waves, bubbles, glass shine and the −3…+3 scale inside the glass (`tankLayers()` in `game.js`).
  * **Layers**, bottom to top: scene art, the water layer (`.tank-fx`), then the characters (`chars-pXXe.png`, cut out of the same art with macOS Vision), so Guddu's pointing hand stays in front of the water. Glass interior: 852–1238 × 228–938; level 0 at y 570, 90 px per level (`ST_TANK`).
  * **Data:** a step's `tank: { from }` sets the starting level. Its `glow` then lists levels instead of [x, y]: the water rises or falls to each one before it lights. `tank: { from, to }` (ST9) moves the water to one level while the marks light.
  * **Pouring:** while the water rises, the top pipe pours (`.pour`, the same stream as the game's inlet), and the fill and drain sounds play.
  * **Every scene starts at 0** (2026-10-08): ST5 and ST7 rise 0 → +3 ("above 0", "positive"), ST6 and ST8 fall 0 → −3 ("below 0", "negative"), and ST9 stays at 0 while both sides light. The water only ever moves through the numbers the line is about. Before, each scene carried on from the last, so "positive" began with the water at −3. The cross-fade between scenes hides the reset.
  * **Art fix:** ChatGPT left a stub of water under the top pipe in `p08`/`p10`. It's covered in the web copies with the same patch of sky from `p07e`.

### A question = up to two parts

Each part (`lever`, `entry`) has its own CSV row: `vo`, `ost`, `correct`, `wrong[3]`, `idle`, `success`.

1. **Lever part** (`leverPart()`): the VO plays, the OST stays in the banner, the learner drags the marker or taps ▲/▼. When the marker has rested `settleMs` (1.3 s) it is checked: at the target → correct; still at the start → ignored; anywhere else → a wrong attempt. Correct: "Marker locks", small ✓ + sparkle, and the correct line ("Correct! You reached +2.").
2. **Entry part** (`entryPart()`): the VO ("Enter the new water level."), then the learner types sign + digits and presses **Check**. **The keypad never makes the learner wait** (2026-10-12 review: in Level 1 it only took keys ~6 s after the lever was placed, and keys pressed before that were lost): it works from the moment the lever locks (`S.padLive`; not in the guided L1T, where the keypad is behind the glass), through the "Correct!" line and the instruction. What is typed stays. Check while a line is still playing is checked as soon as that line ends (`S.checkQueued`; 2026-10-14: lines are never cut short); if something is typed already, the instruction is skipped. Keys only stop during a hint (wrong answer). Correct: the value appears on the display and glows, the equation completes, "✓ Sparkle + Water Level Marked!" (board + confetti; the Level 1 tutorial gets only ✓ + sparkle), then the correct line. Level 3 (`autoLever`) has only this part. **The lever and water follow what the learner types** (`previewEntry()`, 2026-10-08): "+" then "7" slides them level by level to +7, with the water sound and the dashed count line from the start level. A sign alone, a number without its sign, ⌫ back to empty or a wrong Check slides them back to the start level. A correct Check locks them where they are.

**The equation builds in step with the voice-over** (`buildTeachEq()`, `buildQuestionEq()`, `untilWord()` in `game.js`).
* Equation pieces wait hidden (`.eqhide` keeps their space, so nothing shifts) and pop in (`.eqpop`) on their word.
* **Level 2 teaching (P2, P3, `buildMoveEq()`):** "If the water level is at +1" → `(+1)`, "and rises" → `+`, "by 2 levels" → the marker moves up level by level, each level glows and the number counts 1, 2 with it, then "it reaches +3" → `= +3` and the display shows +3. The cue words are in each row's `build: { a, op, b, ans }` (Hindi: `LANG_HI.steps`).
* **Level 2/3 questions:** the start level comes up with the question. The sign appears on "rises" / "goes up" / "goes down", the number on "3 levels", then `= ?`. A0 and B1 skip this, because TR2 / R5 already show their equation.
* **No equation read-outs** (2026-10-14 QA: "remove additional instructions", "do not display equations in the instruction panel"; the 2026-10-12 read-outs at TR2, R5 and in the reminders are gone). The equation is only on the equation panel.
* **The equation follows the lever in all of Level 2** (`liveEq`, 2026-10-12 review: "the second number won't change with the movement of the lever"; the sheet only had it in the A0 tutorial): moved 2 up → "(+2) + 2", 2 down → "(+3) − 2". The sign shows the direction and the number is never negative (no "+ (−2)"). When the lever locks, the panel goes back to the question for the keypad step.
* **Timing:** `FX.progress(text)` in `fx.js` gives how far the current line has got (0…1). For a recorded clip that's its playhead; for the browser voice, or when muted, it's the reading time. A word's place is its share of the text, plus a little for the pause at each , . ! ? (`wordAt()`). If the line never plays, `untilWord()` gives up after twice the reading time, so the game can't get stuck.

**The display starts every question on "?"**, never on the last answer. After a correct answer it shows that answer ("+2 appears on the display"), and the next question flips it straight back to "?". The level transitions, the gates and the Level 3 challenge preview do the same.

**Sign rule:** `config.requireSignForPositive` is `false` (2026-10-14 QA): "2" counts as +2 and the display then shows +2; negative answers need "−", 0 needs no sign.

**Blur/spotlight** only in How to Play and the Level 1 tutorial (`guided: true`). During a feedback animation the spotlight moves to where it plays (scale or keypad), then back.

### Feedback ladder (CSV "Incorrect Feedback 1/2/3")

`wrong[0..2]` is used for attempts 1, 2 and 3+. Each part has its own count. The lever part and the keypad part both speak their lines. Where the CSV has no incorrect feedback (Level 2 and Level 3 tutorials, `wrong: null`), the attempt is shown (shake, ✗, wrong sound) but nothing is spoken. Learner input is locked while a hint plays.

| fx | What happens | CSV cell |
|---|---|---|
| `return` | Marker animates back to the start level | "Marker returns to …" (Level 1) |
| `pulseZero` | The 0 mark pulses | L1T |
| `nudge` | Marker gives a small push toward the target | L1T |
| `glowUp` | ▲ glows | Q1 "Up arrow briefly glows" |
| `glowDirUp` / `glowDirDown` | A glow travels up/down the scale from the start | "Upward/Downward direction glows" |
| `countSteps` | The levels toward the target light up one by one | "+3, +4, +5 highlight one by one" |
| `pulseArrowNext` | ▲ or ▼ glows and the first step pulses | Level 1 inactivity |
| `pulseMarkerNext` | Lever and the first step pulse | Level 2 inactivity |
| `pulseStart` | The starting level pulses | Level 2 / Level 3 Incorrect 1 |
| `pulseTarget` | The answer on the scale pulses | L1T keypad Incorrect 1 |
| `pulseMarker` / `glowMarker` | Marker pulses / glows | "Marker at +2 pulses" / "Marker at 0 glows" |
| `glowTarget` | The answer on the scale glows | "+2 on the scale glows" |
| `pulseKeys` | The sign + digit keys of the answer pulse | "+ and 2 buttons pulse" |
| `pulsePadKeys` / `pulsePad` / `pulseTargetPad` | Keypad (+ answer keys / + answer on the scale) pulses | keypad inactivity |
| `pulseTargetSign` | The answer on the scale and its sign key pulse | Level 3 Incorrect 3 |
| `pulseGate` / `pulseEqPanel` | Start button / equation panel pulses | TR1 / TR2 inactivity |

**Inactivity:** after `inactivityMs` (10 s) with no input, the part's `idle.text` plays, then its `fx`. The timer then restarts.

### Pace and looking back (2026-10-12 review: "dialogues move very quickly … add a button to go back")

* **Slower voice in Level 2:** `config.voicePace: { level2: 0.88 }`. The clips play at 0.88 speed with the pitch kept (`preservesPitch`), about 2.8 words a second instead of 3.2. `FX.speak(…, { pace })`; the lip-sync and word timing follow the playhead, so they stay in step. Other sections can be added to the map.
* **Time to read:** after a spoken row (`runSay()`) its words stay up for `lingerMs()`. If the screen shows other words than the voice said (P1 "Water level rises → Add", P2, P7), that's 2.6–4.5 s by word count (it was 0.5 s). A finished teaching equation stays 1.5 s, and other rows 0.9 s.
* **⏸ Pause** (HUD `#btnPause`, story and game, 2026-10-13: "add a pause and back button in the story if the user misses any step"; `pauseGame()` in `game.js`). Everything stands still where it is: the voice stops (the line starts again from its beginning on ▶, as after leaving the tab), every animation is paused (`document.getAnimations()`: the story camera, the water, the lights, the demo hand), every `FX.sleep()` waits, and the lever and keypad take no input. A big ▶ card (`#paused.user`; a tap anywhere, Esc, or ⏸ again) plays on. `FX.hold(key, on)` is keyed, so ⏸ and the look-back card can't release each other.
* **⏮ Back a step** (HUD `#btnStoryBack`, everywhere, 2026-10-14; `goBack()` in `game.js`). In a story scene, a How to Play step, a spoken row or a gate it stops the step and plays the one before it again (same kind, same part of the game; otherwise this one starts again), and the board goes back to how it was when that step began (`snapshot()` / `restore()`). In a question it speaks the instruction again (`replayInstruction()`). On the "How to Play" card it brings the last scene back (`floodWipe(…, { undo })`). ⏸ is a toggle: it turns into ▶ while paused.
* **Look back** (the speech-bubble ◀ button in the HUD, `#btnBack`; `said`, `openReview()` in `game.js`). It opens a card with the lines spoken so far, newest first: the speaker's face, the line, and the words that stayed on screen after it (`noteOst()`: "Water level rises → Add", "Move the lever 3 levels up."). It plays the line's voice. ◀ goes to an earlier line, ▶ a later one, 🔊 plays it again, and ✕ (or Esc, or a tap outside) closes it. Only icons are added; every line shown is one the game spoke. While the card is up the game holds (`FX.hold()`): the line that was playing stops and starts again from the beginning when the card closes; every `FX.sleep()` waits, and the word timing doesn't count the held time. The button is dim until the first line has been spoken.

### Transitions (`flipCards()`, `levelWipe()`, `floodWipe()` in `game.js`)

* **Next question in the same level → card flip** (≈0.8 s) of the display and the equation.
* **New level → the level card** (≈4.5 s): How to Play → Level 1, Level 1 → Level 2, Level 2 → Level 3. The screen floods, the card ("Level 2") stays up 2 s while the next level is set up underneath, and the water drains.
* With reduce-motion on, the flip becomes an instant swap and the flood a short fade.

## 5. Focus / glass effect

* `#focus` is a full-stage layer with a dark tint and a light sheen (no backdrop blur since 2026-10-21: it was too slow on QA's laptop).
* **The spotlight is a feathered mask** (2026-10-08). Each hole is a soft rounded rectangle (an SVG with a blurred rect, `softHole()`), cut out of a full-cover mask: the top layer `subtract`s the union of the holes, which are `add`-ed together. The blur fades into the sharp area over about 45 px instead of ending in a hard-edged box. The holes grow out of and shrink into their own centre, animated from JavaScript in `setFocusMask()` (CSS transitions of `mask-size` / `mask-position` don't always settle in Chrome). The tank has no box-shaped halo or sweep any more; the narrator box and keypad, which are boxes, keep theirs.
* **Taps outside the spotlight are blocked by `#focusHit`:** an invisible layer with the same holes as a hard `clip-path`. Hit-testing follows `clip-path` but ignores masks.
* **How to Play and the Level 1 tutorial only (`guided`).** **The narrator box stays lit the whole time**, so the instruction can always be read. Beside it the tank is lit, or the keypad **with** the tank (2026-10-12: the learner types the level the marker shows, so the marker stays in sight). **While a line is spoken, whatever the line talks about stays lit** beside the narrator box, so Guddu never points at something blurred: `narrate(…, { look })` and `sayFocused(text, mood, look)`. Lever lines (H1, H2, the L1T marker line) light the tank; dial lines (H3, H4, the L1T keypad line) light the keypad and the tank; H5's "Great! …" keeps both. Feedback and inactivity lines light the area their `fx` plays in (`fxArea()`: keypad fx → keypad, everything else → tank, so "What level is the marker on?" shows the scale). The correct line keeps the part's area lit. With no `look`, only the narrator box is lit. The tank hole starts right of the narrator box; ▲ / ▼ stick out to its left, so while the tank is lit they are raised above the glass (`#stage.lever-lit`) and stay sharp and pressable. `focusOn()` does nothing once `S.guided` is false (from TR1 on). After a feedback line the spotlight goes back to what was lit before it.
* A closed hole shrinks to zero size at its own centre (`shut()`), so the holes open and close in place and never slide across each other. **Holes must not overlap.** Under the even-odd rule an overlap cancels out and shows as blur, which is why the narrator hole ends at x 1092, just left of the tank hole (x 1094). Each hole has its own halo ring (`ring0` narrator, `ring1` tank, `ring2` keypad).
* Clicks outside the holes are blocked, because the layer is clipped and hit-testing follows the clip.
* During narration the character is raised above the glass (`z-index: 45`) instead of getting a hole.

## 6. Scale, marker and water

* Levels run from `levelMin` to `levelMax` (−10…+10), and 11 marks are visible at once (±`visibleHalfRange`).
* `S.view` is the centre of the visible window. `ensureVisible()` scrolls the strip (`#scaleStrip` translateY) when the marker goes past +5 or −5. This is how +6 and −7 work.
* Dragging past the top or bottom mark keeps scrolling, one level every 420 ms (edge auto-scroll).
* The water always follows the marker (`S.water` stays `null`; `setWater()` can still pin it to a level).
* **Water sound:** `FX.sfxLoop("fill" | "drain")` plays while the water rises or falls, and fades out 0.8 s after the water stops.
* **One-shot sounds:** `FX.sfx(name, vol)` (pools in `fx.js`, list and levels in `FX.loadShots()` in `game.js`). **key**: keypad digits, ± and ⌫, including the tutorial hand. **lever**: ▲ / ▼. **tick**: every level the marker moves. **button**: Check, ▶, Start and tap to continue. **correct**: ✓. **board**: "Water Level Marked!". **confetti**. **wrong**: marker or keypad. **flip**: question card flip. **splashIn / bubbles / splashOut**: the level-transition dive. **complete**: end screen. They follow mute, stop when the window loses focus, and are unlocked on the Play tap like the loops.
* **Water is pure CSS** (`#water`): a gradient body, two SVG wave bands scrolling sideways, and rising bubbles. `#glassShine` adds the glass reflections on top.
* The water top follows the marker (`render()`), with a height transition.
* **Pipe water is CSS + SVG.** The pipe images never change; `flowPipe()` turns the streams on while the level moves and off 0.9 s after the last step.
  * **Inlet:** while the water rises, `#streamIn` (a CSS gradient with a highlight running down it) falls from the inlet mouth (1478, 74) to the water surface. Its height follows the water in `render()`, and `#splashIn` puts ripples and droplets where it lands.
  * **Outlet:** while the water falls, `#streamOut` (an SVG path, `pathLength="100"` so it draws on and off at any length) curves out of the outlet mouth (1755, 991), with flowing streaks and droplets.
  * **Start and stop:** `.on` pours, so the stream falls from the pipe. `.off` stops it: the tail drops away. `.reset` puts a stopping stream back at the pipe without animating.
  * **Wobble:** both streams share the `#liquid` SVG filter (animated turbulence and displacement) for a gently wobbling edge.
* The dashed yellow **count line** (`#countLine`) shows the distance from the question's start level to the marker.

## 7. Assets (`assets/`)

| File | Figma source |
|---|---|
| `bg.png` | "ChatGPT Image … 03_26_47 PM (2)" background |
| `tank-empty.png` | Empty glass tank (Tank component "Variant2" image) |
| `pipe-in-dry.png` | Inlet pipe (component set: inlet, water=false). `pipe-in-water.png` is no longer used: the stream is drawn in CSS/SVG |
| `pipe-out-dry.png` | Outlet pipe (outlet, water=false). `pipe-out-water.png` is no longer used |
| `track.png`, `btn-up.png`, `btn-down.png` | Lever track + arrows (Group 21) |
| `plate-blue.png` | Number plate (Group 20) |
| `panel-cream.png` | Keypad panel frame (Group 19). Stretched with CSS `border-image` |
| `strip-cream.png` | Equation strip background |
| `banner-bar.png` | The narrator bar's original art. Since 2026-10-19 the bar is drawn in CSS after it (`#banner::before`), because the 9-slice image left faint lines at its seams when scaled (QA Bug 6). The old single-frame avatars (`guddu-happy/sad/think.png`, `pari-happy.png`, `guddu-full.png`, `pari-full.png`) are no longer used.
| `board-green.png` | "Water Level Marked!" board |
| `panel-title.png` | Start/end card |
| `drop.png` | Water drop (user-supplied reference, trimmed to 480 px). Currently unused: it was the earlier drop wipe, kept for later use |
| `sfx/water-fill.mp3` | Mixkit "Filling sink with water" (#1819), trimmed to a 7 s loop. Mixkit Free Sound Effects License |
| `sfx/water-drain.mp3` | Mixkit "Sink drain" (#1878), trimmed to a 10 s loop. Mixkit Free Sound Effects License |
| `sfx/key.wav` · `lever.wav` · `tick.wav` · `button.wav` · `board.wav` · `wrong.wav` · `flip.wav` | Mixkit #1120 click box check · #2568 interface click tone · #1317 water bubble · #3005 light pop · #2357 bubble pop-up · #2569 negative tone tap · #1104 page turn. Trimmed so each starts on its first sound, peak-normalised, and saved as WAV so short clicks don't lag. Mixkit Free Sound Effects License |
| `sfx/correct.mp3` · `confetti.mp3` · `complete.mp3` | Mixkit #3193 bubbly achievement tone · #2359 silly pop cluster · #2059 game level completed. Trimmed and normalised the same way |
| `sfx/splash-in.mp3` · `bubbles.mp3` · `splash-out.mp3` | Chapter and level floods: Mixkit #1304 jumping into water · #1321 deep water bubbles · #1311 water splash |

The keypad keys, the Check button and ⌫ are drawn in CSS to match the Figma key style. The Figma keypad image only has 0–6, and Q6 needs 7.

## 8. Changing content

* **Text / numbers:** edit `js/data.js` only. Add a question with `start`, `target` and a `lever` and/or `entry` part (`vo`, `ost`, `correct`, `wrong[3]` or `null`, `idle`, `success`), optionally `eq: { a, op, b }`, `liveEq`, `autoLever`, `guided`, `plateStart`. The `q1()` / `q2()` / `q3()` builders at the bottom of `data.js` make the repeated Level 1/2/3 example rows. Keep text verbatim from the CSV.
* **Timing:** `config.settleMs`, `config.inactivityMs`, `config.voicePace` (voice speed per section).
* **Sign rule:** `config.requireSignForPositive` is `false` (2026-10-14); set it to `true` to require "+" for positive answers again.
* **Voice-over:** every line is pre-recorded with **Gemini TTS** (`gemini-3.8-flash-tts`, English–India) into `assets/vo/*.mp3`. `assets/vo/manifest.js` maps `"speaker|line"` to its clip, and `FX.speak(text, { speaker })` plays it. A line without a clip, or whose clip can't play, is read by the browser's SpeechSynthesis (prefers an `en-IN` voice) as before. Either way the promise resolves only when the line has finished. The browser voice only counts as started when it fires `onstart`. Chrome can report `speaking` while no sound comes out and then never finish the line. Before this check, that froze the story for about 20 s per line; now the text stays up for its reading time and the game carries on. **Every line needs a recorded clip** so this fallback never comes up. After any script change, re-record (below). Casting: Guddu Bhaiya = *Puck*, Pari = *Leda*, narrator = *Kore* (`VOICES` in `tools/generate-audio.mjs`). 🔊/🔇 in the top-right corner mutes the voice, music and sound effects (`FX.setMuted`). Muting mid-line doesn't skip ahead: the line goes quiet and its text stays up for its reading time.
* **Background music:** `assets/music/bg-loop.mp3` is a soothing instrumental made with **Lyria 3** (bansuri, marimba, acoustic guitar, soft tabla; ~2:46, the end crossfades into the start so it loops seamlessly). It starts on the ▶ tap, dips to 40 % under every spoken line, and pauses while muted or while the learner is away (`FX.loadMusic` / `FX.startMusic` in `fx.js`). The file is mixed quiet (−30 LUFS, voice clips −16 LUFS) because iOS ignores element volume: there it stays 14 dB under the voice. Elsewhere it plays at 70 % (about 17 dB under the voice between lines) and dips to 40 % of that under every line (about 25 dB under). Lowered 2026-10-08 because it was overpowering the voice.
* **Lip-sync data:** `node tools/make-lipsync.mjs` writes `assets/vo/lipsync.js` from the clips. `generate-audio.mjs` runs it at the end, so re-recording keeps the mouths in step.
* **Re-recording after a script change:** edit `js/data.js`, then run `GEMINI_API_KEY=… node tools/generate-audio.mjs` (needs Node 18+ and ffmpeg). It records only new or changed lines and deletes clips that are no longer used. Every clip is transcribed and compared with the script word for word; a clip where the voice ad-libs or drops words is recorded again (up to 4 tries), and any line that still fails is listed and falls back to the browser voice. `--force` re-records everything, `--music` also makes a new music loop. **The key is read from the environment only. Never put it in the game files: they are public once deployed.** `tools/` is excluded from the Vercel upload.
* **Unlocking audio:** Safari and iOS only allow speech and audio that start from a tap. The Play click calls `FX.unlockSpeech()` (a silent utterance, and a volume-0 play of the shared clip player), `FX.unlockSfx()` (an unmuted play at volume 0) and `FX.startMusic()` synchronously. If the browser still won't speak, the 🔊 button gets a red ring (`fx:voiceproblem` event) and the reason is logged to the console as `[voice] …`. While the game waits because the window lost focus, a ⏸ card is shown; a click resumes.
* **Leaving the game:** the voice and sound effects stop when the tab is hidden, the window loses focus, or the page is closed or reloaded. The current line waits and plays again when the learner comes back.

## 9. Debugging

* **QA level jumper:** the ⏭ button (top right, next to 🔊) lists every step grouped by section: Story, How to Play, Level 1, Level 2, Level 3, Story end. Picking one reloads the page as `index.html?step=ID`. Press ▶ and the game starts at that step, with the keypad, equation panel and progress dots set up as if the earlier steps had been played. It reloads rather than switching in place because browsers only allow speech after a tap. You can also open a link directly, e.g. `index.html?step=A3`, `?step=P1` (Level 2 teaching), `?step=R2` (Level 3 transition). An unknown ID starts from the beginning. Turn the jumper off for release with `config.qaJumper: false` in `data.js`. The `?step=` link still works without the button.

* `window.__GAME_STATE` exposes the live state (`phase`, `level`, `view`, `q`, …).
* Phases: `narrate → marker → feedback → entry → feedback …`, plus `gate`.
* The flow was checked end to end with a Playwright script: all 48 steps, wrong lever and keypad attempts (the full 3-step ladder on L1T and B3), inactivity on both part types, both gates, and the end screen.

## 10. Known decisions / open points

* **QA re-test 2 (2026-10-21):**
  * Bug 15 (laggy on a slow network): the game downloaded 22 MB of art before Start worked (63.5 s at 3 Mbps). Now all art is WebP (`cwebp -q 88 -alpha_q 100`; 23.5 MB → 6.8 MB; the PNG/JPG sources stay in the repo, unused), and it loads in stages: before Start only the cover and the first two story pictures (2.1 MB: Start works after 6.7 s at 3 Mbps), then the rest of the story, the game's own art (in 15 s at 3 Mbps, long before the story ends) and the Story End last. The music is 64 kbps (1.3 MB, was 2.7 MB) and loads from the Start tap.
  * 2026-10-21 asset pass: voice clips re-encoded 64 → 48 kbps mono 24 kHz, metadata stripped (7.7 MB → 5.9 MB, same lengths; manifest `?v=` tags and lipsync.js rebuilt; generate-audio.mjs now writes 48k voice / 64k music). `.vercelignore` drops every PNG/JPG under assets/ (the game fetches only .webp), and vercel.json now caches the root-level .webp art. Art sizes checked against how big each piece is drawn: all within ~2× (the avatar faces are also drawn at 180 px in the review card), so none were shrunk. SFX stay WAV (tiny, and no MP3 start gap on key clicks). 3 Mbps test: Start after 6.4 s, first voice 0.4 s after the tap, no voice waits in the first 60 s.
  * The loading progress moved off the Start button to `#loadBar`: a thin, faint white line along the bottom edge of the cover that fades out once Start works (the button just stays dimmed until then).
  * Reload flash: the page showed its built-in English text for a frame or two before lang.js swapped in Hindi. `#viewport` now stays hidden until lang.js has applied the language (`html.lang-ready`); checked frame by frame on reload at 3 Mbps for ?lang=hi/en and a saved choice: 0 frames in the wrong language (was 1–3 for Hindi).
  * Level 2 question stays up until it is answered (2026-10-21, Pradyumn; this applies QA Bug 11 and replaces Varsha's "second number follows the lever"): the equation shows the full question "(+2) + 3 = ?" the whole time (`liveEq` off for A0–A6) and completes only on the right answer. The narrator box keeps the question on its first line (`S.ask` = the lever VO without its last sentence, so Hindi needs no new lines) and the line that is up under it: the instruction, a hint, a reminder, "Yes, the water level is at …". Cleared when the answer is entered, on ⏮ and on a new question; re-read on a language switch. Checked by playing A0–A6 in English and Hindi with a wrong lever and a wrong entry: question and equation never left, no overflow at 32 px.
  * New: the voice of the previous screen went on over the cover after a reload. The browser voice (the slow-network fallback) can outlive the page in Chrome; it is now cancelled as the page loads, and on a page restored from the back/forward cache.
* **QA re-test 2026-10-21** (items still open after 10-19):
  * Bug 3 (jerky): measured with frame timings. The spotlight's full-screen backdrop blur held How to Play at ~25 fps (37–45 slow frames in 4 s); it is now a dark tint with no blur (`#focus`): 61 fps, 0 slow frames, and the level card 55 → 61 fps. Also moved to GPU-only motion: the water's light patterns (`.caustics` layers, `caustA`/`caustB`), the surface glint, the spotlight sweep and the cover button sweep (they animated `background-position` or `left`); the spotlight halo no longer "breathes" (an animated box-shadow); the top buttons have no backdrop blur; the outlet stream's turbulence filter no longer animates.
  * Bugs 4, 6: the narrator text starts on the left at the same spot for every line, one line or two (`padding-top` 30 px = two lines centred).
    * 2026-10-21 follow-up: text is still left-aligned, and is now also centred top to bottom, so one line sits in the middle of the box too (`#bannerText` flex, `justify-content: safe center`).
  * Bug 5: after the "How to Play" and "Level 1" cards Guddu's bubble is the first thing shown (`hostNext()`: the narrator box no longer flashes first); How to Play's finished example stays 2.6 s, the level card 2.5 s.
  * Bug 7 (QA's new ask): in Level 3 the lever stays off on the first try; after a wrong answer it comes back (▲/▼ glow, `S.leverHelp`) so the learner can count with it, and the hint stays as the instruction. Off again for the next question.
  * Bug 14 (English too): every dialogue box uses the same face, weight 800 and navy (bubbles were 900 and black, the caption 700); every bubble, story and Guddu's, uses one size, 36 px (it varied 28–50 px by line). Z3 moved to the round bubble left of Guddu, and Pari's Z2/Z4 bubbles are 540 px wide, just below the top buttons, so every line fits at 36 px.
* **QA bug round 2026-10-19** (Lenovo ThinkPad, i5-6300U):
  * Bug 1 (zoomed-in flash on load): an inline script in `index.html` sizes the stage before the game scripts load, and `#viewport` stays hidden until it has (`html.fitted`). The Start button shows a loading bar and works once the game has loaded.
  * Bugs 2, 16 (language): switches in place, no reload; the button shows the language in use (see §2a).
  * Bug 3 (jerky transitions): the waves slide with `transform` (no repaint each frame; `--wl`, clipped to the glass with `clip-path`), story pictures are decoded before they fade in, and the zoom dive between levels is gone.
  * Bugs 4, 6, 13 (panel text shifting, faded lines, two-line alignment): the bar is drawn in CSS (no seams), every line uses one font size (32 px, smaller only if it would spill), the scale "pulse" on each new line is gone, and the text is centred.
  * Bugs 5, 9: the level card (see Transitions).
  * Bug 7: a keypad that isn't taking keys (`#panel.locked`, `setPadLive()`) and disabled ▲/▼ show no press.
  * Bugs 8, 10: the display's digits and the equation cards are centred on the art's inner areas (measured: digits +2 px, cards +5 px).
  * Bug 14: all Hindi text uses Baloo 2 (Nunito has no Devanagari, so a system font was mixed in).
  * Bug 15 (slow network): clips carry a version tag (`…mp3?v=…`, from their content: `tools/generate-audio.mjs`) and are cached for a year (`vercel.json`); pictures and sounds for a day; the clips of the next steps are fetched ahead (`prefetchVoice()`, `FX.prefetch`); a clip still loading is waited for (up to 25 s) instead of switching to the browser voice, with a ring round 🔊 meanwhile (`fx:buffering`).
  * **Not applied, against the 2026-10-12 review (Varsha):** ~~Bug 11~~ (applied 2026-10-21, see below) and Bug 12 (keypad only after Guddu finishes: it works from the lever's lock, because she found the wait too long).

* **QA round 2026-10-14** (all levels):
  * **One instruction at a time:** the narrator box (and Guddu's bubble) shows a line a sentence at a time as it is spoken, a short sentence ("Try again.", "Great!") kept with its neighbour (`chunks()`, `followChunks()`); afterwards the last piece stays (`setBanner()` always shows one piece). When the last spoken piece and the sheet's OST say the same thing, the OST wording is used, so nothing flips.
  * **Said once:** in How to Play and the Level 1 tutorial, Guddu stays on screen with his bubble while the learner plays (`hostOut()` when the next line isn't his); the narrator box never repeats his line. Feedback and reminders then go in his bubble too.
  * **Every line is heard to the end:** a new line waits for the one playing, then a 0.35 s breath (`speak()`, `FX.busy()`); Check pressed during a line is checked when it ends. Voice pace per section in `config.voicePace` (0.88–0.95).
  * **Lever checks:** at the answer after 1 s; on the way to it (right direction, not there yet) after 3 s, so a learner still counting isn't told they are wrong; elsewhere after `settleMs`.
  * **Level 2 feedback:** the lever part says "Yes, the water level is at +5.", the keypad part "Correct! You marked the new water level." (sheet: "Correct! You reached …" / "Correct! The new water level is …").
  * **Removed:** P4's "Rises → Add / Goes Down → Subtract", S0, the Z2 "Well Done!" board, the equation in Level 3's OST, all equation read-outs.
  * **R3** now says "That's okay, Pari! Let's mark the water level using the number pad." (review comment; sheet: "That's okay! Pari. Let's mark the new water level …").
  * **Rings:** every highlight ring is yellow, below 0 too, in the hook and the Story End (blue vanished in the water).

* **How to Play example numbers.** The "Game start" row says the lever is above 0, so the demo starts at +2. Step 1 taps ▲ then ▼ ("up or down as necessary"). Its example, "Like water rises 2 levels up", is played in step 2: the lever is dragged +2 → +4. Then the demo picks + and types 4, and presses Check. **Sign first, then the number** (a teaching choice, 2026-10-08): the CSV has the number in step 3 and the sign in step 4, but the game swaps them. Step 1 is spoken by Guddu, not the Narrator as in the CSV, so a face is in the narrator box from the first line and one host presents all of How to Play. Change them in `data.js` (H1–H4).
* The Level 1 tutorial marker starts at +2 ("starts above 0").
* **The equation panel only ever shows equations.** In the Level 2 teaching rows, the example equations ("1 + 2 = ?", "3 − 5 = −2", `ostIn: "eq"`) go in the panel, written as the CSV writes them. The word captions ("Water level rises → Add", "Rise → Add • Go down → Subtract") are shown in the narrator box after the line, like every other OST. Each piece of the equation sits on its own card in the cream strip, following the reference mock (`screen-mock-01.png`): white number cards, smaller cream cards for the signs, and a light-blue answer card with a blue outline. Card sizes are in `em`, so `fitEq()` shrinks the cards along with the font when an equation would overflow the strip. Only the widest one does: "(−2) + (−3) = ?" goes from 46 to 44 px.
* Fixed CSV typos: "thje" → "the" (Level 2 example 2), "2 level up" → "2 levels up" (How to Play step 1), stray closing quotes in OSTs, and missing full stops at the end of the story lines and How to Play step 1. Everything else is word for word. **Voice and screen now agree where the sheet had them differ** (2026-10-12):
  * (Story V3, 2026-10-13: the "Above 0" / "Below 0" lines now follow the new sheet, VO = OST: "Above 0, means there is more water than requirement." / "Below 0, means there is less water.")
  * ST4: the sheet's new VO "Look Pari, we'll use 0 as the reference point to mark the water levels." is also the bubble text (its OST is still the old line, "0 shows the water level we need.");
  * Z2: the bubble shows Pari's line (the sheet's OST "Well Done!" is not shown, 2026-10-14 QA);
  * the Level 2 tutorial's keypad step says "Enter the new water level." (the OST had "Tap");
  * Pari's Story End line is in number-line order, "below 0, at 0, and above 0" (the VO had "at 0, above 0, and below 0"; re-recorded in English and Hindi);
  * the last line says "Integers Expert" (the OST had "Water Level Expert").

  Level 2's on-screen text is still a deliberately shorter version of the spoken instruction ("Move the lever 3 levels down."), as in the sheet.
* **Game script source (2026-10-06): "Integers_Rise and Fall - Game V3.csv"** (now Game V3 (2), unchanged) for Level 1, the Level 2 game and the Level 3 game, word for word. The story, How to Play, the Level 2 teaching rows (P1–P4), TR2 and the Level 3 transition (R2–R6) follow **Story V3** (2026-10-13). How to Play step 1 is a Narrator line in the sheet; Guddu says it (2026-10-08). The new voice lines were recorded with the same voices and notes (`tools/generate-audio.mjs`) and checked: all 321 clips at −16 LUFS ± 1.5, the new ones at the same pace as the old.
  * Cells the sheet shows as `#ERROR!` are text that started with "+", which the spreadsheet read as a formula. They follow the matching negative rows: "+2 on the scale glows", "+ and 2 buttons pulse", "+1 and +2 highlight one by one".
  * **Level 2 example 4:** the sheet's voice says "goes down 6 levels" and its lever-row equation says "(−2) - (6)", but the path, the answer (−5), the hints and the on-screen text all say 3 levels. It's kept at 3 levels down (2026-10-06), and the voice reads "The water level goes down 3 levels. Move the lever to the correct water level."
  * **Equation rule (2026-10-12): the second number is never negative.** There's no "+ (−3)": water going down is subtracting. So the sheet's "(−2) + (−3) = −5" is written **(−2) − 3 = −5**. It was the only equation that broke the rule.
  * **Level 2 example 6:** the lever row shows "(−6) − 4"; the entry row, path and answer say (−3) − 4 = −7, which is what the game uses.
  * **New feedback animations:** `glowDown` (down arrow glows), `pulseMarkerScale` (marker and scale pulse), `pulseMarkerZero` (marker and 0 pulse) and `arrowCount` (the arrow glows and the levels light one by one; Level 3 Incorrect 2).
* **The story's first row (ST1) has no OST in the CSV ("—")**, but the narrator's line is shown as a caption on the scene, matching the reference art `dialogue_p01.png`. This is the one place on-screen text isn't in the CSV's OST column. The decision was made on 2026-10-01.
* The water follows the marker in every level.
* **The VO always completes.** There's no tap-to-skip. `FX.speak()` resolves only when the speech engine has finished.
