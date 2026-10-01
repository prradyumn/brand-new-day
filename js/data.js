/* =====================================================================
   Integers: Rise and Fall — game script (content only, no logic)
   Source: "Integers_Rise and Fall - Story n Game V3.csv": the story
   (Intro, Teaching, Game start), How to Play, Level 1, Level 2 transition
   + game, Level 3 transition + game, Story End.
   Every line of text below is copied from the CSV (speaker labels and
   quote marks removed). game.js adds no dialogue or on-screen text.
   ===================================================================== */

window.GAME_DATA = {
  /* Global tuning ----------------------------------------------------- */
  config: {
    levelMin: -10,            // lowest level the marker can reach
    levelMax: 10,             // highest level the marker can reach
    visibleHalfRange: 5,      // scale shows centre ±5 (11 marks, like Figma)
    settleMs: 1300,           // marker must rest this long before it is checked
    inactivityMs: 10000,      // idle time before the inactivity VO plays
    requireSignForPositive: true,  // CSV: learner "presses + and 2" — positive answers need the + sign (0 needs none)
    maxDigits: 2,
    speechRate: 0.95,
    speechLang: "en-IN",
    qaJumper: true            // QA level jumper (⏭ button, ?step=ID). Set false for release.
  },

  /* Text the engine shows that comes from the CSV ---------------------- */
  ui: {
    marked: "Water Level Marked!"          // CSV "Success / Confetti" column
  },

  /* The flow. Step types:
       scene     story: a full-screen scene with a speech bubble (or caption) and its VO
       demo      How to Play: the game shows the interaction itself (hand + spotlight)
       question  learner plays. `lever` = move the marker/lever part, `entry` = keypad part.
                 Each part: vo / ost / correct / wrong[3] (or null) / idle / success.
       gate      transition dialogue that waits for Start or a tap
       say       a spoken line with the animation from its "Scene Description"
     Common fields:
       section   story | howto | level1 | level2 | level3 | end   (a new level = dive transition)
       speaker   guddu | pari | narrator (default guddu)
       guided    frosted-glass spotlight + full-size character (How to Play, Level 1 tutorial)
     Question fields:
       start / target   lever level at the start / the answer
       eq               { a, op, b } shown as "(+2) + 3 = ?" (Level 2, Level 3)
       liveEq           the equation follows the lever: 0 + 1 → 0 + 2 → 0 + 3
       autoLever        Level 3: the lever is off; it moves by itself after a correct answer
                        (Level 2/3 equations build with the question's VO: the sign on
                        "rises"/"goes up"/"goes down", the number on "3 levels", then "= ?")
     Teaching rows (say): build { a, op, b } = the VO words where the start level, the sign
                        and the counted number appear; opGlow / moveAt = the words where the
                        sign lights up / the lever starts to move
       plateStart       what the display shows before the learner has entered anything
       wrong: null      the CSV has no incorrect feedback for this row (tutorials):
                        the attempt is shown (shake, ✗) but nothing is spoken
     fx names are listed in CONTEXT.md §4; each one does only what its CSV cell says. */
  steps: [
    /* ======================= STORY (CSV Intro / Teaching / Game start) =======================
       Full-screen scenes (assets/story/scene-pXX.jpg, from assets/scene_pXX_background_clean.png).
       bubble: { shape: "round" | "wide", tail: "left" | "right", w, tip: [x, y] }
               the bubble keeps its own proportions (never stretched); `tip` is where the
               tail points (the speaker), in stage px. caption: the narrator's line as on-screen text.
       camera: a slow move { to: zoom, x, y } (the point the camera moves toward);
               `from` starts zoomed in and pulls back (Story End: zoom out to the village)
       glow:   level marks on the scene art that light up one by one, [x, y] in scene px
       sign:   a "+" / "−" badge (CSV visual assets "plus sign" / "minus sign")
       sweep:  a lever marker slides along the glow marks as they light (Story End row 4)
       fx:     "celebrate" (confetti) or "badge" (completion badge) while the line plays */
    { type: "scene", id: "ST1", section: "story", speaker: "narrator", scene: "p01", caption: true,
      camera: { to: 1.14, x: 580, y: 520 },                                // Wide view of the village. Camera moves towards the large water tank.
      vo: "The villagers store water in a big tank. But today, the automatic water-level reading system has stopped working.",
      ost: "The villagers store water in a big tank. But today, the automatic water-level reading system has stopped working." },
    { type: "scene", id: "ST2", section: "story", scene: "p02",
      camera: { to: 1.05, x: 1045, y: 560 },                               // Camera moves closer to the tank. Guddu Bhaiya and Pari stand beside it.
      bubble: { shape: "wide", tail: "right", w: 520, tip: [505, 318] },
      vo: "Pari, can you help me mark the water levels?",
      ost: "Pari, can you help me mark the water levels?" },
    { type: "scene", id: "ST3", section: "story", speaker: "pari", scene: "p03",   // Pari looks at Guddu Bhaiya and agrees to help.
      bubble: { shape: "round", tail: "left", w: 520, tip: [1440, 468] },
      vo: "Yes! Let’s fix it.",
      ost: "Yes! Let’s fix it." },
    { type: "scene", id: "ST4", section: "story", scene: "p06",
      glow: [[757, 575]],                                                  // Close-up of the water-level scale. The 0 level glows first.
      bubble: { shape: "wide", tail: "left", w: 560, tip: [600, 255] },
      vo: "Look Pari, 0 shows the water level we need.",
      ost: "Look Pari, 0 shows the water level we need." },
    { type: "scene", id: "ST5", section: "story", scene: "p07",
      camera: { to: 1.05, x: 960, y: 250 },                                // Levels above 0 are highlighted one by one. Camera moves upward.
      glow: [[922, 481], [922, 396], [922, 308]],
      bubble: { shape: "wide", tail: "right", w: 520, tip: [495, 300] },
      vo: "Above 0, there is more water than required.",
      ost: "Above 0, there is more water than requirement." },
    { type: "scene", id: "ST6", section: "story", scene: "p08",
      camera: { to: 1.05, x: 960, y: 850 },                                // Levels below 0 are highlighted one by one. Camera moves downward.
      glow: [[922, 650], [922, 743], [922, 842]],
      bubble: { shape: "wide", tail: "right", w: 520, tip: [505, 318] },
      vo: "Below 0, there is less water than required.",
      ost: "Below 0, there is less water than requirement." },
    { type: "scene", id: "ST7", section: "story", scene: "p07",
      camera: { to: 1.05, x: 960, y: 250 },                                // Levels above 0 highlighted one by one, plus sign.
      glow: [[922, 481], [922, 396], [922, 308]], sign: { text: "+", x: 1100, y: 395 },
      bubble: { shape: "wide", tail: "right", w: 520, tip: [495, 300] },
      vo: "Now notice this, numbers above 0 are positive numbers.",
      ost: "Now notice this, numbers above 0 are positive numbers." },
    { type: "scene", id: "ST8", section: "story", scene: "p09",
      camera: { to: 1.05, x: 960, y: 850 },                                // Levels below 0 highlighted one by one, minus sign.
      glow: [[922, 650], [922, 743], [922, 842]], sign: { text: "−", x: 1100, y: 745 },
      bubble: { shape: "wide", tail: "right", w: 500, tip: [530, 395] },
      vo: "And, numbers below 0 are negative numbers.",
      ost: "And, numbers below 0 are negative numbers." },
    { type: "scene", id: "ST9", section: "story", speaker: "pari", scene: "p10",   // Full scale: negative numbers, 0, positive numbers. Pari responds.
      glow: [[922, 650], [922, 743], [922, 842], [930, 553], [922, 481], [922, 396], [922, 308]],
      bubble: { shape: "round", tail: "left", w: 560, tip: [1440, 470] },
      vo: "Oh! so, below 0 is negative, and above 0 is positive!",
      ost: "Oh! so, below 0 is negative, and above 0 is positive!" },
    { type: "scene", id: "ST10", section: "story", scene: "p04",
      glow: [[930, 553]],                                                  // Camera returns to the full tank and lever. The 0 mark glows.
      bubble: { shape: "wide", tail: "right", w: 520, tip: [505, 318] },
      vo: "Correct, Let’s mark the correct water level now.",
      ost: "Correct, Let’s mark the correct water level now." },

    /* ======================= HOW TO PLAY (guided demo) ======================= */
    {
      type: "demo", id: "H1", section: "howto", guided: true, speaker: "narrator",
      act: "leverUpDown", start: 2, taps: [1, -1],     // "Game start" row: the lever is positioned above 0. The "2 levels up" example is shown in H2 (+2 → +4)
      vo: "Move the lever up or down as necessary. Like water rises 2 levels up.",
      ost: "Move the lever up or down.\nMove the lever 2 levels up."
    },
    {
      type: "demo", id: "H2", section: "howto", guided: true,
      act: "leverMark", to: 4,                          // "The lever moves along the scale and stops at the new level."
      vo: "Mark the correct water level.",
      ost: "Mark the correct water level."
    },
    {
      type: "demo", id: "H3", section: "howto", guided: true,
      act: "enterNumber", key: "4",                     // "Camera shifts to the dial and display screen."
      vo: "Now enter the new water level.",
      ost: "Now, enter the new water level."
    },
    {
      type: "demo", id: "H4", section: "howto", guided: true,
      act: "chooseSign", key: "+",                      // "Plus and minus sign buttons are highlighted beside the number buttons."
      vo: "Choose the correct sign for the water level.",
      ost: "Choose the correct sign."
    },
    {
      type: "demo", id: "H5", section: "howto", guided: true,
      act: "check", ostFirst: true,                     // "Check icon glows … Both glow and a tick appears."
      vo: "Great! You marked the water level correctly.",
      ost: "Check the water level marked."
    },

    /* ======================= LEVEL 1 ======================= */
    {
      type: "question", id: "L1T", section: "level1", guided: true,
      start: 2, target: 0, plateStart: "?",             // "The marker starts above 0."
      lever: {
        vo: "0 shows the sufficient water level. Find the 0 mark.",
        ost: "0 shows the sufficient water level. Find the 0 mark.",
        correct: "Correct! This is 0.",                                  // Marker locks at 0. The 0 mark glows briefly.
        wrong: [
          { text: "Try again. Find 0 on the scale.", fx: "return" },     // Marker returns to its starting position.
          { text: "Look for 0.",                    fx: "pulseZero" },   // The 0 mark gently pulses.
          { text: "Move the marker to 0.",          fx: "nudge" }        // Marker gives a small nudge towards 0.
        ],
        idle: { text: "Find the 0 mark.", fx: "pulseZero" },             // The 0 mark glows/pulses.
        success: "small"                                                 // Small ✓ and sparkle animation.
      },
      entry: {                                                           // Dialer is highlighted on the screen.
        vo: "Now enter the current water level on the screen.",
        ost: "Enter the current water level.",
        correct: "Correct! This is the current water level.",            // 0 appears on the display and glows briefly.
        wrong: [
          { text: "Try again. What level is the marker on?", fx: "pulseTarget" },  // 0 on the scale pulses.
          { text: "Look at the marked water level.",         fx: "glowMarker" },   // Marker at 0 glows.
          { text: "Enter 0 on the screen.",                  fx: "pulseKeys" }     // 0 button on the dial pulses.
        ],
        idle: { text: "Enter the current water level.", fx: "pulsePadKeys" },      // Dial and 0 button gently pulse.
        success: "small"                                                 // Small ✓ and sparkle.
      }
    },
    {
      type: "gate", id: "TR1", section: "level1",
      vo: "Great! Now you know how the levels work. \nLet’s mark the water levels.",
      ost: "Let’s mark the water levels.",
      button: "Start",                                                   // Learner taps Start / continues.
      then: "activateScaleDial",                                         // Tank scale and dial become active.
      idle: { text: "Let’s mark the new water level.", fx: "pulseGate" } // Start button or tank scale gently pulses.
    },
    q1("Q1", 0, 2,
      "The water level rises 2 levels. Move the marker up 2 levels.",
      "The water rises 2 levels. Move the marker 2 levels up.",
      { text: "The water level went up. Move above 0.", fx: "glowUp" },  // Up arrow briefly glows.
      "Count 2 levels up from 0.", "Move 2 levels up from 0."),          // +1 and +2 highlight one by one. / Up arrow and +1 pulse.
    q1("Q2", 2, 4,
      "The water level rises 2 levels up. Move the marker up 2 levels.",
      "The water level rises 2 levels up. \nMove the marker up 2 levels.",
      { text: "The water level is rising. Move up.", fx: "glowDirUp" },  // Upward direction glows.
      "Count 2 levels up from +2.", "Move 2 levels up from +2."),        // +3 and +4 … / +3 and up arrow pulse.
    q1("Q3", 4, 6,
      "The water level rises 2 levels more. Move the marker 2 levels up.",
      "The water level rises 2 levels more. \nMove the marker 2 levels up.",
      { text: "The water level is rising. Move up.", fx: "glowDirUp" },
      "Count 2 levels up from +4.", "Move 2 levels up from +4."),
    q1("Q4", 6, 3,
      "The water level goes down 3 levels. Move the marker 3 levels down.",
      "The water level goes down 3 levels. Move the marker 3 levels down.",
      { text: "The water level goes down. Move downward.", fx: "glowDirDown" },  // Downward direction glows.
      "Count 3 levels down from +6.", "Move 3 levels down from +6."),    // +5, +4 and +3 … / +5 and down arrow pulse.
    q1("Q5", 3, -1,
      "The water level goes down 4 levels. Move the marker 4 levels down.",
      "The water goes down 4 levels. Move the marker 4 levels down.",
      { text: "The water level goes down. Move downward.", fx: "glowDirDown" },
      "Count 4 levels down from +3.", "Move 4 levels down from +3."),    // +2, +1, 0, −1 … / Down arrow and +2 pulse.
    q1("Q6", -1, -3,
      "The water level goes down 2 levels. Move the marker 2 levels down.",
      "The water goes down 2 levels. Move the marker 2 levels down.",
      { text: "The water level goes down. Move downward.", fx: "glowDirDown" },
      "Count 2 levels down from −1.", "Move 2 levels down from −1."),
    q1("Q7", -3, -7,
      "The water level goes down 4 levels. Move the marker 4 levels down.",
      "The water goes down 4 levels. Move the marker 4 levels down.",
      { text: "The water level goes down. Move downward.", fx: "glowDirDown" },
      "Count 4 levels down from −3.", "Move 4 levels down from −3."),

    /* ============== LEVEL 2 TRANSITION (teaching) ============== */
    { type: "say", id: "P1", section: "level2", speaker: "pari", level: 2,
      vo: "I noticed something! When the water level rises, we add to the current level.",
      ost: "Water level rises → Add" },                                  // Full water-level scale is visible. (OST in the narrator box)
    { type: "say", id: "P2", section: "level2", speaker: "pari", level: 2,
      fx: "moveTo", to: 1,                                               // The lever moves slightly downward.
      vo: "And when the water level goes down, we subtract from the current level.",
      ost: "Water level goes down → Subtract" },
    { type: "say", id: "P3", section: "level2", level: 1, ostIn: "eq",
      fx: "countSteps", from: 1, to: 3,                                  // Lever starts at +1. Two levels above it highlight one by one.
      build: { a: "+1", op: "rises", b: "2 levels" },                    // the equation is written with the line: 1 → + → 2 (counted 1, 2) → = ?
      vo: "Correct, Pari! If the water level is at +1 and rises by 2 levels, ",
      ost: "1 + 2 = ?" },
    { type: "say", id: "P4", section: "level2", level: 1, ostIn: "eq", ostAfter: true,
      fx: "moveTo", to: 3, opGlow: "add", moveAt: "new water level",     // Lever moves +1 → +2 → +3. The equation completes.
      vo: "We add and the new water level is +3.",
      ost: "1 + 2 = 3" },
    { type: "say", id: "P5", section: "level2", level: 3, ostIn: "eq",
      fx: "countSteps", from: 3, to: -2,                                 // Lever starts at +3. Five levels below it highlight one by one.
      build: { a: "+3", op: "goes down", b: "5 levels" },
      vo: "Now, if the water level is at +3 and goes down by 5 levels.",
      ost: "3 − 5 = ?" },
    { type: "say", id: "P6", section: "level2", level: 3, ostIn: "eq", ostAfter: true,
      fx: "moveTo", to: -2, zeroGlow: true, opGlow: "subtract", moveAt: "new water level",   // +3 → … → −2, 0 highlighted while crossing.
      vo: "We subtract and the new water level is −2.",
      ost: "3 − 5 = −2" },
    { type: "say", id: "P7", section: "level2", speaker: "pari", level: -2,
      fx: "riseFall",                                                    // Up arrow, down arrow, plus and minus symbols.
      vo: "Got it! When the level rises, we add. When it goes down, we subtract.",
      ost: "Rise → Add • Go down → Subtract" },
    {
      type: "gate", id: "TR2", section: "level2",
      vo: "Let’s calculate the water levels exactly.",
      ost: "Let’s calculate the water levels exactly!",
      appear: "eqPanel",                                                 // Equation panel appears beside the tank.
      continueOnTap: true,                                               // Learner observes and taps to continue.
      idle: { text: "Let’s find the new water level.", fx: "pulseEqPanel" } // Equation panel gently pulses.
    },

    /* ======================= LEVEL 2 GAME ======================= */
    {
      type: "question", id: "A0", section: "level2",
      start: 0, target: 3, eq: { a: 0, op: "+", b: 3 }, liveEq: true,   // Tutorial: 0 + 3 = ?
      lever: {
        vo: "The water level goes up 3 levels. Move the lever 3 levels up.",
        ost: "Move the lever 3 levels up.",
        correct: "Correct! You reached +3.",                             // Lever locks at +3.
        wrong: null,                                                     // (no incorrect feedback in the CSV)
        idle: { text: "Move the lever 3 levels up from 0.", fx: "pulseMarkerNext" },  // Lever and +1 gently pulse.
        success: "small"
      },
      entry: {
        vo: "Tap the new water level.",
        ost: "Tap the new water level.",
        correct: "Correct! The new water level is +3.",                  // Equation completes: 0 + 3 = +3.
        wrong: null,
        idle: { text: "Tap the new water level.", fx: "pulseTargetPad" }, // +3 on the scale and dial pad gently pulse.
        success: "marked"
      }
    },
    q2("A1", 2, 5, { a: 2, op: "+", b: 3 },
      "The water level rises 3 levels up. Move the lever to correct water level.",
      "The water level rises 3 levels up. \nMove the lever to correct water level.",
      { text: "The water level goes up. Move upward.", fx: "glowDirUp" },
      "Count 3 levels up from +2.", "Move the lever 3 levels up from +2."),
    q2("A2", -2, 2, { a: -2, op: "+", b: 4 },
      "The water level rises 4 levels up. Move the lever to the correct water level.",   // CSV typo "thje" → "the"
      "The water level rises 4 levels up. \nMove the lever to the correct water level.",
      { text: "The water level goes up. Move upward.", fx: "glowDirUp" },
      "Count 4 levels up from −2.", "Move the lever 4 levels up from −2."),
    q2("A3", 3, -2, { a: 3, op: "−", b: 5 },
      "The water level goes down 5 levels. Move the lever to the correct water level.",
      "The water level goes down 5 levels. \nMove the lever 5 levels down.",
      { text: "The water level goes down. Move downward.", fx: "glowDirDown" },
      "Count 5 levels down from +3.", "Move the lever 5 levels down from +3."),
    q2("A4", -2, -5, { a: -2, op: "+", b: -3 },
      "The water level goes down 3 levels. Move the lever 3 levels down.",
      "Move the lever 3 levels down.",
      { text: "The water level goes down. Move downward.", fx: "glowDirDown" },
      "Count 3 levels down from −2.", "Move the lever 3 levels down from −2."),
    q2("A5", -5, -3, { a: -5, op: "+", b: 2 },
      "The water level goes up 2 levels. Move the lever 2 levels up.",
      "Move the lever 2 levels up.",
      { text: "The water level goes up. Move upward.", fx: "glowDirUp" },
      "Count 2 levels up from −5.", "Move the lever 2 levels up from −5."),
    q2("A6", -3, -7, { a: -3, op: "−", b: 4 },
      "The water level goes down 4 levels. Move the lever 4 levels down.",
      "Move the lever 4 levels down.",
      { text: "The water level goes down. Move downward.", fx: "glowDirDown" },
      "Count 4 levels down from −3.", "Move the lever 4 levels down from −3."),
    { type: "say", id: "E2", section: "level2", ostIn: "board", fx: "levelComplete",   // final level glows, ✓, confetti
      vo: "Great job! You marked the water levels correctly.",
      ost: "Level Complete!" },

    /* ============== LEVEL 3 TRANSITION ============== */
    { type: "say", id: "S0", section: "level3",
      vo: "Let’s mark some more water levels.",
      ost: "Let’s mark some more water levels!" },
    { type: "say", id: "R2", section: "level3", speaker: "pari", fx: "leverStuck",     // Pari tries the lever; it does not respond.
      vo: "Oh! The lever isn’t working now!",
      ost: "Oh! The lever isn’t working now!" },
    { type: "say", id: "R3", section: "level3", fx: "padGlow",                          // The dial pad begins to glow.
      vo: "That’s okay! Pari. \nLet’s mark the new water level using the number pad.",
      ost: "That’s okay! Pari. \nLet’s mark the new water level using the number pad." },
    { type: "say", id: "R4", section: "level3", fx: "keysPulse",                        // The sign and number buttons gently pulse.
      vo: "Choose the correct sign and number.",
      ost: "Choose the correct sign and number." },
    { type: "say", id: "R5", section: "level3", fx: "showNextEq",                       // The first water-level challenge appears.
      vo: "And Let’s see where the water level reaches!",
      ost: "And Let’s see where the water level reaches!" },
    { type: "say", id: "R6", section: "level3", speaker: "pari", fx: "padActive",       // Dial pad stays active.
      vo: "I’m ready! Let’s mark the new level.",
      ost: "I’m ready! Let’s mark the new level." },

    /* ======================= LEVEL 3 GAME (keypad only) ======================= */
    {
      type: "question", id: "B0", section: "level3",
      start: 0, target: 4, eq: { a: 0, op: "+", b: 4 }, autoLever: true,           // Tutorial
      entry: {
        vo: "The water level is at 0. It goes up 4 levels. Enter the new water level.",
        ost: "0 + 4 = ?\nEnter the new water level.",
        correct: "Correct! The new water level is +4.",                  // Lever automatically moves 0 → +4.
        wrong: null,
        idle: { text: "Enter the new water level.", fx: "pulseKeys" },   // + and 4 buttons on the dial pad gently pulse.
        success: "marked"
      }
    },
    q3("B1", 4, 7, { a: 4, op: "+", b: 3 }, "goes up 3 levels", "Try again. The water level goes up.",
      "Count 3 levels up from +4.", "Check the new water level and its sign."),
    q3("B2", 7, 1, { a: 7, op: "−", b: 6 }, "goes down 6 levels", "Try again. The water level goes down.",
      "Count 6 levels down from +7.", "Check the new water level and its sign."),
    q3("B3", 1, -4, { a: 1, op: "−", b: 5 }, "goes down 5 levels", "Try again. The water level goes down.",
      "Count 5 levels down from +1.", "The new level is below 0. Check the sign."),
    q3("B4", -4, -6, { a: -4, op: "−", b: 2 }, "goes down 2 levels", "Try again. The water level goes down.",
      "Count 2 levels down from −4.", "Check the new water level and its sign."),
    q3("B5", -6, -3, { a: -6, op: "+", b: 3 }, "goes up 3 levels", "Try again. The water level goes up.",
      "Count 3 levels up from −6.", "Check the new water level and its sign."),
    q3("B6", -3, -1, { a: -3, op: "+", b: 2 }, "goes up 2 levels", "Try again. The water level goes up.",
      "Count 2 levels up from −3.", "Check the new water level and its sign."),

    /* ======================= STORY END ======================= */
    { type: "say", id: "Z1", section: "end", fx: "displayGlow",                         // display lights up, sparkle
      vo: "Great work! You marked all the water levels correctly.",
      ost: "Great work! You marked all the water levels correctly." },
    /* Z2–Z5 are full-screen story scenes again: the camera pulls back out of the tank
       after Z1. p11 = celebration at the tank (water at −1, the last answer),
       p12 = wide village view, both waving. Scale marks on p11: x ≈ 920,
       +3 … −3 at y 310 / 400 / 482 / 553 / 653 / 743 / 842 (stage px). */
    { type: "scene", id: "Z2", section: "end", speaker: "pari", scene: "p11", fx: "celebrate",   // Guddu Bhaiya and Pari look at the completed scale. Confetti/sparkles.
      camera: { to: 1.04, x: 960, y: 560 },
      bubble: { shape: "round", tail: "left", w: 500, tip: [1450, 420] },
      vo: "We did it! We tracked every rise and fall in the water level.",
      ost: "We did it! We tracked every rise and fall in the water level." },
    { type: "scene", id: "Z3", section: "end", scene: "p11",                                    // Camera focuses on the full scale: negative numbers, 0, positive numbers.
      camera: { to: 1.08, x: 920, y: 575 },
      glow: [[918, 653], [918, 743], [918, 842], [925, 553], [920, 482], [920, 400], [920, 310]],
      bubble: { shape: "wide", tail: "right", w: 440, tip: [420, 300] },
      vo: "And these positive numbers, negative numbers, and 0 are called integers.",
      ost: "And these positive numbers, negative numbers, and 0 are called integers." },
    { type: "scene", id: "Z4", section: "end", speaker: "pari", scene: "p11", sweep: true,      // The lever moves briefly from a negative number through 0 to a positive number.
      glow: [[918, 842], [918, 743], [918, 653], [925, 553], [920, 482], [920, 400], [920, 310]],
      bubble: { shape: "round", tail: "left", w: 500, tip: [1450, 420] },
      vo: "So integers helped us show water levels at 0, above 0, and below 0!",
      ost: "So integers helped us show water levels below 0, at 0, and above 0!" },
    { type: "scene", id: "Z5", section: "end", scene: "p12", fx: "badge",                       // Camera zooms out to the village and tank. Both wave. Completion badge.
      camera: { from: 1.5, to: 1, x: 730, y: 310 },
      bubble: { shape: "wide", tail: "left", w: 520, tip: [730, 310] },
      vo: "Excellent! You’re an Integers Expert now!",
      ost: "Excellent! You’re a Water Level Expert now!" }
  ]
};

