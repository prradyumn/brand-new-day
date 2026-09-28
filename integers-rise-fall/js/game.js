/* =====================================================================
   game.js — flow + interaction for "Integers: Rise and Fall"

   Flow (see CONTEXT.md for the full walkthrough):
     Start → Tutorial [T0 T1 T2] → TR1 → Level 1 [Q1…Q6]
           → TR2 (equation panel) → Level 2 [A1…A5] → Level 3 [S1…S5] → End

   The tutorial is a guided demo: the frosted-glass spotlight moves
   narrator → tank → keypad, and a hand drags the marker and types the
   answer by itself. From TR1 on there is no blur and the learner plays.

   Each question:
     1. NARRATE  – VO plays (tutorial: spotlight on the narrator box).
     2. MARKER   – learner drags the marker (or taps ▲/▼). After it rests
                   `settleMs` it is checked. (Tutorial: the hand drags it.)
     3. ENTRY    – (if q.entry) learner types the level on the keypad and
                   presses Check. (Tutorial: the hand types it.)
     4. CELEBRATE– ✓, sparkle, "Water Level Marked!", confetti.
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

  /* Spotlight holes for the focus layer */
  const HOLES = {
    narr:   { x: 12,   y: 6,   w: 1089, h: 160 },
    char:   { x: 20,   y: 318, w: 450,  h: 755 },
    tank:   { x: 1092, y: 26,  w: 738,  h: 1064 },   // starts right of the narrator banner (ends x 1090)
    padTut: { x: 196,  y: 250, w: 656,  h: 716 },
    plate:  { x: 272,  y: 250, w: 530,  h: 196 },
    gate:   { x: 306,  y: 460, w: 468,  h: 160 }
  };
  // Two identical holes cancel out under evenodd, so unused slots get a
  // 2×2 px hole parked off-stage (keeps the path shape stable for transitions).
  const NO_HOLE = { x: -40, y: -40, w: 2, h: 2 };

  /* ---------------- DOM ---------------- */
  const el = {
    stage: $("stage"), focus: $("focus"), ring0: $("ring0"), ring1: $("ring1"),
    banner: $("banner"), bannerText: $("bannerText"), avatar: $("avatar"), character: $("character"),
    plate: $("plate"), plateText: $("plateText"), connector: $("connector"),
    panel: $("panel"),
    eqPanel: $("eqPanel"), eqA: $("eqA"), eqOp: $("eqOp"), eqB: $("eqB"), eqEq: $("eqEq"), eqAns: $("eqAns"),
    btnCheck: $("btnCheck"), btnClear: $("btnClear"),
    water: $("water"), pipeIn: $("pipeIn"), pipeOut: $("pipeOut"),
    strip: $("scaleStrip"), countLine: $("countLine"),
    marker: $("marker"), btnUp: $("btnUp"), btnDown: $("btnDown"),
    fx: $("fxLayer"), confetti: $("confetti"), marked: $("markedBadge"),
    gateBtn: $("gateBtn"), progress: $("progress"), paused: $("paused"),
    btnMute: $("btnMute"), startScreen: $("startScreen"), endScreen: $("endScreen"), hand: $("hand"),
    wipe: $("wipe"), wipeDrop: $("wipeDrop")
  };

  /* ---------------- State ---------------- */
  const S = {
    scale: 1,
    level: 2,            // marker/water level
    view: 0,             // centre level of the visible scale window
    q: null,             // current question
    phase: "idle",       // idle | narrate | marker | entry | feedback | gate
    markerEnabled: false,
    dragging: false,
    countFrom: null,     // level the dashed count line starts from
    water: null,         // fixed water level (tutorial); null = water follows the marker
    entry: "",
    gate: null,          // current transition step
    guided: DATA.steps[0].section === "tutorial", // spotlight/blur + character only in the tutorial
    eqLive: false,       // equation follows the marker (CSV Level 2 Q1)
    labels: {}, ticks: {}, tticks: {},
    timers: { settle: null, idle: null, edge: null, pipeIn: null, pipeOut: null },
    resolveMarker: null, resolveEntry: null, resolveGate: null
  };

  window.__GAME_STATE = S; // exposed for debugging / automated tests

  // QA: ?step=ID starts the game at that step (see the level jumper below)
  const START_ID = new URLSearchParams(location.search).get("step");
  const START_INDEX = Math.max(0, DATA.steps.findIndex((s) => s.id === START_ID));

  FX.lang = CFG.speechLang;
  FX.loadSfx({ fill: "assets/sfx/water-fill.mp3", drain: "assets/sfx/water-drain.mp3" });
  FX.rate = CFG.speechRate;

  /* =================================================================
     Stage scaling
     ================================================================= */
  function fitStage() {
    const W = window.innerWidth, H = window.innerHeight;
    const s = Math.min(W / 1920, H / 1080);
    S.scale = s;
    el.stage.style.transform = `translate(${(W - 1920 * s) / 2}px, ${(H - 1080 * s) / 2}px) scale(${s})`;
  }
  window.addEventListener("resize", fitStage);
  // Older browsers without `overflow: clip`: never let the stage scroll itself
  el.stage.addEventListener("scroll", () => { el.stage.scrollTop = 0; el.stage.scrollLeft = 0; });

  function toStage(e) {
    const r = el.stage.getBoundingClientRect();
    return { x: (e.clientX - r.left) / S.scale, y: (e.clientY - r.top) / S.scale };
  }

  /* =================================================================
     Formatting
     ================================================================= */
  const fmt = (n) => (n > 0 ? "+" + n : n < 0 ? "−" + Math.abs(n) : "0");
  const term = (n) => (n === 0 ? "0" : `(${fmt(n)})`);   // CSV style: 0, (+2), (−3)

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

  function buildBubbles() {
    const box = el.water.querySelector(".bubbles");
    for (let i = 0; i < 12; i++) {
      const b = document.createElement("span");
      b.className = "bubble";
      const size = 8 + Math.random() * 18;
      b.style.width = b.style.height = size + "px";
      b.style.left = 20 + Math.random() * 340 + "px";
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
    if (S.water === null) waterFlow(dir); // water only moves when it follows the marker
    if (S.eqLive) renderEq(S.q, { moved: L - S.q.start });
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

  /** Raise/lower the fixed water one level at a time, with the pipe running. */
  async function animateWater(L, stepMs = 450) {
    while (S.water !== L) {
      const dir = Math.sign(L - S.water);
      S.water += dir;
      render();
      waterFlow(dir);
      await FX.sleep(stepMs);
    }
  }

  function flowPipe(which) {
    const img = which === "in" ? el.pipeIn : el.pipeOut;
    const key = which === "in" ? "pipeIn" : "pipeOut";
    img.src = `assets/pipe-${which}-water.png`;
    clearTimeout(S.timers[key]);
    S.timers[key] = setTimeout(() => { img.src = `assets/pipe-${which}-dry.png`; }, 900);
  }

  /** Move the marker one level at a time (used by animations/feedback). */
  async function animateTo(L, stepMs = 240) {
    while (S.level !== L) {
      setLevel(S.level + Math.sign(L - S.level));
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
    if (key && !S.guided) key = null;   // the spotlight is only used in the tutorial
    if (!key) {
      S.focusKey = null;
      el.focus.classList.remove("on");
      el.ring0.classList.remove("on"); el.ring1.classList.remove("on");
      return;
    }
    // One highlight at a time: the second slot always stays parked (NO_HOLE)
    // so the path keeps the same shape and the hole animates between targets.
    const sets = {
      narr: [HOLES.narr, NO_HOLE],   // character sits above the glass layer
      narrOnly: [HOLES.narr, NO_HOLE],
      tank: [HOLES.tank, NO_HOLE],
      pad: [HOLES.padTut, NO_HOLE],
      plate: [HOLES.plate, NO_HOLE],
      gate: [HOLES.gate, NO_HOLE]
    };
    const [a, b] = sets[key];
    el.focus.style.clipPath = `path(evenodd, "M0 0H1920V1080H0Z ${rr(a)} ${rr(b)}")`;
    el.focus.style.webkitClipPath = el.focus.style.clipPath;
    el.focus.classList.add("on");
    const moved = S.focusKey !== key;
    S.focusKey = key;
    placeRing(el.ring0, a, true);
    if (moved) FX.flash(el.ring0, "sweep", 1700);
    placeRing(el.ring1, b, false);
  }

  /* =================================================================
     Narrator
     ================================================================= */
  function setAvatar(mood) {
    const src = `assets/guddu-${mood}.png`;
    if (!el.avatar.src.endsWith(src)) {
      el.avatar.src = src;
      FX.flash(el.avatar, "swap", 600);
    }
  }
  function setBanner(text, mood) {
    el.bannerText.textContent = text;
    el.bannerText.classList.toggle("long", text.length > 70);
    if (mood) setAvatar(mood);
    FX.flash(el.banner, "speak", 400);
  }
  async function say(text, mood) {
    setBanner(text, mood);
    el.character.classList.add("talk");
    await FX.speak(text);
    el.character.classList.remove("talk");
  }
  /** Feedback line: the spotlight moves to the narrator box while Guddu talks,
      then returns to whatever was highlighted before (unless the flow moved on). */
  async function sayFocused(text, mood) {
    const back = S.focusKey;
    focusOn("narrOnly");
    await say(text, mood);
    if (back && S.focusKey === "narrOnly") focusOn(back);
  }

  /** Full narrator moment: glass blur on everything except the narrator. */
  async function narrate(text, { character = S.guided, mood = "happy" } = {}) {
    S.phase = "narrate";
    setBanner(text, mood);
    if (character) el.character.classList.add("in", "talk");
    focusOn(character ? "narr" : "narrOnly");
    await FX.sleep(350);
    await FX.speak(text);           // always plays to the end (no tap-to-skip)
    el.character.classList.remove("talk");
    await FX.sleep(250);
    el.character.classList.remove("in");
  }

  /* =================================================================
     Inactivity
     ================================================================= */
  function stopIdle() { clearTimeout(S.timers.idle); }
  function resetIdle() {
    stopIdle();
    if (S.phase !== "marker" && S.phase !== "entry" && S.phase !== "gate") return;
    S.timers.idle = setTimeout(onIdle, CFG.inactivityMs);
  }
  async function onIdle() {
    const q = S.q;
    if (S.phase === "marker" && q) {
      S.phase = "feedback";
      setMarkerEnabled(false);
      await sayFocused(q.idle.text, "think");
      await runFx(q.idle.fx, q, q.idle);
      setBanner(q.ost, "happy");
      S.phase = "marker";
      setMarkerEnabled(true);
    } else if (S.phase === "entry") {
      FX.flash(el.panel, "nudge", 2600); // the CSV has no inactivity line for the keypad: animation only
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
  function pressLever(btn) { FX.flash(btn, "tap", 520); }
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
    const q = S.q;
    S.phase = "feedback";
    stopIdle();
    setMarkerEnabled(false);
    S.wrongMarker = (S.wrongMarker || 0) + 1;
    const fb = q.wrong[Math.min(S.wrongMarker, q.wrong.length) - 1];
    FX.flash(el.marker, "shake", 500);
    await sayFocused(fb.text, "sad");
    await runFx(fb.fx, q, fb);
    setBanner(q.ost, "happy");
    S.phase = "marker";
    setMarkerEnabled(true);
    resetIdle();
  }

  /** Feedback / inactivity animations named in data.js (fx field).
      Each one does only what its CSV "Incorrect Animation" / "Inactivity Animation"
      cell describes. The marker goes back to the start only for "return". */
  async function runFx(fx, q, opts = {}) {
    const dir = Math.sign(q.target - q.start) || 1;
    const next = q.start + dir;                      // first step toward the target
    switch (fx) {
      case "return":                                 // "Marker returns to its starting position."
        if (S.level !== q.start) await animateTo(q.start, 200);
        break;
      case "pulseZero":                              // "The 0 mark gently pulses." / "0 briefly glows"
        pulseLevel(0);
        await FX.sleep(1400);
        break;
      case "nudge": {                                // "Marker gives a small nudge toward 0."
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
      case "glowDirUp":                              // "Upward direction on the scale glows."
        await glowDirection(q.start, 1); break;
      case "glowDirDown":                            // "Down direction glows."
        await glowDirection(q.start, -1); break;
      case "pulseUpFirst":                           // "Up arrow and first step pulse."
        FX.flash(el.btnUp, "glow", 3000); pulseLevel(q.start + 1);
        await FX.sleep(1500); break;
      case "pulseDownFirst":                         // "Down arrow and first step pulse."
        FX.flash(el.btnDown, "glow", 3000); pulseLevel(q.start - 1);
        await FX.sleep(1500); break;
      case "pulseMarkerNext":                        // "Marker and next level above it pulse."
        el.marker.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.22)" }, { transform: "scale(1)" }],
          { duration: 900, iterations: 3, easing: "ease-in-out" }
        );
        pulseLevel(next);
        await FX.sleep(1500); break;
      case "pulseNext":                              // "First downward step pulses." / "−2 gently pulses."
        pulseLevel(next);
        await FX.sleep(1500); break;
      case "countSteps":                             // "(0 and) the steps highlight / pulse one by one."
        await countSteps(q, !!opts.withStart, !!opts.pulse);
        break;
      case "pulseSteps":                             // "Three levels above 0 gently pulse."
        for (let L = next; L !== q.target + dir; L += dir) pulseLevel(L);
        await FX.sleep(1800); break;
      case "pulseStart":                             // "Starting level +2 pulses."
        pulseLevel(q.start);
        await FX.sleep(1500); break;
      case "highlightStart":                         // "0 highlights as the starting level."
        S.labels[q.start].classList.add("lit");
        await FX.sleep(1600);
        S.labels[q.start].classList.remove("lit"); break;
      case "pulseStartEq":                           // "Starting level +3 and equation pulse."
        pulseLevel(q.start); FX.flash(el.eqPanel, "nudge", 2600);
        await FX.sleep(1500); break;
      case "pulseEqTerms":                           // "0 and (+3) in the equation gently pulse."
        [el.eqA, el.eqB].forEach((n) => FX.flash(n, "eqpulse", 2800));
        await FX.sleep(1500); break;
      case "glowEqOp":                               // "− (−2) in the equation glows."
        [el.eqOp, el.eqB].forEach((n) => FX.flash(n, "eqglow", 2600));
        await FX.sleep(1500); break;
      case "pulseEqOpDirUp":                         // "−(−2) and the upward side of the scale gently pulse."
        [el.eqOp, el.eqB].forEach((n) => FX.flash(n, "eqpulse", 2800));
        await glowDirection(q.start, 1); break;
    }
  }

  /** Pulse one level of the scale (label + both ticks). */
  function pulseLevel(L) {
    [S.labels[L], S.ticks[L], S.tticks[L]].forEach((n) => n && FX.flash(n, "pulse", 2800));
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

  /** Highlight each step toward the target one by one (optionally the start mark first). */
  async function countSteps(q, withStart, pulse) {
    const dir = Math.sign(q.target - q.start);
    const path = [];
    for (let L = withStart ? q.start : q.start + dir; L !== q.target + dir; L += dir) path.push(L);
    // make sure the whole path is visible
    ensureVisible(q.target); ensureVisible(q.start); render();
    await FX.sleep(300);
    for (let i = 0; i < path.length; i++) {
      const lab = S.labels[path[i]];
      if (!lab) continue;
      lab.classList.add("lit");
      if (pulse) pulseLevel(path[i]);
      if (path[i] !== q.start) FX.sparkle(el.fx, LABEL_X, levelY(path[i]), 6, 50);
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
    [el.panel, el.plate, el.connector].forEach((n) => n.classList.toggle("lvl", lvl));
  }

  /* Equation panel (Level 2/3): "a op (b) = ?" in the CSV's notation.
     { moved } shows the live form while the lever moves ("0 + (+1)"),
     { answer } completes it ("0 + (+3) = +3"). */
  function renderEq(q, { moved = null, answer = null } = {}) {
    const e = q.eq, live = moved !== null && moved !== 0;
    el.eqA.textContent = term(e.a);
    el.eqOp.textContent = e.op;
    el.eqB.textContent = `(${fmt(live ? moved : e.b)})`;
    el.eqEq.classList.toggle("gone", live);
    el.eqAns.classList.toggle("gone", live);
    el.eqAns.textContent = answer !== null ? fmt(answer) : "?";
  }
  function completeEq(q) {                        // "Equation completes: 0 + (+3) = +3."
    renderEq(q, { answer: q.target });
    FX.flash(el.eqPanel, "complete", 1000);
  }
  function showEqPanel() {
    if (!el.eqPanel.classList.contains("hidden")) return;
    el.eqPanel.classList.remove("hidden");
    FX.flash(el.eqPanel, "appear", 900);
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
    S.entry = S.entry.slice(0, -1);
    entryDisplay();
  }
  async function checkEntry() {
    if (S.phase !== "entry") return;
    resetIdle();
    const m = /^([+-]?)(\d+)$/.exec(S.entry);
    if (!m) { FX.flash(el.plate, "shake", 500); return; }
    const val = (m[1] === "-" ? -1 : 1) * parseInt(m[2], 10);
    const signOk = !(CFG.requireSignForPositive && val > 0 && m[1] !== "+");
    if (val === S.q.target && signOk) {
      S.resolveEntry && S.resolveEntry();
    } else {
      entryWrong();
    }
  }
  /** Wrong keypad answer. The CSV gives no line for this, so it is shown, not spoken. */
  function entryWrong() {
    S.wrongEntry = (S.wrongEntry || 0) + 1;
    FX.flash(el.plate, "shake", 500);
    FX.badge(el.fx, 790, 350, false);
    S.entry = "";
    entryDisplay();
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
     Tutorial demo — a hand shows the interaction; nothing waits for input
     ================================================================= */
  function stagePt(node, fx = 0.5, fy = 0.5) {
    const r = node.getBoundingClientRect(), st = el.stage.getBoundingClientRect();
    return { x: (r.left - st.left + r.width * fx) / S.scale, y: (r.top - st.top + r.height * fy) / S.scale };
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
  const handHide = () => el.hand.classList.remove("on");
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
  /** The hand moves the marker to the target: drags it (T0) or taps ▲ / ▼ (T1, T2). */
  async function demoMarker(q) {
    if (q.demoMove === "tap") return demoTapButtons(q);
    await handTo(MARKER_GRIP_X, levelY(S.level));
    FX.flash(el.hand, "tap", 400);
    el.marker.classList.add("held");
    await FX.sleep(450);
    const dir = Math.sign(q.target - S.level);
    el.hand.style.transition = "top .45s var(--ease-out), opacity .3s";  // same glide as the marker
    while (S.level !== q.target) {
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
  /** The hand taps the green ▲ or red ▼ button once per level. */
  async function demoTapButtons(q) {
    const dir = Math.sign(q.target - S.level);
    const btn = dir > 0 ? el.btnUp : el.btnDown;
    el.hand.classList.toggle("flip", dir < 0);      // point down from above at ▼ (it sits at the stage's bottom edge)
    const p = stagePt(btn, 0.5, dir > 0 ? 0.55 : 0.42);
    await handTo(p.x, p.y);
    while (S.level !== q.target) {
      FX.flash(el.hand, "tap", 400);
      pressLever(btn);
      setLevel(S.level + dir);
      await FX.sleep(750);
    }
    await FX.sleep(300);
    handHide();
    await FX.sleep(350);
    el.hand.classList.remove("flip");
  }

  /** The hand types the answer (sign, digits) and presses Check. */
  async function demoEntry(q) {
    const keys = [q.target < 0 ? "-" : "+", ...String(Math.abs(q.target))];
    for (const k of keys) {
      const node = document.querySelector(`.key[data-k="${k}"]`);
      await handTap(node);
      applyKey(k);
    }
    await handTap(el.btnCheck);
    handHide();
  }

  /* =================================================================
     Transitions
       · question → question (same level): card flip of the display + equation
       · level → level: the screen closes into a water drop (assets/drop.png)
         on the tank, the drop pops, the next level is set up behind it,
         and the drop swells open onto the new level
     ================================================================= */
  const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FLIP = (deg) => ({ transform: `perspective(900px) rotateX(${deg}deg)` });

  async function flipCards(swap) {
    const cards = [el.plate, el.eqPanel].filter((n) => !n.classList.contains("hidden") && !n.classList.contains("away"));
    if (!cards.length || REDUCED) { swap(); return; }
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

  // Which level a step belongs to (a transition belongs to the level it opens)
  function levelOf(step) {
    const i = DATA.steps.indexOf(step);
    const q = step.type === "question" ? step : DATA.steps.slice(i).find((s) => s.type === "question");
    return q ? q.section : step.id;
  }

  const WIPE = { cx: 1407, cy: 560, ratio: 1260 / 912, anchor: 0.62, max: 5200, drop: 240 };
  function setHole(w) {
    const h = w * WIPE.ratio;
    const size = `${w}px ${h}px, 100% 100%`, pos = `${WIPE.cx - w / 2}px ${WIPE.cy - h * WIPE.anchor}px, 0 0`;
    el.wipe.style.webkitMaskSize = size; el.wipe.style.maskSize = size;
    el.wipe.style.webkitMaskPosition = pos; el.wipe.style.maskPosition = pos;
  }
  function tween(ms, ease, fn) {
    return new Promise((res) => {
      const t0 = performance.now();
      const tick = (now) => { const k = Math.min(1, (now - t0) / ms); fn(ease(k)); if (k < 1) requestAnimationFrame(tick); else res(); };
      requestAnimationFrame(tick);
    });
  }
  const easeIn = (k) => k * k * k, easeOut = (k) => 1 - Math.pow(1 - k, 3);

  async function dropWipe(during) {
    if (REDUCED) {                                                  // reduce-motion: a short fade
      el.wipe.classList.add("plain"); el.wipe.classList.remove("hidden");
      await el.wipe.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: "forwards" }).finished;
      await during();
      await el.wipe.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" }).finished;
      el.wipe.classList.add("hidden"); el.wipe.classList.remove("plain");
      el.wipe.getAnimations().forEach((a) => a.cancel());
      return;
    }
    setHole(WIPE.max);
    el.wipe.classList.remove("hidden");
    await tween(620, easeIn, (e) => setHole(WIPE.max * (1 - e)));  // the screen closes into a drop
    const d = el.wipeDrop;
    d.style.left = WIPE.cx - WIPE.drop / 2 + "px";
    d.style.top = WIPE.cy - WIPE.drop * WIPE.ratio * WIPE.anchor + "px";
    d.classList.remove("hidden");
    await d.animate([{ transform: "scale(0)" }, { transform: "scale(1.14)", offset: 0.65 }, { transform: "scale(1)" }],
      { duration: 420, easing: "cubic-bezier(.34,1.56,.64,1)", fill: "forwards" }).finished;
    await during();                                                 // next level set up behind the curtain
    await FX.sleep(260);
    const swell = d.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(2.8)", opacity: 0 }],
      { duration: 520, easing: "ease-in", fill: "forwards" });
    await tween(720, easeOut, (e) => setHole(WIPE.drop + (WIPE.max - WIPE.drop) * e)); // …and opens onto it
    await swell.finished;
    el.wipe.classList.add("hidden");
    d.classList.add("hidden");
    d.getAnimations().forEach((a) => a.cancel());
  }

  /** Level change: drop wipe, with the board reset for the step that opens the next level. */
  function levelWipe(step) {
    const i = DATA.steps.indexOf(step);
    const nq = step.type === "question" ? step : DATA.steps.slice(i).find((s) => s.type === "question");
    return dropWipe(async () => {
      S.guided = false;
      focusOn(null);
      el.character.classList.remove("in", "talk");
      S.countFrom = null;
      el.marker.classList.remove("locked");
      setWater(null);
      if (nq) jumpTo(nq.start);                                     // new level starts on a settled tank
      if (nq && nq.entry) setPlate(fmt(nq.start));
      if (step.type === "question" && nq.eq) renderEq(nq);          // no transition step (Level 2 → 3)
      setBanner(step.vo, "happy");                                  // the next line is already up when the drop opens
    });
  }

  /* =================================================================
     Celebration
     ================================================================= */
  async function celebrate(q) {
    // CSV: "Small ✓, sparkle and Water Level Marked!" (+ confetti after each example);
    // T0 is "Small ✓ and sparkle" only; crossing 0 (Q4) gets "slightly stronger sparkle/confetti".
    setAvatar("happy");
    const y = levelY(q.target);
    const small = q.celebrate === "small";
    FX.sparkle(el.fx, LABEL_X, y, q.crossZero ? 22 : 16, q.crossZero ? 150 : 120);
    FX.badge(el.fx, 1500, Math.max(200, Math.min(880, y)), true);
    FX.flash(S.labels[q.target], "pulse", 2800);
    if (!small) {
      el.marked.querySelector("span").textContent = DATA.ui.marked;
      FX.flash(el.marked, "show", 2300);
      FX.confetti(el.confetti, { count: q.crossZero ? 150 : 90, x: 820, y: 330, power: q.crossZero ? 1.12 : 1 });
    }
    await say(q.correct, "happy");
    await FX.sleep(500);
  }

  /* =================================================================
     Question runner
     ================================================================= */
  async function runQuestion(q, { flip = false } = {}) {
    S.q = q;
    S.guided = q.section === "tutorial";
    S.wrongMarker = 0; S.wrongEntry = 0;
    S.countFrom = null;
    el.marker.classList.remove("locked");
    setMarkerEnabled(false);
    markProgress(q.id);

    // New question in the same level: the display (and equation) flip over to it
    // while the water re-levels to the new start.
    const showQuestion = () => {
      if (q.entry && q.section !== "tutorial") setPlate(fmt(q.start));   // "The marker is at +2."
      else if (flip) setPlate("?");
      if (q.eq) renderEq(q);
    };
    const flipping = flip ? flipCards(showQuestion) : (showQuestion(), null);

    // Put the water/marker at the question's start level
    setWater(null);
    if (S.level !== q.start) {
      if (Math.abs(S.level - q.start) <= 4) await animateTo(q.start, 180);
      else jumpTo(q.start);
    }
    setView(viewFor(q.start));
    render();
    await flipping;

    // Tutorial: the water shows the answer and the learner matches the marker to it
    if (q.water === "target") setWater(q.target, true);
    else if (q.water === "animate") setWater(q.start, true);

    if (q.eq) showEqPanel();

    /* 1 ─ Narrator moment */
    await narrate(q.vo);

    /* 2 ─ Marker phase */
    setBanner(q.ost, "happy");
    focusOn(q.eq ? "work" : "tank");
    if (q.water === "animate") {
      await FX.sleep(700);            // let the spotlight settle on the tank
      await animateWater(q.target);
      await FX.sleep(400);
    }
    S.countFrom = q.start;
    render();
    await FX.sleep(300);
    if (q.demo) {                     // tutorial: the hand drags the marker
      S.phase = "demo";
      await demoMarker(q);
    } else {
      S.phase = "marker";
      S.eqLive = !!q.liveEq;
      setMarkerEnabled(true);
      el.marker.focus({ preventScroll: true });
      resetIdle();
      await new Promise((r) => (S.resolveMarker = r));
      S.resolveMarker = null;
    }
    S.eqLive = false;
    stopIdle();
    clearTimeout(S.timers.settle);
    setMarkerEnabled(false);
    el.marker.classList.add("locked");
    if (q.eq && !q.entry) completeEq(q);
    else if (q.eq) renderEq(q);        // back to the full question "0 + (+3) = ?" for the keypad step
    S.phase = "feedback";
    FX.sparkle(el.fx, LABEL_X, levelY(q.target), 10, 70);
    FX.flash(S.labels[q.target], "pulse", 2800);
    if (q.target === 0) { FX.flash(S.ticks[0], "pulse", 2800); FX.flash(S.tticks[0], "pulse", 2800); }

    /* 3 ─ Entry phase (number plate + keypad) */
    if (q.entry) {
      showPlate();
      showPanel();
      S.entry = "";
      entryDisplay();
      focusOn("pad");
      await FX.sleep(500);
      if (q.demo) {                   // tutorial: the hand types the answer
        S.phase = "demo";
        await demoEntry(q);
      } else {
        S.phase = "entry";
        resetIdle();
        await new Promise((r) => (S.resolveEntry = r));
        S.resolveEntry = null;
      }
      stopIdle();
      S.phase = "feedback";
      setPlate(fmt(q.target), true);            // "+2 appears on the display."
      if (q.eq) completeEq(q);
    }

    /* 4 ─ Celebrate */
    await celebrate(q);

    S.countFrom = null;
    render();
    markProgress(q.id, true);
  }

  async function runGate(step) {
    S.q = null;
    S.gate = step;
    S.guided = false;                                      // the tutorial is over: no more blur
    focusOn(null);
    const next = DATA.steps[DATA.steps.indexOf(step) + 1];
    if (step.button) [el.panel, el.plate, el.connector].forEach((n) => n.classList.add("away"));
    await narrate(step.vo);
    setBanner(step.ost, "happy");
    if (step.appear === "eqPanel") {                       // "Equation panel appears beside the tank."
      setMode("lvl");                                      // keypad grows; the equation sits on top of it
      if (next && next.entry) setPlate(fmt(next.start));
      await FX.sleep(650);
      if (next && next.eq) renderEq(next);
      showEqPanel();
      await FX.sleep(900);
    }
    if (step.button) {                                     // "Learner taps Start"
      el.gateBtn.textContent = step.button;
      el.gateBtn.classList.remove("hidden");
      focusOn("gate");
    }
    S.phase = "gate";
    resetIdle();
    await new Promise((r) => (S.resolveGate = r));
    S.resolveGate = null;
    stopIdle();
    el.gateBtn.classList.add("hidden");
    if (step.then === "activateScaleDial") {               // "Tank scale and dial become active."
      if (next && next.entry) setPlate(fmt(next.start));
      [el.panel, el.plate, el.connector].forEach((n) => n.classList.remove("away"));
      focusOn("tank");
      await FX.sleep(600);
      await glowDirection(S.view - HALF - 1, 1, 500);     // light sweeps up the whole scale
      focusOn("pad");
      FX.flash(el.panel, "activate", 1300);
      await FX.sleep(1400);
    }
    S.gate = null;
    S.phase = "idle";
  }
  el.gateBtn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    if (S.resolveGate) S.resolveGate();
  });
  // "Learner observes and taps to continue." — a tap anywhere on the game, including
  // the keypad (capture phase, before the keys stop the event); HUD/QA controls excluded
  el.stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest("#btnMute, #btnJump, #jumper, #paused")) return;
    if (S.phase === "gate" && S.gate && S.gate.continueOnTap && S.resolveGate) S.resolveGate();
  }, true);

  /* =================================================================
     Progress dots
     ================================================================= */
  /* =================================================================
     QA level jumper — lists every step; picking one reloads with ?step=ID.
     (Reload, because browsers only allow speech after a tap: press ▶ once.)
     ================================================================= */
  const SECTION_NAMES = { tutorial: "Tutorial", level1: "Level 1", level2: "Level 2 · addition", level3: "Level 3 · subtraction" };
  function initJumper() {
    const btn = $("btnJump"), panel = $("jumper"), list = $("jumpList");
    btn.classList.remove("hidden");
    let group = null, row = null;
    DATA.steps.forEach((s) => {
      const key = s.type === "gate" ? s.id : s.section;
      if (key !== group) {
        group = key;
        const h = document.createElement("h3");
        h.textContent = s.type === "gate" ? `Transition ${s.id.replace("TR", "")}` : SECTION_NAMES[key] || key;
        row = document.createElement("div");
        row.className = "jump-row";
        list.append(h, row);
      }
      const b = document.createElement("button");
      b.className = "jump-btn" + (s.id === (DATA.steps[START_INDEX] || {}).id ? " on" : "");
      const sub = s.type === "gate" ? (s.button ? "Start" : "tap")
        : s.eq ? `${term(s.eq.a)} ${s.eq.op} (${fmt(s.eq.b)})` : `${fmt(s.start)} → ${fmt(s.target)}`;
      b.innerHTML = `<b>${s.id}</b><small>${sub}</small>`;
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

  /** When starting mid-game, put the keypad / progress in the state that step expects. */
  function prepareJump() {
    if (!START_INDEX) return;
    const before = DATA.steps.slice(0, START_INDEX);
    S.guided = DATA.steps[START_INDEX].section === "tutorial";
    if (before.some((s) => s.appear === "eqPanel")) setMode("lvl");
    if (before.some((s) => s.entry)) {
      [el.panel, el.plate, el.connector].forEach((n) => n.classList.remove("hidden"));
      const q = DATA.steps.slice(START_INDEX).find((s) => s.type === "question");
      if (q && q.entry) setPlate(fmt(q.start));
    }
    before.forEach((s) => s.type === "question" && markProgress(s.id, true));
  }

  function buildProgress() {
    el.progress.innerHTML = "";
    DATA.steps.forEach((s) => {
      if (s.type === "gate") { el.progress.appendChild(document.createElement("b")); return; }
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
      if (prev && levelOf(step) !== levelOf(prev)) await levelWipe(step);           // drop wipe between levels
      const flip = !!prev && prev.type === "question" && step.type === "question" && prev.section === step.section;
      prev = step;
      if (step.type === "question") await runQuestion(step, { flip });
      else if (step.type === "gate") await runGate(step);
      else if (step.type === "narrate") await narrate(step.vo);
    }
    // End
    focusOn(null);
    FX.confetti(el.confetti, { count: 260, x: 960, y: 420, power: 1.3, spread: 1.4 });
    el.endScreen.classList.remove("hidden");
  }

  function init() {
    fitStage();
    buildScale();
    buildBubbles();
    buildProgress();
    // Start state for the first step played (the first step, or the QA jump target)
    const first = DATA.steps[START_INDEX];
    const firstQ = DATA.steps.slice(START_INDEX).find((s) => s.type === "question");
    jumpTo(firstQ.start);
    if (first === firstQ && firstQ.water === "target") setWater(firstQ.target, true);
    setBanner(first.ost, "happy");
    prepareJump();
    setMarkerEnabled(false);

    $("btnStart").addEventListener("click", () => {
      FX.unlockSpeech(); // Safari/iOS: speech and audio must be started from this tap
      FX.unlockSfx();
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
  const PRELOAD = ["bg", "tank-empty", "pipe-in-dry", "pipe-in-water", "pipe-out-dry", "pipe-out-water", "track",
    "btn-up", "btn-down", "plate-blue", "panel-cream", "strip-cream", "board-green", "panel-title",
    "banner-bar", "guddu-happy", "guddu-sad", "guddu-think", "guddu-full", "drop"];
  Promise.all(PRELOAD.map((n) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = `assets/${n}.png`; })))
    .then(init);
  fitStage();
})();
