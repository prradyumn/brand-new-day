# Integers: Rise and Fall — How to Play + Levels 1–3

This is a plain HTML, CSS and JavaScript game with no build step and no libraries. It follows **"Integers_Rise and Fall - Story n Game V3 (1).csv"** from the "How to Play" table onward: How to Play, Level 1, the Level 2 transition and game, the Level 3 transition and game, and the Story End. The intro/teaching story rows before "How to Play" are not part of the game. The layout matches **Figma → Integers → page "LBD" → Section 2** (Slide 16:9 – 16 / 18 / 19 / 20).

**Content rule:** every spoken line and every piece of on-screen text comes from the CSV. `data.js` copies it verbatim, with speaker labels ("Guddu Bhaiya:") and quote marks removed. The engine adds no dialogue or captions of its own. Buttons use the CSV's "Start" or icons (▶ ↻ ⏸).

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

## 4. Game flow

```
Start screen (▶ = user gesture, unlocks speech; the first story scene sits behind it)
  Story        ST1–ST10  full-screen scenes (CSV Intro, Teaching, Game start), speech bubbles + VO
  ── camera pushes into the tank ──
  How to Play  H1–H5  guided demo (blur + spotlight + hand): ▲/▼ taps, drag to +4, type 4, pick +, Check
  ── dive ──
  Level 1      L1T    tutorial, learner plays (blur + spotlight): +2 → 0, then enter 0
               TR1    "Start" button → tank scale and dial become active
               Q1…Q7  0→+2, +2→+4, +4→+6, +6→+3, +3→−1, −1→−3, −3→−7   (marker, then keypad)
  ── dive ──
  Level 2      P1–P7  teaching rows (Pari + Guddu): example equations (P3–P6) in the equation panel, lever demos
               TR2    tap to continue; the equation panel shows 0 + 3 = ?
               A0     tutorial 0 + 3 (equation follows the lever), no incorrect feedback
               A1…A6  (+2) + 3, (−2) + 4, (+3) − 5, (−2) + (−3), (−5) + 2, (−3) − 4
               E2     "Level Complete!" board + confetti
  ── dive ──
  Level 3      S0, R2–R6  "the lever isn't working now": ▲/▼ switch off, keypad glows, first challenge appears
               B0     tutorial 0 + 4 (keypad only), no incorrect feedback
               B1…B6  (+4) + 3, (+7) − 6, (+1) − 5, (−4) − 2, (−6) + 3, (−3) + 2  (keypad; the lever moves by itself)
  Story End    Z1–Z5  display glows, confetti, integers highlighted, lever sweeps − → 0 → +, completion badge
End screen (confetti, ↻ = reload)
```

**Step types** (`data.js`): `demo` (How to Play), `question`, `gate` (transition dialogue that waits for Start or a tap), `say` (a spoken row plus the animation in its Scene Description). `section` decides the dive: a new section = dive into the tank. The Story End plays on at the Level 3 tank.

