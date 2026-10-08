#!/usr/bin/env node
/* =====================================================================
   generate-audio.mjs — pre-records the game's audio with the Gemini API.

     • Voice-over: every line in js/data.js, in English and in Hindi (js/lang-hi.js,
       through js/lang.js) → assets/vo/*.mp3 (Gemini TTS),
       plus assets/vo/manifest.js, which fx.js uses to play the clips.
       Each clip is transcribed and compared with the script; a clip that
       doesn't match word for word is generated again.
     • Music (--music): a soothing instrumental loop → assets/music/bg-loop.mp3 (Lyria 3).

   The API key is read from the environment and is never written to disk:
     GEMINI_API_KEY=… node tools/generate-audio.mjs            # new/changed lines only
     GEMINI_API_KEY=… node tools/generate-audio.mjs --force    # re-record every line
     GEMINI_API_KEY=… node tools/generate-audio.mjs --verify   # re-check every existing clip, re-record mismatches
     GEMINI_API_KEY=… node tools/generate-audio.mjs --music    # also make the music loop
   Needs Node 18+ and ffmpeg on the PATH.
   ===================================================================== */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KEY = process.env.GEMINI_API_KEY;
const ARGS = new Set(process.argv.slice(2));
if (!KEY) { console.error("Set GEMINI_API_KEY first."); process.exit(1); }

const API = "https://generativelanguage.googleapis.com/v1beta/models";
const TTS_MODEL = "gemini-3.8-flash-tts";
const CHECK_MODEL = "gemini-3.6-flash";          // transcribes each clip to verify it
const MUSIC_MODEL = "lyria-3-pro-preview";
const LANGUAGE = "en-IN";

/* Voice casting. `profile` goes into the prompt's AUDIO PROFILE. */
const VOICES = {
  guddu:    { voice: "Puck", profile: "Guddu Bhaiya, a cheerful young Indian man in his twenties from a North Indian village, the kind older brother of the neighbourhood" },
  // Pari: the child brief picked in the voice audition (2026-10-07: "Leda · Gemini 3.8 Flash")
  pari:     { voice: "Leda", profile: "Pari, an eight-year-old Indian girl from a village in Uttar Pradesh. A real young child's voice: high, light and bright, a little breathy, bubbly and excited, with a child's quick, playful energy. Never an adult woman." },
  narrator: { voice: "Kore", profile: "An Indian storyteller narrator, calm and warm" }
};
const SCENE = "A sunny village in India. Beside the big village water tank, a friendly guide helps a young child learn about water levels and integers.";
const NOTES = [
  "Accent: a clear, natural Indian English accent, as spoken by an Indian from Uttar Pradesh or Delhi. Never British or American.",
  "Style: warm, friendly and encouraging, for young children.",
  "Pacing: natural and clear, no long pauses."
].join("\n");

/* Hindi: the same voices, cast for natural, everyday Hindi */
const VOICES_HI = {
  guddu:    "Guddu Bhaiya, a cheerful young Indian man in his twenties from a village in Uttar Pradesh, the kind older brother of the neighbourhood, speaking warm, natural, everyday Hindi",
  pari:     "Pari, an eight-year-old Indian girl from a village in Uttar Pradesh, speaking natural everyday Hindi. A real young child's voice: high, light and bright, a little breathy, bubbly and excited, with a child's quick, playful energy. Never an adult woman.",
  narrator: "An Indian storyteller narrator, calm and warm, speaking clear, natural Hindi"
};
const NOTES_HI = [
  "Language: natural, everyday spoken Hindi (Hindustani), exactly as a Hindi speaker from Uttar Pradesh or Delhi talks. Pure Hindi pronunciation, never an English accent.",
  "Read the transcript exactly as written, word for word, in Hindi. Read the numbers in Hindi (2 = दो, 5 = पाँच). 'धन' and 'ऋण' are maths words (positive / negative): say them clearly.",
  "Style: warm, friendly and encouraging, for young children in primary school.",
  "Pacing: natural and clear, a little slower than adult conversation, no long pauses."
].join("\n");

const MUSIC_PROMPT = "Soothing, gentle instrumental background music for a children's educational maths game set in a sunny Indian village beside a big water tank. Soft bansuri flute melody, light marimba, warm fingerpicked acoustic guitar, very soft hand percussion (light tabla), calm, cheerful and encouraging, about 80 BPM, major key. No vocals. Even, low-key texture that sits quietly under narration and loops smoothly, with no sudden drops, builds or loud hits.";

