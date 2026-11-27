// The capybara mode, see animals/cat/animal.js for how to add an animal.
globalThis.ANIMALS ??= {};

for (const file of ["sayings", "phrases", "highscores", "arts"]) {
    document.write(`<script src="animals/capybara/${file}.js"><\/script>`);
}

ANIMALS.capybara = {
    emoji: "🐹",
    plural: "Capybaras",
    face: "(o.o)",
    emojiPattern: /🐹/gu,
    highlight: ["capybara", "wasser", "bad"],
    ui: {
        title: "Lock your screen 🐹",
        photoAlt: "Zufälliges Capybarafoto",
        artLabel: "Capybaras aus Textzeichen",
        toAscii: "Ohne Bilder (ASCII-Capybaras)",
        effects: "Ressourcenfressendes Wackelcapybara",
        dark: "Die dunkle Seite des Flusses.",
        historyEmpty: "Noch keine Capybaras.",
    },
    // capy.lol answers { success, data: { url, ... } } where url is a fixed photo (http, hence the upgrade)
    async randomPhoto() {
        try {
            const res = await fetch("https://api.capy.lol/v1/capybara?json=true", {signal: AbortSignal.timeout(8000)});
            const data = res.ok ? await res.json() : undefined;
            if (data?.success) return {src: data.data.url.replace(/^http:/, "https:")};
        } catch { /* no photo: the last one stays */ }
    },
};
