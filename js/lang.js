/* =====================================================================
   Language: English (default) or Hindi (js/lang-hi.js).

   The choice comes from ?lang=hi|en or the last one used (localStorage). For
   Hindi every game line in GAME_DATA is swapped for its Hindi line before the
   game starts, so the engine (game.js) runs exactly the same; the recorded
   Hindi voice is looked up by the Hindi line (assets/vo/manifest.js).

   The हिंदी / English button reloads the game at the same step in the other
   language (a reload, because browsers only allow speech after a tap — press ▶).
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
      if (pack.steps && pack.steps[step.id]) Object.assign(step, pack.steps[step.id]);   // cue words inside the lines
    }
    for (const k in data.ui) if (pack.ui[k]) data.ui[k] = pack.ui[k];
    data.cues = pack.cues;
    data.config.speechLang = pack.speechLang;
    return data;
  }

  const PACKS = { hi: window.LANG_HI };
  window.I18N = { tr, translateGame, packs: PACKS };
  if (typeof document === "undefined" || typeof location === "undefined") return;   // tools/ (no page)

  const url = new URLSearchParams(location.search);
  let lang = url.get("lang");
  try { if (!lang) lang = localStorage.getItem("lang"); } catch (e) {}
  if (!PACKS[lang]) lang = "en";
  try { localStorage.setItem("lang", lang); } catch (e) {}
  window.LANG = lang;
  document.documentElement.lang = lang;

  const pack = PACKS[lang];
  if (pack) translateGame(window.GAME_DATA, pack);
  // the page's own text (index.html data-i18n="title" / "check" / "langBtn")
  document.querySelectorAll("[data-i18n]").forEach((n) => {
    const v = pack && pack.html[n.dataset.i18n];
    if (v) n.innerHTML = v;
  });

  // हिंदी / English: reload at the same step in the other language
  const btn = document.getElementById("btnLang");
  if (btn) {
    btn.setAttribute("aria-label", lang === "hi" ? "Switch to English" : "हिंदी में बदलें");
    btn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      const next = new URLSearchParams(location.search);
      next.set("lang", lang === "hi" ? "en" : "hi");
      const st = window.__GAME_STATE;
      if (st && st.stepId) next.set("step", st.stepId); else next.delete("step");
      try { localStorage.setItem("lang", next.get("lang")); } catch (err) {}
      location.search = "?" + next.toString();
    });
  }
})();
