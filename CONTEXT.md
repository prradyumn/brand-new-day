# Integers: Rise and Fall — Tutorial + Levels 1–3

This is a plain HTML, CSS and JavaScript game with no build step and no libraries. It follows **"Integers_Rise and Fall - Story n Game V3-2.csv"** from the "How to Play" table onward (Tutorial, Level 1, Level 2, Level 3). The story rows before that table are not part of the game. The layout matches **Figma → Integers → page "LBD" → Section 2** (Slide 16:9 – 16 / 18 / 19 / 20).

**Content rule:** every spoken line and every piece of on-screen text comes from the CSV. `data.js` copies it verbatim, with speaker labels ("Guddu Bhaiya:") and quote marks removed. The engine adds no dialogue or captions of its own. Buttons use the CSV's "Start" or icons (▶ ↻ ⏸).

---

## 1. Run it

Open `index.html` in a browser. To serve it locally from VS Code, pick one:

```bash
npx serve .            # or
python3 -m http.server 8000
```

or use the VS Code "Live Server" extension. The only network request is the **Nunito** font from Google Fonts. Offline, the game falls back to a system font.

## 2. Files

The game lives at the **repository root** (so Vercel serves `index.html` directly):

```
brand-new-day/        (repo root)
├── index.html        DOM for the 1920×1080 stage (every element is here, hidden or shown by JS)
├── css/style.css     All visuals, positions (Figma px), water, focus glass, animations
├── js/data.js        CONTENT ONLY: config + every VO/OST/feedback line + question list
├── js/fx.js          Helpers: sleep, voice-over (TTS), sparkles, badges, confetti
├── js/game.js        Engine: flow, marker drag, scale scrolling, keypad, feedback
├── assets/           PNGs harvested from Figma (see §7)
├── CONTEXT.md        This file
├── Integers_LBD_assets/  Raw Figma exports (source art, not used by the game; excluded from Vercel by .vercelignore)
├── .vercelignore     Keeps the deploy to the game files
└── .gitignore
```

**Deploy (Vercel):** static site, no build step. Framework preset "Other", Root Directory empty (the repo root), no build or output command.

Script load order matters: `data.js` → `fx.js` → `game.js`.

## 3. Coordinate system

* `#stage` is a fixed **1920 × 1080** box, the same size as the Figma frame. `fitStage()` scales it to the window with letterboxing.
* Every `left/top/width/height` in `style.css` is a **Figma pixel**. To match a Figma change, copy the new x/y/w/h straight in.
* Pointer events are converted back to stage pixels in `toStage()`.

Key positions (from Figma "Slide 16:9 - 16"):

| Element | Figma layer | x, y, w, h |
|---|---|---|
| Narrator box | Group 18 | 23, 16, 1067×138 |
| Number plate | Group 20 | 287, 265, 501×167 |
| Keypad panel | Group 19 | 214, 451, 619×498 |
| Level 2/3 layout (level mode, Figma slide 18–20) | — | plate y=205 · keypad 214, 371, 619×628 · equation strip 272, 433, 507×146 on top of the keys |
| Tank (empty glass) | Group 16 image | 1039, 16, 747×1119 |
| Inlet / outlet pipe | instances | 1172,-168,363×273 / 1595,868,217×163 |
| Lever track | Group 21 | 1094, 102, 114×945 |
| ▲ / ▼ buttons | image 5 / image 6 | 1078,43 / 1078,952 |
| Marker (yellow arrow) | Line 13 | x 1128, 140 wide |
| Scale | Frame 3 / Frame 4 | level 0 at **y = 570**, **75 px per level** |

## 4. Game flow

```
Start screen (▶ = user gesture, unlocks speech)
  Tutorial   T0  Find 0            (guided demo: the game plays it; spotlight + hand)
             T1  0 → +2            (demo: hand drags the marker, then types +2 on the keypad)
             T2  0 → −3            (demo)
  TR1        "Start" button → tank scale and dial become active
  Level 1    Q1…Q6  +2→+4, +4→+6, +6→+3, +3→−1 (crosses 0), −1→−3, −3→−7   (marker + keypad)
  TR2        keypad switches to level mode, the equation appears on top of it; tap anywhere to continue
  Level 2    A1…A5  0+(+3), (+2)+(+3), (−2)+(+4), (+3)+(−5), (−2)+(−3)       (lever + keypad + equation)
  Level 3    S1…S5  0−(+3), (+4)−(+2), (+2)−(+4), (−1)−(+3), (−3)−(−2)       (lever + keypad + equation)
End screen (confetti, ↻ = reload)
```

