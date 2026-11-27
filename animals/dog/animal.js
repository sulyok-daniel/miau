// The dog mode, see animals/cat/animal.js for how to add an animal.
globalThis.ANIMALS ??= {};

// Load the texts next to this file. document.write adds the scripts right after this one, in order and before
// app.js runs (and works from file://, unlike fetch or modules)
for (const file of ["sayings", "phrases", "highscores", "arts"]) {
    document.write(`<script src="animals/dog/${file}.js"><\/script>`);
}

ANIMALS.dog = {
    emoji: "🐕",
    plural: "Hunde",
    face: "U^.^U",
    emojiPattern: /[🐶🐕]/gu,
    highlight: ["hund", "wuff", "leckerli", "gassi"],
    ui: {
        title: "Lock your screen 🐕",
        photoAlt: "Zufälliges Hundefoto",
        artLabel: "Hunde aus Textzeichen",
        toAscii: "Ohne Bilder (ASCII-Hunde)",
        effects: "Ressourcenfressender Wackeldackel",
        dark: "Die dunkle Seite des Wuffs.",
        historyEmpty: "Noch keine Hunde.",
    },
    // dog.ceo answers { message: <image url>, status: "success" }; no ids, no thumbnails (style.css scales the image down)
    async randomPhoto() {
        try {
            const res = await fetch("https://dog.ceo/api/breeds/image/random", {signal: AbortSignal.timeout(8000)});
            const data = res.ok ? await res.json() : undefined;
            if (data?.status === "success") return {src: data.message};
        } catch { /* no photo: the last one stays */ }
    },
};
