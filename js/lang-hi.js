/* =====================================================================
   Hindi (हिंदी) for "Integers: Rise and Fall" — applied by js/lang.js.

   Every English line in data.js maps to one Hindi line: `exact` for the
   one-off lines, `patterns` for the lines that only differ by their numbers
   ("Count 4 levels up from +2."). Equations ("(+4) + 3 = ?") stay as they are.

   Words chosen for the maths (as Hindi-medium textbooks use them):
     integers पूर्णांक · positive numbers धनात्मक संख्याएँ · negative numbers ऋणात्मक संख्याएँ
     +2 is read "धन 2", −3 "ऋण 3", 0 "शून्य" (only in the voice; the screen keeps + − 0)
     rises बढ़ता है → we add जोड़ते हैं · goes down घटता है → we subtract घटाते हैं
     (the same pair of words, so the language itself carries the rule)
     the water's level पानी का स्तर / स्तर · the game's level लेवल ("लेवल पूरा हुआ!"), so
     the two "levels" are never confused · mark निशान लगाना · sign चिह्न
   The learner is "तुम", and lines about the learner are gender-neutral
   ("तुमने निशान लगाया", "लीवर +2 पर पहुँच गया").
   ===================================================================== */
(function () {
  const dirWord = (d) => (d === "up" ? "ऊपर" : "नीचे");

  window.LANG_HI = {
    speechLang: "hi-IN",

    /* text the page itself shows (index.html data-i18n) */
    html: {
      title: "पूर्णांक<br /><span>उतार और चढ़ाव</span>",
      check: "जाँचो",
      start: "शुरू करो",
      langBtn: "English"                     // the button offers the other language
    },

    /* data.js `ui` */
    ui: {
      marked: "निशान लग गया!",
      howTo: "कैसे खेलें"
    },

    /* the voice's cue words for building the equation (game.js buildQuestionEq):
       Hindi says the number before the verb ("3 स्तर ऊपर जाता है"), so the sign and
       the number appear together on "3 स्तर" */
    cues: { dir: null, levels: "{n} स्तर" },

    /* per-step cue words that live inside the Hindi lines (teaching rows P3–P6) */
    steps: {
      P3: { build: { a: "+1", op: "बढ़कर", b: "2 स्तर" } },
      P4: { opGlow: "जोड़ते", moveAt: "नया" },
      P5: { build: { a: "+3", op: "घटकर", b: "5 स्तर" } },
      P6: { opGlow: "घटाते", moveAt: "नया" }
    },

    exact: {
      /* ---- Story ---- */
      "The villagers store water in a big tank. But today, the automatic water-level reading system has stopped working.":
        "गाँव के लोग एक बड़ी टंकी में पानी जमा करते हैं। लेकिन आज, पानी का स्तर अपने-आप पढ़ने वाली मशीन ने काम करना बंद कर दिया है।",
      "Pari, can you help me mark the water levels?": "परी, क्या तुम पानी के स्तर पर निशान लगाने में मेरी मदद करोगी?",
      "Yes! Let’s fix it.": "हाँ! चलो, इसे ठीक करते हैं।",
      "Look Pari, 0 shows the water level we need.": "देखो परी, 0 वह पानी का स्तर दिखाता है जितना हमें चाहिए।",
      "Above 0, there is more water than required.": "0 से ऊपर, ज़रूरत से ज़्यादा पानी है।",
      "Above 0, there is more water than requirement.": "0 से ऊपर, ज़रूरत से ज़्यादा पानी है।",
      "Below 0, there is less water than required.": "0 से नीचे, ज़रूरत से कम पानी है।",
      "Below 0, there is less water than requirement.": "0 से नीचे, ज़रूरत से कम पानी है।",
      "Now notice this, numbers above 0 are positive numbers.": "अब यह ध्यान दो, 0 से ऊपर की संख्याएँ धनात्मक संख्याएँ हैं।",
      "And, numbers below 0 are negative numbers.": "और, 0 से नीचे की संख्याएँ ऋणात्मक संख्याएँ हैं।",
      "Oh! so, below 0 is negative, and above 0 is positive!": "अरे! तो 0 से नीचे ऋणात्मक है, और 0 से ऊपर धनात्मक!",
      "Correct, Let’s mark the correct water level now.": "सही! चलो, अब पानी के सही स्तर पर निशान लगाते हैं।",

      /* ---- How to Play ---- */
      "Move the lever up or down as necessary. Like water rises 2 levels up.":
        "ज़रूरत के हिसाब से लीवर को ऊपर या नीचे करो। जैसे, पानी 2 स्तर ऊपर बढ़ता है।",
      "Move the lever up or down.\nMove the lever 2 levels up.": "लीवर को ऊपर या नीचे करो।\nलीवर को 2 स्तर ऊपर करो।",
      "Mark the correct water level.": "पानी के सही स्तर पर निशान लगाओ।",
      "Now enter the new water level.": "अब पानी का नया स्तर डालो।",
      "Now, enter the new water level.": "अब, पानी का नया स्तर डालो।",
      "Choose the correct sign for the water level.": "पानी के स्तर के लिए सही चिह्न चुनो।",
      "Choose the correct sign.": "सही चिह्न चुनो।",
      "Great! You marked the water level correctly.": "बहुत बढ़िया! तुमने पानी के स्तर पर सही निशान लगाया।",
      "Check the water level marked.": "लगाया गया निशान जाँचो।",

      /* ---- Level 1 ---- */
      "Find the mark 0.": "0 का निशान ढूँढो।",
      "Correct! This is the reference level 0.": "सही! यह संदर्भ स्तर 0 है।",
      "Try again. Find 0 on the scale.": "फिर से कोशिश करो। स्केल पर 0 ढूँढो।",
      "Look for 0.": "0 को ढूँढो।",
      "Move the marker to 0.": "मार्कर को 0 पर ले जाओ।",
      "Find the 0 mark.": "0 का निशान ढूँढो।",
      "Enter the current water level.": "पानी का अभी का स्तर डालो।",
      "Correct! 0 is the current water level.": "सही! पानी का अभी का स्तर 0 है।",
      "Try again. What level is the marker on?": "फिर से कोशिश करो। मार्कर किस स्तर पर है?",
      "Look at the marked water level.": "जिस स्तर पर निशान लगा है, उसे देखो।",
      "Enter 0 on the screen.": "स्क्रीन पर 0 डालो।",
      "Great! \nLet’s mark all water levels.": "बहुत बढ़िया! \nचलो, पानी के सभी स्तरों पर निशान लगाते हैं।",
      "Let’s mark all the water levels.": "चलो, पानी के सभी स्तरों पर निशान लगाते हैं।",
      "Start": "शुरू करो",
      "Let’s mark the new water level.": "चलो, पानी के नए स्तर पर निशान लगाते हैं।",
      "Correct! You marked the new water level.": "सही! तुमने पानी के नए स्तर पर निशान लगाया।",
      "Check the number of levels. Try again.": "स्तरों की गिनती जाँचो। फिर से कोशिश करो।",
      "Find the new water level.": "पानी का नया स्तर ढूँढो।",
      "Enter the new water level.": "पानी का नया स्तर डालो।",
      "Try again. Check where the marker is.": "फिर से कोशिश करो। देखो मार्कर कहाँ है।",
      "Look at the number beside the marker.": "मार्कर के पास वाली संख्या देखो।",

      /* ---- Level 2 teaching ---- */
      "I noticed something! When the water level rises, we add to the current level.":
        "मैंने कुछ देखा! जब पानी का स्तर बढ़ता है, तो हम अभी के स्तर में जोड़ते हैं।",
      "Water level rises → Add": "पानी का स्तर बढ़ा → जोड़ो",
      "And when the water level goes down, we subtract from the current level.":
        "और जब पानी का स्तर घटता है, तो हम अभी के स्तर में से घटाते हैं।",
      "Water level goes down → Subtract": "पानी का स्तर घटा → घटाओ",
      "Correct, Pari! If the water level is at +1 and rises by 2 levels, ":
        "सही, परी! अगर पानी का स्तर +1 पर है और बढ़कर 2 स्तर ऊपर जाता है, ",
      "We add and the new water level is +3.": "हम जोड़ते हैं, और पानी का नया स्तर +3 है।",
      "Now, if the water level is at +3 and goes down by 5 levels.":
        "अब, अगर पानी का स्तर +3 पर है और घटकर 5 स्तर नीचे जाता है।",
      "We subtract and the new water level is −2.": "हम घटाते हैं, और पानी का नया स्तर −2 है।",
      "Got it! When the level rises, we add. When it goes down, we subtract.":
        "समझ गई! जब स्तर बढ़ता है, हम जोड़ते हैं। जब घटता है, हम घटाते हैं।",
      "Rise → Add • Go down → Subtract": "बढ़ा → जोड़ो • घटा → घटाओ",
      "Let’s calculate the water levels exactly.": "चलो, पानी के स्तरों का सही हिसाब लगाते हैं।",
      "Let’s calculate the water levels exactly!": "चलो, पानी के स्तरों का सही हिसाब लगाते हैं!",
      "Let’s find the new water level.": "चलो, पानी का नया स्तर ढूँढते हैं।",

      /* ---- Level 2 game ---- */
      "The water level is at 0. It goes up 3 levels. Move the lever 3 levels up.":
        "पानी का स्तर 0 पर है। यह 3 स्तर ऊपर जाता है। लीवर को 3 स्तर ऊपर ले जाओ।",
      "Tap the new water level.": "पानी का नया स्तर दबाओ।",
      "The water level is at +2. It rises 3 levels up. \nMove the lever to correct water level.":
        "पानी का स्तर +2 पर है। यह 3 स्तर ऊपर बढ़ता है। \nलीवर को पानी के सही स्तर पर ले जाओ।",
      "The water level rises 3 levels up. \nMove the lever to correct water level.":
        "पानी 3 स्तर ऊपर बढ़ता है। \nलीवर को पानी के सही स्तर पर ले जाओ।",
      "Check how the water level needs to move.": "जाँचो कि पानी का स्तर किस तरफ़ जाना चाहिए।",
      "The water level goes up. Move upward.": "पानी ऊपर जाता है। ऊपर की ओर ले जाओ।",
      "The water level goes down. Move downward.": "पानी नीचे जाता है। नीचे की ओर ले जाओ।",
      "Try again. Check where the lever stopped.": "फिर से कोशिश करो। देखो लीवर कहाँ रुका।",
      "Look at the number beside the lever.": "लीवर के पास वाली संख्या देखो।",
      "Great job! You marked the water levels correctly.": "शाबाश! तुमने पानी के सभी स्तरों पर सही निशान लगाए।",
      "Level Complete!": "लेवल पूरा हुआ!",

      /* ---- Level 3 transition ---- */
      "Let’s mark some more water levels.": "चलो, पानी के कुछ और स्तरों पर निशान लगाते हैं।",
      "Let’s mark some more water levels!": "चलो, पानी के कुछ और स्तरों पर निशान लगाते हैं!",
      "Oh! The lever isn’t working now!": "अरे! लीवर अब काम नहीं कर रहा!",
      "That’s okay! Pari. \nLet’s mark the new water level using the number pad.":
        "कोई बात नहीं, परी! \nचलो, नंबर पैड से पानी के नए स्तर पर निशान लगाते हैं।",
      "Choose the correct sign and number.": "सही चिह्न और संख्या चुनो।",
      "And Let’s see where the water level reaches!": "और देखते हैं, पानी का स्तर कहाँ तक पहुँचता है!",
      "I’m ready! Let’s mark the new level.": "मैं तैयार हूँ! चलो, नए स्तर पर निशान लगाते हैं।",
      "Check how the water level changes. Try again.": "देखो पानी का स्तर कैसे बदलता है। फिर से कोशिश करो।",

      /* ---- Story end ---- */
      "Great work! You marked all the water levels correctly.": "बहुत बढ़िया! तुमने पानी के सभी स्तरों पर सही निशान लगाए।",
      "We did it! We tracked every rise and fall in the water level.":
        "हमने कर दिखाया! हमने पानी के स्तर के हर उतार और चढ़ाव पर नज़र रखी।",
      "And these positive numbers, negative numbers, and 0 are called integers.":
        "और ये धनात्मक संख्याएँ, ऋणात्मक संख्याएँ और 0, पूर्णांक कहलाते हैं।",
      "So integers helped us show water levels at 0, above 0, and below 0!":
        "तो पूर्णांकों ने हमें 0 पर, 0 से ऊपर और 0 से नीचे के पानी के स्तर दिखाने में मदद की!",
      "So integers helped us show water levels below 0, at 0, and above 0!":
        "तो पूर्णांकों ने हमें 0 से नीचे, 0 पर और 0 से ऊपर के पानी के स्तर दिखाने में मदद की!",
      "Excellent! You’re an Integers Expert now!": "शानदार! अब तुम पूर्णांकों के विशेषज्ञ हो!",
      "Excellent! You’re a Water Level Expert now!": "शानदार! अब तुम पानी के स्तर के विशेषज्ञ हो!"
    },

    /* [English pattern, (match, translate) → Hindi] — the repeated lines that differ only by numbers */
    patterns: [
      // an equation stays as it is: "(+4) + 3 = ?"
      [/^[()+−\d\s=?]+$/, (m) => m[0]],
      // Level 3 OST: the equation, then the instruction
      [/^(.+ = \?)\n([\s\S]+)$/, (m, tr) => `${m[1]}\n${tr(m[2])}`],
      // Level 1
      [/^The water level rises (\d+) levels\. \nMove the marker \1 levels up\.$/,
        (m) => `पानी ${m[1]} स्तर बढ़ता है। \nमार्कर को ${m[1]} स्तर ऊपर ले जाओ।`],
      [/^The water level (rises|falls) (\d+) levels\. Move the marker to the correct water level\.$/,
        (m) => `पानी ${m[2]} स्तर ${m[1] === "rises" ? "बढ़ता" : "घटता"} है। मार्कर को पानी के सही स्तर पर ले जाओ।`],
      [/^The water level (rises|falls) (\d+) levels\. Move the marker \2 levels (up|down)\.$/,
        (m) => `पानी ${m[2]} स्तर ${m[1] === "rises" ? "बढ़ता" : "घटता"} है। मार्कर को ${m[2]} स्तर ${dirWord(m[3])} ले जाओ।`],
      [/^Count (\d+) levels (up|down) from ([+−]?\d+)\.$/,
        (m) => `${m[3]} से ${m[1]} स्तर ${dirWord(m[2])} गिनो।`],
      [/^Yes! The new water level is ([+−]?\d+)\.$/, (m) => `हाँ! पानी का नया स्तर ${m[1]} है।`],
      [/^Enter ([+−]?\d+)\.$/, (m) => `${m[1]} डालो।`],
      // Level 2
      [/^Correct! You reached ([+−]?\d+)\.$/, (m) => `सही! लीवर ${m[1]} पर पहुँच गया।`],
      [/^Correct! The new water level is ([+−]?\d+)\.$/, (m) => `सही! पानी का नया स्तर ${m[1]} है।`],
      [/^Enter ([+−]?\d+) on the screen\.$/, (m) => `स्क्रीन पर ${m[1]} डालो।`],
      [/^Move the lever (\d+) levels (up|down) from ([+−]?\d+)\.$/,
        (m) => `लीवर को ${m[3]} से ${m[1]} स्तर ${dirWord(m[2])} ले जाओ।`],
      [/^Move the lever (\d+) levels (up|down)\.$/, (m) => `लीवर को ${m[1]} स्तर ${dirWord(m[2])} ले जाओ।`],
      [/^The water level (rises|goes up|goes down) (\d+) levels( up)?\. (\n)?Move the lever to (?:the )?correct water level\.$/,
        (m) => `पानी ${m[2]} स्तर ${m[1] === "goes down" ? "नीचे जाता" : m[1] === "goes up" ? "ऊपर जाता" : "ऊपर बढ़ता"} है। ${m[4] || ""}लीवर को पानी के सही स्तर पर ले जाओ।`],
      [/^The water level (rises|goes up|goes down) (\d+) levels( up)?\. \nMove the lever \2 levels (up|down)\.$/,
        (m) => `पानी ${m[2]} स्तर ${m[1] === "goes down" ? "नीचे जाता" : m[1] === "goes up" ? "ऊपर जाता" : "ऊपर बढ़ता"} है। \nलीवर को ${m[2]} स्तर ${dirWord(m[4])} ले जाओ।`],
      // Level 3
      [/^The water level is at ([+−]?\d+)\. It goes (up|down) (\d+) levels\. Enter the new water level\.$/,
        (m) => `पानी का स्तर ${m[1]} पर है। यह ${m[3]} स्तर ${dirWord(m[2])} जाता है। पानी का नया स्तर डालो।`],
      [/^The water level goes (up|down) (\d+) levels\. Count \2 levels \1 from ([+−]?\d+)\.$/,
        (m) => `पानी ${m[2]} स्तर ${dirWord(m[1])} जाता है। ${m[3]} से ${m[2]} स्तर ${dirWord(m[1])} गिनो।`],
      [/^The new water level is ([+−]?\d+)\. Enter \1\.$/, (m) => `पानी का नया स्तर ${m[1]} है। ${m[1]} डालो।`]
    ],

    /* what the voice reads (the screen keeps the symbols): +2 "धन 2", −3 "ऋण 3", 0 "शून्य" */
    spoken: (text) => text
      .replace(/\s*\n\s*/g, " ")
      .replace(/−(\d)/g, "ऋण $1")
      .replace(/\+(\d)/g, "धन $1")
      .replace(/(?<![\d.])0(?!\d|\.\d)/g, "शून्य")
      .replace(/\s+/g, " ").trim()
  };
})();