Each question (`runQuestion()` in `game.js`) runs four phases:

**Tutorial = guided demo** (`demo: true`). The game plays T0–T2 by itself so the learner sees how it works. In T0 and T1, where something new appears, the spotlight moves from the narrator box to the tank to the keypad. T2 (`spotlight: false`) repeats the same walk-through, so it plays without the blur or the full-size character, which also eases the change into Level 1. A hand (`#hand`) moves the marker and types the answer (`demoMarker()` / `demoEntry()`). The tutorial shows all three ways to move the marker, with no added dialogue (`demoMove` in `data.js`): **T0 drags the marker**, **T1 taps the green ▲ twice**, **T2 taps the red ▼ three times**. For ▼ the hand points down from above (`#hand.flip`), because the button sits on the bottom edge. Every ▲ / ▼ press, the hand's or the learner's, shows the same feedback (`pressLever()`): the button squashes, brightens and sends out a ripple ring. Nothing waits for input, so the tutorial's wrong-answer and inactivity lines are never triggered. **From TR1 on there is no blur and no full-size character**, and the learner plays.

1. **Narrate.** The VO plays in the narrator box. In the tutorial only, a frosted-glass layer blurs everything else and Guddu Bhaiya slides in. It can't be skipped. The game only continues once the line has finished (see §8, Voice-over).
2. **Marker.** The learner drags the marker or taps ▲/▼ (tutorial: the hand drags it, with the spotlight on the tank). The learner drags the marker or taps ▲/▼. When the marker has rested for `settleMs` (1.3 s) it is checked:
   * at the target → correct
   * still at the start → ignored
   * anywhere else → a wrong attempt
3. **Entry** (`entry: true`: T1/T2 demo, Level 1, Level 2, Level 3). The learner types the level (sign keys + digits) on the keypad and presses **Check**. In Level 2/3 the equation stays "… = ?" during this step and completes after Check ("Equation completes: 0 + (+3) = +3"). In Level 2 Q1 (`liveEq`) the equation follows the lever while it moves: 0 + (+1) → 0 + (+2) → 0 + (+3).
4. **Celebrate** (CSV "Success" column). Small ✓, sparkle on the level label, the "Water Level Marked!" board and confetti. T0 (`celebrate: "small"`) gets only the ✓ and sparkle, as in CSV row 12. Crossing 0 (`crossZero: true`, Q4) gets slightly stronger sparkle and confetti.

### Transitions (`flipCards()`, `diveWipe()` in `game.js`)

* **Next question in the same level → card flip** (≈0.8 s). The number display flips over on its horizontal axis and comes back showing the new question. In Levels 2 and 3 the equation strip follows 80 ms later. The water re-levels at the same time. In Level 1 the display flips to the same number, because each question starts where the last ended.
* **New level → dive into the tank** (≈2.6 s), at Tutorial → Level 1, Level 1 → Level 2 and Level 2 → Level 3. The camera (the whole `#stage`, a zoom added on top of the fit-to-window transform) plunges into the tank's water with a splash. The window goes underwater (`#under`, outside the stage so it doesn't zoom: soft light beams and rising bubbles, with a bubbles sound). The next level is set up out of sight (`levelWipe()`: the tank settles at the next start, and the display, equation and banner update). Then the camera rises out of the new tank's water with a splash and a small bounce. The CSV transition beat (TR1 sweep, TR2 equation panel) plays after it.
* Neither runs before the step a QA jump starts at. With reduce-motion on, the flip becomes an instant swap and the dive a 0.25 s fade.

### Feedback ladder (CSV "Incorrect Feedback 1/2/3")

`q.wrong[0..2]` from `data.js` is used for attempts 1, 2 and 3+. Attempts past 3 repeat the third line. Each entry has an `fx`:

Each `fx` does only what its CSV cell says:

| fx | What happens | Used by (CSV) |
|---|---|---|
| `return` | Marker animates back to the start level | Incorrect 1, every question |
| `pulseZero` | The 0 mark pulses | T0 Incorrect 2 + inactivity, Q4 Incorrect 2 |
| `nudge` | Marker gives a small push toward the target from wherever it is | T0 Incorrect 3 |
| `glowUp` / `glowDown` | ▲ or ▼ button glows ("Up/Down arrow briefly glows") | T1/T2 Incorrect 2 |
| `glowDirUp` / `glowDirDown` | A glow travels up or down the scale from the start level ("Upward direction on the scale glows") | Q1–Q3, Q5, Q6 Incorrect 2 |
| `countSteps` | The steps toward the target light up one by one. With `withStart: true`, the start mark lights first ("0 and the two upward steps…") | Incorrect 3 (T1/T2 with start; Q1–Q6 steps only, as in Q5/Q6 "−2, −3 highlight one by one") |
| `pulseUpFirst` / `pulseDownFirst` | Arrow glows and the first step pulses | T1/T2 inactivity |
| `pulseMarkerNext` | Marker and the next level pulse | Q1 (and Q2) inactivity |
| `pulseNext` | Only the first step pulses ("−2 gently pulses") | Q3–Q6 inactivity |
| `pulseGate` | Start button gently pulses | TR1 inactivity |
| `pulseEqPanel` | Equation panel gently pulses | TR2 inactivity |
| `pulseStart` | The starting level pulses | L2/L3 Incorrect 1 ("Starting level +2 pulses") |
| `pulseStartEq` | Starting level and the equation pulse | A4 Incorrect 1 |
| `highlightStart` | The starting level lights up | S1 Incorrect 2 ("0 highlights as the starting level") |
| `pulseSteps` | All the steps to the target pulse together | A1 Incorrect 3 ("Three levels above 0 gently pulse") |
| `countSteps` + `pulse: true` | Steps light and pulse one by one | L2/L3 Incorrect 3 ("−1, 0, +1, +2 pulse one by one") |
| `pulseEqTerms` | The start term and the change in the equation pulse ("0 and (+3)") | L2/L3 inactivity |
| `glowEqOp` | The operator and the change glow ("− (−2)") | S5 Incorrect 1 |
| `pulseEqOpDirUp` | "−(−2)" pulses and the upward side of the scale glows | S5 inactivity |

The marker goes back to the start only on `return` ("Marker returns…" / "Lever resets…"): attempt 1 in the Tutorial and Level 1, attempt 2 in Level 2/3. Otherwise it stays where the learner left it, because the CSV doesn't say to move it.

**TR1:** after Start, "Tank scale and dial become active". The spotlight moves to the tank, a light sweeps up the scale, and then the keypad glows.
**TR2:** after the VO, the keypad switches to level mode (the plate moves up, the keypad grows), and "the equation panel appears beside the tank" on top of the keys, showing A1's equation. A tap anywhere continues, including on the keypad.

**Inactivity:** after `inactivityMs` (10 s) with no input, `q.idle.text` plays with its `fx`. The timer then restarts.

**Keypad wrong answers** have no line in the CSV, so nothing is spoken: the plate shakes, a ✗ appears and the entry clears. Keypad inactivity only nudges the keypad.

## 5. Focus / glass effect

* `#focus` is a full-stage layer with `backdrop-filter: blur(10px) saturate brightness` and a light tint and sheen.
* The "spotlight" is a `clip-path: path(evenodd, …)` with **two rounded-rect holes** (see `HOLES` and `focusOn()` in `game.js`). The path always has the same shape, so the holes **animate smoothly** between targets.
* **T0 and T1 only, one highlight at a time.** The spotlight moves narrator box → tank → keypad, and the others are blurred. `focusOn()` does nothing once `S.guided` is false (from TR1 on). Feedback and hint lines use `sayFocused()`: the spotlight moves to the narrator box while Guddu speaks, then goes back.
* An unused hole is parked off-stage as `NO_HOLE`. This matters because two identical holes cancel each other under the even-odd rule.
* Clicks outside the holes are blocked, because the layer is clipped and hit-testing follows the clip.
* During narration the character is raised above the glass (`z-index: 45`) instead of getting a hole.

## 6. Scale, marker and water