**Speakers:** `guddu` (default), `pari`, `narrator`. The banner avatar changes (Pari's is `assets/pari-happy.png`, cropped from `pari-full.png`; "Narrator:" lines have no face) and Pari's voice is pitched a little higher. All feedback lines are Guddu Bhaiya's.

### Story (`runScene()` in `game.js`)

Ten scenes from the CSV story rows, word for word, before How to Play. Scene art: `assets/story/scene-pXX.jpg` (web copies of `assets/scene_pXX_background_clean.png`, 5 MB instead of 23 MB).

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
| ST10 | p04 | Guddu | Game start: "Correct, Let's mark the correct water level." (0 glows) |

* **Speech bubbles** use the two artworks as they are, never stretched: `asset_speech_bubble_blank.png` (round, tail bottom-left) and `asset_p09_overlay_….png` (wide, tail bottom-right). `BUBBLES` in `game.js` holds their measured tail tip and inner text area. A scene sets `bubble: { shape, tail, w, tip }`: the width, and the point the tail aims at (the speaker). A tail on the other side mirrors the artwork only, never the text. The text is bold black and centred in the inner area, and its font shrinks to fit (50 → 20 px), so the bubble never changes shape.
* **Narrator line (ST1)** is a caption straight on the scene, as in `dialogue_p01.png`, with a soft white halo. It is inset so it stays clear of the ⏭ / 🔊 buttons.
* **Highlights** (`glow`) are halo rings around the numbers painted in the art, yellow above 0 and blue below, lit one by one while the line plays. `camera` is a slow zoom toward a point ("camera moves upward/closer").
* The baked-text images (`dialogue_p01–p06.png`) are references only. Their wording differs from the CSV in places (p01 drops "reading", p04 and p06 are different lines), so the game shows the CSV text.
* **Story → game:** the camera pushes into the tank as the story fades, and How to Play begins.

### A question = up to two parts

Each part (`lever`, `entry`) has its own CSV row: `vo`, `ost`, `correct`, `wrong[3]`, `idle`, `success`.

1. **Lever part** (`leverPart()`): the VO plays, the OST stays in the banner, the learner drags the marker or taps ▲/▼. When the marker has rested `settleMs` (1.3 s) it is checked: at the target → correct; still at the start → ignored; anywhere else → a wrong attempt. Correct: "Marker locks", small ✓ + sparkle, and the correct line ("Correct! You reached +2.").
2. **Entry part** (`entryPart()`): the VO ("Enter the new water level."), then the learner types sign + digits and presses **Check**. Correct: the value appears on the display and glows, the equation completes, "✓ Sparkle + Water Level Marked!" (board + confetti; the Level 1 tutorial gets only ✓ + sparkle), then the correct line. Level 3 (`autoLever`) has only this part; after the answer the lever moves by itself, level by level, and the water follows.

**Sign rule:** positive answers need "+", negative answers need "−", 0 needs no sign.

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

**Inactivity:** after `inactivityMs` (10 s) with no input, the part's `idle.text` plays with its `fx`. The timer then restarts.

### Transitions (`flipCards()`, `diveWipe()` in `game.js`)

* **Next question in the same level → card flip** (≈0.8 s) of the display and the equation.
* **New level → dive into the tank** (≈2.6 s): How to Play → Level 1, Level 1 → Level 2, Level 2 → Level 3. The next level is set up underwater (`levelWipe()`).
* With reduce-motion on, the flip becomes an instant swap and the dive a 0.25 s fade.

## 5. Focus / glass effect

* `#focus` is a full-stage layer with `backdrop-filter: blur(10px) saturate brightness` and a light tint and sheen.
* The "spotlight" is a `clip-path: path(evenodd, …)` with **two rounded-rect holes** (see `HOLES` and `focusOn()` in `game.js`). The path always has the same shape, so the holes **animate smoothly** between targets.
* **How to Play and the Level 1 tutorial only (`guided`).** Usually one highlight at a time: the spotlight moves narrator box → tank → keypad, and the others are blurred (How to Play step 5 lights the keypad and the tank together). The tank hole starts right of the narrator box; ▲ / ▼ stick out to its left, so while the tank is lit they are raised above the glass (`#stage.lever-lit`) and stay sharp and pressable. `focusOn()` does nothing once `S.guided` is false (from TR1 on). Feedback and hint lines use `sayFocused()`: the spotlight moves to the narrator box while Guddu speaks, then goes back.
* An unused hole is parked off-stage as `NO_HOLE`. This matters because two identical holes cancel each other under the even-odd rule.
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
* The water top follows the marker (`render()`), with a height transition. While it rises, the inlet pipe switches to the "water" sprite. While it falls, the outlet pipe does.
* The dashed yellow **count line** (`#countLine`) shows the distance from the question's start level to the marker.

## 7. Assets (`assets/`)

| File | Figma source |
|---|---|
| `bg.png` | "ChatGPT Image … 03_26_47 PM (2)" background |
| `tank-empty.png` | Empty glass tank (Tank component "Variant2" image) |
| `pipe-in-dry/water.png` | Inlet pipe (component set: inlet, water=false/true) |
| `pipe-out-dry/water.png` | Outlet pipe (outlet, water=false/true) |
| `track.png`, `btn-up.png`, `btn-down.png` | Lever track + arrows (Group 21) |
| `plate-blue.png` | Number plate (Group 20) |
| `panel-cream.png` | Keypad panel frame (Group 19). Stretched with CSS `border-image` |
| `strip-cream.png` | Equation strip background |
| `banner-bar.png`, `guddu-happy/sad/think.png` | Narrator bar + 3 avatar moods (cropped from one Figma sheet) |
| `guddu-full.png`, `pari-full.png` | Characters (Pari is included for later story scenes) |
| `board-green.png` | "Water Level Marked!" board |
| `panel-title.png` | Start/end card |
| `drop.png` | Water drop (user-supplied reference, trimmed to 480 px). Currently unused: it was the earlier drop wipe, kept for later use |
| `pari-happy.png` | Pari's banner avatar, cropped from `pari-full.png` |
| `sfx/water-fill.mp3` | Mixkit "Filling sink with water" (#1819), trimmed to a 7 s loop. Mixkit Free Sound Effects License |
| `sfx/water-drain.mp3` | Mixkit "Sink drain" (#1878), trimmed to a 10 s loop. Mixkit Free Sound Effects License |
| `sfx/key.wav` · `lever.wav` · `tick.wav` · `button.wav` · `board.wav` · `wrong.wav` · `flip.wav` | Mixkit #1120 click box check · #2568 interface click tone · #1317 water bubble · #3005 light pop · #2357 bubble pop-up · #2569 negative tone tap · #1104 page turn. Trimmed so each starts on its first sound, peak-normalised, and saved as WAV so short clicks don't lag. Mixkit Free Sound Effects License |
| `sfx/correct.mp3` · `confetti.mp3` · `complete.mp3` | Mixkit #3193 bubbly achievement tone · #2359 silly pop cluster · #2059 game level completed. Trimmed and normalised the same way |
| `sfx/splash-in.mp3` · `bubbles.mp3` · `splash-out.mp3` | Level-transition dive: Mixkit #1304 jumping into water · #1321 deep water bubbles · #1311 water splash |

The keypad keys, the Check button and ⌫ are drawn in CSS to match the Figma key style. The Figma keypad image only has 0–6, and Q6 needs 7.

## 8. Changing content

* **Text / numbers:** edit `js/data.js` only. Add a question with `start`, `target` and a `lever` and/or `entry` part (`vo`, `ost`, `correct`, `wrong[3]` or `null`, `idle`, `success`), optionally `eq: { a, op, b }`, `liveEq`, `autoLever`, `guided`, `plateStart`. The `q1()` / `q2()` / `q3()` builders at the bottom of `data.js` make the repeated Level 1/2/3 example rows. Keep text verbatim from the CSV.
* **Timing:** `config.settleMs`, `config.inactivityMs`.
* **Sign rule:** `config.requireSignForPositive` is `true`, because the CSV says the learner "presses + and 4". Set it to `false` to accept "4" as well as "+4". Negative answers always need "−".
* **Voice-over:** every line is pre-recorded with **Gemini TTS** (`gemini-3.8-flash-tts`, English–India) into `assets/vo/*.mp3`. `assets/vo/manifest.js` maps `"speaker|line"` to its clip, and `FX.speak(text, { speaker })` plays it. A line without a clip, or whose clip can't play, is read by the browser's SpeechSynthesis (prefers an `en-IN` voice) as before. Either way the promise resolves only when the line has finished. Casting: Guddu Bhaiya = *Puck*, Pari = *Leda*, narrator = *Kore* (`VOICES` in `tools/generate-audio.mjs`). 🔊/🔇 in the top-right corner mutes the voice, music and sound effects (`FX.setMuted`). Muting mid-line doesn't skip ahead: the line goes quiet and its text stays up for its reading time.
* **Background music:** `assets/music/bg-loop.mp3` is a soothing instrumental made with **Lyria 3** (bansuri, marimba, acoustic guitar, soft tabla; ~2:46, the end crossfades into the start so it loops seamlessly). It starts on the ▶ tap, dips to 45 % under every spoken line, and pauses while muted or while the learner is away (`FX.loadMusic` / `FX.startMusic` in `fx.js`). The file is mixed quiet (−24 LUFS, voice clips −16 LUFS) because iOS ignores element volume.
* **Re-recording after a script change:** edit `js/data.js`, then run `GEMINI_API_KEY=… node tools/generate-audio.mjs` (needs Node 18+ and ffmpeg). It records only new or changed lines and deletes clips that are no longer used. Every clip is transcribed and compared with the script word for word; a clip where the voice ad-libs or drops words is recorded again (up to 4 tries), and any line that still fails is listed and falls back to the browser voice. `--force` re-records everything, `--music` also makes a new music loop. **The key is read from the environment only. Never put it in the game files: they are public once deployed.** `tools/` is excluded from the Vercel upload.
* **Unlocking audio:** Safari and iOS only allow speech and audio that start from a tap. The Play click calls `FX.unlockSpeech()` (a silent utterance, and a volume-0 play of the shared clip player), `FX.unlockSfx()` (an unmuted play at volume 0) and `FX.startMusic()` synchronously. If the browser still won't speak, the 🔊 button gets a red ring (`fx:voiceproblem` event) and the reason is logged to the console as `[voice] …`. While the game waits because the window lost focus, a ⏸ card is shown; a click resumes.
* **Leaving the game:** the voice and sound effects stop when the tab is hidden, the window loses focus, or the page is closed or reloaded. The current line waits and plays again when the learner comes back.

## 9. Debugging

* **QA level jumper:** the ⏭ button (top right, next to 🔊) lists every step grouped by section: Story, How to Play, Level 1, Level 2, Level 3, Story end. Picking one reloads the page as `index.html?step=ID`. Press ▶ and the game starts at that step, with the keypad, equation panel and progress dots set up as if the earlier steps had been played. It reloads rather than switching in place because browsers only allow speech after a tap. You can also open a link directly, e.g. `index.html?step=A3`, `?step=P1` (Level 2 teaching), `?step=R2` (Level 3 transition). An unknown ID starts from the beginning. Turn the jumper off for release with `config.qaJumper: false` in `data.js`. The `?step=` link still works without the button.

* `window.__GAME_STATE` exposes the live state (`phase`, `level`, `view`, `q`, …).
* Phases: `narrate → marker → feedback → entry → feedback …`, plus `gate`.
* The flow was checked end to end with a Playwright script: all 48 steps, wrong lever and keypad attempts (the full 3-step ladder on L1T and B3), inactivity on both part types, both gates, and the end screen.

## 10. Known decisions / open points

* **How to Play example numbers are not in the CSV.** The "Game start" row says the lever is above 0, so the demo starts at +2, taps ▲ then ▼ ("up or down as shown"), drags to +4, types 4 then + (the CSV introduces the number in step 3 and the sign in step 4) and presses Check. Change them in `data.js` (H1–H4).
* The Level 1 tutorial marker starts at +2 ("starts above 0").
* **The equation panel only ever shows equations.** In the Level 2 teaching rows, the example equations ("1 + 2 = ?", "3 − 5 = −2", `ostIn: "eq"`) go in the panel, written as the CSV writes them. The word captions ("Water level rises → Add", "Rise → Add • Go down → Subtract") are shown in the narrator box after the line, like every other OST. `fitEq()` shrinks the font only if an equation would ever overflow the strip (none do: the widest, "(−2) + (−3) = −5", uses 345 of 447 px).
* Fixed CSV typos: "thje" → "the" (Level 2 example 2), stray closing quotes in OSTs. Everything else is word for word, including where VO and OST differ (Level 2 example 3, Story End row 4).
* The water follows the marker in every level.
* **The VO always completes.** There's no tap-to-skip. `FX.speak()` resolves only when the speech engine has finished.