/* ---------------------------------------------------------------------
   Lines: exactly the strings game.js passes to FX.speak(), with the
   speaker it uses (game.js: narrate → step.speaker; feedback → guddu).
   --------------------------------------------------------------------- */
function loadLines() {
  const sandbox = { window: {}, console: { warn() {}, log() {} } };
  vm.createContext(sandbox);
  for (const f of ["js/data.js", "js/lang-hi.js", "js/lang.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox);
  const W = sandbox.window;
  const lines = new Map();
  const addAll = (data, lang) => {
  const add = (speaker, text) => { if (text) lines.set(`${speaker}|${text}`, { speaker, text, lang }); };
  for (const s of data.steps) {
    const who = s.speaker || "guddu";
    add(who, s.vo);                                   // demo / say / gate
    if (s.idle) add("guddu", s.idle.text);            // gate inactivity
    for (const p of [s.lever, s.entry]) {
      if (!p) continue;
      add("guddu", p.vo); add("guddu", p.correct);
      (p.wrong || []).forEach((w) => add("guddu", w.text));
      if (p.idle) add("guddu", p.idle.text);
    }
  }
  };
  addAll(W.GAME_DATA, "en");
  addAll(W.I18N.translateGame(JSON.parse(JSON.stringify(W.GAME_DATA)), W.LANG_HI), "hi");   // the Hindi lines (js/lang-hi.js)
  W.LANG_HI.spoken && (spokenHi = W.LANG_HI.spoken);
  return [...lines.values()];
}
let spokenHi = null;

/** What the voice reads: signs and 0 written out, line breaks joined (Hindi: "धन 2", "ऋण 3", "शून्य"). */
function spokenForm(text, lang) {
  if (lang === "hi") return spokenHi(text);
  return text
    .replace(/\s*\n\s*/g, " ")
    .replace(/−(\d)/g, "minus $1")
    .replace(/\+(\d)/g, "plus $1")
    .replace(/(?<![\d.])0(?!\d|\.\d)/g, "zero")
    .replace(/\s+/g, " ").trim();
}

/* ---------------------------------------------------------------------
   Gemini calls (with retry on rate limits / server errors)
   --------------------------------------------------------------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(model, body, tries = 6) {
  for (let i = 0; ; i++) {
    const res = await fetch(`${API}/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (res.ok) return res.json();
    const msg = await res.text();
    if (i < tries && (res.status === 429 || res.status >= 500)) { await sleep(2000 * 2 ** i); continue; }
    throw new Error(`${model} ${res.status}: ${msg.slice(0, 300)}`);
  }
}
const audioPart = (d) => d.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;

/* Pari's own director's notes (the audition's): a child's delivery, not a narrator's */
const NOTES_PARI = {
  en: "Accent: natural Indian English, as a child from Uttar Pradesh speaks it.\nStyle: excited, cheerful, childlike.\nPacing: natural, lively.",
  hi: "Language: natural, everyday spoken Hindi, exactly as a child from Uttar Pradesh talks. Pure Hindi pronunciation.\nRead the transcript exactly as written, word for word. Read the numbers in Hindi (2 = दो). 'धन' and 'ऋण' are maths words: say them clearly.\nStyle: excited, cheerful, childlike.\nPacing: natural, lively."
};
function ttsPrompt(speaker, text, lang) {
  const profile = lang === "hi" ? VOICES_HI[speaker] : VOICES[speaker].profile;
  const notes = speaker === "pari" ? NOTES_PARI[lang === "hi" ? "hi" : "en"] : lang === "hi" ? NOTES_HI : NOTES;
  return `# AUDIO PROFILE: ${profile}\n\n## THE SCENE\n${SCENE}\n\n### DIRECTOR'S NOTES\n${notes}\n\n#### TRANSCRIPT\n${text}`;
}
async function tts(speaker, text, lang) {
  const d = await call(TTS_MODEL, {
    contents: [{ parts: [{ text: ttsPrompt(speaker, text, lang) }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES[speaker].voice } }, languageCode: lang === "hi" ? "hi-IN" : LANGUAGE }
    }
  });
  const a = audioPart(d);
  if (!a) throw new Error("no audio returned");
  return { buf: Buffer.from(a.data, "base64"), mime: a.mimeType };
}
async function transcribe(audio, mime = "audio/wav", lang = "en") {
  const ask = lang === "hi"
    ? "Write out every word spoken in this Hindi audio, verbatim, in Devanagari script, from the first sound to the last. Write numbers as Hindi words (दो, पाँच). Do not translate, skip or summarise anything. Output only the words."
    : "Write out every word spoken in this audio, verbatim, from the first sound to the last. Do not skip or summarise anything. Output only the words.";
  const d = await call(CHECK_MODEL, { contents: [{ parts: [
    { inlineData: { mimeType: mime, data: audio.toString("base64") } },
    { text: ask }
  ] }] });
  return d.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join(" ").trim() || "";
}

/* Word-level comparison: the clip must say the line, and nothing else. */
const NUM = { 0: "zero", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten" };
const words = (t) => t.toLowerCase().replace(/’/g, "'").replace(/[−-](\d)/g, "minus $1").replace(/\+(\d)/g, "plus $1").replace(/\b(\d+)\b/g, (m) => NUM[m] || m)
  .replace(/[^a-z' ]+/g, " ").split(/\s+/).filter(Boolean)
  .map((w) => w.replace(/'s$/, "s").replace(/'/g, ""));
/* Hindi: Devanagari words, numbers as Hindi words, spelling variants folded together
   (ँ/ं, nukta, पाँच/पांच, छह/छः) so only real differences count. */
const NUM_HI = ["शून्य", "एक", "दो", "तीन", "चार", "पांच", "छह", "सात", "आठ", "नौ", "दस"];
const wordsHi = (t) => t.normalize("NFC")
  .replace(/\b(\d+)\b/g, (m) => NUM_HI[+m] || m)
  .replace(/\u0901/g, "\u0902").replace(/\u093C/g, "").replace(/छः|छे/g, "छह")
  .replace(/[^\u0900-\u0963\u0966-\u097F\s]+/g, " ").replace(/[।॥]/g, " ")
  .split(/\s+/).filter(Boolean);
function matches(expected, heard, lang = "en") {
  const a = lang === "hi" ? wordsHi(expected) : words(expected), b = lang === "hi" ? wordsHi(heard) : words(heard);
  // longest common subsequence
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const lcs = dp[a.length][b.length];
  const missing = a.length - lcs, extra = b.length - lcs;
  // no added words at all (the voice sometimes ad-libs "Haha," or "no?"); one dropped word allowed in long lines
  if (lang === "hi")   // the transcriber splits / joins some Hindi words differently: allow a little either way
    return { ok: a.length > 0 && missing <= Math.max(1, Math.floor(a.length * .12)) && extra <= 1, missing, extra };
  return { ok: missing <= (a.length > 8 ? 1 : 0) && extra === 0, missing, extra };
}

/* ---------------------------------------------------------------------
   ffmpeg helpers
   --------------------------------------------------------------------- */
function ffmpeg(args, input) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { input, maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error("ffmpeg: " + r.stderr.toString());
  return r.stdout;
}
function toWav(buf, mime) {
  if (/wav/.test(mime)) return buf;
  const rate = +(/rate=(\d+)/.exec(mime) || [0, 24000])[1];           // raw PCM (audio/L16;rate=24000)
  return ffmpeg(["-f", "s16le", "-ar", String(rate), "-ac", "1", "-i", "pipe:0", "-f", "wav", "pipe:1"], buf);
}
function voiceMp3(wav, out) {
  // trim silence at both ends, even loudness, small mono MP3
  const trim = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05";
  ffmpeg(["-i", "pipe:0", "-af", `${trim},areverse,${trim},areverse,loudnorm=I=-16:TP=-1.5:LRA=7`,
    "-ar", "24000", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k", out], wav);
}

/* ---------------------------------------------------------------------
   Voice-over
   --------------------------------------------------------------------- */
async function makeVoice() {
  const lines = loadLines();
  const dir = path.join(ROOT, "assets/vo");
  fs.mkdirSync(dir, { recursive: true });
  const manifest = {}, failed = [];
  let done = 0, made = 0;
  const jobs = lines.map((l) => async () => {
    const key = `${l.speaker}|${l.text}`;
    const file = `assets/vo/${l.speaker}-${crypto.createHash("sha1").update(key).digest("hex").slice(0, 10)}.mp3`;
    const out = path.join(ROOT, file);
    const spoken = spokenForm(l.text, l.lang);
    if (fs.existsSync(out) && !ARGS.has("--force")) {
      // --verify: listen to the existing clip again and re-record it if it doesn't match the script
      if (!ARGS.has("--verify") || matches(spoken, await transcribe(fs.readFileSync(out), "audio/mpeg", l.lang), l.lang).ok) {
        manifest[key] = file; done++;
        process.stdout.write(`\r  voice-over ${done}/${lines.length}   `);
        return;
      }
      console.log(`\n  re-recording [${l.speaker}] ${l.text}`);
    }
    let last = "";
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const { buf, mime } = await tts(l.speaker, spoken, l.lang);
        const wav = toWav(buf, mime);
        const heard = await transcribe(wav, "audio/wav", l.lang);
        const m = matches(spoken, heard, l.lang);
        if (!m.ok) { last = heard; continue; }                          // ad-libbed or cut: record again
        voiceMp3(wav, out);
        manifest[key] = file; made++;
        break;
      } catch (e) { last = e.message; await sleep(1500); }
    }
    if (!manifest[key]) {
      failed.push({ ...l, heard: last, kept: fs.existsSync(out) });
      if (fs.existsSync(out)) manifest[key] = file;                    // keep the earlier clip rather than lose it
    }
    done++;
    process.stdout.write(`\r  voice-over ${done}/${lines.length}   `);
  });
  // a few requests at a time
  const queue = jobs.slice();
  await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await queue.shift()(); }));
  process.stdout.write("\n");

  // remove clips no longer in the script
  const keep = new Set(Object.values(manifest).map((f) => path.basename(f)));
  for (const f of fs.readdirSync(dir)) if (f.endsWith(".mp3") && !keep.has(f)) fs.unlinkSync(path.join(dir, f));

  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(path.join(dir, "manifest.js"),
    "/* Generated by tools/generate-audio.mjs: \"speaker|line\" → recorded clip. Lines without a clip use the browser voice. */\n" +
    `window.VO_MANIFEST = ${JSON.stringify(sorted, null, 2)};\n`);
  console.log(`  ${made} recorded, ${Object.keys(manifest).length}/${lines.length} lines have a clip.`);
  if (failed.length) {
    console.log("  Could not get a clean take (kept = the earlier clip is still used, otherwise the browser voice reads it):");
    failed.forEach((f) => console.log(`   - [${f.speaker}] ${f.text}${f.kept ? "  (kept)" : ""}\n       heard: ${f.heard}`));
  }
}

/* ---------------------------------------------------------------------
   Music: one Lyria 3 track → a seamless loop (the end crossfades into the start)
   --------------------------------------------------------------------- */
async function makeMusic() {
  console.log("  music: asking Lyria 3…");
  const d = await call(MUSIC_MODEL, { contents: [{ role: "user", parts: [{ text: MUSIC_PROMPT }] }] });
  const a = audioPart(d);
  if (!a) throw new Error("Lyria returned no audio");
  const raw = path.join(ROOT, "assets/music/.lyria-raw.mp3");
  fs.mkdirSync(path.dirname(raw), { recursive: true });
  fs.writeFileSync(raw, Buffer.from(a.data, "base64"));
  const dur = parseFloat(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", raw]).stdout);
  const start = 1.2, end = dur - 9, X = 5, L = end - start;          // skip the silent head and the fade-out tail
  ffmpeg(["-i", raw, "-filter_complex",
    `[0:a]atrim=${start}:${end},asetpts=PTS-STARTPTS,asplit=3[a][b][c];` +
    `[a]atrim=${X}:${L - X},asetpts=PTS-STARTPTS[body];[b]atrim=${L - X}:${L},asetpts=PTS-STARTPTS[tail];` +
    `[c]atrim=0:${X},asetpts=PTS-STARTPTS[head];[tail][head]acrossfade=d=${X}:c1=tri:c2=tri[seam];` +
    `[body][seam]concat=n=2:v=0:a=1,loudnorm=I=-24:TP=-3:LRA=11[out]`,
    "-map", "[out]", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "128k", path.join(ROOT, "assets/music/bg-loop.mp3")]);
  fs.unlinkSync(raw);
  console.log("  music: assets/music/bg-loop.mp3");
}

(async () => {
  if (ARGS.has("--music")) await makeMusic();
  await makeVoice();
  // the mouths follow the voice: refresh the loudness data for the new clips
  spawnSync(process.execPath, [path.join(ROOT, "tools/make-lipsync.mjs")], { stdio: "inherit" });
})().catch((e) => { console.error(e); process.exit(1); });