* Levels run from `levelMin` to `levelMax` (−10…+10), and 11 marks are visible at once (±`visibleHalfRange`).
* `S.view` is the centre of the visible window. `ensureVisible()` scrolls the strip (`#scaleStrip` translateY) when the marker goes past +5 or −5. This is how +6 and −7 work.
* Dragging past the top or bottom mark keeps scrolling, one level every 420 ms (edge auto-scroll).
* **Tutorial water** (`water` field on a question in `data.js`): `"target"` puts the water at the answer from the start (T0). `"animate"` makes the water rise or fall from the start level to the answer once the tank is lit (T1, T2). In both cases the learner moves the marker to match the water, and moving the marker doesn't move the water (`S.water` in `game.js`). Without the field, the water follows the marker (Level 1).
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
| `sfx/water-fill.mp3` | Mixkit "Filling sink with water" (#1819), trimmed to a 7 s loop. Mixkit Free Sound Effects License |
| `sfx/water-drain.mp3` | Mixkit "Sink drain" (#1878), trimmed to a 10 s loop. Mixkit Free Sound Effects License |
| `sfx/key.wav` · `lever.wav` · `tick.wav` · `button.wav` · `board.wav` · `wrong.wav` · `flip.wav` | Mixkit #1120 click box check · #2568 interface click tone · #1317 water bubble · #3005 light pop · #2357 bubble pop-up · #2569 negative tone tap · #1104 page turn. Trimmed so each starts on its first sound, peak-normalised, and saved as WAV so short clicks don't lag. Mixkit Free Sound Effects License |
| `sfx/correct.mp3` · `confetti.mp3` · `complete.mp3` | Mixkit #3193 bubbly achievement tone · #2359 silly pop cluster · #2059 game level completed. Trimmed and normalised the same way |
| `sfx/splash-in.mp3` · `bubbles.mp3` · `splash-out.mp3` | Level-transition dive: Mixkit #1304 jumping into water · #1321 deep water bubbles · #1311 water splash |

The keypad keys, the Check button and ⌫ are drawn in CSS to match the Figma key style. The Figma keypad image only has 0–6, and Q6 needs 7.

## 8. Changing content

* **Text / numbers:** edit `js/data.js` only. Add a question by adding an object to `steps` with `start`, `target`, `vo`, `ost`, `correct`, `wrong[3]`, `idle`, and optionally `entry`, `eq: { a, op, b }`, `liveEq`, `water`, `celebrate` and `crossZero`. Keep text verbatim from the CSV.
* **Timing:** `config.settleMs`, `config.inactivityMs`.
* **Sign rule:** `config.requireSignForPositive` is `true`, because the CSV says the learner "presses + and 4". Set it to `false` to accept "4" as well as "+4". Negative answers always need "−".
* **Voice-over:** `FX.speak()` in `fx.js` uses the browser's SpeechSynthesis (prefers an `en-IN` voice) and waits for it to finish. To use recorded MP3s, replace `FX.speak(text)` with an `<audio>` player that resolves on `ended`, keyed by the text or by a new `audio` field in `data.js`. 🔊/🔇 in the top-right corner mutes the voice and the sound effects (`FX.setMuted`). Muting mid-line doesn't skip ahead: the line goes quiet and its text stays up for its reading time.
* **Unlocking audio:** Safari and iOS only allow speech and audio that start from a tap. The Play click calls `FX.unlockSpeech()` (a silent utterance) and `FX.unlockSfx()` (an unmuted play at volume 0) synchronously. If the browser still won't speak, the 🔊 button gets a red ring (`fx:voiceproblem` event) and the reason is logged to the console as `[voice] …`. While the game waits because the window lost focus, a ⏸ card is shown; a click resumes.
* **Leaving the game:** the voice and sound effects stop when the tab is hidden, the window loses focus, or the page is closed or reloaded. The current line waits and plays again when the learner comes back.

## 9. Debugging

* **QA level jumper:** the ⏭ button (top right, next to 🔊) lists every step grouped by section: Tutorial, Transition 1, Level 1, Transition 2, Level 2, Level 3. Picking one reloads the page as `index.html?step=ID`. Press ▶ and the game starts at that step, with the keypad, equation panel and progress dots set up as if the earlier steps had been played. It reloads rather than switching in place because browsers only allow speech after a tap. You can also open a link directly, e.g. `index.html?step=A3`. An unknown ID starts from the beginning. Turn the jumper off for release with `config.qaJumper: false` in `data.js`. The `?step=` link still works without the button.

* `window.__GAME_STATE` exposes the live state (`phase`, `level`, `view`, `q`, …).
* Phases: `narrate → marker → feedback → entry → feedback …`, plus `gate`.
* The flow was checked end to end with a Playwright script: all 9 questions, one wrong marker attempt, one wrong keypad attempt, the gate, and the end screen.

## 10. Known decisions / open points

* In Level 1 the water follows the marker, so the learner sees the level change as they mark it. In the tutorial the water shows the answer first, and the learner matches the marker to it.
* The CSV cells marked `#ERROR!` were filled from the same column in the rows next to them. Incorrect Animation 3 in rows 17–20 is "count steps one by one", as in rows 21–22. Inactivity Animation in row 18 is the same as row 17.
* **The VO always completes.** There's no tap-to-skip. `FX.speak()` resolves only when the speech engine has finished: on `onend`, or by polling `speechSynthesis.speaking` when Chrome drops `onend`. Learner input is locked while a hint plays.
* Stage 1 row 12 says the marker "starts above 0". It starts at +2.
* The story rows before "How to Play" are deliberately not part of the game.
* Level 1 has no equation strip: the CSV introduces the equation panel only at the Level 2 transition.
