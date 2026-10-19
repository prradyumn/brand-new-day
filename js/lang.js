/* =====================================================================
   Language: English (default) or Hindi (js/lang-hi.js).

   The choice comes from ?lang=hi|en or the last one used (localStorage). For
   Hindi every game line in GAME_DATA is swapped for its Hindi line, so the
   engine (game.js) runs exactly the same; the recorded Hindi voice is looked
   up by the Hindi line (assets/vo/manifest.js).

   The language button shows the language in use. A tap switches in place, with
   no reload (2026-10-19 QA): the lines are swapped in GAME_DATA (an English copy
   is kept to switch back), the page text and the address follow, and game.js
   ("langchange") plays the current step again in the new language.
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

  const PACKS = { hi: window.LANG_HI };
  window.I18N = { tr, translateGame, packs: PACKS };
  if (typeof document === "undefined" || typeof location === "undefined") return;   // tools/ (no page)

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
    const pack = PACKS[lang];
    if (pack) translateGame(data, pack);
    window.LANG = lang;
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((n) => {
      const v = pack && pack.html[n.dataset.i18n] != null ? pack.html[n.dataset.i18n] : pageText[n.dataset.i18n];
      if (v != null) n.innerHTML = v;
    });
    const btn = document.getElementById("btnLang");
    if (btn) btn.setAttribute("aria-label", lang === "hi" ? "भाषा: हिंदी (English में बदलें)" : "Language: English (switch to Hindi)");
    try { localStorage.setItem("lang", lang); } catch (e) {}
    try {
      const q = new URLSearchParams(location.search); q.set("lang", lang);
      history.replaceState(null, "", "?" + q.toString() + location.hash);
    } catch (e) {}
  }

  const url = new URLSearchParams(location.search);
  let lang = url.get("lang");
  try { if (!lang) lang = localStorage.getItem("lang"); } catch (e) {}
  if (!PACKS[lang]) lang = "en";
  apply(lang);

  const btn = document.getElementById("btnLang");
  if (btn) btn.addEventListener("pointerdown", (e) => {
    e.stopPropagation(); e.preventDefault();
    lang = lang === "hi" ? "en" : "hi";
    apply(lang);
    window.dispatchEvent(new CustomEvent("langchange", { detail: lang }));   // game.js: the current step again, in this language
  });
})();