/* ---- Row builders: the CSV repeats the same feedback pattern in every example row,
        only the numbers change. Text still comes from the CSV, word for word. ---- */
function signed(n) { return n > 0 ? "+" + n : n < 0 ? "−" + Math.abs(n) : "0"; }

/** Level 1 example: marker part + keypad part. */
function q1(id, start, target, vo, ost, wrong2, count, idle) {
  const t = signed(target);
  return {
    type: "question", id, section: "level1", start, target,
    lever: {
      vo, ost,
      correct: `Correct! You reached ${t}.`,                                   // Marker locks at …
      wrong: [
        { text: "Check the number of levels. Try again.", fx: "return" },      // Marker returns to the start.
        wrong2,                                                                // arrow / direction glows
        { text: count, fx: "countSteps" }                                      // the levels highlight one by one
      ],
      idle: { text: idle, fx: "pulseArrowNext" },                                // arrow and the next level pulse
      success: "small"                                                         // Small ✓ and sparkle.
    },
    entry: {
      vo: "Enter the new water level.",
      ost: "Enter the new water level.",
      correct: `Correct! The water level is ${t}.`,                            // … appears on the display.
      wrong: [
        { text: "Try again. Check where the marker is.",  fx: "pulseMarker" }, // Marker at … pulses.
        { text: "Look at the number beside the marker.",  fx: "glowTarget" },  // … on the scale glows.
        { text: `Enter ${t} on the screen.`,              fx: "pulseKeys" }    // sign and number buttons pulse.
      ],
      idle: { text: "Enter the new water level.", fx: "pulsePad" },            // Dial pad gently pulses.
      success: "marked"                                                        // ✓ Sparkle + Water Level Marked!
    }
  };
}

