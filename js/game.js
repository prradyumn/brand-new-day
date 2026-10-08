/* =====================================================================
   game.js — flow + interaction for "Integers: Rise and Fall"

   Flow (see CONTEXT.md for the full walkthrough):
     Start → How to Play [H1…H5, guided demo]
           → Level 1 [L1T tutorial, TR1, Q1…Q6]
           → Level 2 [teaching P1…P7, TR2, A0 tutorial, A1…A6, E2 Level Complete]
           → Level 3 [S0, R2…R6, B1…B7 keypad only]
           → Story End [Z1…Z5] → End screen

   Blur/spotlight: How to Play and the Level 1 tutorial (`guided`). From TR1
   on there is no blur and no full-size character.

   A question has up to two parts, each with its own VO, OST, correct line,
   wrong-answer ladder and inactivity line (straight from the CSV):
     lever  – learner moves the marker/lever; checked after it rests `settleMs`
     entry  – learner types the level on the keypad and presses Check
   Level 3 has only the entry part; the lever then moves by itself.
   All dialogue and on-screen text comes from data.js (the CSV).
   ===================================================================== */
(function () {
  "use strict";

  const DATA = window.GAME_DATA;
  const CFG = DATA.config;
  const $ = (id) => document.getElementById(id);

  /* ---------------- Geometry (Figma px on the 1920×1080 frame) ---------------- */
  const ZERO_Y = 570;          // y of level 0 when the view is centred on 0
  const STEP = 75;             // px between two levels
  const HALF = CFG.visibleHalfRange; // ±5 levels visible
  const CLIP_TOP = 150;        // #scaleClip top
  const WATER_TOP_MIN = 147;   // inner glass top
  const WATER_BOTTOM = 963;    // inner glass bottom
  const MARKER_H = 40;
  const LABEL_X = 1329;        // centre of the level labels (for sparkles)
  const STREAM_TOP = 70;       // #streamIn top: just inside the inlet pipe's mouth

  /* Spotlight holes for the focus layer */
  // Holes must never overlap: under evenodd an overlap cancels out and shows as blur.
  const HOLES = {
    narr:   { x: 12,   y: 6,   w: 1080, h: 160 },   // ends at x 1092, just left of the tank hole
    tank:   { x: 1094, y: 26,  w: 736,  h: 1064 },   // starts right of the narrator box; ▲ / ▼ are lifted above the glass (lever-lit)
    padTut: { x: 196,  y: 250, w: 656,  h: 716 },
    gate:   { x: 289.5, y: 460, w: 468,  h: 160 }
  };
  // A closed hole: zero size at the centre of its rect, so it shrinks into and
  // grows out of its own place (the path keeps the same shape for transitions).
  const shut = (h) => ({ x: h.x + h.w / 2, y: h.y + h.h / 2, w: 0, h: 0 });

  /* Who is speaking: banner avatar, full-size art (guided steps) and voice pitch */
  const SPEAKERS = {
    guddu:    { full: true,  pitch: 1.0 },       // full: slides in full size in guided steps (POSES)
    pari:     { full: false, pitch: 1.35 },
    narrator: { full: false, pitch: 1.05 }
  };

  /* Talking characters: frame strips where every frame is the same picture except the
     mouth (or the eyes, for a blink). `mouth` = the frame for closed / half / wide open
     (two-frame sets: closed / open); `blink` = the eyes-shut frame. lipLoop() picks the
     frame from the voice (FX.mouth). */
  const AVATARS = {
    "guddu-happy": { src: "assets/char/avatar-guddu-happy.png", frames: 4, mouth: [0, 1, 2], blink: 3 },
    "guddu-sad":   { src: "assets/char/avatar-guddu-sad.png",   frames: 2, mouth: [0, 1, 1] },
    "guddu-think": { src: "assets/char/avatar-guddu-think.png", frames: 2, mouth: [0, 1, 1] },
    "pari-happy":  { src: "assets/char/avatar-pari-happy.png",  frames: 4, mouth: [0, 1, 2], blink: 3 }
  };
  const POSES = {                                // full-size Guddu (data.js `pose`), feet on the same spot in every strip
    // tip / tipRight: where the speech bubble's tail points (beside his head, stage px) when
    // he stands on the left (over the keypad) / on the right (over the tank, mirrored)
    talk:   { src: "assets/char/guddu-talk.png",   frames: 3, mouth: [0, 1, 2], tip: [352, 352], tipRight: [1252, 352] },
    point:  { src: "assets/char/guddu-point.png",  frames: 2, mouth: [0, 1, 1], tip: [446, 352], tipRight: [1172, 344] },
    thumbs: { src: "assets/char/guddu-thumbs.png", frames: 2, mouth: [0, 1, 1], tip: [318, 346], tipRight: [1290, 346] }
  };

  /* ---------------- DOM ---------------- */
  const el = {
    stage: $("stage"), focus: $("focus"), ring0: $("ring0"), ring1: $("ring1"), ring2: $("ring2"),
    banner: $("banner"), bannerText: $("bannerText"), avatar: $("avatar"), character: $("character"),
    plate: $("plate"), plateText: $("plateText"), connector: $("connector"),
    panel: $("panel"),
    eqPanel: $("eqPanel"), eqA: $("eqA"), eqOp: $("eqOp"), eqB: $("eqB"), eqEq: $("eqEq"), eqAns: $("eqAns"),
    btnCheck: $("btnCheck"), btnClear: $("btnClear"),
    water: $("water"), streamIn: $("streamIn"), splashIn: $("splashIn"), streamOut: $("streamOut"),
    strip: $("scaleStrip"), countLine: $("countLine"),
    marker: $("marker"), btnUp: $("btnUp"), btnDown: $("btnDown"),
    fx: $("fxLayer"), confetti: $("confetti"), marked: $("markedBadge"), medal: $("medal"),
    gateBtn: $("gateBtn"), progress: $("progress"), paused: $("paused"),
    btnMute: $("btnMute"), startScreen: $("startScreen"), endScreen: $("endScreen"), hand: $("hand"),
    under: $("under"), flood: $("flood"),
    story: $("story"), shots: [...document.querySelectorAll("#story .shot")], caption: $("caption"),
    bubble: $("bubble"), hostBubble: $("hostBubble"),
    charArt: document.querySelector("#character .art"), charGlow: $("charGlow")
  };

  /* ---------------- State ---------------- */
  const S = {
    scale: 1,
    level: 2,            // marker/water level
    view: 0,             // centre level of the visible scale window
    q: null,             // current question
    part: null,          // current part of the question (q.lever or q.entry)
    area: null,          // spotlight of the current part: "tank" | "pad"
    phase: "idle",       // idle | narrate | demo | marker | entry | feedback | gate
    speaker: "guddu",
    markerEnabled: false,
    dragging: false,
    countFrom: null,     // level the dashed count line starts from
    water: null,         // fixed water level; null = water follows the marker
    entry: "",
    wrong: 0,            // wrong attempts in the current part
    gate: null,          // current transition step
    guided: false,       // spotlight/blur + character
    eqLive: false,       // equation follows the marker (Level 2 tutorial)
    labels: {}, ticks: {}, tticks: {},
    timers: { settle: null, idle: null, edge: null, pipeIn: null, pipeOut: null },
    resolveMarker: null, resolveEntry: null, resolveGate: null
  };

  window.__GAME_STATE = S; // exposed for debugging / automated tests
  // the web fonts change text widths once they arrive: fit the equation and the narrator box again
  if (document.fonts) {
    const refit = () => { fitEq(); fitText(el.bannerText, el.bannerText.textContent.length > 70 ? 28 : 32); };
    document.fonts.ready.then(refit);
    document.fonts.addEventListener && document.fonts.addEventListener("loadingdone", refit);
  }

  // QA: ?step=ID starts the game at that step (see the level jumper below)
  const START_ID = new URLSearchParams(location.search).get("step");
  const START_INDEX = Math.max(0, DATA.steps.findIndex((s) => s.id === START_ID));

  FX.lang = CFG.speechLang;
  FX.loadSfx({ fill: "assets/sfx/water-fill.mp3", drain: "assets/sfx/water-drain.mp3" });
  FX.loadMusic("assets/music/bg-loop.mp3", 0.7);   // Lyria 3 instrumental loop, mixed at −30 LUFS (voice −16): ~17 dB under the voice between lines
  // One-shots (Mixkit free licence, trimmed so each starts on its first sound — see CONTEXT.md §7)
  FX.loadShots({
    key:      { url: "assets/sfx/key.wav",      vol: 0.55, pool: 4 },  // keypad digits, ±, ⌫
    lever:    { url: "assets/sfx/lever.wav",    vol: 0.6,  pool: 3 },  // ▲ / ▼ press
    tick:     { url: "assets/sfx/tick.wav",     vol: 0.45, pool: 4 },  // each level the marker moves
    button:   { url: "assets/sfx/button.wav",   vol: 0.6 },            // Check, ▶, Start, tap to continue
    correct:  { url: "assets/sfx/correct.mp3",  vol: 0.6,  pool: 2 },  // ✓ on a right answer
    board:    { url: "assets/sfx/board.wav",    vol: 0.5,  pool: 2 },  // "Water Level Marked!" board
    confetti: { url: "assets/sfx/confetti.mp3", vol: 0.35, pool: 2 },  // confetti burst
    wrong:    { url: "assets/sfx/wrong.wav",    vol: 0.5,  pool: 2 },  // wrong marker / keypad answer
    flip:     { url: "assets/sfx/flip.wav",     vol: 0.7,  pool: 2 },  // question card flip
    splashIn: { url: "assets/sfx/splash-in.mp3", vol: 0.6, pool: 1 },  // level transition: dive in
    bubbles:  { url: "assets/sfx/bubbles.mp3",   vol: 0.5, pool: 1 },  //   underwater
    splashOut:{ url: "assets/sfx/splash-out.mp3",vol: 0.55, pool: 1 }, //   rise out
    complete: { url: "assets/sfx/complete.mp3", vol: 0.6,  pool: 1 }   // end screen
  });
  FX.rate = CFG.speechRate;

  /* =================================================================
     Stage scaling
     ================================================================= */
  /* CSS zoom where supported: a scale() transform makes Chrome capture the
     frosted-glass backdrop (focus layer, start/end screens) at the wrong size,
     so part of the game showed up mirrored behind the blur. The #viewport grid
     centres the zoomed stage. Browsers without zoom get the transform. */
  const USE_ZOOM = !!(window.CSS && CSS.supports && CSS.supports("zoom", "0.5"));
  el.stage.classList.toggle("zoomed", USE_ZOOM);
  function fitStage() {
    const W = window.innerWidth, H = window.innerHeight;
    const s = Math.min(W / 1920, H / 1080);
    S.scale = s;
    if (USE_ZOOM) el.stage.style.zoom = s;
    else el.stage.style.transform = `translate(${(W - 1920 * s) / 2}px, ${(H - 1080 * s) / 2}px) scale(${s})`;
  }
  /** On-screen px per stage px, measured (the same for zoom and transform). */
  const stageK = (r) => r.width / 1920 || S.scale;
  window.addEventListener("resize", fitStage);
  window.addEventListener("orientationchange", () => setTimeout(fitStage, 250));
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fitStage);   // phones: the URL bar showing / hiding
  // The game's art and text are not for copying: no right-click menu, no dragging, no selection
  ["contextmenu", "dragstart", "selectstart", "copy", "cut"].forEach((ev) =>
    document.addEventListener(ev, (e) => { if (!(e.target.closest && e.target.closest("input, textarea"))) e.preventDefault(); }));
  // Older browsers without `overflow: clip`: never let the stage scroll itself
  el.stage.addEventListener("scroll", () => { el.stage.scrollTop = 0; el.stage.scrollLeft = 0; });

  function toStage(e) {
    const r = el.stage.getBoundingClientRect();
    const k = stageK(r);
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  }

  /* =================================================================
     Formatting
     ================================================================= */
  const fmt = (n) => (n > 0 ? "+" + n : n < 0 ? "−" + Math.abs(n) : "0");
  // CSV equation notation: "0 + 3", "(+2) + 3", "(−2) + (−3)", "(+3) − 5"
  const termA = (n) => (n === 0 ? "0" : `(${fmt(n)})`);
  const termB = (n) => (n < 0 ? `(${fmt(n)})` : String(n));

  /* =================================================================
     Scale + water + marker rendering
     ================================================================= */
  function buildScale() {
    el.strip.innerHTML = "";
    for (let L = CFG.levelMin; L <= CFG.levelMax; L++) {
      const local = ZERO_Y - CLIP_TOP - STEP * L;
      const tick = document.createElement("div");
      tick.className = "tick" + (L === 0 ? " zero" : "");
      tick.style.top = local - 2.5 + "px";
      const tt = document.createElement("div");
      tt.className = "ttick" + (L === 0 ? " zero" : "");
      tt.style.top = local - 3 + "px";
      const lab = document.createElement("div");
      lab.className = "lab" + (L === 0 ? " zero" : "");
      lab.style.top = local - 28 + "px";
      lab.textContent = fmt(L);
      el.strip.append(tick, tt, lab);
      S.labels[L] = lab; S.ticks[L] = tick; S.tticks[L] = tt;
    }
  }

  function buildBubbles(box = el.water.querySelector(".bubbles"), n = 12, w = 340) {
    for (let i = 0; i < n; i++) {
      const b = document.createElement("span");
      b.className = "bubble";
      const size = 8 + Math.random() * 18;
      b.style.width = b.style.height = size + "px";
      b.style.left = 20 + Math.random() * w + "px";
      b.style.animationDuration = 5 + Math.random() * 6 + "s";
      b.style.animationDelay = -Math.random() * 8 + "s";
      box.appendChild(b);
    }
  }

  const levelY = (L) => ZERO_Y - STEP * (L - S.view);

  function setView(v, instant) {
    S.view = v;
    el.strip.style.transition = instant ? "none" : "";
    el.strip.style.transform = `translateY(${STEP * v}px)`;
  }

  function ensureVisible(L) {
    if (L > S.view + HALF) setView(L - HALF);
    else if (L < S.view - HALF) setView(L + HALF);
  }

  function viewFor(start) {
    if (Math.abs(start) <= HALF - 1) return 0;
    return start > 0 ? start - (HALF - 1) : start + (HALF - 1);
  }

  function render() {
    const y = levelY(S.level);
    el.marker.style.top = y - MARKER_H / 2 + "px";
    el.marker.setAttribute("aria-valuenow", S.level);
    el.marker.setAttribute("aria-valuetext", "Level " + fmt(S.level));
    const wy = S.water === null ? y : levelY(S.water);
    const top = Math.max(WATER_TOP_MIN, Math.min(WATER_BOTTOM - 4, wy));
    el.water.style.top = top + "px";
    el.water.style.height = WATER_BOTTOM - top + "px";
    el.streamIn.style.height = top - STREAM_TOP + 6 + "px";             // the inlet stream reaches the water surface
    el.splashIn.style.top = top - 6 + "px";
    for (const k in S.labels) {
      const cur = +k === S.level;
      S.labels[k].classList.toggle("current", cur);
      S.tticks[k].classList.toggle("current", cur);
    }
    if (S.countFrom !== null && S.countFrom !== S.level) {
      const a = levelY(S.countFrom), b = y;
      el.countLine.style.top = Math.min(a, b) + "px";
      el.countLine.style.height = Math.abs(a - b) + "px";
      el.countLine.classList.add("on");
    } else {
      el.countLine.classList.remove("on");
    }
  }

  let waterMoveTimer = null;
  function setLevel(L) {
    L = Math.max(CFG.levelMin, Math.min(CFG.levelMax, L));
    if (L === S.level) return false;
    const dir = Math.sign(L - S.level);
    S.level = L;
    ensureVisible(L);
    render();
    FX.sfx("tick");                       // a small bloop for every level counted
    if (S.water === null) waterFlow(dir); // water only moves when it follows the marker
    if (S.eqLive) renderEq(S.q, { moved: L - S.q.start });   // "0 + 1 → 0 + 2 → 0 + 3"
    return true;
  }

  /** Wave speed-up + the inlet/outlet pipe running while the water moves. */
  function waterFlow(dir) {
    el.water.classList.add("moving");
    clearTimeout(waterMoveTimer);
    waterMoveTimer = setTimeout(() => el.water.classList.remove("moving"), 700);
    flowPipe(dir > 0 ? "in" : "out");
    FX.sfxLoop(dir > 0 ? "fill" : "drain");
  }

  /** Fix the water at level L (null = follow the marker again). */
  function setWater(L, instant) {
    S.water = L;
    if (instant) el.water.classList.add("instant");
    render();
    if (instant) { void el.water.offsetWidth; el.water.classList.remove("instant"); }
  }

  /** Water pours from the inlet (filling) or out of the outlet (draining) while the
      level moves, and stops 0.9 s after the last step. The pipes themselves never change. */
  function flowPipe(which) {
    const stream = which === "in" ? el.streamIn : el.streamOut;
    const key = which === "in" ? "pipeIn" : "pipeOut";
    if (!stream.classList.contains("on")) {
      stream.classList.add("reset");                 // a stream that was stopping goes back to the pipe at once
      stream.classList.remove("off");
      void stream.getBoundingClientRect();
      stream.classList.remove("reset");
      stream.classList.add("on");                    // … and pours again
      if (which === "in") el.splashIn.classList.add("on");
    }
    clearTimeout(S.timers[key]);
    S.timers[key] = setTimeout(() => {
      stream.classList.replace("on", "off");         // the tail drops away
      if (which === "in") el.splashIn.classList.remove("on");
    }, 900);
  }

  /** Move the marker one level at a time. `zeroGlow`: 0 lights up as it is crossed. */
  async function animateTo(L, stepMs = 240, zeroGlow = false) {
    while (S.level !== L) {
      setLevel(S.level + Math.sign(L - S.level));
      if (zeroGlow && S.level === 0) { pulseLevel(0); S.labels[0].classList.add("lit"); setTimeout(() => S.labels[0].classList.remove("lit"), 1400); }
      await FX.sleep(stepMs);
    }
  }

  function jumpTo(L) {
    // instant reposition (used between questions when nothing should animate)
    el.water.classList.add("instant");
    el.marker.style.transition = "none";
    S.level = L;
    setView(viewFor(L), true);
    render();
    requestAnimationFrame(() => {
      el.water.classList.remove("instant");
      el.marker.style.transition = "";
      el.strip.style.transition = "";
    });
  }

  /* =================================================================
     Focus layer (frosted glass + spotlight holes)
     ================================================================= */
  function rr({ x, y, w, h }, r = 28) {
    r = Math.min(r, w / 2, h / 2);
    return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  }
  function placeRing(ring, h, show) {
    ring.style.left = h.x + "px"; ring.style.top = h.y + "px";
    ring.style.width = h.w + "px"; ring.style.height = h.h + "px";
    ring.classList.toggle("on", !!show);
  }
  function focusOn(key) {
    if (key && !S.guided) key = null;   // the spotlight is only used in guided steps
    if (!key) {
      S.focusKey = null; S.focusOpen = null;
      el.stage.classList.remove("lever-lit");
      el.focus.classList.remove("on");
      el.ring0.classList.remove("on"); el.ring1.classList.remove("on"); el.ring2.classList.remove("on");
      return;
    }
    // The narrator box stays lit the whole time so the instruction can always be read.
    // `key` picks what is lit beside it; the tank and keypad holes each have their own
    // slot and open/close in place, so a hole never slides across the narrator box.
    const sets = {
      narr: {},
      tank: { tank: HOLES.tank },
      pad: { pad: HOLES.padTut },
      padTank: { pad: HOLES.padTut, tank: HOLES.tank },   // How to Play step 5: "Both glow"
      gate: { pad: HOLES.gate }
    };
    const open = sets[key];
    if (open.pad) S.padHole = open.pad;
    const tank = open.tank || shut(HOLES.tank);
    const pad = open.pad || shut(S.padHole || HOLES.padTut);
    // ▲ / ▼ poke out left of the tank spotlight: raise them above the glass so they stay sharp and pressable
    el.stage.classList.toggle("lever-lit", !!open.tank);
    const host = el.stage.classList.contains("host");      // Guddu's line is in his bubble: the narrator box is away
    const narr = host ? shut(HOLES.narr) : HOLES.narr;
    el.focus.style.clipPath = `path(evenodd, "M0 0H1920V1080H0Z ${rr(narr)} ${rr(tank)} ${rr(pad)}")`;
    el.focus.style.webkitClipPath = el.focus.style.clipPath;
    el.focus.classList.add("on");
    const was = S.focusOpen || {};
    if (key === "narr" && S.focusKey !== key) FX.flash(el.ring0, "sweep", 1700);   // a new line: light sweeps the narrator box
    if (open.tank && !was.tank) FX.flash(el.ring1, "sweep", 1700);
    if (open.pad && was.pad !== open.pad) FX.flash(el.ring2, "sweep", 1700);
    S.focusKey = key; S.focusOpen = open;
    placeRing(el.ring0, narr, !host);
    placeRing(el.ring1, tank, !!open.tank);
    placeRing(el.ring2, pad, !!open.pad);
  }

  /* =================================================================
     Narrator
     ================================================================= */
  function setSpeaker(who) {
    S.speaker = SPEAKERS[who] ? who : "guddu";
  }
  function setAvatar(mood) {
    const who = S.speaker;
    el.avatar.classList.toggle("none", who === "narrator");
    if (who === "narrator") return;
    const set = AVATARS[who === "pari" ? "pari-happy" : `guddu-${mood || "happy"}`] || AVATARS["guddu-happy"];
    if (el.avatar.sprite !== set) {
      setSprite(el.avatar, set);
      FX.flash(el.avatar, "swap", 600);
    }
  }
  /** Show a frame strip on a node (background-image, one frame wide). */
  function setSprite(node, set) {
    node.sprite = set; node.frame = -1;
    node.style.backgroundImage = `url(${set.src})`;
    node.style.backgroundSize = `${set.frames * 100}% 100%`;
    showFrame(node, 0);
  }
  function showFrame(node, f) {
    if (node.frame === f) return;
    node.frame = f;
    node.style.backgroundPositionX = node.sprite.frames > 1 ? (f / (node.sprite.frames - 1)) * 100 + "%" : "0";
  }
  /* Lip-sync: every frame, the mouth follows the voice (closed / half / wide). The level is
     smoothed (opens fast, closes a little slower), each shape is held at least 85 ms and the
     mouth moves one step at a time (never closed ↔ wide in one jump), so it reads as speech,
     not flicker. Between words the avatars blink now and then. */
  const lip = { k: 0, lvl: 0, since: 0, blinkAt: 0, blinkUntil: 0 };
  function lipLoop(now) {
    const m = FX.mouth();
    lip.lvl += (m - lip.lvl) * (m > lip.lvl ? .7 : .5);
    const up = lip.k === 0 ? .36 : .7, down = lip.k === 2 ? .62 : .26;  // a little hysteresis (tuned on all clips: ~9 changes/s, 25% closed · 32% half · 43% wide)
    const want = lip.lvl > up ? lip.k + 1 : lip.lvl < down ? lip.k - 1 : lip.k;
    if (want !== lip.k && now - lip.since > 85) { lip.k = Math.max(0, Math.min(2, want)); lip.since = now; }
    const av = el.avatar.sprite;
    if (av) {
      let f = av.mouth[lip.k];
      if (!lip.k && av.blink != null) {
        if (now > lip.blinkAt) { lip.blinkUntil = now + 130; lip.blinkAt = now + 2600 + Math.random() * 2800; }
        if (now < lip.blinkUntil) f = av.blink;
      }
      showFrame(el.avatar, f);
    }
    const ch = el.charArt.sprite;
    if (ch && el.character.classList.contains("in")) showFrame(el.charArt, ch.mouth[lip.k]);
    requestAnimationFrame(lipLoop);
  }
  function setBanner(text, mood) {
    el.bannerText.textContent = text;
    el.bannerText.classList.toggle("long", text.length > 70);
    fitText(el.bannerText, text.length > 70 ? 28 : 32);     // long lines (and Hindi) never spill out of the box
    setAvatar(mood);
    FX.flash(el.banner, "speak", 400);
  }
  const speak = (text) => FX.speak(text, { pitch: SPEAKERS[S.speaker].pitch, speaker: S.speaker });   // speaker picks the recorded clip
  /** Feedback line (always Guddu Bhaiya). */
  async function say(text, mood) {
    setSpeaker("guddu");
    setBanner(text, mood);
    el.character.classList.add("talk");
    await speak(text);
    el.character.classList.remove("talk");
  }
  /** Where a line looks: the spotlight the feedback animation plays in (see runFx), else the part's area. */
  const fxArea = (fx) => (fx ? (PAD_FX.has(fx) ? "pad" : "tank") : S.area);
  /** Feedback line in a guided step. `look` is the part of the screen the line talks about
      ("Find 0 on the scale" → tank, "Enter 0 on the screen" → pad): it stays lit beside the
      narrator box, so Guddu never points at something blurred. Without it only the narrator
      box is lit. Afterwards the spotlight returns to whatever was highlighted before. */
  async function sayFocused(text, mood, look) {
    const back = S.focusKey;
    focusOn(look || "narr");
    if (look) FX.flash(el.ring0, "sweep", 1700);
    await say(text, mood);
    if (back && S.focusKey === (look || "narr")) focusOn(back);
  }

  /** Narrator moment. In guided steps the glass blurs everything except the narrator box
      and `look` (the tank or keypad the line is about), and the speaker slides in full size. */
  async function narrate(text, { speaker = "guddu", mood = "happy", pose = "talk", look = null } = {}) {
    S.phase = "narrate";
    setSpeaker(speaker);
    setBanner(text, mood);
    const full = S.guided && SPEAKERS[S.speaker].full;
    if (full) {
      const set = POSES[pose] || POSES.talk;          // a gesture that fits the line (data.js `pose`)
      if (el.charArt.sprite !== set) setSprite(el.charArt, set);
      // He stands over what is NOT lit and points at what is: on keypad lines he moves in
      // front of the (blurred) tank, mirrored, so the keypad stays completely visible.
      const right = look === "pad";
      el.character.classList.toggle("right", right);
      el.charGlow.classList.toggle("right", right);
      el.character.classList.add("in", "talk");
      el.stage.classList.add("host");               // one Guddu at a time: his line goes in the story's speech bubble beside him
      placeBubble({ shape: "wide", tail: "left", w: 560, tip: right ? set.tipRight : set.tip }, text, el.hostBubble);
      setTimeout(() => el.stage.classList.contains("host") && el.hostBubble.classList.add("on"), 380);   // as he lands
    }
    focusOn(look || "narr");
    if (look && S.guided) FX.flash(el.ring0, "sweep", 1700);   // a new line: light sweeps the narrator box
    await FX.sleep(350);
    await speak(text);              // always plays to the end (no tap-to-skip)
    el.character.classList.remove("talk");
    el.hostBubble.classList.remove("on");
    await FX.sleep(250);
    el.character.classList.remove("in");
    el.stage.classList.remove("host");
  }

  /* =================================================================
     Inactivity (CSV "Inactivity VO / Instruction" + "Inactivity Animation")
     ================================================================= */
  function stopIdle() { clearTimeout(S.timers.idle); }
  function resetIdle() {
    stopIdle();
    if (S.phase !== "marker" && S.phase !== "entry" && S.phase !== "gate") return;
    S.timers.idle = setTimeout(onIdle, CFG.inactivityMs);
  }
  async function onIdle() {
    const q = S.q, p = S.part;
    if ((S.phase === "marker" || S.phase === "entry") && q && p && p.idle) {
      const phase = S.phase;
      S.phase = "feedback";
      setMarkerEnabled(false);
      await sayFocused(p.idle.text, "think", fxArea(p.idle.fx));
      await runFx(p.idle.fx, q, p.idle);
      setBanner(p.ost, "happy");
      S.phase = phase;
      if (phase === "marker") setMarkerEnabled(true);
    } else if (S.phase === "gate" && S.gate) {
      const step = S.gate;
      await sayFocused(step.idle.text, "happy");
      if (step.idle.fx === "pulseGate") FX.flash(el.gateBtn, "nudge", 3700);      // "Start button … gently pulses."
      if (step.idle.fx === "pulseEqPanel") FX.flash(el.eqPanel, "nudge", 3700);   // "Equation panel gently pulses."
    }
    resetIdle();
  }

  /* =================================================================
     Marker interaction (drag + ▲/▼ + keyboard)
     ================================================================= */
  function setMarkerEnabled(on) {
    S.markerEnabled = on;
    el.marker.classList.toggle("disabled", !on);
    el.btnUp.disabled = el.btnDown.disabled = !on;
  }

  function afterMove() {
    resetIdle();
    clearTimeout(S.timers.settle);
    if (S.phase === "marker" && !S.dragging) S.timers.settle = setTimeout(evaluateMarker, CFG.settleMs);
  }

  el.marker.addEventListener("pointerdown", (e) => {
    if (!S.markerEnabled) return;
    e.preventDefault(); e.stopPropagation();
    S.dragging = true;
    el.marker.classList.add("dragging");
    el.marker.setPointerCapture(e.pointerId);
    clearTimeout(S.timers.settle);
    resetIdle();
  });
  el.marker.addEventListener("pointermove", (e) => {
    if (!S.dragging) return;
    const p = toStage(e);
    const raw = S.view + (ZERO_Y - p.y) / STEP;
    let L = Math.round(raw);
    L = Math.max(S.view - HALF, Math.min(S.view + HALF, L));
    setLevel(L);
    // Edge auto-scroll: hold the marker past the top/bottom mark to keep going
    const dir = raw > S.view + HALF + 0.45 ? 1 : raw < S.view - HALF - 0.45 ? -1 : 0;
    if (dir && !S.timers.edge) {
      S.timers.edge = setInterval(() => {
        if (!S.dragging) return;
        const next = S.level + dir;
        if (next < CFG.levelMin || next > CFG.levelMax) return;
        setLevel(next);
      }, 420);
    } else if (!dir && S.timers.edge) {
      clearInterval(S.timers.edge); S.timers.edge = null;
    }
  });
  const endDrag = () => {
    if (!S.dragging) return;
    S.dragging = false;
    el.marker.classList.remove("dragging");
    clearInterval(S.timers.edge); S.timers.edge = null;
    afterMove();
  };
  el.marker.addEventListener("pointerup", endDrag);
  el.marker.addEventListener("pointercancel", endDrag);

  function step(dir) {
    if (!S.markerEnabled) return;
    pressLever(dir > 0 ? el.btnUp : el.btnDown);
    if (setLevel(S.level + dir)) afterMove();
  }
  /** Press feedback on ▲ / ▼: squash, brighten and a ripple ring. */
  function pressLever(btn) { FX.flash(btn, "tap", 520); FX.sfx("lever"); }
  el.btnUp.addEventListener("pointerdown", (e) => { e.stopPropagation(); step(1); });
  el.btnDown.addEventListener("pointerdown", (e) => { e.stopPropagation(); step(-1); });
  el.marker.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") { e.preventDefault(); step(1); }
    if (e.key === "ArrowDown") { e.preventDefault(); step(-1); }
  });

  /* =================================================================
     Marker checking + feedback
     ================================================================= */
  function evaluateMarker() {
    const q = S.q;
    if (S.phase !== "marker" || !q) return;
    if (S.level === q.target) {
      S.resolveMarker && S.resolveMarker();
    } else if (S.level !== q.start) {
      markerWrong();
    }
  }

  async function markerWrong() {
    const q = S.q, p = S.part;
    S.wrong++;
    FX.flash(el.marker, "shake", 500);
    FX.sfx("wrong");
    if (!p.wrong) {                    // CSV gives no incorrect feedback (tutorial): shown, not spoken
      FX.badge(el.fx, 1500, Math.max(200, Math.min(880, levelY(S.level))), false);
      resetIdle();
      return;
    }
    S.phase = "feedback";
    stopIdle();
    setMarkerEnabled(false);
    const fb = p.wrong[Math.min(S.wrong, p.wrong.length) - 1];
    await sayFocused(fb.text, "sad", fxArea(fb.fx));
    await runFx(fb.fx, q, fb);
    setBanner(p.ost, "happy");
    S.phase = "marker";
    setMarkerEnabled(true);
    resetIdle();
  }

  /* Feedback / inactivity animations named in data.js (fx field).
     Each one does only what its CSV "Incorrect Animation" / "Inactivity Animation"
     cell describes. The marker goes back to the start only for "return". */
  const PAD_FX = new Set(["pulseKeys", "pulsePadKeys", "pulsePad"]);
  async function runFx(fx, q, opts = {}) {
    const dir = Math.sign(q.target - q.start) || 1;
    const next = q.start + dir;                      // first step toward the target
    const signKey = q.target > 0 ? "+" : q.target < 0 ? "-" : null;
    // Guided (Level 1 tutorial): move the spotlight to where the animation plays
    if (S.guided) focusOn(PAD_FX.has(fx) ? "pad" : "tank");
    switch (fx) {
      /* ----- lever / scale ----- */
      case "return":                                 // "Marker returns to its starting position."
        if (S.level !== q.start) await animateTo(q.start, 200);
        break;
      case "pulseZero":                              // "The 0 mark gently pulses."
        pulseLevel(0);
        await FX.sleep(1400);
        break;
      case "nudge": {                                // "Marker gives a small nudge towards 0."
        const toward = Math.sign(q.target - S.level) || dir;
        const px = -toward * 34;
        el.marker.animate(
          [{ transform: "translateY(0)" }, { transform: `translateY(${px}px)` }, { transform: "translateY(0)" },
           { transform: `translateY(${px * 0.6}px)` }, { transform: "translateY(0)" }],
          { duration: 1300, easing: "ease-in-out" }
        );
        await FX.sleep(1300);
        break;
      }
      case "glowUp":                                 // "Up arrow briefly glows."
        FX.flash(el.btnUp, "glow", 3000); await FX.sleep(1500); break;
      case "glowDown":                               // "Down arrow briefly glows."
        FX.flash(el.btnDown, "glow", 3000); await FX.sleep(1500); break;
      case "pulseMarkerScale": {                     // "Marker and water-level scale pulse."
        pulseMarker();
        for (let L = Math.max(CFG.levelMin, S.view - HALF); L <= Math.min(CFG.levelMax, S.view + HALF); L++) pulseLevel(L);
        await FX.sleep(1500); break;
      }
      case "pulseMarkerZero":                        // "Marker and 0 pulse."
        pulseMarker(); pulseLevel(0);
        await FX.sleep(1500); break;
      case "arrowCount":                             // "Up arrow glows. +1 → +2 → +3 → +4 highlight one by one."
        FX.flash(dir > 0 ? el.btnUp : el.btnDown, "glow", 3000);
        await countPath(q.start, q.target);
        break;
      case "glowDirUp":                              // "Upward direction glows."
        await glowDirection(q.start, 1); break;
      case "glowDirDown":                            // "Downward direction glows."
        await glowDirection(q.start, -1); break;
      case "pulseArrowNext":                         // "Up arrow and +1 pulse." / "+5 and down arrow pulse."
        FX.flash(dir > 0 ? el.btnUp : el.btnDown, "glow", 3000); pulseLevel(next);
        await FX.sleep(1500); break;
      case "pulseMarkerNext":                        // "Lever and +3 gently pulse."
        pulseMarker(); pulseLevel(next);
        await FX.sleep(1500); break;
      case "countSteps":                             // "+3, +4, +5 highlight one by one."
        await countPath(q.start, q.target, !!opts.withStart);
        break;
      case "pulseStart":                             // "Starting level +2 pulses."
        pulseLevel(q.start);
        await FX.sleep(1500); break;
      /* ----- keypad part: pointing at the answer ----- */
      case "pulseTarget":                            // "0 on the scale pulses."
        pulseLevel(q.target);
        await FX.sleep(1500); break;
      case "pulseMarker":                            // "Marker at +2 pulses."
        pulseMarker();
        await FX.sleep(1500); break;
      case "glowMarker":                             // "Marker at 0 glows."
        FX.flash(el.marker, "glowing", 2800);
        await FX.sleep(1500); break;
      case "glowTarget":                             // "+2 on the scale glows."
        S.labels[q.target].classList.add("lit");
        await FX.sleep(1800);
        S.labels[q.target].classList.remove("lit"); break;
      case "pulseKeys":                              // "+ and 2 buttons pulse." / "0 button on the dial pulses."
        answerKeys(q.target).forEach((k) => FX.flash(k, "keypulse", 2800));
        await FX.sleep(1500); break;
      case "pulsePadKeys":                           // "Dial and 0 button gently pulse."
        FX.flash(el.panel, "nudge", 2600);
        answerKeys(q.target).forEach((k) => FX.flash(k, "keypulse", 2800));
        await FX.sleep(1500); break;
      case "pulsePad":                               // "Dial pad gently pulses."
        FX.flash(el.panel, "nudge", 2600);
        await FX.sleep(1500); break;
      case "pulseTargetPad":                         // "+3 on the scale and dial pad gently pulse."
        pulseLevel(q.target); FX.flash(el.panel, "nudge", 2600);
        await FX.sleep(1500); break;
      case "pulseTargetSign":                        // "+7 on the scale and + button pulse."
        pulseLevel(q.target);
        if (signKey) FX.flash(keyNode(signKey), "keypulse", 2800);
        await FX.sleep(1500); break;
    }
    if (S.guided && S.area) focusOn(S.area);
  }

  const keyNode = (k) => document.querySelector(`.key[data-k="${k}"]`);
  /** The keys that type an answer: sign (none for 0) + digits. */
  function answerKeys(n) {
    const keys = n === 0 ? [] : [n > 0 ? "+" : "-"];
    return keys.concat([...String(Math.abs(n))]).map(keyNode);
  }

  /** Pulse one level of the scale (label + both ticks). */
  function pulseLevel(L) {
    [S.labels[L], S.ticks[L], S.tticks[L]].forEach((n) => n && FX.flash(n, "pulse", 2800));
  }
  function pulseMarker() {
    el.marker.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.22)" }, { transform: "scale(1)" }],
      { duration: 900, iterations: 3, easing: "ease-in-out" }
    );
  }

  /** A glow that travels along the scale from `from` in direction `dir`. */
  async function glowDirection(from, dir, hold = 1500) {
    const levels = [];
    for (let L = from + dir; Math.abs(L - S.view) <= HALF && L >= CFG.levelMin && L <= CFG.levelMax; L += dir) levels.push(L);
    for (const L of levels) {
      [S.labels[L], S.ticks[L]].forEach((n) => n.classList.add("dirglow"));
      await FX.sleep(90);
    }
    await FX.sleep(hold);
    levels.forEach((L) => [S.labels[L], S.ticks[L]].forEach((n) => n.classList.remove("dirglow")));
  }

  /** Highlight each level from `from` toward `to` one by one (optionally the start mark first). */
  async function countPath(from, to, withStart = false, onStep = null) {
    const dir = Math.sign(to - from);
    const path = [];
    for (let L = withStart ? from : from + dir; L !== to + dir; L += dir) path.push(L);
    // make sure the whole path is visible
    ensureVisible(to); ensureVisible(from); render();
    await FX.sleep(300);
    for (const L of path) {
      const lab = S.labels[L];
      if (!lab) continue;
      lab.classList.add("lit");
      if (L !== from) FX.sparkle(el.fx, LABEL_X, levelY(L), 6, 50);
      if (onStep) onStep(path.indexOf(L) + 1);
      await FX.sleep(520);
    }
    await FX.sleep(700);
    path.forEach((L) => S.labels[L] && S.labels[L].classList.remove("lit"));
    ensureVisible(S.level); render();
  }

  /* =================================================================
     Number plate + keypad
     ================================================================= */
  function setPlate(text, flash) {
    el.plateText.textContent = text;
    if (flash) FX.flash(el.plate, "flash", 1000);
  }
  function showPlate() {
    if (!el.plate.classList.contains("hidden")) return;
    el.plate.classList.remove("hidden");
    FX.flash(el.plate, "pop", 700);
  }
  function showPanel() {
    el.connector.classList.remove("hidden");
    if (el.panel.classList.contains("hidden")) {
      el.panel.classList.remove("hidden");
      FX.flash(el.panel, "intro", 800);
    }
  }
  function setMode(mode) {
    const lvl = mode === "lvl";
    [el.panel, el.plate, el.connector, el.marked].forEach((n) => n.classList.toggle("lvl", lvl));
  }

  /* Equation panel (Level 2/3): "a op b = ?" in the CSV's notation.
     { moved } shows the live form while the lever moves ("0 + 1"),
     { answer } completes it ("0 + 3 = +3"). */
  function renderEq(q, { moved = null, answer = null } = {}) {
    const e = q.eq, live = moved !== null && moved !== 0;
    eqParts().forEach((n) => n.classList.remove("eqhide"));
    el.eqA.textContent = termA(e.a);
    el.eqOp.textContent = e.op;
    el.eqB.textContent = termB(live ? moved : e.b);
    el.eqEq.classList.toggle("gone", live);
    el.eqAns.classList.toggle("gone", live);
    el.eqAns.textContent = answer !== null ? fmt(answer) : "?";
    fitEq();
  }
  /** Level 2 teaching rows: the row's OST equation, written as the CSV writes it
      ("1 + 2 = ?", "3 − 5 = −2"). The panel only ever shows equations. */
  async function showTeachEq(text, { build = false } = {}) {
    const m = /^(.+?) ([+−]) (.+?) = (.+)$/.exec(text);
    if (!m) return;
    if (build) {                                   // written piece by piece as the line is spoken (buildTeachEq)
      const shown = !el.eqPanel.classList.contains("hidden");
      if (shown) { eqHide(eqParts()); await FX.sleep(280); }      // the last example fades out first
      [el.eqA.textContent, el.eqOp.textContent, el.eqB.textContent, el.eqAns.textContent] = [m[1], m[2], m[3], m[4]];
      el.eqEq.classList.remove("gone"); el.eqAns.classList.remove("gone");
      eqHide(eqParts(), true);
      if (!shown) showEqPanel();
      fitEq();
      return;
    }
    eqParts().forEach((n) => n.classList.remove("eqhide"));
    const was = el.eqPanel.textContent;
    el.eqA.textContent = m[1]; el.eqOp.textContent = m[2]; el.eqB.textContent = m[3];
    el.eqEq.classList.remove("gone"); el.eqAns.classList.remove("gone");
    el.eqAns.textContent = m[4];
    if (el.eqPanel.classList.contains("hidden")) showEqPanel();
    else if (was !== el.eqPanel.textContent) FX.flash(el.eqPanel, "complete", 1000);
    fitEq();
  }
  /** Keep the equation inside the strip: shrink the font only if it would overflow. */
  /** Keep the equation cards inside the strip's cream area, in width and height: shrink the
      font (the cards are sized in em, so they shrink with it). Runs on every change and again
      when the web fonts arrive (measured with a fallback font, the line would be too narrow). */
  function fitEq() {
    const p = el.eqPanel;
    p.style.fontSize = "";
    if (p.classList.contains("hidden")) return;
    const cs = getComputedStyle(p);
    const gap = parseFloat(cs.columnGap) || 0;
    const roomW = p.clientWidth - 44, roomH = p.clientHeight - 8;    // clear of the strip's gold rim (it is thicker at the sides)
    // centred flex content overflows on both sides, so add up the parts (layout px, unaffected by the stage scale)
    const parts = [...p.children].filter((n) => n.offsetWidth > 0);
    let fs = parseFloat(cs.fontSize);
    for (let i = 0; i < 16; i++) {
      const w = parts.reduce((sum, n) => sum + n.offsetWidth, 0) + gap * (parts.length - 1);
      const h = Math.max(0, ...parts.map((n) => n.offsetHeight));
      if (w <= roomW && h <= roomH) break;
      fs = Math.max(18, Math.floor(fs * Math.min(1, roomW / w, roomH / h)) - (i ? 1 : 0));
      p.style.fontSize = fs + "px";
    }
  }
  /** Shrink a text box's font until its text fits (the box keeps its size). */
  function fitText(node, max, min = 18) {
    node.style.fontSize = max + "px";
    for (let fs = max; fs > min && (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1); fs--)
      node.style.fontSize = fs - 1 + "px";
  }
  /* Building the equation in step with the voice-over: pieces start hidden
     (.eqhide keeps their space, so nothing shifts) and pop in on their word. */
  const eqParts = () => [el.eqA, el.eqOp, el.eqB, el.eqEq, el.eqAns];
  function eqHide(parts, instant = false) {
    parts.forEach((n) => {
      if (instant) n.style.transition = "none";
      n.classList.add("eqhide");
      if (instant) { void n.offsetWidth; n.style.transition = ""; }
    });
  }
  function eqShow(...parts) {
    parts.forEach((n) => { n.classList.remove("eqhide"); FX.flash(n, "eqpop", 500); });
    FX.sfx("tick");
  }
  /** Where `word` falls in a spoken line, 0…1: its share of the text, plus a
      little for the pause at each , . ! ? (the clips pause there). */
  function wordAt(text, word) {
    const i = text.indexOf(word);
    if (i < 0) return 0;
    const w = (t) => t.length + 6 * (t.match(/[,.!?](\s|$)/g) || []).length;
    return w(text.slice(0, i)) / w(text);
  }
  /** Wait until the voice reaches `word` in `text` (gives up if the line never plays). */
  async function untilWord(text, word) {
    const at = wordAt(text, word), until = performance.now() + FX.readTime(text) * 2 + 4000;
    while (FX.progress(text) < at && performance.now() < until) await FX.sleep(40);
  }

  /** Level 2 teaching example (P3, P5): "If the water level is at +1" → 1,
      "and rises" → +, "by 2 levels" → the levels light one by one and the
      number counts 1, 2 with them, then "= ?". */
  async function buildTeachEq(step) {
    const b = step.build, vo = step.vo, n = el.eqB.textContent;
    await untilWord(vo, b.a);
    eqShow(el.eqA); pulseLevel(step.from);
    await untilWord(vo, b.op);
    eqShow(el.eqOp);
    await untilWord(vo, b.b);
    await countPath(step.from, step.to, false, (k) => {
      el.eqB.textContent = String(k); fitEq();
      el.eqB.classList.remove("eqhide"); FX.flash(el.eqB, "eqpop", 500);
    });
    el.eqB.textContent = n; fitEq();
    eqShow(el.eqEq, el.eqAns);
    await FX.sleep(400);
  }
  /** Level 2/3 question: the start level is up with the question, then the sign
      on "rises" / "goes up" / "goes down", the number on "3 levels", then "= ?". */
  async function buildQuestionEq(q, vo) {
    const cues = DATA.cues || { dir: "rises|goes up|goes down", levels: "{n} levels" };   // Hindi: js/lang-hi.js
    const dir = cues.dir && new RegExp(cues.dir).exec(vo);
    if (dir) await untilWord(vo, dir[0]);
    if (cues.dir) eqShow(el.eqOp);
    await untilWord(vo, cues.levels.replace("{n}", Math.abs(q.eq.b)));
    if (!cues.dir) eqShow(el.eqOp);                      // Hindi says the number first: the sign comes with it
    eqShow(el.eqB);
    await FX.sleep(450);
    eqShow(el.eqEq, el.eqAns);
  }

  function completeEq(q) {                        // "Equation completes: (+2) + 3 = +5."
    renderEq(q, { answer: q.target });
    FX.flash(el.eqPanel, "complete", 1000);
  }
  function showEqPanel() {
    el.eqPanel.classList.remove("hidden");
    FX.flash(el.eqPanel, "appear", 900);
    fitEq();
  }
  function entryDisplay() {
    setPlate(S.entry === "" ? "?" : S.entry.replace("-", "−"));
  }

  function pressKey(k) {
    if (S.phase !== "entry") return;
    resetIdle();
    applyKey(k);
  }
  function applyKey(k) {
    FX.sfx("key");
    let sign = /^[+-]/.test(S.entry) ? S.entry[0] : "";
    let digits = S.entry.replace(/^[+-]/, "");
    if (k === "+" || k === "-") sign = k;
    else if (/\d/.test(k)) {
      if (digits === "0") digits = k;
      else if (digits.length < CFG.maxDigits) digits += k;
    }
    S.entry = sign + digits;
    entryDisplay();
  }
  function backspace() {
    if (S.phase !== "entry") return;
    resetIdle();
    FX.sfx("key", 0.8);
    S.entry = S.entry.slice(0, -1);
    entryDisplay();
  }
  function checkEntry() {
    if (S.phase !== "entry") return;
    resetIdle();
    FX.sfx("button");
    const m = /^([+-]?)(\d+)$/.exec(S.entry);
    if (!m) { FX.flash(el.plate, "shake", 500); return; }    // nothing to check yet
    const val = (m[1] === "-" ? -1 : 1) * parseInt(m[2], 10);
    // 0 has no sign; positive answers need "+" (CSV: "presses + and 2")
    const signOk = val === 0 || !(CFG.requireSignForPositive && val > 0 && m[1] !== "+");
    if (val === S.q.target && signOk) S.resolveEntry && S.resolveEntry();
    else entryWrong();
  }
  /** Wrong keypad answer: the CSV "Incorrect Feedback 1/2/3" ladder for the keypad row
      (the tutorials of Level 2 and 3 have none: shown, not spoken). */
  async function entryWrong() {
    const q = S.q, p = S.part;
    S.wrong++;
    FX.sfx("wrong");
    FX.flash(el.plate, "shake", 500);
    const pp = stagePt(el.plate);
    FX.badge(el.fx, pp.x + 250, pp.y, false);                     // ✗ on the display's right edge
    S.entry = "";
    entryDisplay();
    if (!p.wrong) { resetIdle(); return; }
    S.phase = "feedback";
    stopIdle();
    const fb = p.wrong[Math.min(S.wrong, p.wrong.length) - 1];
    await sayFocused(fb.text, "sad", fxArea(fb.fx));
    await runFx(fb.fx, q, fb);
    setBanner(p.ost, "happy");
    S.phase = "entry";
    resetIdle();
  }

  document.querySelectorAll(".key").forEach((b) =>
    b.addEventListener("pointerdown", (e) => { e.stopPropagation(); pressKey(b.dataset.k); })
  );
  el.btnClear.addEventListener("pointerdown", (e) => { e.stopPropagation(); backspace(); });
  el.btnCheck.addEventListener("pointerdown", (e) => { e.stopPropagation(); checkEntry(); });
  window.addEventListener("keydown", (e) => {
    if (S.phase !== "entry") return;
    if (/^[0-9]$/.test(e.key)) pressKey(e.key);
    else if (e.key === "+" || e.key === "-") pressKey(e.key);
    else if (e.key === "Backspace") backspace();
    else if (e.key === "Enter") checkEntry();
  });

  /* =================================================================
     How to Play demo hand — shows the interaction; nothing waits for input
     ================================================================= */
  function stagePt(node, fx = 0.5, fy = 0.5) {
    const r = node.getBoundingClientRect(), st = el.stage.getBoundingClientRect();
    const k = stageK(st);
    return { x: (r.left - st.left + r.width * fx) / k, y: (r.top - st.top + r.height * fy) / k };
  }
  async function handTo(x, y, ms = 650) {
    if (!el.hand.classList.contains("on")) {        // first appearance: slide in from below-right
      el.hand.style.transition = "none";
      el.hand.style.left = x + 90 + "px"; el.hand.style.top = y + 170 + "px";
      void el.hand.offsetWidth;
      el.hand.style.transition = "";
      el.hand.classList.add("on");
    }
    el.hand.style.left = x + "px"; el.hand.style.top = y + "px";
    await FX.sleep(ms);
  }
  const handHide = () => el.hand.classList.remove("on", "flip");
  async function handTap(node) {
    const p = stagePt(node);
    await handTo(p.x, p.y);
    FX.flash(el.hand, "tap", 400);
    node.classList.add("down");
    await FX.sleep(200);
    node.classList.remove("down");
    await FX.sleep(350);
  }
  const MARKER_GRIP_X = 1152;                      // stage x of the marker's grip
  /** The hand drags the marker to level `to`. */
  async function demoDrag(to) {
    handHide(); await FX.sleep(200);
    await handTo(MARKER_GRIP_X, levelY(S.level));
    FX.flash(el.hand, "tap", 400);
    el.marker.classList.add("held");
    await FX.sleep(450);
    const dir = Math.sign(to - S.level);
    el.hand.style.transition = "top .45s var(--ease-out), opacity .3s";  // same glide as the marker
    while (S.level !== to) {
      setLevel(S.level + dir);
      el.hand.style.top = levelY(S.level) + "px";
      await FX.sleep(750);
    }
    el.hand.style.transition = "";
    el.marker.classList.remove("held");
    await FX.sleep(400);
    handHide();
    await FX.sleep(300);
  }
  /** The hand taps the green ▲ (dir 1) or red ▼ (dir −1) button `times` times. */
  async function demoTap(dir, times = 1) {
    const btn = dir > 0 ? el.btnUp : el.btnDown;
    if (el.hand.classList.contains("flip") !== dir < 0) { handHide(); await FX.sleep(300); }
    el.hand.classList.toggle("flip", dir < 0);      // point down from above at ▼ (it sits at the stage's bottom edge)
    const p = stagePt(btn, 0.5, dir > 0 ? 0.55 : 0.42);
    await handTo(p.x, p.y);
    for (let i = 0; i < times; i++) {
      FX.flash(el.hand, "tap", 400);
      pressLever(btn);
      setLevel(S.level + dir);
      await FX.sleep(900);
    }
  }

  /* =================================================================
     Transitions
       · question → question (same level): card flip of the display + equation
       · level → level: dive into the tank (see diveWipe)
     ================================================================= */
  const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FLIP = (deg) => ({ transform: `perspective(900px) rotateX(${deg}deg)` });

  async function flipCards(swap) {
    const cards = [el.plate, el.eqPanel].filter((n) => !n.classList.contains("hidden") && !n.classList.contains("away"));
    if (!cards.length || REDUCED) { swap(); return; }
    FX.sfx("flip");
    const anims = [];
    await Promise.all(cards.map((c, i) => {
      const a = c.animate([FLIP(0), FLIP(90)], { duration: 260, delay: i * 80, easing: "ease-in", fill: "forwards" });
      anims.push(a); return a.finished;
    }));
    swap();                                                         // new question on the back of the card
    await Promise.all(cards.map((c, i) => {
      const a = c.animate([FLIP(-90), { ...FLIP(10), offset: 0.7 }, FLIP(0)], { duration: 420, delay: i * 80, easing: "ease-out", fill: "forwards" });
      anims.push(a); return a.finished;
    }));
    anims.forEach((a) => a.cancel());                               // hand the transform back to CSS
  }

  // Which level a step belongs to. The story end plays on at the Level 3 tank (no dive).
  const levelOf = (step) => (step.section === "end" ? "level3" : step.section);
  // Lever level a step starts from: its own start/level, or the next one that has one
  // (Story End: none follow, so the last answer, where the lever was left)
  function levelAt(i) {
    for (const s of DATA.steps.slice(i)) {
      if (s.start != null) return s.start;
      if (s.level != null) return s.level;
    }
    const last = DATA.steps.slice(0, i).reverse().find((s) => s.target != null);
    return last ? last.target : 0;
  }
  const firstLine = (s) => s.vo || (s.lever && s.lever.vo) || (s.entry && s.entry.vo) || "";

  /* Level change: "dive into the tank". The camera (the whole #stage) zooms into
     the water, the screen goes underwater (#under: bubbles + light rays, outside
     the stage so it doesn't zoom), the next level is set up out of sight, and the
     camera rises back out of the new tank's water with a small bounce. */
  const TANK_X = 1407;                                              // centre of the glass
  const camAt = (base, y, k) => `${base} translate(${TANK_X}px, ${y}px) scale(${k}) translate(${-TANK_X}px, ${-y}px)`;
  function riseBubbles(n) {
    const box = el.under.querySelector(".bubbles");
    for (let i = 0; i < n; i++) {
      const b = document.createElement("span");
      const sz = 1 + Math.random() * 3.6;
      Object.assign(b.style, { width: sz + "vmin", height: sz + "vmin", left: Math.random() * 100 + "%" });
      box.appendChild(b);
      b.animate([{ transform: "translate(0, 0)", opacity: 0 }, { opacity: 1, offset: 0.1 },
                 { transform: `translate(${(Math.random() - 0.5) * 8}vmin, -125vh)`, opacity: 0.9 }],
        { duration: 1300 + Math.random() * 900, delay: Math.random() * 600, easing: "ease-in", fill: "forwards" })
        .finished.then(() => b.remove());
    }
  }

  async function diveWipe(during) {
    const under = el.under;
    if (REDUCED) {                                                  // reduce-motion: a short fade
      under.classList.remove("hidden");
      await under.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: "forwards" }).finished;
      await during();
      await under.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" }).finished;
      under.classList.add("hidden"); under.getAnimations().forEach((a) => a.cancel());
      return;
    }
    const base = el.stage.style.transform;
    const inY = Math.min(955, levelY(S.water !== null ? S.water : S.level) + 50);   // just under the water line
    el.stage.style.willChange = "transform";
    FX.sfx("splashIn");
    const dive = el.stage.animate([{ transform: camAt(base, inY, 1) }, { transform: camAt(base, inY, 6) }],
      { duration: 900, easing: "cubic-bezier(.6,0,.9,.5)", fill: "forwards" });
    await FX.sleep(420);
    under.classList.remove("hidden");
    under.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, fill: "forwards" });
    riseBubbles(30);
    FX.sfx("bubbles");
    await dive.finished;

    await during();                                                 // next level set up while underwater

    const outY = Math.min(900, levelY(S.level) + 130);              // rise out of the new tank's water
    const rise = el.stage.animate([{ transform: camAt(base, outY, 6) }, { transform: camAt(base, outY, 0.97), offset: 0.85 }, { transform: camAt(base, outY, 1) }],
      { duration: 1000, delay: 600, easing: "cubic-bezier(.1,.6,.3,1)", fill: "both" });
    dive.cancel();
    await FX.sleep(600);
    FX.sfx("splashOut");
    riseBubbles(12);
    under.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 520, delay: 250, fill: "forwards" });
    await rise.finished;
    rise.cancel();
    el.stage.style.willChange = "";
    under.classList.add("hidden");
    under.getAnimations().forEach((a) => a.cancel());
    under.querySelector(".bubbles").innerHTML = "";
  }

  /** Level change: the dive, with the board reset for the step that opens the next level. */
  function levelWipe(step) {
    const i = DATA.steps.indexOf(step);
    S.guided = false;
    focusOn(null);                                                  // no blur layer while the camera moves
    return diveWipe(async () => {
      focusOn(null);
      handHide();
      el.character.classList.remove("in", "talk");
      el.stage.classList.remove("host");
      el.hostBubble.classList.remove("on");
      S.countFrom = null;
      el.marker.classList.remove("locked");
      setWater(null);
      const L = levelAt(i);
      jumpTo(L);                                                    // new level starts on a settled tank
      setPlate(step.type === "question" ? "?" : fmt(L));      // a question starts on "?", never on the last answer
      if (step.section === "level2" || step.section === "level3") setMode("lvl");
      if (step.section === "level3") el.eqPanel.classList.add("hidden");   // the Level 3 challenge appears at R5
      setSpeaker(step.speaker);
      setBanner(firstLine(step), "happy");                          // the next line is already up when the camera rises
    });
  }

  /* =================================================================
     Success (CSV "Correct Animations" + "Success / Confetti after each example")
     ================================================================= */
  async function succeed(q, p, where) {
    setAvatar("happy");
    const atPlate = where === "plate";
    const pp = atPlate ? stagePt(el.plate) : { x: LABEL_X, y: levelY(q.target) };
    FX.sparkle(el.fx, pp.x, pp.y, 16, 120);                                     // sparkle
    FX.badge(el.fx, atPlate ? pp.x + 250 : 1500, Math.max(200, Math.min(880, pp.y)), true);   // small ✓
    FX.sfx("correct");
    if (p.success === "marked") {                                               // "✓ Sparkle + Water Level Marked!"
      el.marked.querySelector("span").textContent = DATA.ui.marked;
      FX.flash(el.marked, "show", 2300);
      setTimeout(() => FX.sfx("board"), 250);
      setTimeout(() => FX.sfx("confetti"), 120);
      FX.confetti(el.confetti, { count: 90, x: 820, y: 330 });
    }
    await sayFocused(p.correct, "happy", S.area);     // "Correct! You reached 0." with the scale (or display) still lit
    await FX.sleep(500);
  }

  /* =================================================================
     Question runner
     ================================================================= */
  async function runQuestion(q, { flip = false } = {}) {
    S.q = q;
    S.guided = !!q.guided;
    if (!S.guided) focusOn(null);
    S.countFrom = null;
    el.marker.classList.remove("locked");
    setMarkerEnabled(false);
    markProgress(q.id);

    // New question in the same level: the display (and equation) flip over to it
    // while the water re-levels to the new start.
    // The equation builds with the question's voice-over, unless it is already up
    // (A0 after TR2 and B1 after R5 show it before the question starts).
    const full = q.eq && termA(q.eq.a) + q.eq.op + termB(q.eq.b) + "=?";
    S.eqBuild = !!q.eq && !(!el.eqPanel.classList.contains("hidden") && el.eqPanel.textContent.replace(/\s/g, "") === full);
    const showQuestion = () => {
      setPlate("?");                                     // the new question starts on "?" (not the last answer)
      if (q.eq) renderEq(q);
      if (S.eqBuild) eqHide([el.eqOp, el.eqB, el.eqEq, el.eqAns], true);   // only the start level for now
    };
    const flipping = flip ? flipCards(showQuestion) : (showQuestion(), null);

    setWater(null);
    if (S.level !== q.start) {
      if (Math.abs(S.level - q.start) <= 4) await animateTo(q.start, 180);
      else jumpTo(q.start);
    }
    setView(viewFor(q.start));
    render();
    await flipping;
    if (q.eq && el.eqPanel.classList.contains("hidden")) showEqPanel();

    if (q.lever) await leverPart(q, q.lever);
    if (q.entry) await entryPart(q, q.entry);

    S.countFrom = null;
    render();
    markProgress(q.id, true);
  }

  /** Lever part: VO, the learner moves the marker, "Correct! You reached +2." */
  async function leverPart(q, p) {
    S.part = p; S.wrong = 0; S.area = "tank";
    await Promise.all([narrate(p.vo, { pose: p.pose, look: "tank" }), S.eqBuild && buildQuestionEq(q, p.vo)]);
    S.eqBuild = false;
    setBanner(p.ost, "happy");
    focusOn("tank");
    S.countFrom = q.start;
    render();
    await FX.sleep(300);
    S.phase = "marker";
    S.eqLive = !!q.liveEq;
    setMarkerEnabled(true);
    el.marker.focus({ preventScroll: true });
    resetIdle();
    await new Promise((r) => (S.resolveMarker = r));
    S.resolveMarker = null;
    S.eqLive = false;
    stopIdle();
    clearTimeout(S.timers.settle);
    setMarkerEnabled(false);
    S.phase = "feedback";
    el.marker.classList.add("locked");                   // "Marker locks at +2."
    if (q.eq) renderEq(q);                               // back to the full question "0 + 3 = ?" for the keypad step
    FX.flash(S.labels[q.target], "pulse", 2800);
    if (q.target === 0) { FX.flash(S.ticks[0], "pulse", 2800); FX.flash(S.tticks[0], "pulse", 2800); }   // "The 0 mark glows briefly."
    await succeed(q, p, "level");
  }

  /** Keypad part: VO, the learner types the level and presses Check. */
  async function entryPart(q, p) {
    S.part = p; S.wrong = 0; S.area = "pad";
    showPlate();
    showPanel();
    await Promise.all([narrate(p.vo, { pose: p.pose, look: "pad" }), S.eqBuild && buildQuestionEq(q, p.vo)]);   // Level 3: the keypad part is the only part
    S.eqBuild = false;
    S.entry = "";
    entryDisplay();
    setBanner(p.ost, "happy");
    focusOn("pad");
    await FX.sleep(400);
    S.phase = "entry";
    resetIdle();
    await new Promise((r) => (S.resolveEntry = r));
    S.resolveEntry = null;
    stopIdle();
    S.phase = "feedback";
    setPlate(fmt(q.target), true);                       // "+2 appears on the display (and glows briefly)."
    if (q.autoLever) {                                   // Level 3: "Lever automatically moves 0 → +1 → … → +4."
      await FX.sleep(300);
      S.countFrom = q.start;
      await animateTo(q.target, 420);
      el.marker.classList.add("locked");
    }
    if (q.eq) completeEq(q);                             // "Equation completes: 0 + 3 = +3."
    await succeed(q, p, "plate");
  }

  /* =================================================================
     How to Play (guided demo)
     ================================================================= */
  async function runDemo(step) {
    S.q = null; S.part = null;
    S.guided = !!step.guided;
    if (step.start != null && S.level !== step.start) jumpTo(step.start);
    if ((step.act === "chooseSign" || step.act === "enterNumber") && el.panel.classList.contains("hidden")) {
      S.entry = ""; entryDisplay();                      // "Camera shifts to the dial and display screen." (the first keypad step)
      showPlate(); showPanel();
    }
    // the line is about the lever (H1, H2) or the dial (H3, H4): keep that lit while it plays
    const look = step.act === "leverUpDown" || step.act === "leverMark" ? "tank" : "pad";
    if (!step.ostFirst) {
      await narrate(step.vo, { speaker: step.speaker, pose: step.pose, look });
      setBanner(step.ost, "happy");
    } else {
      setSpeaker(step.speaker);
      setBanner(step.ost, "happy");
    }
    S.phase = "demo";
    switch (step.act) {
      case "leverUpDown":                                // "Move the lever up or down as shown."
        focusOn("tank");
        await FX.sleep(800);
        for (const d of step.taps) await demoTap(d, 1);
        await FX.sleep(300);
        handHide();
        break;
      case "leverMark":                                  // "The lever moves along the scale and stops at the new level."
        focusOn("tank");
        await FX.sleep(800);
        S.countFrom = S.level; render();
        await demoDrag(step.to);
        el.marker.classList.add("locked");
        FX.flash(S.labels[step.to], "pulse", 2800);      // highlighted level marks
        FX.sparkle(el.fx, LABEL_X, levelY(step.to), 10, 70);
        await FX.sleep(1200);
        S.countFrom = null; render();
        break;
      case "enterNumber":                                // number buttons + display
        focusOn("pad");
        await FX.sleep(800);
        await handTap(keyNode(step.key));
        applyKey(step.key);
        await FX.sleep(600);
        break;
      case "chooseSign":                                 // "(+ / −) sign buttons … highlighted"
        focusOn("pad");
        [keyNode("+"), keyNode("-")].forEach((k) => FX.flash(k, "keypulse", 2800));
        await FX.sleep(1400);
        await handTap(keyNode(step.key));
        applyKey(step.key);                              // the sign first: the display shows "+", then the number follows
        await FX.sleep(600);
        break;
      case "check": {                                    // "Check icon glows. The entered number matches the lever position."
        focusOn("pad");
        FX.flash(el.btnCheck, "keypulse", 2800);
        await FX.sleep(1200);
        FX.sfx("button");
        await handTap(el.btnCheck);
        handHide();
        focusOn("padTank");                              // "Both glow and a tick appears."
        setPlate(fmt(S.level), true);
        FX.flash(el.marker, "glowing", 2800);
        FX.flash(S.labels[S.level], "pulse", 2800);
        const pp = stagePt(el.plate);
        FX.sparkle(el.fx, pp.x, pp.y, 16, 120);
        FX.sparkle(el.fx, LABEL_X, levelY(S.level), 12, 90);
        FX.badge(el.fx, pp.x + 250, pp.y, true);
        FX.sfx("correct");
        await FX.sleep(1600);
        await narrate(step.vo, { speaker: step.speaker, pose: step.pose, look: "padTank" });   // both stay lit with their tick
        break;
      }
    }
    S.phase = "idle";
  }

  /* =================================================================
     Spoken rows (teaching, Level 3 transition, Level Complete, Story End)
     ================================================================= */
  async function runSay(step) {
    S.q = null; S.part = null;
    S.guided = false;
    focusOn(null);
    if (step.level != null) {                          // teaching rows: the lever (and the display) at the row's level
      if (S.level !== step.level) await animateTo(step.level, 200);
      setPlate(fmt(S.level));
    }
    const showOst = () => {
      if (step.ostIn === "eq") { setMode("lvl"); return showTeachEq(step.ost, { build: !!step.build }); }
    };
    if (!step.ostAfter) await showOst();
    await Promise.all([narrate(step.vo, { speaker: step.speaker }), sayFx(step, showOst)]);
    if (!step.ostIn) setBanner(step.ost, "happy");
    await FX.sleep(500);
  }

  /** The animation in each row's "Scene Description" (plays while the line is spoken). */
  async function sayFx(step, showOst) {
    const i = DATA.steps.indexOf(step);
    const nextQ = DATA.steps.slice(i).find((s) => s.type === "question");
    await FX.sleep(400);
    switch (step.fx) {
      case "moveTo":                                     // "The lever moves …" (0 highlighted while crossing)
        if (step.opGlow) {                               // "We add" / "We subtract": the sign lights up
          await untilWord(step.vo, step.opGlow);
          FX.flash(el.eqOp, "eqglow", 1800); FX.flash(el.eqOp, "eqpop", 500);
        }
        if (step.moveAt) await untilWord(step.vo, step.moveAt);
        await animateTo(step.to, 480, !!step.zeroGlow);
        setPlate(fmt(S.level), true);
        if (step.ostAfter) showOst();                    // "The equation completes."
        break;
      case "countSteps":                                 // "… levels highlight one by one."
        if (step.build) await buildTeachEq(step);        // … and the equation is written along with the line
        else await countPath(step.from, step.to);
        break;
      case "riseFall":                                   // "upward and downward arrow, plus and minus symbols"
        FX.flash(el.btnUp, "glow", 3000);
        await glowDirection(S.level, 1, 900);
        FX.flash(el.btnDown, "glow", 3000);
        await glowDirection(S.level, -1, 900);
        break;
      case "levelComplete": {                            // final level glows, dial shows the answer, ✓, confetti
        pulseLevel(S.level);
        setPlate(fmt(S.level), true);
        FX.badge(el.fx, 1500, Math.max(200, Math.min(880, levelY(S.level))), true);
        el.marked.querySelector("span").textContent = step.ost;       // OST "Level Complete!"
        FX.flash(el.marked, "show", 2300);
        FX.sfx("board"); FX.sfx("confetti");
        FX.confetti(el.confetti, { count: 180, x: 960, y: 420, power: 1.2, spread: 1.3 });
        break;
      }
      case "leverStuck":                                 // "Pari tries to use the lever, but it does not respond."
        for (let k = 0; k < 2; k++) {
          pressLever(el.btnUp);
          FX.flash(el.marker, "shake", 500);
          await FX.sleep(700);
        }
        el.stage.classList.add("lever-off");             // inactive lever from here on
        break;
      case "padGlow":                                    // "The dial pad begins to glow."
        FX.flash(el.panel, "activate", 1300);
        await FX.sleep(1400);
        FX.flash(el.panel, "activate", 1300);
        break;
      case "keysPulse":                                  // "The sign and number buttons gently pulse."
        [keyNode("+"), keyNode("-")].forEach((k) => FX.flash(k, "keypulse", 2800));
        await FX.sleep(900);
        document.querySelectorAll(".key:not(.key--sign)").forEach((k) => FX.flash(k, "keypulse", 2800));
        break;
      case "showNextEq":                                 // "The first water-level challenge appears."
        if (nextQ && nextQ.eq) { renderEq(nextQ); showEqPanel(); setPlate("?"); }
        break;
      case "padActive":                                  // "Dial pad stays active."
        FX.flash(el.panel, "activate", 1300);
        break;
      case "displayGlow": {                              // "The final water level is marked correctly and the display lights up."
        setPlate(el.plateText.textContent, true);
        FX.flash(el.plate, "glowing", 2800);
        const pp = stagePt(el.plate);
        FX.sparkle(el.fx, pp.x, pp.y, 18, 140);
        FX.sparkle(el.fx, LABEL_X, levelY(S.level), 12, 90);
        break;
      }
      case "celebrate":                                  // "confetti/sparkles"
        FX.sfx("confetti");
        FX.confetti(el.confetti, { count: 160, x: 960, y: 420, power: 1.15, spread: 1.3 });
        break;
      case "badge":                                      // "completion badge"
        FX.flash(el.medal, "show", 3200);
        FX.sfx("board");
        FX.sparkle(el.fx, 960, 470, 22, 200);
        break;
    }
  }

  /* =================================================================
     Story (CSV Intro / Teaching / Game start): full-screen scenes with a
     speech bubble near the speaker, or the narrator's caption.
     ================================================================= */
  /* The two bubble artworks, measured from the PNGs (fractions of the image):
     `tip` = the tail's point, `text` = [left, top, width, height] of the inner area.
     Each keeps its own proportions; "flip" mirrors the artwork only, never the text. */
  const BUBBLES = {
    round: { src: "assets/asset_speech_bubble_blank.png", ratio: 600 / 800, tail: "left",  tip: [0.2125, 0.892], text: [0.15, 0.217, 0.715, 0.475] },
    wide:  { src: "assets/asset_p09_overlay_6218b7e3.png", ratio: 355 / 800, tail: "right", tip: [0.91, 0.983],  text: [0.05, 0.073, 0.90, 0.637] }
  };
  let shotIdx = 0;

  function placeBubble(b, text, node = el.bubble) {
    const img = node.querySelector("img"), box = node.querySelector("p");
    const art = BUBBLES[b.shape], flip = b.tail !== art.tail;
    const w = b.w, h = w * art.ratio;
    const tx = flip ? 1 - art.tip[0] : art.tip[0], ty = art.tip[1];
    const [l, t, tw, th] = art.text;
    Object.assign(node.style, {
      width: w + "px", left: b.tip[0] - tx * w + "px", top: b.tip[1] - ty * h + "px",
      transformOrigin: `${tx * 100}% ${ty * 100}%`                 // pops out of the tail
    });
    node.classList.toggle("flip", flip);
    if (!img.src.endsWith(art.src)) img.src = art.src;
    Object.assign(box.style, {
      left: (flip ? 1 - l - tw : l) * w + "px", top: t * h + "px", width: tw * w + "px", height: th * h + "px"
    });
    box.textContent = text;
    // largest font that keeps the line inside the bubble (the bubble itself never changes size)
    for (let fs = 50; fs >= 20; fs -= 2) {
      box.style.fontSize = fs + "px";
      if (box.scrollHeight <= box.clientHeight + 1 && box.scrollWidth <= box.clientWidth + 1) break;
    }
  }

  /* Story scenes with an empty tank (scene-pXXe, `tank` in data.js): the water is
     drawn here, between the scene art and the characters (cut out of the same art,
     chars-pXXe.png), so it rises and falls with the line. The glass and the scale are
     in the same place in all four scenes (stage px). */
  const ST_TANK = { top: 228, bottom: 938, zeroY: 570, step: 90, labelX: 922 };
  const stLevelY = (L) => ST_TANK.zeroY - ST_TANK.step * L;
  function tankLayers(shot) {
    if (shot.tank) return shot.tank;
    const fx = document.createElement("div");
    fx.className = "tank-fx";
    fx.innerHTML = `<div class="tstream pour"><i></i></div>
      <div class="twater"><div class="wave wave--back"></div><div class="wave wave--front"></div><div class="bubbles"></div></div>
      <div class="tscale"></div>`;
    const top = document.createElement("div");
    top.className = "tstream-top pour"; top.innerHTML = "<i></i>";
    const chars = document.createElement("img");
    chars.className = "chars"; chars.alt = ""; chars.draggable = false;
    shot.querySelector("img").after(fx, top, chars);
    const scale = fx.querySelector(".tscale");
    for (let L = -3; L <= 3; L++) {                // the scale on the glass, in front of the water
      const d = document.createElement("div");
      d.className = "tlab";
      d.style.top = stLevelY(L) - ST_TANK.top + "px";
      d.innerHTML = `<i></i><span>${fmt(L)}</span>`;
      scale.appendChild(d);
    }
    buildBubbles(fx.querySelector(".bubbles"), 8);
    return (shot.tank = { fx, top, chars, water: fx.querySelector(".twater"), stream: fx.querySelector(".tstream"), level: 0, timer: null });
  }
  function showTank(shot, step) {
    const on = !!step.tank;
    if (!on && !shot.tank) return null;
    const t = tankLayers(shot);
    [t.fx, t.top, t.chars].forEach((n) => n.classList.toggle("tank-off", !on));
    if (!on) return null;
    t.chars.src = `assets/story/chars-${step.scene}.png`;
    setTankLevel(t, step.tank.from, true);
    return t;
  }
  /** Move a story tank's water to level L. Returns how long it takes (ms). While it
      rises the pipe pours (the stream falls from the pipe, then the tail drops away). */
  function setTankLevel(t, L, instant = false) {
    const d = Math.abs(L - t.level), ms = instant || !d ? 0 : 250 + 320 * d;
    const y = stLevelY(L) - ST_TANK.top;
    t.water.style.transitionDuration = ms + "ms";
    t.water.style.top = y + "px";
    t.water.style.height = ST_TANK.bottom - ST_TANK.top - y + "px";
    t.stream.style.transition = `height ${ms}ms ease-in-out, clip-path .32s cubic-bezier(.55, 0, 1, .45)`;
    t.stream.style.height = y + 6 + "px";                         // the stream reaches the water surface
    if (ms) {
      t.water.classList.add("moving");
      FX.sfxLoop(L > t.level ? "fill" : "drain", ms + 200);
      if (L > t.level) [t.top, t.stream].forEach((n) => {
        if (n.classList.contains("on")) return;
        n.classList.add("reset"); n.classList.remove("off");    // a stream that was stopping goes back to the pipe at once
        void n.getBoundingClientRect();
        n.classList.remove("reset"); n.classList.add("on");      // … and pours again
      });
      clearTimeout(t.timer);
      t.timer = setTimeout(() => {
        t.water.classList.remove("moving");
        [t.top, t.stream].forEach((n) => { if (n.classList.contains("on")) n.classList.replace("on", "off"); });
      }, ms);
    } else {
      clearTimeout(t.timer);
      t.water.classList.remove("moving");
      [t.top, t.stream].forEach((n) => n.classList.remove("on", "off"));
    }
    t.level = L;
    return ms;
  }

  async function runScene(step) {
    S.q = null; S.part = null; S.guided = false;
    focusOn(null);
    S.phase = "narrate";
    const first = el.story.classList.contains("hidden");
    el.story.classList.remove("hidden");
    // cross-fade to the new scene (a repeated scene stays, only its highlights restart)
    const cur = el.shots[shotIdx];
    const src = `assets/story/scene-${step.scene}.jpg`;
    let shot = cur;
    if (!cur.classList.contains("on") || !cur.querySelector("img").src.endsWith(src)) {
      shot = el.shots[shotIdx = 1 - shotIdx];
      shot.querySelector("img").src = src;
      shot.getAnimations().forEach((a) => a.cancel());
      shot.style.transform = "";
      shot.classList.add("on");
      if (first) { shot.style.transition = "none"; void shot.offsetWidth; shot.style.transition = ""; }
      cur.classList.remove("on");
    }
    const spots = shot.querySelector(".spots");
    spots.innerHTML = "";
    const tank = showTank(shot, step);               // empty-tank scenes: the water and the characters' layer

    // camera: a slow move toward a point for the length of the line
    const readMs = Math.max(3500, FX.readTime(step.vo) + 1500);
    if (step.camera && !REDUCED) {
      const c = step.camera;
      shot.style.transformOrigin = `${c.x}px ${c.y}px`;
      shot.animate([{ transform: `scale(${c.from || 1})` }, { transform: `scale(${c.to})` }],
        { duration: readMs + 1200, easing: "ease-in-out", fill: "forwards" });
    }

    // who speaks: bubble near them, or the narrator's caption
    setSpeaker(step.speaker);
    el.caption.classList.remove("on"); el.bubble.classList.remove("on");
    await FX.sleep(first ? 500 : 450);
    if (step.caption) {
      el.caption.textContent = step.ost;
      el.caption.classList.add("on");
    } else if (step.bubble) {
      placeBubble(step.bubble, step.ost);
      void el.bubble.offsetWidth;
      el.bubble.classList.add("on");
    }

    // highlights on the scene art, one by one (+ the sign badge), while the line plays
    const lights = (async () => {
      await FX.sleep(400);
      let lever = null;                              // sweep: a lever marker slides along the marks as they light
      if (step.sweep && step.glow) {
        lever = document.createElement("div");
        lever.className = "lever";
        lever.style.left = step.glow[0][0] - 120 + "px"; lever.style.top = step.glow[0][1] + "px";
        spots.appendChild(lever);
        void lever.offsetWidth; lever.classList.add("on");
        await FX.sleep(400);
      }
      if (tank && step.tank.to != null) setTankLevel(tank, step.tank.to);   // the water goes to one level while the marks light
      for (const g of step.glow || []) {
        // a glow is [x, y] on the art, or a level on an empty-tank scene's drawn scale
        const [x, y] = typeof g === "number" ? [ST_TANK.labelX, stLevelY(g)] : g;
        const neg = typeof g === "number" ? g < 0 : y > 600;
        if (tank && step.tank.to == null) await FX.sleep(setTankLevel(tank, g));   // the water reaches the mark, then it lights
        if (lever) { lever.style.top = y + "px"; await FX.sleep(300); }
        const d = document.createElement("div");
        d.className = "spot" + (neg ? " neg" : ""); d.style.left = x + "px"; d.style.top = y + "px";   // below 0: blue, as in the art
        spots.appendChild(d);
        void d.offsetWidth; d.classList.add("on");
        FX.sfx("tick");
        await FX.sleep(520);
      }
      if (step.sign) {
        const g = document.createElement("div");
        g.className = "sign " + (step.sign.text === "+" ? "plus" : "minus");
        g.style.left = step.sign.x + "px"; g.style.top = step.sign.y + "px";
        g.innerHTML = `<span>${step.sign.text}</span>`;
        spots.appendChild(g);
        void g.offsetWidth; g.classList.add("on");
        FX.sfx("board", 0.7);
      }
    })();

    await Promise.all([speak(step.vo), lights, step.fx ? sayFx(step) : null]);     // the line always plays to the end
    await FX.sleep(700);
    el.bubble.classList.remove("on");
    el.caption.classList.remove("on");
    await FX.sleep(250);
    S.phase = "idle";
  }

  /* Chapter break (story ↔ game): water floods up from the bottom of the screen, a
     title card (the CSV section name) floats up in it, then the water drains away and
     reveals what was set up underneath. `tap`: the learner presses ▶ to go on. */
  async function floodWipe(title, { tap = false, during = null } = {}) {
    const f = el.flood, water = f.querySelector(".flood-water"), card = f.querySelector(".flood-card");
    const go = f.querySelector("#floodGo");
    card.querySelector("h2").textContent = title || "";
    go.classList.toggle("hidden", !tap);
    card.classList.remove("on", "away");
    f.classList.remove("hidden");
    const move = (from, to, ms, easing) => REDUCED
      ? water.animate([{ transform: "translateY(-40px)", opacity: from === "1200px" ? 0 : 1 }, { transform: "translateY(-40px)", opacity: to === "1200px" ? 0 : 1 }], { duration: 300, fill: "forwards" }).finished
      : water.animate([{ transform: `translateY(${from})` }, { transform: `translateY(${to})` }], { duration: ms, easing, fill: "forwards" }).finished;
    FX.sfx("splashIn");
    FX.sfxLoop("fill", 1300);
    await move("1200px", "-40px", 1200, "cubic-bezier(.45, 0, .25, 1)");        // the screen fills up
    FX.sfx("bubbles");
    if (during) await during();                                          // what comes next is set up under the water
    if (title) card.classList.add("on");
    if (tap) {
      await FX.sleep(500);
      go.focus({ preventScroll: true });
      await new Promise((r) => { go.onclick = () => { go.onclick = null; FX.sfx("button"); r(); }; });
    } else await FX.sleep(title ? 1900 : 450);
    if (title) { card.classList.replace("on", "away"); await FX.sleep(350); }   // the card floats off
    FX.sfxLoop("drain", 1200);
    FX.sfx("splashOut");
    await move("-40px", "1200px", 1100, "cubic-bezier(.55, 0, .75, 1)");      // … and the water drains away
    f.classList.add("hidden");
    card.classList.remove("away");
    water.getAnimations().forEach((a) => a.cancel());
  }

  /** Story → game: the screen floods, "How to Play" (tap ▶), and the game appears as it drains. */
  async function storyExit(next) {
    el.bubble.classList.remove("on"); el.caption.classList.remove("on");
    await floodWipe(DATA.ui.howTo, {
      tap: true,
      during: async () => {
        if (next) { setSpeaker(next.speaker); setBanner(firstLine(next), "happy"); }   // the game's first line is already up
        el.story.classList.add("hidden");
        el.shots.forEach((sh) => { sh.classList.remove("on"); sh.getAnimations().forEach((a) => a.cancel()); sh.style.transform = ""; });
      }
    });
  }

  /** Game → story (Story End): the screen floods and the ending scene appears as the water
      drains (no card). */
  async function storyEnter(step) {
    focusOn(null);
    el.bubble.classList.remove("on"); el.caption.classList.remove("on");
    await floodWipe(null, {                          // no card here: the water rises and drains straight into the ending
      during: async () => {
        const shot = el.shots[shotIdx];
        shot.querySelector("img").src = `assets/story/scene-${step.scene}.jpg`;
        shot.querySelector(".spots").innerHTML = "";
        shot.style.transition = "none";
        shot.classList.add("on");
        el.shots[1 - shotIdx].classList.remove("on");
        void shot.offsetWidth;
        shot.style.transition = "";
        el.story.classList.remove("hidden");
      }
    });
  }

  /* =================================================================
     Transition dialogue (gate)
     ================================================================= */
  async function runGate(step) {
    S.q = null; S.part = null;
    S.gate = step;
    S.guided = false;                                      // the tutorial is over: no more blur
    focusOn(null);
    const next = DATA.steps[DATA.steps.indexOf(step) + 1];
    if (step.button) [el.panel, el.plate, el.connector].forEach((n) => n.classList.add("away"));
    await narrate(step.vo);
    setBanner(step.ost, "happy");
    if (step.appear === "eqPanel") {                       // "Equation panel appears beside the tank."
      setMode("lvl");
      if (next && next.start != null) setPlate("?");
      await FX.sleep(400);
      if (next && next.eq) renderEq(next);
      showEqPanel();
      await FX.sleep(900);
    }
    if (step.button) {                                     // "Learner taps Start"
      el.gateBtn.textContent = step.button;
      el.gateBtn.classList.remove("hidden");
    }
    S.phase = "gate";
    resetIdle();
    await new Promise((r) => (S.resolveGate = r));
    S.resolveGate = null;
    stopIdle();
    el.gateBtn.classList.add("hidden");
    if (step.then === "activateScaleDial") {               // "Tank scale and dial become active."
      if (next && next.start != null) setPlate("?");
      [el.panel, el.plate, el.connector].forEach((n) => n.classList.remove("away"));
      await FX.sleep(600);
      await glowDirection(S.view - HALF - 1, 1, 500);     // light sweeps up the whole scale
      FX.flash(el.panel, "activate", 1300);
      await FX.sleep(1400);
    }
    S.gate = null;
    S.phase = "idle";
  }
  el.gateBtn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    if (S.resolveGate) { FX.sfx("button"); S.resolveGate(); }
  });
  // "Learner observes and taps to continue." — a tap anywhere on the game, including
  // the keypad (capture phase, before the keys stop the event); HUD/QA controls excluded
  el.stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest("#btnMute, #btnJump, #jumper, #paused")) return;
    if (S.phase === "gate" && S.gate && S.gate.continueOnTap && S.resolveGate) { FX.sfx("button"); S.resolveGate(); }
  }, true);

  /* =================================================================
     QA level jumper — lists every step; picking one reloads with ?step=ID.
     (Reload, because browsers only allow speech after a tap: press ▶ once.)
     ================================================================= */
  const SECTION_NAMES = { story: "Story", howto: "How to Play", level1: "Level 1", level2: "Level 2", level3: "Level 3", end: "Story end" };
  function jumpLabel(s) {
    if (s.type === "gate") return s.button ? "Start" : "tap";
    if (s.type === "demo") return s.act;
    if (s.type === "scene") return `${s.speaker || "guddu"} · ${s.scene}`;
    if (s.type === "say") return (s.speaker || "guddu") + (s.fx ? " · " + s.fx : "");
    const kind = s.id.endsWith("0") || s.id.endsWith("T") ? "tutorial · " : "";
    return kind + (s.eq ? `${termA(s.eq.a)} ${s.eq.op} ${termB(s.eq.b)}` : `${fmt(s.start)} → ${fmt(s.target)}`);
  }
  function initJumper() {
    const btn = $("btnJump"), panel = $("jumper"), list = $("jumpList");
    btn.classList.remove("hidden");
    let group = null, row = null;
    DATA.steps.forEach((s) => {
      if (s.section !== group) {
        group = s.section;
        const h = document.createElement("h3");
        h.textContent = SECTION_NAMES[group] || group;
        row = document.createElement("div");
        row.className = "jump-row";
        list.append(h, row);
      }
      const b = document.createElement("button");
      b.className = "jump-btn" + (s.id === (DATA.steps[START_INDEX] || {}).id ? " on" : "");
      b.innerHTML = `<b>${s.id}</b><small>${jumpLabel(s)}</small>`;
      b.addEventListener("click", () => { location.search = "?step=" + encodeURIComponent(s.id); });
      row.appendChild(b);
    });
    const open = (on) => panel.classList.toggle("hidden", !on);
    btn.addEventListener("pointerdown", (e) => { e.stopPropagation(); open(panel.classList.contains("hidden")); });
    $("jumpClose").addEventListener("pointerdown", (e) => { e.stopPropagation(); open(false); });
    panel.addEventListener("pointerdown", (e) => { e.stopPropagation(); if (e.target === panel) open(false); });
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") open(false); });
    if (START_ID) {
      const tag = $("qaStartTag");
      tag.textContent = `QA · starting at ${DATA.steps[START_INDEX].id}`;
      tag.classList.remove("hidden");
    }
  }

  /** When starting mid-game, put the keypad / equation / lever in the state that step expects. */
  function prepareJump() {
    if (!START_INDEX) return;
    const before = DATA.steps.slice(0, START_INDEX);
    const at = DATA.steps[START_INDEX];
    if (before.some((s) => s.act === "enterNumber" || s.act === "chooseSign")) {
      [el.panel, el.plate, el.connector].forEach((n) => n.classList.remove("hidden"));
    }
    if (["level2", "level3", "end"].includes(at.section)) setMode("lvl");   // Level 2 on: keypad in level mode
    if (before.some((s) => s.fx === "leverStuck")) el.stage.classList.add("lever-off");
    setPlate(at.type === "question" ? "?" : fmt(levelAt(START_INDEX)));
    before.forEach((s) => s.type === "question" && markProgress(s.id, true));
  }

  /* =================================================================
     Progress dots (one per question)
     ================================================================= */
  function buildProgress() {
    el.progress.innerHTML = "";
    let sec = null;
    DATA.steps.forEach((s) => {
      if (s.type !== "question") return;
      if (sec && s.section !== sec) el.progress.appendChild(document.createElement("b"));
      sec = s.section;
      const i = document.createElement("i");
      i.dataset.id = s.id;
      el.progress.appendChild(i);
    });
  }
  function markProgress(id, done) {
    el.progress.querySelectorAll("i").forEach((d) => {
      if (d.dataset.id === id) { d.classList.toggle("done", !!done); d.classList.toggle("now", !done); }
      else d.classList.remove("now");
    });
  }

  /* =================================================================
     Main flow
     ================================================================= */
  async function run() {
    let prev = null;
    for (const step of DATA.steps.slice(START_INDEX)) {
      if (prev && prev.section === "story" && step.section !== "story") await storyExit(step);   // story → game
      else if (prev && prev.type !== "scene" && step.type === "scene") await storyEnter(step);   // game → story (Story End)
      else if (prev && levelOf(step) !== levelOf(prev)) await levelWipe(step);           // dive between levels
      const flip = !!prev && prev.type === "question" && step.type === "question" && prev.section === step.section;
      prev = step;
      S.stepId = step.id;                                 // the language button reloads at this step
      if (step.type === "question") await runQuestion(step, { flip });
      else if (step.type === "gate") await runGate(step);
      else if (step.type === "demo") await runDemo(step);
      else if (step.type === "say") await runSay(step);
      else if (step.type === "scene") await runScene(step);
    }
    // End
    focusOn(null);
    FX.confetti(el.confetti, { count: 260, x: 960, y: 420, power: 1.3, spread: 1.4 });
    FX.sfx("complete");
    el.endScreen.classList.remove("hidden");
  }

  function init() {
    window.__GAME_DEBUG = { renderEq, showTeachEq, fitEq, setBanner, el };   // automated layout checks (QA)
    fitStage();
    buildScale();
    buildBubbles();
    buildBubbles(el.flood.querySelector(".bubbles"), 34, 1880);
    requestAnimationFrame(lipLoop);                  // the characters' mouths follow the voice
    buildProgress();
    // Start state for the first step played (the first step, or the QA jump target)
    const first = DATA.steps[START_INDEX];
    jumpTo(levelAt(START_INDEX));
    setSpeaker(first.speaker);
    setBanner(first.ost || (first.lever || first.entry).ost, "happy");
    if (first.type === "scene") {                         // the story's first scene sits behind the start screen
      el.story.classList.remove("hidden");
      el.shots[0].querySelector("img").src = `assets/story/scene-${first.scene}.jpg`;
      el.shots[0].classList.add("on");
    }
    prepareJump();
    setMarkerEnabled(false);

    $("btnStart").addEventListener("click", () => {
      FX.unlockSpeech(); // Safari/iOS: speech and audio must be started from this tap
      FX.unlockSfx();
      FX.startMusic();   // background music starts with the game
      setTimeout(() => FX.sfx("button"), 60);  // after the unlock (which briefly plays everything at volume 0)
      el.startScreen.classList.add("fade");
      setTimeout(() => el.startScreen.classList.add("hidden"), 500);
      run();
    });
    $("btnReplay").addEventListener("click", () => location.reload());
    // The game pauses while the window isn't focused; say so instead of going silent
    window.addEventListener("fx:paused", () => el.paused.classList.remove("hidden"));
    window.addEventListener("fx:resumed", () => el.paused.classList.add("hidden"));
    // Voice couldn't start: flag the sound button (no added text; the reason is in the console)
    window.addEventListener("fx:voiceproblem", () => el.btnMute.classList.add("warn"));
    if (CFG.qaJumper) initJumper();
    el.btnMute.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      FX.setMuted(!FX.muted); // the current line goes quiet but the game doesn't jump ahead
      el.btnMute.textContent = FX.muted ? "🔇" : "🔊";
    });
  }

  // Preload images so nothing pops in mid-animation
  const PRELOAD = ["bg", "tank-empty", "pipe-in-dry", "pipe-out-dry", "track",
    "btn-up", "btn-down", "plate-blue", "panel-cream", "strip-cream", "board-green", "panel-title",
    "banner-bar",
    "asset_speech_bubble_blank", "asset_p09_overlay_6218b7e3"].map((n) => `assets/${n}.png`)
    .concat([...new Set(DATA.steps.filter((s) => s.scene).map((s) => `assets/story/scene-${s.scene}.jpg`))])
    .concat(DATA.steps.filter((s) => s.tank).map((s) => `assets/story/chars-${s.scene}.png`))
    .concat([...Object.values(AVATARS), ...Object.values(POSES)].map((a) => a.src));
  Promise.all(PRELOAD.map((src) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = src; })))
    .then(init);
  fitStage();
})();
