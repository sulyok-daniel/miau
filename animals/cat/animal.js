// The cat mode. To add an animal: copy the folder animals/cat/, adjust its files, and add
// <script src="animals/<name>/animal.js"> to index.html. The cat is always the default animal.
globalThis.ANIMALS ??= {};

// Load the texts next to this file. document.write adds the scripts right after this one, in order and before
// app.js runs (and works from file://, unlike fetch or modules)
for (const file of ["sayings", "phrases", "highscores", "arts"]) {
    document.write(`<script src="animals/cat/${file}.js"><\/script>`);
}

const CATAAS = "https://cataas.com";

ANIMALS.cat = {
    emoji: "🐈",
    plural: "Katzen",
    face: "=^.^=",              // stands in for an icon on the ASCII button
    emojiPattern: /😺/gu,       // emojis in sayings that become `face` in ASCII mode
    highlight: ["katze", "miau"], // words (and their endings) that get an accent paper, besides the common ones
    ui: {
        title: "Lock your screen 🐈",
        photoAlt: "Zufälliges Katzenfoto",
        artLabel: "Katzen aus Textzeichen",
        toAscii: "Ohne Bilder (ASCII-Katzen)",
        effects: "Ressourcenfressende Wackelkatze",
        dark: "Die dunkle Seite der Miau.",
        historyEmpty: "Noch keine Katzen.",
    },
    // A random photo { src, thumb? } (thumb: small version for the history); transient: not worth a history entry.
    // Asks for the photo's id first, so the history can show exactly this photo again.
    async randomPhoto() {
        try {
            const res = await fetch(`${CATAAS}/cat?json=true&${Date.now()}`, {signal: AbortSignal.timeout(8000)});
            const id = res.ok ? (await res.json()).id : undefined;
            if (id) {
                const src = `${CATAAS}/cat/${encodeURIComponent(id)}`;
                return {src, thumb: `${src}?width=160`};
            }
        } catch { /* fall through */ }
        return {src: `${CATAAS}/cat?${Date.now()}`, transient: true}; // the timestamp defeats the cache
    },
    // History entries from before the animals were configurable: { id } instead of { src, thumb }
    legacyPhoto: id => ({src: `${CATAAS}/cat/${encodeURIComponent(id)}`, thumb: `${CATAAS}/cat/${encodeURIComponent(id)}?width=160`}),
};