/** Level 2 example: lever part + keypad part, with the equation panel. */
function q2(id, start, target, eq, vo, ost, wrong2, count, idle) {
  const t = signed(target);
  return {
    type: "question", id, section: "level2", start, target, eq,
    lever: {
      vo, ost,
      correct: `Correct! You reached ${t}.`,                                   // Lever locks at …
      wrong: [
        { text: "Check how the water level needs to move.", fx: "pulseStart" }, // Starting level … pulses.
        wrong2,                                                                 // direction glows
        { text: count, fx: "countSteps" }                                       // the levels highlight one by one
      ],
      idle: { text: idle, fx: "pulseMarkerNext" },                              // Lever and the next level gently pulse.
      success: "small"
    },
    entry: {
      vo: "Enter the new water level.",
      ost: "Enter the new water level.",
      correct: `Correct! The new water level is ${t}.`,                         // Equation completes.
      wrong: [
        { text: "Try again. Check where the lever stopped.", fx: "pulseMarker" }, // Lever at … pulses.
        { text: "Look at the number beside the lever.",      fx: "glowTarget" },  // … on the scale glows.
        { text: `Enter ${t} on the screen.`,                 fx: "pulseKeys" }    // sign and number buttons pulse.
      ],
      idle: { text: "Enter the new water level.", fx: "pulsePad" },
      success: "marked"
    }
  };
}

/** Level 3 example: keypad only; the lever moves by itself after the answer. */
function q3(id, start, target, eq, change, wrong1, count, wrong3) {
  const a = start === 0 ? "0" : `(${signed(start)})`;
  const b = eq.b < 0 ? `(${signed(eq.b)})` : String(eq.b);
  return {
    type: "question", id, section: "level3", start, target, eq, autoLever: true,
    entry: {
      vo: `The water level ${change}. Enter the new water level.`,
      ost: `${a} ${eq.op} ${b} = ?\nEnter the new water level.`,
      correct: `Correct! The new water level is ${signed(target)}.`,           // Lever automatically moves …
      wrong: [
        { text: wrong1, fx: "pulseStart" },                                     // Starting level … pulses.
        { text: count,  fx: "countSteps" },                                     // the levels highlight one by one
        { text: wrong3, fx: "pulseTargetSign" }                                 // the answer on the scale and its sign button pulse
      ],
      idle: { text: "Enter the new water level.", fx: "pulsePad" },             // Dial pad gently pulses.
      success: "marked"
    }
  };
}
