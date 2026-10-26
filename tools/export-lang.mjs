/* =====================================================================
   Writes lang/en.json (every English line the game shows, the list to
   translate) and lang/hi.json (the Hindi lines, from js/lang-hi.js), and
   checks every other lang/*.json against en.json (missing / extra lines).

     node tools/export-lang.mjs

   The game reads lang/<code>.json for the text-only languages (js/lang.js);
   English and Hindi play from data.js / lang-hi.js (their voice-over is keyed
   by those lines), the two JSON files here are exports of them.
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ["js/data.js", "js/lang-hi.js", "js/lang.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
const DATA = ctx.GAME_DATA, I18N = ctx.I18N;

/** Every line translateGame (js/lang.js) swaps, in game order, once each. */
function lines(data) {
  const out = [];
  const add = (s) => { if (s && !out.includes(s) && !/^[()+−\d\s=?]+$/.test(s)) out.push(s); };
  for (const step of data.steps) {
    for (const k of ["vo", "ost", "button"]) add(step[k]);
    if (step.idle) add(step.idle.text);
    for (const part of [step.lever, step.entry]) {
      if (!part) continue;
      add(part.vo); add(part.ost); add(part.correct);
      (part.wrong || []).forEach((w) => add(w.text));
      if (part.idle) add(part.idle.text);
    }
  }
  return out;
}
const html = {};
for (const m of fs.readFileSync(path.join(ROOT, "index.html"), "utf8").matchAll(/data-i18n="(\w+)">([\s\S]*?)<\/(?:b|h1|button)>/g)) html[m[1]] = m[2];

const EN = lines(DATA);
const write = (code, obj) => fs.writeFileSync(path.join(ROOT, "lang", code + ".json"), JSON.stringify(obj, null, 2) + "\n");
write("en", { code: "en", name: "English", html, ui: DATA.ui, lines: Object.fromEntries(EN.map((s) => [s, s])) });

const HI = ctx.LANG_HI;
const hiLines = Object.fromEntries(EN.map((s) => [s, I18N.tr(HI, s)]));
write("hi", { code: "hi", name: "हिंदी", html: HI.html, ui: HI.ui, lines: hiLines });
console.log(`lang/en.json, lang/hi.json: ${EN.length} lines` + (HI.missing ? `, Hindi missing ${HI.missing.length}` : ""));

for (const f of fs.readdirSync(path.join(ROOT, "lang")).filter((f) => f.endsWith(".json") && !/^(en|hi)\.json$/.test(f))) {
  const pack = JSON.parse(fs.readFileSync(path.join(ROOT, "lang", f), "utf8"));
  const have = pack.lines || {};
  const missing = EN.filter((s) => !have[s]), extra = Object.keys(have).filter((s) => !EN.includes(s));
  const keys = ["title", "check", "start", "langName"].filter((k) => !(pack.html || {})[k]).concat(Object.keys(DATA.ui).filter((k) => !(pack.ui || {})[k]));
  console.log(`lang/${f}: ${EN.length - missing.length}/${EN.length} lines` + (missing.length ? `, MISSING ${missing.length}: ${missing.slice(0, 3).join(" | ")}` : "") + (extra.length ? `, extra ${extra.length}` : "") + (keys.length ? `, missing keys: ${keys}` : ""));
}
