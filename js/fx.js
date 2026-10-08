/* =====================================================================
   fx.js — reusable helpers: timing, voice-over (TTS), sparkles, confetti.
   No game rules live here.
   ===================================================================== */
(function () {
  "use strict";

  const FX = {};

  /* ---------- timing ---------- */
  FX.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  FX.nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

  /** Re-trigger a CSS animation class on an element. */
  FX.flash = (el, cls, ms) => {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth; // restart animation
    el.classList.add(cls);
    if (ms) setTimeout(() => el.classList.remove(cls), ms);
  };

  /* ---------- Voice-over ----------
     Recorded clips first: assets/vo/manifest.js (made by tools/generate-audio.mjs)
     maps "speaker|line" to an MP3. A line without a clip, or whose clip can't
     play, is read by the browser's SpeechSynthesis instead. Either way the
     promise resolves only when the line has really finished. */
  const synth = window.speechSynthesis || null;
  let voice = null;
  FX.muted = false;
  const CLIPS = window.VO_MANIFEST || {};
  FX.clipFor = (text, speaker) => CLIPS[(speaker || "guddu") + "|" + text] || null;
  // One shared element for every clip: iOS only lets an element that was
  // unlocked by a tap play later, so the same one is reused.
  const voEl = new Audio();
  voEl.preload = "auto";

  function pickVoice(lang) {
    if (!synth) return null;
    const list = synth.getVoices();
    if (!list.length) return null;
    return (
      list.find((v) => v.lang === lang) ||
      list.find((v) => v.lang && v.lang.startsWith("en-IN")) ||
      list.find((v) => /female|zira|samantha|google uk english female/i.test(v.name) && v.lang.startsWith("en")) ||
      list.find((v) => v.lang && v.lang.startsWith("en")) ||
      list[0]
    );
  }
  if (synth) synth.onvoiceschanged = () => { voice = pickVoice(FX.lang || "en-IN"); };

  /** Reading-time estimate used when muted / no voice (ms). */
  FX.readTime = (text) => Math.max(1600, text.length * 55 + 900);

  /* How far the current line has got, 0…1, so the game can time an animation to a
     word (game.js untilWord). Recorded clip: its playhead. Browser voice or muted:
     the time since the line began, against its reading time. */
  let line = null, lastLine = null;               // line: { text, t0, ms, clip }
  /* How open the speaker's mouth should be right now, 0…1 (game.js lip-sync).
     Recorded clip: its loudness at the playhead (assets/vo/lipsync.js, one digit per
     50 ms). Browser voice or muted: a talking rhythm for the line's reading time. */
  const LIPS = window.VO_LIPSYNC || {};
  FX.mouth = () => {
    if (!line) return 0;
    if (line.clip) {
      const env = LIPS[line.clipSrc];
      if (!env || voEl.paused) return 0;
      const i = Math.floor(voEl.currentTime / 0.05);
      return i < env.length ? +env[i] / 9 : 0;
    }
    const t = performance.now() - line.t0;
    if (t > line.ms - 700) return 0;                // the reading time includes a pause at the end
    const s = t / 1000;
    return Math.max(0, .55 * Math.sin(s * 14) + .45 * Math.sin(s * 8.7 + 1.3));
  };
  FX.progress = (text) => {
    if (!line || line.text !== text) return lastLine === text ? 1 : 0;
    if (line.clip) return voEl.duration ? voEl.currentTime / voEl.duration : 0;
    return Math.min(1, (performance.now() - line.t0) / line.ms);
  };

  /* The voice only plays while the game is on screen. When the tab is hidden
     or the window loses focus, the current line is cut off and the game waits;
     when the learner comes back, that line starts again from the beginning. */
  let blurred = false;
  const isAway = () => document.hidden || blurred;
  const leaveHooks = new Set();
  let backWaiters = [];
  const whenBack = () => (isAway() ? new Promise((r) => backWaiters.push(r)) : Promise.resolve());
  function onPresence() {
    if (isAway()) {
      if (synth) synth.cancel();
      voEl.pause();
      FX.stopSfx(true);
      leaveHooks.forEach((h) => h());
    } else {
      const w = backWaiters; backWaiters = [];
      w.forEach((r) => r());
    }
    syncMusic();
  }
  document.addEventListener("visibilitychange", onPresence);
  window.addEventListener("blur", () => { blurred = true; onPresence(); });
  window.addEventListener("focus", () => { blurred = false; onPresence(); });
  // Any tap or key press means the learner is here, even if a focus event was
  // missed (embedded previews such as VS Code's don't always send one).
  const here = () => { if (blurred) { blurred = false; onPresence(); } };
  window.addEventListener("pointerdown", here, true);
  window.addEventListener("keydown", here, true);
  // Closing or reloading the tab: the OS voice can keep talking after the page
  // is gone, so silence it on the way out and clear any leftover on load.
  const silence = () => { if (synth) synth.cancel(); voEl.pause(); FX.stopSfx && FX.stopSfx(true); music.a && music.a.pause(); };
  window.addEventListener("pagehide", silence);
  window.addEventListener("beforeunload", silence);

  let gen = 0; // bumped by every new line and by stopSpeech(), so stale lines never replay
  const muteHooks = new Set();

  /** Tell the page once when the browser can't play the voice (game.js shows a notice). */
  let voiceWarned = false;
  function voiceProblem(reason) {
    console.warn("[voice] speech did not play:", reason);
    if (voiceWarned) return;
    voiceWarned = true;
    window.dispatchEvent(new CustomEvent("fx:voiceproblem", { detail: reason }));
  }

  /** One attempt at a line. Resolves true if it was cut off because the learner left. */
  function speakOnce(text, spoken, opts) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      let done = false, timer = null, poll = null, muting = false, clipOn = false;
      line = { text, t0, ms: FX.readTime(text), clip: false };
      if (lastLine === text) lastLine = null;
      const stopClip = () => {
        if (!clipOn) return;
        clipOn = false;
        if (line && line.text === text) {               // carry on from the same point on the timer (muted mid-line)
          const f = voEl.duration ? voEl.currentTime / voEl.duration : 0;
          Object.assign(line, { clip: false, t0: performance.now() - f * line.ms });
        }
        voEl.onended = voEl.onerror = voEl.onplaying = null;
        voEl.pause();
      };
      const finish = (cut) => {
        if (done) return;
        done = true;
        if (line && line.text === text) { line = null; if (!cut) lastLine = text; }
        clearTimeout(timer);
        clearInterval(poll);
        stopClip();
        leaveHooks.delete(onLeave);
        muteHooks.delete(onMute);
        resolve(!!cut);
      };
      const onLeave = () => finish(true);
      leaveHooks.add(onLeave);
      // Without sound the text stays up for its reading time, counted from when the line began.
      const readFallback = () => {
        clearTimeout(timer);
        timer = setTimeout(finish, Math.max(0, FX.readTime(text) - (performance.now() - t0)));
      };
      // Muting mid-line doesn't skip ahead: the line goes quiet and the text stays up.
      const onMute = () => {
        muting = true;
        clearInterval(poll);
        stopClip();
        try { synth && synth.cancel(); } catch (e) {}
        readFallback();
      };
      muteHooks.add(onMute);

      if (FX.muted) { readFallback(); return; }

      /* ---- Recorded clip ---- */
      const clip = FX.clipFor(text, opts.speaker);
      if (clip) {
        clipOn = true;
        line.clip = true; line.clipSrc = clip;
        let started = false;
        const toSynth = (why) => {                       // clip missing / blocked: the browser voice reads it
          if (done || muting || !clipOn) return;
          console.warn("[voice] clip did not play, using the browser voice:", clip, why);
          stopClip();
          startSynth();
        };
        voEl.onplaying = () => {
          if (started) return;
          started = true;
          clearTimeout(timer);                           // a generous cap only guards against a stuck element
          timer = setTimeout(finish, ((voEl.duration || 10) * 3 + 10) * 1000);
        };
        voEl.onended = () => finish();
        voEl.onerror = () => toSynth("error");
        voEl.src = clip;
        voEl.volume = 1;
        const p = voEl.play();
        if (p && p.catch) p.catch((e) => toSynth(e && e.name));
        timer = setTimeout(() => { if (!started) toSynth("did not start"); }, 5000);
        return;
      }
      startSynth();

      /* ---- Browser voice ---- */
      function startSynth() {
        if (!synth) { readFallback(); return; }
        /* The line counts as done when the speech engine has finished it:
             - `onend` is the normal signal;
             - polling `speaking` catches engines that drop `onend` (Chrome);
             - the line has started only when `onstart` fires. Chrome can report
               `speaking` while no sound comes out and never end the line, so
               `speaking` alone doesn't count: without `onstart` the text gets its
               reading time, a notice appears, and the game carries on;
             - a cap of 1.5× the reading time guards against an engine that hangs mid-line. */
        let started = false, quiet = 0;
        const markStarted = () => {
          if (started || done) return;
          started = true;
          clearTimeout(timer);
          timer = setTimeout(finish, FX.readTime(text) * 1.5 + 2500);
        };
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (started) return;
          voiceProblem("no speech started");
          finish();
        }, Math.max(2500, FX.readTime(text)));

        const go = () => {
          if (done || muting) return;
          try {
            if (synth.paused) synth.resume(); // Chrome can be left paused after the tab was hidden
            const u = new SpeechSynthesisUtterance(spoken);
            FX._utterance = u; // keep a reference: Chrome drops `onend` if the utterance is garbage-collected
            voice = voice || pickVoice(FX.lang || "en-IN");
            if (voice) u.voice = voice;
            u.lang = (voice && voice.lang) || FX.lang || "en-IN";
            u.rate = opts.rate || FX.rate || 0.95;
            u.pitch = opts.pitch || 1.05;   // game.js: a little higher for Pari
            u.onstart = () => { console.info("[voice] speaking:", text, "| voice:", u.voice ? u.voice.name : "default"); markStarted(); };
            u.onend = () => { if (!muting) finish(); };
            u.onerror = (e) => {
              if (muting) return;
              // our own cancel (a newer line / leaving) ends it; a real failure keeps the reading time
              if (e && (e.error === "interrupted" || e.error === "canceled")) finish();
              else { voiceProblem(e && e.error); readFallback(); }
            };
            synth.speak(u);
            poll = setInterval(() => {
              if (synth.speaking) { quiet = 0; return; }
              if (started && !synth.pending && ++quiet >= 3) finish();
            }, 250);
          } catch (e) {
            voiceProblem(e.message);
            readFallback();
          }
        };
        // speak() straight after cancel() is silently dropped by some browsers,
        // so clear a previous line first and give the engine a moment.
        if (synth.speaking || synth.pending) { synth.cancel(); setTimeout(go, 80); }
        else go();
      }
    });
  }

  /** Speak text. Resolves when finished (or after a reading-time fallback).
      opts: { speaker, pitch, rate } — `speaker` picks the recorded clip. */
  FX.speak = async (text, opts = {}) => {
    const my = ++gen;
    // Screen-reader friendly symbols (browser voice only; clips are recorded from the same line)
    const spoken = window.LANG === "hi" && window.LANG_HI ? window.LANG_HI.spoken(text) : text   // Hindi: "ऋण 3", "धन 2"
      .replace(/−/g, "minus ")
      .replace(/\+(\d)/g, "plus $1")
      .replace(/\(|\)/g, "")
      .replace(/=/g, " equals ")
      .replace(/\?$/, "?");
    duck(true);                                   // music dips under the voice
    try {
      for (;;) {
        if (isAway()) {
          // tell the page it's waiting for the learner, so it can show a "Paused" card
          window.dispatchEvent(new Event("fx:paused"));
          await whenBack();
          window.dispatchEvent(new Event("fx:resumed"));
        }
        if (my !== gen) return;
        const cut = await speakOnce(text, spoken, opts);
        if (!cut || my !== gen) return;
      }
    } finally {
      if (my === gen) duck(false);
    }
  };

  FX.stopSpeech = () => { gen++; if (synth) synth.cancel(); voEl.pause(); duck(false); };

  /** Call synchronously inside the Play click. Safari only allows speech and
      audio that start from a tap: this unlocks the browser voice and the clip player. */
  FX.unlockSpeech = () => {
    const first = Object.values(CLIPS)[0];
    if (first) {
      try {
        voEl.src = first; voEl.muted = false; voEl.volume = 0;
        const p = voEl.play();
        if (p && p.then) p.then(() => { if (voEl.volume === 0) voEl.pause(); }).catch(() => {});
      } catch (e) {}
    }
    if (!synth) return;
    try {
      synth.getVoices();
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      synth.speak(u);
    } catch (e) {}
  };

  /** Mute / unmute voice, music + sound effects without skipping the current line. */
  FX.setMuted = (m) => {
    FX.muted = !!m;
    if (FX.muted) { muteHooks.forEach((h) => h()); FX.stopSfx(); }
    syncMusic();
  };

  /* ---------- Background music (Lyria 3 loop) ----------
     Plays from the Play tap, loops, dips under every spoken line, and is
     silent while muted or while the learner is away. The file itself is
     mixed quiet (−24 LUFS), because iOS ignores element volume. */
  const music = { a: null, base: 0.7, on: false, ducked: false, fade: null };
  FX.loadMusic = (url, vol = 0.7) => {
    const a = new Audio(url);
    a.loop = true; a.preload = "auto"; a.volume = 0;
    music.a = a; music.base = vol;
  };
  /** Call from the Play click (a user gesture). */
  FX.startMusic = () => {
    if (!music.a) return;
    music.on = true;
    if (!FX.muted && !isAway()) music.a.play().catch(() => {});
    syncMusic();
  };
  function duck(on) { music.ducked = on; syncMusic(); }
  function syncMusic() {
    const a = music.a;
    if (!a) return;
    if (isAway()) {                               // left the tab or window: silent at once (a hidden tab slows the fade timer)
      clearInterval(music.fade); a.volume = 0; a.pause(); return;
    }
    const target = !music.on || FX.muted ? 0 : music.base * (music.ducked ? 0.4 : 1);   // under a line: about 25 dB below the voice
    if (target > 0 && a.paused) a.play().catch(() => {});
    clearInterval(music.fade);
    const from = a.volume, t0 = performance.now(), ms = target > from ? 900 : 350;
    music.fade = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = Math.max(0, Math.min(1, from + (target - from) * k));
      if (k >= 1) { clearInterval(music.fade); if (target === 0) a.pause(); }
    }, 30);
  }

  /* ---------- Sound effects (looping water) ----------
     Plain <audio> elements so it also works when index.html is opened from
     disk (file://). A loop keeps running while it is "fed" and fades out
     `holdMs` after the last call. Silent while muted or while the learner is
     away from the game, like the voice. */
  const SFX = {};
  FX.sfxVolume = 0.55;

  FX.loadSfx = (map) => {
    for (const [name, url] of Object.entries(map)) {
      const a = new Audio(url);
      a.preload = "auto"; a.loop = true; a.volume = 0;
      SFX[name] = { a, on: false, timer: null, fade: null };
    }
  };

  /** Call from the Play click: mobile browsers only allow audio started by a gesture. */
  FX.unlockSfx = () => {
    // Safari only counts an unmuted play (volume 0 here) as permission to play later.
    for (const k in SFX) {
      const s = SFX[k], a = s.a;
      a.muted = false; a.volume = 0;
      a.play().then(() => { if (!s.on) a.pause(); }).catch(() => {});
    }
  };

  function fadeTo(s, v, ms, done) {
    clearInterval(s.fade);
    const from = s.a.volume, t0 = performance.now();
    s.fade = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      s.a.volume = Math.max(0, Math.min(1, from + (v - from) * k));
      if (k >= 1) { clearInterval(s.fade); s.fade = null; if (done) done(); }
    }, 30);
  }
  function stopOne(s, ms) {
    s.on = false;
    clearTimeout(s.timer);
    if (!ms) { clearInterval(s.fade); s.a.volume = 0; s.a.pause(); return; }
    fadeTo(s, 0, ms, () => { if (!s.on) s.a.pause(); });
  }

  /** Keep the named loop playing for another `holdMs` (starts it if needed). */
  FX.sfxLoop = (name, holdMs = 800) => {
    const s = SFX[name];
    if (!s || FX.muted || isAway()) return;
    for (const k in SFX) if (k !== name && SFX[k].on) stopOne(SFX[k], 120);
    if (!s.on) {
      s.on = true;
      if (s.a.paused) {
        // start somewhere random in the clip so repeats don't sound identical
        try { if (s.a.duration) s.a.currentTime = Math.random() * Math.max(0, s.a.duration - 2); } catch (e) {}
        s.a.play().catch(() => {});
      }
      fadeTo(s, FX.sfxVolume, 120);
    }
    clearTimeout(s.timer);
    s.timer = setTimeout(() => stopOne(s, 350), holdMs);
  };

  /* ---------- One-shot sound effects (clicks, chimes, pops) ----------
     Each sound has a small pool of <audio> elements so quick repeats
     (typing, ticking through levels) overlap instead of cutting off.
     Same rules as the loops: silent while muted or away. */
  const SHOTS = {};
  FX.loadShots = (map) => {
    for (const [name, def] of Object.entries(map)) {
      const { url, vol = 0.7, pool = 3 } = typeof def === "string" ? { url: def } : def;
      SHOTS[name] = { vol, i: 0, els: Array.from({ length: pool }, () => { const a = new Audio(url); a.preload = "auto"; return a; }) };
    }
  };
  /** Play a one-shot. `vol` scales the sound's own level (0–1). */
  FX.sfx = (name, vol = 1) => {
    const s = SHOTS[name];
    if (!s || FX.muted || isAway()) return;
    const a = s.els[s.i = (s.i + 1) % s.els.length];
    try { a.currentTime = 0; } catch (e) {}
    a.volume = Math.max(0, Math.min(1, s.vol * vol));
    a.play().catch(() => {});
  };
  const unlockLoops = FX.unlockSfx;
  FX.unlockSfx = () => {
    unlockLoops();
    for (const k in SHOTS) for (const a of SHOTS[k].els) {
      a.muted = false; a.volume = 0;
      a.play().then(() => { if (a.volume === 0) { a.pause(); a.currentTime = 0; } }).catch(() => {}); // don't cut a real sound that started meanwhile
    }
  };

  /** Stop every loop (hard = cut instantly, used when leaving the page) and any playing one-shot. */
  FX.stopSfx = (hard) => {
    for (const k in SFX) stopOne(SFX[k], hard ? 0 : 100);
    for (const k in SHOTS) for (const a of SHOTS[k].els) if (!a.paused) a.pause();
  };

  /* ---------- Sparkles ---------- */
  FX.sparkle = (layer, x, y, n = 14, spread = 110) => {
    for (let i = 0; i < n; i++) {
      const s = document.createElement("div");
      s.className = i % 3 === 0 ? "star" : "spark";
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const d = spread * (0.55 + Math.random() * 0.6);
      s.style.left = x + "px";
      s.style.top = y + "px";
      s.style.setProperty("--dx", Math.cos(a) * d + "px");
      s.style.setProperty("--dy", Math.sin(a) * d + "px");
      s.style.animationDelay = Math.random() * 0.12 + "s";
      layer.appendChild(s);
      setTimeout(() => s.remove(), 1300);
    }
  };

  FX.badge = (layer, x, y, good = true) => {
    const b = document.createElement("div");
    b.className = "tick-badge" + (good ? "" : " cross-badge");
    b.textContent = good ? "✓" : "✗";
    b.style.left = x + "px";
    b.style.top = y + "px";
    layer.appendChild(b);
    setTimeout(() => b.remove(), 1400);
  };

  /* ---------- Confetti (canvas) ---------- */
  const COLORS = ["#ffe11a", "#3fbf2f", "#1d7fe8", "#ff7a1a", "#ff4d6d", "#7ee0ff", "#ffffff"];
  let running = [];
  let raf = null;

  FX.confetti = (canvas, { count = 120, x = 960, y = 300, spread = 1, power = 1 } = {}) => {
    const ctx = canvas.getContext("2d");
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1 * spread;
      const v = (9 + Math.random() * 11) * power;
      running.push({
        x: x + (Math.random() - 0.5) * 80, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        w: 10 + Math.random() * 10, h: 6 + Math.random() * 8,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
        c: COLORS[(Math.random() * COLORS.length) | 0], life: 0
      });
    }
    if (!raf) {
      const step = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        running = running.filter((p) => p.y < canvas.height + 40 && p.life < 260);
        for (const p of running) {
          p.life++;
          p.vy += 0.35; p.vx *= 0.99; p.vy *= 0.99;
          p.x += p.vx; p.y += p.vy; p.r += p.vr;
          ctx.save();
          ctx.translate(p.x, p.y); ctx.rotate(p.r);
          ctx.fillStyle = p.c;
          ctx.globalAlpha = Math.min(1, (260 - p.life) / 60);
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 1.7)));
          ctx.restore();
        }
        raf = running.length ? requestAnimationFrame(step) : (ctx.clearRect(0, 0, canvas.width, canvas.height), null);
      };
      raf = requestAnimationFrame(step);
    }
  };

  if (synth) synth.cancel();      // clear a voice left over from a previous page

  window.FX = FX;
})();
