/* =====================================================================
   Language: English (default) or Hindi (js/lang-hi.js).

   The choice comes from ?lang=hi|en or the last one used (localStorage). For
   Hindi every game line in GAME_DATA is swapped for its Hindi line, so the
   engine (game.js) runs exactly the same; the recorded Hindi voice is looked
   up by the Hindi line (assets/vo/manifest.js).

   The language button shows the language in use; a tap opens the list of languages
   (English, Hindi with voice; Gujarati, Marathi, Tamil, Telugu, Odia as text, from
   lang/*.json). A pick switches in place, with no reload (2026-10-19 QA): the lines
   are swapped in GAME_DATA (an English copy is kept to switch back), the page text and
   the address follow, and game.js ("langchange") plays the current step again.
   tools/generate-audio.mjs uses I18N.translateGame to record the Hindi lines.
   ===================================================================== */
(function () {
  /** Translate one line: exact match, else the first pattern that fits. */
  function tr(pack, s) {
    if (s == null || s === "") return s;
    if (Object.prototype.hasOwnProperty.call(pack.exact, s)) return pack.exact[s];
    for (const [re, f] of pack.patterns) {
      const m = re.exec(s);
      if (m) return f(m, (x) => tr(pack, x));
    }
    (pack.missing = pack.missing || []).push(s);
    if (typeof console !== "undefined") console.warn("[lang] no translation for:", s);
    return s;
  }

  /** Swap every line of the game data for its translation (in place). */
  function translateGame(data, pack) {
    const t = (s) => tr(pack, s);
    for (const step of data.steps) {
      for (const k of ["vo", "ost", "button"]) if (step[k]) step[k] = t(step[k]);
      if (step.idle) step.idle.text = t(step.idle.text);
      for (const part of [step.lever, step.entry]) {
        if (!part) continue;
        part.vo = t(part.vo); part.ost = t(part.ost); part.correct = t(part.correct);
        (part.wrong || []).forEach((w) => { w.text = t(w.text); });
        if (part.idle) part.idle.text = t(part.idle.text);
      }
      if (pack.steps && pack.steps[step.id]) Object.assign(step, JSON.parse(JSON.stringify(pack.steps[step.id])));   // cue words inside the lines (a copy: switching back must not change the pack)
    }
    for (const k in data.ui) if (pack.ui[k]) data.ui[k] = pack.ui[k];
    data.cues = pack.cues;
    data.config.speechLang = pack.speechLang;
    return data;
  }

  /* The languages on the language button. English and Hindi have recorded voice-over (their
     lines are in data.js / lang-hi.js). The others are text only (2026-10-26): their lines are in
     lang/<code>.json (made from lang/en.json, see tools/export-lang.mjs), loaded when picked; the
     text stays up for its reading time instead of a voice. `font`: a face with that script. */
  const LANGS = [
    { code: "en", name: "English" },
    { code: "hi", name: "हिंदी", font: "Baloo 2" },
    { code: "gu", name: "ગુજરાતી", font: "Baloo Bhai 2", speech: "gu-IN" },
    { code: "mr", name: "मराठी", font: "Baloo 2", speech: "mr-IN" },
    { code: "ta", name: "தமிழ்", font: "Baloo Thambi 2", speech: "ta-IN" },
    { code: "te", name: "తెలుగు", font: "Baloo Tammudu 2", speech: "te-IN" },
    { code: "or", name: "ଓଡ଼ିଆ", font: "Baloo Bhaina 2", speech: "or-IN" }
  ];
  const meta = (code) => LANGS.find((l) => l.code === code);
  const PACKS = { hi: window.LANG_HI };
  window.I18N = { tr, translateGame, packs: PACKS, langs: LANGS };
  if (typeof document === "undefined" || typeof location === "undefined") return;   // tools/ (no page)

  /** A lang/<code>.json file as a pack: every line by exact match; equations stay as they are.
      With no voice the equation's cue words are its numbers ("3" in "goes up 3 levels"). */
  function fromJson(j, m) {
    return {
      speechLang: m.speech, html: j.html || {}, ui: j.ui || {}, exact: j.lines || {}, textOnly: true,
      patterns: [
        [/^[()+−\d\s=?]+$/, (x) => x[0]],
        [/^(.+ = \?)\n([\s\S]+)$/, (x, t) => `${x[1]}\n${t(x[2])}`]
      ],
      cues: { dir: null, levels: "{n}" },
      steps: { P2: { build: { a: "+1", op: "2", b: "2", ans: "+3" } }, P3: { build: { a: "+3", op: "5", b: "5", ans: "−2" } } }
    };
  }
  function load(code) {
    if (code === "en" || PACKS[code]) return Promise.resolve();
    return fetch(`lang/${code}.json`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((j) => { PACKS[code] = fromJson(j, meta(code)); });
  }
  const fonts = new Set(["Baloo 2", undefined]);                  // Baloo 2 comes with the page
  function loadFont(name) {
    if (fonts.has(name)) return;
    fonts.add(name);
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, "+")}:wght@600;700;800&display=swap`;
    document.head.appendChild(l);
  }

  const data = window.GAME_DATA;
  const EN = JSON.parse(JSON.stringify({ steps: data.steps, ui: data.ui, speechLang: data.config.speechLang }));
  const pageText = {};                                            // the page's own English text (data-i18n)
  document.querySelectorAll("[data-i18n]").forEach((n) => { pageText[n.dataset.i18n] = n.innerHTML; });

  /** Copy every value of `src` into `dst`, keeping the objects the game already holds. */
  function copyInto(dst, src) {
    for (const k of Object.keys(src)) {
      const v = src[k];
      if (v && typeof v === "object" && dst[k] && typeof dst[k] === "object") copyInto(dst[k], v);
      else dst[k] = v && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v;
    }
  }
  function apply(lang) {
    data.steps.forEach((st, i) => copyInto(st, EN.steps[i]));   // back to English first
    copyInto(data.ui, EN.ui);
    data.cues = undefined;
    data.config.speechLang = EN.speechLang;
    const pack = PACKS[lang], m = meta(lang);
    if (pack) translateGame(data, pack);
    window.LANG = lang;
    window.LANG_TEXT_ONLY = !!(pack && pack.textOnly);           // fx.js: no voice, the text stays up for its reading time
    const root = document.documentElement;
    root.lang = lang;
    if (m.font) { loadFont(m.font); root.dataset.script = lang; root.style.setProperty("--script-font", `"${m.font}"`); }
    else { delete root.dataset.script; root.style.removeProperty("--script-font"); }
    document.querySelectorAll("[data-i18n]").forEach((n) => {
      const v = pack && pack.html[n.dataset.i18n] != null ? pack.html[n.dataset.i18n] : pageText[n.dataset.i18n];
      if (v != null) n.innerHTML = v;
    });
    const btn = document.getElementById("btnLang");
    if (btn) btn.setAttribute("aria-label", `Language: ${m.name}`);
    menu.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.lang === lang));
    try { localStorage.setItem("lang", lang); } catch (e) {}
    try {
      const q = new URLSearchParams(location.search); q.set("lang", lang);
      history.replaceState(null, "", "?" + q.toString() + location.hash);
    } catch (e) {}
  }

  /* The language button opens a list of the languages, each in its own script. */
  const menu = document.createElement("div");
  menu.id = "langMenu"; menu.className = "hidden"; menu.setAttribute("role", "menu");
  LANGS.forEach((l) => {
    const b = document.createElement("button");
    b.dataset.lang = l.code; b.textContent = l.name; b.setAttribute("role", "menuitemradio");
    if (l.font) b.style.fontFamily = `"${l.font}", system-ui, sans-serif`;
    menu.appendChild(b);
  });
  const btn = document.getElementById("btnLang");
  if (btn) btn.insertAdjacentElement("afterend", menu);
  const closeMenu = () => menu.classList.add("hidden");
  // (the menu's names in their own faces: fetch those now so the list never shows boxes)
  LANGS.forEach((l) => l.font && l.font !== "Baloo 2" && document.fonts && document.fonts.load && document.fonts.load(`800 20px "${l.font}"`, l.name).catch(() => {}));

  const url = new URLSearchParams(location.search);
  let lang = url.get("lang");
  try { if (!lang) lang = localStorage.getItem("lang"); } catch (e) {}
  if (!meta(lang)) lang = "en";
  const show = () => document.documentElement.classList.add("lang-ready");   // style.css keeps the page hidden until now (no flash of the other language on reload)
  if (PACKS[lang] || lang === "en") { apply(lang); show(); window.I18N.ready = Promise.resolve(); }
  else window.I18N.ready = load(lang).catch(() => { lang = "en"; }).then(() => { apply(lang); show(); });   // game.js waits for this before it starts

  if (btn) btn.addEventListener("pointerdown", (e) => {
    e.stopPropagation(); e.preventDefault();
    menu.classList.toggle("hidden");
  });
  menu.addEventListener("pointerdown", (e) => {
    e.stopPropagation(); e.preventDefault();
    const b = e.target.closest("button[data-lang]");
    if (!b) return;
    closeMenu();
    const next = b.dataset.lang;
    if (next === lang) return;
    load(next).then(() => {
      lang = next;
      apply(lang);
      window.dispatchEvent(new CustomEvent("langchange", { detail: lang }));   // game.js: the current step again, in this language
    }).catch(() => console.warn("[lang] could not load", next));
  });
  document.addEventListener("pointerdown", (e) => { if (!menu.classList.contains("hidden") && !e.target.closest("#langMenu, #btnLang")) closeMenu(); }, true);
})();
