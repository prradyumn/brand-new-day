/* =====================================================================
   Integers: Rise and Fall — game script (content only, no logic)
   Source: "Integers_Rise and Fall - Story n Game V3-2.csv", from the
   "How to Play" table onward (Tutorial, Level 1, Level 2, Level 3).
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
    requireSignForPositive: true,  // CSV: learner "presses + and 4" — positive answers need the + sign
    maxDigits: 2,
    speechRate: 0.95,
    speechLang: "en-IN",
    qaJumper: true            // QA level jumper (⏭ button, ?step=ID). Set false for release.
  },

  /* Speaker shown in the narrator box --------------------------------- */
  narrator: { name: "Guddu Bhaiya", avatar: "guddu" },

  /* Text the engine shows that comes from the CSV ---------------------- */
  ui: {
    marked: "Water Level Marked!"          // CSV "Success" column
  },

  /* The flow. Each step is a "question" or a "gate" (transition).
     Question fields:
       start / target   marker level at the start / the answer
       demo             tutorial: the game plays it by itself (a hand moves the marker and types)
       demoMove         how the hand moves the marker: "drag" it, or "tap" the ▲ / ▼ buttons
       entry            true = learner also types the level on the keypad
       eq               { a, op, b } = the equation "a op (b) = ?" shown on top of the keypad (Level 2, Level 3)
       liveEq           the equation updates as each step is moved (CSV Level 2 Q1)
       water            "target" = water already at the answer, "animate" = water moves
                        to the answer first (tutorial); absent = water follows the marker
       vo / ost         CSV "Game Instruction / VO" and "On-Screen Text (OST)"
       correct          CSV "Correct Feedback"
       wrong[0..2]      CSV "Incorrect Feedback 1/2/3" + the matching animation (fx)
       idle             CSV "Inactivity VO" + "Inactivity Animation" (fx)
     `#ERROR!` cells in the CSV are filled from the same column of the rows
     next to them (marked below).                                           */
  steps: [
    /* ======================= TUTORIAL ======================= */
    {
      type: "question", id: "T0", section: "tutorial", demo: true, demoMove: "drag",
      start: 2, target: 0, entry: false,
      water: "target",
      vo: "0 shows the water level we need. Find the 0 mark.",
      ost: "Find the 0 mark.",
      correct: "Correct! This is 0.",
      wrong: [
        { text: "Try again. Find 0 on the scale.", fx: "return" },       // Marker returns to its starting position.
        { text: "Look for 0.",                    fx: "pulseZero" },     // The 0 mark gently pulses.
        { text: "Move the marker to 0.",          fx: "nudge" }          // Marker gives a small nudge toward 0.
      ],
      idle: { text: "Find the 0 mark.", fx: "pulseZero" },               // The 0 mark glows/pulses.
      celebrate: "small"                                                 // Small ✓ and sparkle animation.
    },
    {
      type: "question", id: "T1", section: "tutorial", demo: true, demoMove: "tap",
      start: 0, target: 2, entry: true,
      water: "animate",
      vo: "The water level rises by 2 levels. Move the marker up 2 levels. Where does it reach? Enter the number.",
      ost: "Move 2 levels up. Enter the number.",
      correct: "Correct! The water level is +2.",
      wrong: [
        { text: "Check the number of levels. Try again.", fx: "return" },                       // Marker returns to 0.
        { text: "The water level went up. Move above 0.",  fx: "glowUp" },                      // Up arrow briefly glows.
        { text: "Count 2 levels up from 0.",               fx: "countSteps", withStart: true }  // 0 and the two upward steps highlight one by one.
      ],
      idle: { text: "Move 2 levels up from 0.", fx: "pulseUpFirst" }                            // Up arrow and first step pulse.
    },
    {
      type: "question", id: "T2", section: "tutorial", demo: true, demoMove: "tap",
      start: 0, target: -3, entry: true,
      water: "animate",
      vo: "The water level goes down by 3 levels. Move the marker down 3 levels. Where does it reach? Enter the number.",
      ost: "Move 3 levels down. Enter the number.",
      correct: "Correct! The water level is −3.",
      wrong: [
        { text: "Check the number of levels. Try again.",   fx: "return" },                     // Marker returns to 0.
        { text: "The water level went down. Move below 0.", fx: "glowDown" },                   // Down arrow briefly glows.
        { text: "Count 3 levels down from 0.",              fx: "countSteps", withStart: true } // 0 and the three downward steps highlight one by one.
      ],
      idle: { text: "Move 3 levels down from 0.", fx: "pulseDownFirst" }                        // Down arrow and first step pulse.
    },

    /* ============== TRANSITION → LEVEL 1 ============== */
    {
      type: "gate", id: "TR1",
      vo: "Good! Now you know how the levels work. Let’s mark the new water levels.",
      ost: "Let’s mark the new water level.",
      button: "Start",                                                   // Learner taps Start / continues.
      then: "activateScaleDial",                                         // Tank scale and dial become active.
      idle: { text: "Let’s mark the new water level.", fx: "pulseGate" } // Start button or tank scale gently pulses.
    },

    /* ======================= LEVEL 1 ======================= */
    {
      type: "question", id: "Q1", section: "level1",
      start: 2, target: 4, entry: true,
      vo: "The water level is at +2. It rises 2 levels. What is the new water level?",
      ost: "2 levels up from +2 = ?",
      correct: "Correct! The new water level is +4.",
      wrong: [
        { text: "Try again. Start at +2 and move 2 levels up.",            fx: "return" },      // Marker returns to +2.
        { text: "The water level is rising. Which way should you move?",   fx: "glowDirUp" },   // Upward direction on the scale glows.
        { text: "Count 2 levels up from +2.",                              fx: "countSteps" }   // #ERROR! → steps one by one (as Q5/Q6)
      ],
      idle: { text: "Move 2 levels up from +2.", fx: "pulseMarkerNext" }                        // Marker and next level above it pulse.
    },
    {
      type: "question", id: "Q2", section: "level1",
      start: 4, target: 6, entry: true,
      vo: "The water level is at +4. It rises 2 more levels. What is the new water level?",
      ost: "2 levels up from +4 = ?",
      correct: "Correct! The new water level is +6.",
      wrong: [
        { text: "Try again. Start at +4 and move 2 levels up.", fx: "return" },                 // Marker returns to +4.
        { text: "The level is rising. Move up.",                fx: "glowDirUp" },              // Up direction glows.
        { text: "Count 2 levels up from +4.",                   fx: "countSteps" }              // #ERROR! → steps one by one
      ],
      idle: { text: "Move 2 levels up from +4.", fx: "pulseMarkerNext" }                        // #ERROR! → as Q1
    },
    {
      type: "question", id: "Q3", section: "level1",
      start: 6, target: 3, entry: true,
      vo: "The water level is at +6. The villagers use 3 levels of water. What is the new water level?",
      ost: "3 levels down from +6 = ?",
      correct: "Correct! The new water level is +3.",
      wrong: [
        { text: "Try again. Start at +6 and move 3 levels down.", fx: "return" },               // Marker returns to +6.
        { text: "Water was used, so the level goes down.",        fx: "glowDirDown" },          // Down direction glows.
        { text: "Count 3 levels down from +6.",                   fx: "countSteps" }            // #ERROR! → steps one by one
      ],
      idle: { text: "Move 3 levels down from +6.", fx: "pulseNext" }                            // First downward step pulses.
    },
    {
      type: "question", id: "Q4", section: "level1",
      start: 3, target: -1, entry: true, crossZero: true,
      vo: "The water level is at +3. The villagers use 4 more levels of water. What is the new water level?",
      ost: "4 levels down from +3 = ?",
      correct: "Correct! The new water level is −1.",
      wrong: [
        { text: "Try again. Start at +3 and move 4 levels down.", fx: "return" },               // Marker returns to +3.
        { text: "Keep moving down. You can cross 0.",             fx: "pulseZero" },            // 0 briefly glows to show the crossing point.
        { text: "Count 4 levels down from +3.",                   fx: "countSteps" }            // #ERROR! → steps one by one
      ],
      idle: { text: "Move 4 levels down from +3.", fx: "pulseNext" }                            // The first downward step pulses.
    },
    {
      type: "question", id: "Q5", section: "level1",
      start: -1, target: -3, entry: true,
      vo: "The water level is at −1. The villagers use 2 more levels of water. What is the new water level?",
      ost: "2 levels down from −1 = ?",
      correct: "Correct! The new water level is −3.",
      wrong: [
        { text: "Try again. Start at −1 and move 2 levels down.", fx: "return" },               // Lever returns to −1.
        { text: "The water level goes down. Move lower.",         fx: "glowDirDown" },          // Down direction glows.
        { text: "Count 2 levels down from −1.",                   fx: "countSteps" }            // −2, −3 highlight one by one.
      ],
      idle: { text: "Move 2 levels down from −1.", fx: "pulseNext" }                            // −2 gently pulses.
    },
    {
      type: "question", id: "Q6", section: "level1",
      start: -3, target: -7, entry: true,
      vo: "The water level is at −3. The villagers use 4 more levels of water. What is the new water level?",
      ost: "4 levels down from −3 = ?",
      correct: "Correct! The new water level is −7.",
      wrong: [
        { text: "Try again. Start at −3 and move 4 levels down.", fx: "return" },               // Lever returns to −3.
        { text: "The water level goes down. Move lower.",         fx: "glowDirDown" },          // Down direction glows.
        { text: "Count 4 levels down from −3.",                   fx: "countSteps" }            // −4, −5, −6, −7 highlight one by one.
      ],
      idle: { text: "Move 4 levels down from −3.", fx: "pulseNext" }                            // −4 gently pulses.
    },

    /* ============== TRANSITION → LEVEL 2 ============== */
    {
      type: "gate", id: "TR2",
      vo: "Now let’s calculate the water levels exactly.",
      ost: "Let’s calculate the water levels!",
      appear: "eqPanel",                                                 // Equation panel appears beside the tank.
      continueOnTap: true,                                               // Learner observes and taps to continue.
      idle: { text: "Let’s find the new water level.", fx: "pulseEqPanel" } // Equation panel gently pulses.
    },

    /* ======================= LEVEL 2 (addition) ======================= */
    {
      type: "question", id: "A1", section: "level2",
      start: 0, target: 3, entry: true, eq: { a: 0, op: "+", b: 3 }, liveEq: true,
      vo: "The water level is at 0. It increases by 3 levels. Let’s find the new water level.",
      ost: "The water level is at 0.\n0 + (+3) = ?",
      correct: "Correct! The new water level is +3.",
      wrong: [
        { text: "The water level is increasing. Move upward.", fx: "glowDirUp" },                          // Upward side of the scale highlights.
        { text: "Start at 0 and count 3 levels up.",           fx: "countSteps", withStart: true },        // 0 → +1 → +2 → +3 highlights one level at a time.
        { text: "Count the 3 levels carefully.",               fx: "pulseSteps" }                          // Three levels above 0 gently pulse.
      ],
      idle: { text: "Start at 0 and count 3 levels up.", fx: "pulseEqTerms" }                              // 0 and (+3) in the equation gently pulse.
    },
    {
      type: "question", id: "A2", section: "level2",
      start: 2, target: 5, entry: true, eq: { a: 2, op: "+", b: 3 },
      vo: "The water level is at +2. It increases by 3 levels. Find the new water level.",
      ost: "(+2) + (+3) = ?",
      correct: "Correct! The new water level is +5.",
      wrong: [
        { text: "Check how the water level needs to change.", fx: "pulseStart" },                          // Starting level +2 pulses.
        { text: "Start again from +2.",                       fx: "return" },                              // Lever resets to +2.
        { text: "Count 3 levels from +2.",                    fx: "countSteps", pulse: true }              // #ERROR! → levels pulse one by one (as A3/A5)
      ],
      idle: { text: "Start at +2 and find the new water level.", fx: "pulseEqTerms" }                      // #ERROR! → start and operand pulse (as A3/A5)
    },
    {
      type: "question", id: "A3", section: "level2",
      start: -2, target: 2, entry: true, eq: { a: -2, op: "+", b: 4 },
      vo: "The water level increases by 4 levels. Find the new water level.",
      ost: "(−2) + (+4) = ?",
      correct: "Correct! The new water level is +2.",
      wrong: [
        { text: "Check how the water level should change.", fx: "pulseStart" },                            // Starting level −2 pulses.
        { text: "Start again from −2.",                     fx: "return" },                                // Lever resets to −2.
        { text: "Count 4 levels as you move.",              fx: "countSteps", pulse: true }                // −1, 0, +1, +2 pulse one by one.
      ],
      idle: { text: "Start at −2 and find the new water level.", fx: "pulseEqTerms" }                      // −2 and (+4) in the equation pulse.
    },
    {
      type: "question", id: "A4", section: "level2",
      start: 3, target: -2, entry: true, eq: { a: 3, op: "+", b: -5 },
      vo: "Your turn! Find the new water level.",
      ost: "(+3) + (−5) = ?",
      correct: "Correct! The new water level is −2.",
      wrong: [
        { text: "Check whether the level should rise or come down.", fx: "pulseStartEq" },                 // Starting level +3 and equation pulse.
        { text: "Start again from +3.",                              fx: "return" },                       // Lever resets to +3.
        { text: "Count 5 levels carefully.",                         fx: "countSteps", pulse: true }       // #ERROR! → levels pulse one by one
      ],
      idle: { text: "Start at +3 and find the new water level.", fx: "pulseEqTerms" }                      // #ERROR! → start and operand pulse
    },
    {
      type: "question", id: "A5", section: "level2",
      start: -2, target: -5, entry: true, eq: { a: -2, op: "+", b: -3 },
      vo: "Find the new water level.",
      ost: "(−2) + (−3) = ?",
      correct: "Correct! The new water level is −5.",
      wrong: [
        { text: "Check how the water level should change.", fx: "pulseStart" },                            // Starting level −2 pulses.
        { text: "Start again from −2.",                     fx: "return" },                                // Lever resets to −2.
        { text: "Count 3 levels as you move.",              fx: "countSteps", pulse: true }                // −3, −4, −5 pulse one by one.
      ],
      idle: { text: "Start at −2 and find the new water level.", fx: "pulseEqTerms" }                      // −2 and (−3) in the equation pulse.
    },

    /* ======================= LEVEL 3 (subtraction) ======================= */
    {
      type: "question", id: "S1", section: "level3",
      start: 0, target: -3, entry: true, eq: { a: 0, op: "−", b: 3 },
      vo: "The water level is at 0. Now 3 levels are used. Let’s find the new water level.",
      ost: "0 − (+3) = ?",
      correct: "Correct! The new water level is −3.",
      wrong: [
        { text: "The water level needs to go down.",  fx: "glowDirDown" },                                 // Downward side of the scale highlights.
        { text: "Start at 0 and move 3 levels down.", fx: "highlightStart" },                              // 0 highlights as the starting level.
        { text: "Count 3 levels down carefully.",     fx: "countSteps", pulse: true }                      // −1, −2, −3 pulse one by one.
      ],
      idle: { text: "Start at 0 and count 3 levels down.", fx: "pulseEqTerms" }                            // 0 and (+3) in the equation gently pulse.
    },
    {
      type: "question", id: "S2", section: "level3",
      start: 4, target: 2, entry: true, eq: { a: 4, op: "−", b: 2 },
      vo: "Now it’s your turn! Find the new water level.",
      ost: "(+4) − (+2) = ?",
      correct: "Correct! The new water level is +2.",
      wrong: [
        { text: "Check how the water level needs to change.", fx: "pulseStart" },                          // Starting level +4 pulses.
        { text: "Start again from +4.",                       fx: "return" },                              // Lever resets to +4.
        { text: "Count 2 levels down from +4.",               fx: "countSteps", pulse: true }              // #ERROR! → levels pulse one by one (as S4)
      ],
      idle: { text: "Start at +4 and find the new water level.", fx: "pulseEqTerms" }                      // #ERROR! → start and operand pulse (as S4)
    },
    {
      type: "question", id: "S3", section: "level3",
      start: 2, target: -2, entry: true, eq: { a: 2, op: "−", b: 4 },
      vo: "Find the new water level.",
      ost: "(+2) − (+4) = ?",
      correct: "Correct! The new water level is −2.",
      wrong: [
        { text: "Check how the water level should change.", fx: "pulseStart" },                            // Starting level +2 pulses.
        { text: "Start again from +2.",                     fx: "return" },                                // Lever resets to +2.
        { text: "Count 4 levels down from +2.",             fx: "countSteps", pulse: true }                // #ERROR! → levels pulse one by one
      ],
      idle: { text: "Start at +2 and find the new water level.", fx: "pulseEqTerms" }                      // #ERROR! → start and operand pulse
    },
    {
      type: "question", id: "S4", section: "level3",
      start: -1, target: -4, entry: true, eq: { a: -1, op: "−", b: 3 },
      vo: "Your turn! Find the new water level.",
      ost: "(−1) − (+3) = ?",
      correct: "Correct! The new water level is −4.",
      wrong: [
        { text: "Check how the water level should change.", fx: "pulseStart" },                            // Starting level −1 pulses.
        { text: "Start again from −1.",                     fx: "return" },                                // Lever resets to −1.
        { text: "Count 3 levels down from −1.",             fx: "countSteps", pulse: true }                // −2, −3, −4 pulse one by one.
      ],
      idle: { text: "Start at −1 and find the new water level.", fx: "pulseEqTerms" }                      // −1 and (+3) in the equation pulse.
    },
    {
      type: "question", id: "S5", section: "level3",
      start: -3, target: -1, entry: true, eq: { a: -3, op: "−", b: -2 },
      vo: "Find the new water level.",
      ost: "(−3) − (−2) = ?",
      correct: "Correct! The new water level is −1.",
      wrong: [
        { text: "Look carefully at the two minus signs.",         fx: "glowEqOp" },                        // − (−2) in the equation glows.
        { text: "Subtracting a negative changes the direction.",  fx: "glowDirUp" },                       // Upward direction on the scale highlights.
        { text: "Start at −3 and move 2 levels up.",              fx: "countSteps", pulse: true }          // −2, −1 pulse one by one.
      ],
      idle: { text: "Look at −(−2). Which way should the level move?", fx: "pulseEqOpDirUp" }              // −(−2) and the upward side of the scale gently pulse.
    }
  ]
};
