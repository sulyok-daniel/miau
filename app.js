// ---------------------------------------------------------------------------
// Texts live in files next to this page; add or change texts there, not here:
//   texts/sayings.js     ready-made sayings, one per line
//   texts/phrases.js     parts for generated sayings: [when] + [what] + [ending], one per line
//   texts/highscores.js  messages for a new highscore, one per line
//   texts/cats.js        ASCII cats, separated by a line with ---
// They are .js files loaded by index.html (each sets TEXTS.<name> to its text) rather than .txt files
// fetched here, because browsers block fetch() on pages opened straight from disk (file://)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "miau-lock-settings";
const HIGHSCORE_KEY = "miau-lock-highscore";
const HISTORY_KEY = "miau-lock-history";

const CATAAS = "https://cataas.com";
const HISTORY_SIZE = 50;     // how many shown cats the history keeps
const THUMBNAIL_WIDTH = 160;

const DEFAULT_RELOAD_SECONDS = 30;
const READY_MADE_CHANCE = 0.75;

// Highlighted words: "Katze…", "miau…", "Kaffee…" and "Kuchen…" (the capture group makes split() keep the matches)
const HIGHLIGHT = /(katze\p{L}*|miau\p{L}*|kaffee\p{L}*|kuchen\p{L}*)/giu;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const $ = selector => document.querySelector(selector);
const pad = n => String(n).padStart(2, "0");

const randomBetween = (min, max) => min + Math.random() * (max - min);
const randomSigned = (min, max) => (Math.random() < 0.5 ? -1 : 1) * randomBetween(min, max);
const pick = list => list[Math.floor(Math.random() * list.length)];

// Slightly irregular edges for the paper: a clip-path polygon whose corners and edge points are
// nudged inwards by up to `maxX` / `maxY` percent of the element's width / height
const roughPolygon = (maxX, maxY, steps) => {
    const along = n => Array.from({length: n + 1}, (_, i) => (i * 100) / n);
    const points = [
        ...along(steps).map(x => [x, randomBetween(0, maxY)]),                       // top, left to right
        ...along(3).slice(1, -1).map(y => [100 - randomBetween(0, maxX), y]),        // right
        ...along(steps).reverse().map(x => [x, 100 - randomBetween(0, maxY)]),       // bottom, right to left
        ...along(3).slice(1, -1).reverse().map(y => [randomBetween(0, maxX), y]),    // left
    ];
    return `polygon(${points.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(", ")})`;
};

// Pick up to `count` different entries from a list
const pickDistinct = (list, count) => {
    const pool = [...list];
    return Array.from({length: Math.min(count, pool.length)},
        () => pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
};

const formatTime = seconds =>
    `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;

// Replace non-ASCII characters so the saying is plain ASCII text
const ASCII_REPLACEMENTS = [
    [/ä/g, "ae"], [/ö/g, "oe"], [/ü/g, "ue"], [/Ä/g, "Ae"], [/Ö/g, "Oe"], [/Ü/g, "Ue"], [/ß/g, "ss"],
    [/[„“”]/g, '"'], [/[‚‘’]/g, "'"], [/[–—]/g, "-"], [/…/g, "..."], [/😺/g, "=^.^="],
    [/[^\x00-\x7F]/g, ""],
];
const toAscii = text =>
    ASCII_REPLACEMENTS.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), text).trim();

// Put cats next to each other, bottom-aligned, as one block of text
const sideBySide = cats => {
    const height = Math.max(0, ...cats.map(cat => cat.length));
    const columns = cats.map(cat => {
        const width = Math.max(...cat.map(line => line.length));
        const padding = Array(height - cat.length).fill("");
        return [...padding, ...cat].map(line => line.padEnd(width));
    });
    const rows = Array.from({length: height}, (_, row) => columns.map(column => column[row]).join("   ").trimEnd());
    return rows.join("\n");
};

// ---------------------------------------------------------------------------
// Elements and state
// ---------------------------------------------------------------------------

const photo = $(".photo");
const img = $("img");
const art = $("pre");
const saying = $("main p span");
const clock = $("#timer time");
const highscoreBox = $("#highscore");
const highscoreTime = $("#highscore .best time");
const highscoreRecord = $("#highscore .record");
const configDrawer = $("#config");
const historyDrawer = $("#history");
const openConfigButton = $("#open-config");
const openHistoryButton = $("#open-history");
const modeButton = $("#mode");
const effectsToggle = $("#effects");
const glow = $(".glow");
const fullscreenButton = $("#fullscreen");
const historyList = $("#history ol");
const darkMode = $("#dark");
const inverted = $("#inverted");
const autoReload = $("#autoreload");
const seconds = $("#seconds");
const resetSettingsButton = $("#reset-settings");
const resetHighscoreButton = $("#reset-highscore");
const resetHistoryButton = $("#reset-history");

let sayings = [];            // ready-made
let phrases = {};            // generated: { when: [...], what: [...], ending: [...] }
let highscoreMessages = [];
let cats = [];               // each cat is an array of lines

let currentSaying = "";
let reloadTimeout;
let showCount = 0;           // detects outdated cataas answers after a quick second click

// Shown cats, newest first: { kind: "photo", id, saying } or { kind: "ascii", art, saying }
let shownCats = [];
let currentEntry;
let pendingEntry;            // shown after a mode switch instead of a new random cat

const startedAt = Date.now();
let highscoreAtStart = 0;    // what had to be beaten when this page was opened
let highscoreAnnounced = false;

const isAscii = () => location.hash === "#ascii";

// ---------------------------------------------------------------------------
// Sayings
// ---------------------------------------------------------------------------

function generatedSaying() {
    const {when, what, ending} = phrases;
    if (!when?.length || !what?.length || !ending?.length) return "";
    const end = pick(ending);
    const separator = /^[.,!?…]/.test(end) ? "" : " ";
    return `${pick(when)} ${pick(what)}${separator}${end}`;
}

function randomSaying() {
    const useReadyMade = sayings.length && (Math.random() < READY_MADE_CHANCE || !phrases.when);
    return useReadyMade ? pick(sayings) : generatedSaying();
}

// A word as DOM nodes; highlighted parts become <mark>
function wordNodes(word) {
    return word.split(HIGHLIGHT).map((part, i) => {
        if (i % 2 === 0) return part;
        const mark = document.createElement("mark");
        mark.textContent = part;
        return mark;
    });
}

// The saying is set in strips, one per line, each slightly rotated and indented differently.
// Step 1: lay the words out normally to find out where the lines break.
// Step 2: rebuild the text as one strip element per line.
function setSaying(text) {
    currentSaying = text;

    const words = text.split(/\s+/).filter(Boolean).map(word => {
        const el = document.createElement("span");
        el.append(...wordNodes(word));
        // highlighted words get their own strip later; reserve about the room that costs (padding and gaps)
        if (el.querySelector("mark")) el.style.marginInline = ".1em";
        return el;
    });
    saying.replaceChildren(...words.flatMap(word => [word, " "]));

    const wordsPerLine = [];
    let lineTop;
    for (const word of words) {
        if (word.offsetTop !== lineTop) {
            wordsPerLine.push([]);
            lineTop = word.offsetTop;
        }
        wordsPerLine.at(-1).push(word);
    }

    words.forEach(word => word.style.marginInline = "");

    saying.replaceChildren(...wordsPerLine.map(lineWords => {
        // outer span: tilt, indent and shadow; inner spans: the papers themselves, each with its own rough edge
        // (the shadow must sit on the outer span, or the clip-path would cut it off).
        // Highlighted words are cut out of the strip: they sit on their own paper in the accent color.
        const papers = [];
        for (const word of lineWords) {
            const accent = !!word.querySelector("mark");
            if (papers.at(-1)?.accent !== accent) {
                const paper = document.createElement("span");
                paper.className = accent ? "paper accent" : "paper";
                paper.style.setProperty("--clip", roughPolygon(.3, 3, 8));
                let el = paper;
                if (accent) {
                    // the accent paper gets a wrapper for tilt and its own shadow (the clip-path would cut it off)
                    el = document.createElement("span");
                    el.className = "chip";
                    el.style.setProperty("--tilt", `${randomSigned(1.2, 2.6)}deg`);
                    el.style.setProperty("--lift", `${randomSigned(.03, .1)}em`);
                    // its own wobble, independent of the strip's
                    el.style.setProperty("--chip-wobble", `${randomSigned(.6, 1.2)}deg`);
                    el.style.setProperty("--chip-time", `${randomBetween(4, 7)}s`);
                    el.style.setProperty("--chip-delay", `-${randomBetween(0, 7)}s`);
                    el.append(paper);
                }
                papers.push({ el, paper, accent, words: [] });
            }
            papers.at(-1).words.push(word);
        }
        for (const { paper, words } of papers) paper.append(...words.flatMap((word, i) => (i ? [" ", word] : [word])));

        const strip = document.createElement("span");
        strip.className = "line";
        strip.style.setProperty("--rot", `${randomSigned(.2, .8)}deg`);
        strip.style.setProperty("--indent", `${randomBetween(0, .9)}em`);
        // each strip wobbles a little, at its own pace
        strip.style.setProperty("--wobble", `${randomSigned(.3, .5)}deg`);
        strip.style.setProperty("--wobble-time", `${randomBetween(5.25, 9)}s`);
        strip.style.setProperty("--wobble-delay", `-${randomBetween(0, 9)}s`);
        strip.append(...papers.map(({ el }) => el));
        return strip;
    }));
}

// Line breaks depend on window size and font: lay the saying out again
const relayout = () => currentSaying && setSaying(currentSaying);

// ---------------------------------------------------------------------------
// Cat: photo or ASCII art, plus a new saying
// ---------------------------------------------------------------------------

// Once the photo has loaded: fit the frame to its ratio, start the swaying, reuse it as blurred background
img.onload = () => {
    document.body.style.setProperty("--photo", `url("${img.src}")`);
    photo.style.setProperty("--ratio", img.naturalWidth / img.naturalHeight);
    img.style.setProperty("--clip", roughPolygon(.15, .25, 10));
    startSway();
};

// Gentle swaying: random shift, rotation and scale, different for every photo
function startSway() {
    photo.style.setProperty("--dx", `${randomSigned(.8, 1.8)}vw`);
    photo.style.setProperty("--dy", `${randomSigned(.8, 1.8)}vh`);
    photo.style.setProperty("--rot", `${randomSigned(1, 2.2)}deg`);
    photo.style.setProperty("--scale", randomBetween(1.03, 1.06));
    photo.style.animation = "none"; // restart the animation for the new photo
    void photo.offsetWidth;
    photo.style.animation = "";
}

const photoUrl = id => `${CATAAS}/cat/${encodeURIComponent(id)}`;

// Ask cataas for a random photo's id first, so the history can show exactly this photo again
async function randomPhotoId() {
    try {
        const res = await fetch(`${CATAAS}/cat?json=true&${Date.now()}`, {signal: AbortSignal.timeout(8000)});
        return res.ok ? (await res.json()).id : undefined;
    } catch {
        return undefined;
    }
}

async function newEntry() {
    const saying = randomSaying();
    if (isAscii()) return {kind: "ascii", art: sideBySide(pickDistinct(cats, pick([1, 2, 2, 3]))), saying};
    return {kind: "photo", id: await randomPhotoId(), saying};
}

function show(entry) {
    currentEntry = entry;
    // Easter egg: a Comic Sans saying switches the whole page to Comic Sans
    document.body.classList.toggle("comic", /comic sans/i.test(entry.saying));
    if (entry.kind === "ascii") {
        art.textContent = entry.art;
        setSaying(toAscii(entry.saying));
    } else {
        // without an id (cataas JSON unavailable) fall back to a plain random photo; timestamp defeats the cache
        img.src = entry.id ? photoUrl(entry.id) : `${CATAAS}/cat?${Date.now()}`;
        setSaying(entry.saying);
    }
    if (historyDrawer.open) renderHistory();
    scheduleReload();
}

async function next() {
    const count = ++showCount;
    const entry = await newEntry();
    if (count !== showCount) return; // a newer click, mode switch or history pick took over meanwhile
    if (entry.kind === "ascii" || entry.id) addToHistory(entry);
    show(entry);
}

// Show a cat from the history again, switching between photos and ASCII if needed
function restore(entry) {
    ++showCount;
    if ((entry.kind === "ascii") === isAscii()) {
        show(entry);
    } else {
        pendingEntry = entry;
        location.hash = entry.kind === "ascii" ? "ascii" : ""; // hashchange shows pendingEntry
    }
}

// Auto-reload: new cat and saying after the configured seconds (the timer keeps running)
function scheduleReload() {
    clearTimeout(reloadTimeout);
    if (!autoReload.checked) return;
    const delay = Math.max(1, Number(seconds.value) || DEFAULT_RELOAD_SECONDS);
    reloadTimeout = setTimeout(next, delay * 1000);
}

function applyMode() {
    document.body.classList.toggle("ascii", isAscii());
    modeButton.title = isAscii() ? "Mit Bildern" : "Ohne Bilder (ASCII-Katzen)";
    modeButton.setAttribute("aria-label", modeButton.title);
    saveSettings();
    const entry = pendingEntry;
    pendingEntry = undefined;
    if (entry) show(entry);
    else next();
}

// ---------------------------------------------------------------------------
// History of shown cats: saved in localStorage, shown as a grid in the history drawer
// ---------------------------------------------------------------------------

function loadHistory() {
    try {
        shownCats = JSON.parse(localStorage.getItem(HISTORY_KEY)) ?? [];
    } catch {
        shownCats = [];
    }
    if (!Array.isArray(shownCats)) shownCats = [];
}

function addToHistory(entry) {
    shownCats = [entry, ...shownCats].slice(0, HISTORY_SIZE);
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(shownCats));
    } catch { /* storage blocked: history lasts this page only */
    }
}

function historyItem(entry) {
    let preview;
    if (entry.kind === "photo") {
        preview = document.createElement("img");
        preview.src = `${photoUrl(entry.id)}?width=${THUMBNAIL_WIDTH}`;
        preview.alt = "";
        preview.loading = "lazy";
    } else {
        preview = document.createElement("pre");
        preview.textContent = entry.art;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.title = entry.kind === "ascii" ? toAscii(entry.saying) : entry.saying; // the saying shows on hover
    button.setAttribute("aria-label", button.title);
    if (entry === currentEntry) button.setAttribute("aria-current", "true");
    button.append(preview);
    button.onclick = () => {
        historyDrawer.close();
        restore(entry);
    };

    const item = document.createElement("li");
    item.append(button);
    return item;
}

function renderHistory() {
    historyDrawer.classList.toggle("has-entries", shownCats.length > 0);
    historyList.replaceChildren(...shownCats.map(historyItem));
}

// ---------------------------------------------------------------------------
// Animations and effects (blurred background, shadows, swaying, tilt) are off unless switched on:
// they are heavy on slow machines
// ---------------------------------------------------------------------------

const setEffects = on => {
    effectsToggle.checked = on;
    document.body.classList.toggle("calm", !on);
};

// ---------------------------------------------------------------------------
// Timer and highscore: the highscore is the longest counter ever (shared by all open tabs)
// ---------------------------------------------------------------------------

function readHighscore() {
    try {
        return Number(localStorage.getItem(HIGHSCORE_KEY)) || 0;
    } catch {
        return 0;
    }
}

function updateClock() {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    clock.textContent = formatTime(elapsed);
    updateHighscore(elapsed);
}

function updateHighscore(elapsed) {
    const best = readHighscore();
    if (elapsed > best) {
        try {
            localStorage.setItem(HIGHSCORE_KEY, elapsed);
        } catch { /* storage blocked: no highscore */
        }
        // Announce once per page, and not for the very first run (nothing to beat yet)
        if (!highscoreAnnounced && highscoreAtStart > 0) {
            highscoreAnnounced = true;
            highscoreRecord.textContent = pick(highscoreMessages) ?? "";
            highscoreBox.classList.add("new");
        }
    }
    highscoreTime.textContent = formatTime(Math.max(best, elapsed));
    highscoreBox.hidden = best === 0 && elapsed === 0;
}

// ---------------------------------------------------------------------------
// Settings: saved in localStorage, restored on the next start
// ---------------------------------------------------------------------------

// Dark mode off = light page; inverted swaps paper and ink (see style.css)
function applyTheme() {
    document.documentElement.classList.toggle("light", !darkMode.checked);
    document.documentElement.classList.toggle("inverted", inverted.checked);
}

function saveSettings() {
    const settings = {
        ascii: isAscii(), effects: effectsToggle.checked, autoReload: autoReload.checked, seconds: seconds.value,
        dark: darkMode.checked, inverted: inverted.checked,
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch { /* storage blocked: don't persist */
    }
}

function restoreSettings() {
    let settings = {};
    try {
        settings = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
    } catch { /* unreadable: use defaults */
    }
    setEffects(settings.effects === true);
    darkMode.checked = settings.dark !== false;      // default: on
    inverted.checked = settings.inverted !== false;  // default: on
    applyTheme();
    autoReload.checked = settings.autoReload === true;
    if (Number(settings.seconds) >= 1) seconds.value = settings.seconds;
    // An explicit #hash in the URL wins over the saved mode
    if (settings.ascii && !location.hash) history.replaceState(null, "", "#ascii");
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

// Mode (photos / ASCII) lives in the URL hash
modeButton.onclick = () => {
    location.hash = isAscii() ? "" : "ascii";
};
window.onhashchange = applyMode;

darkMode.onchange = inverted.onchange = () => {
    applyTheme();
    saveSettings();
};

// The glow in the background follows the pointer (effects only; style.css hides it otherwise)
document.onpointermove = e => {
    if (document.body.classList.contains("calm")) return;
    glow.style.setProperty("--mx", `${e.clientX}px`);
    glow.style.setProperty("--my", `${e.clientY}px`);
};

effectsToggle.onchange = () => {
    setEffects(effectsToggle.checked);
    saveSettings();
};

window.onresize = relayout;
document.fonts.onloadingdone = relayout;

autoReload.onchange = seconds.onchange = () => {
    saveSettings();
    scheduleReload();
};

// Reset buttons (the confirmation question is stored in the button's data-confirm)
resetSettingsButton.onclick = () => {
    if (!confirm(resetSettingsButton.dataset.confirm)) return;
    localStorage.removeItem(STORAGE_KEY);
    setEffects(effectsToggle.defaultChecked);
    darkMode.checked = darkMode.defaultChecked;
    inverted.checked = inverted.defaultChecked;
    applyTheme();
    autoReload.checked = autoReload.defaultChecked;
    seconds.value = seconds.defaultValue;
    scheduleReload();
    if (isAscii()) location.hash = ""; // hashchange switches back to photos
};

resetHighscoreButton.onclick = () => {
    if (!confirm(resetHighscoreButton.dataset.confirm)) return;
    localStorage.removeItem(HIGHSCORE_KEY);
    highscoreAtStart = 0;
    highscoreAnnounced = false;
    highscoreBox.classList.remove("new");
};

resetHistoryButton.onclick = () => {
    if (!confirm(resetHistoryButton.dataset.confirm)) return;
    localStorage.removeItem(HISTORY_KEY);
    shownCats = [];
    renderHistory();
};

// Fullscreen button, shown only where the browser supports it
fullscreenButton.hidden = !document.fullscreenEnabled;
fullscreenButton.onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {
    });
};

// Drawers (settings, history): a click on the backdrop closes them
// The drawer itself takes the focus, not its first button, so nothing starts out highlighted
const openDrawer = drawer => {
    drawer.showModal();
    drawer.focus();
};
openConfigButton.onclick = () => openDrawer(configDrawer);
openHistoryButton.onclick = () => {
    renderHistory();
    openDrawer(historyDrawer);
};
for (const drawer of [configDrawer, historyDrawer]) {
    drawer.onclick = e => {
        if (e.target === drawer) drawer.close();
    };
}

// Click on the photo (or on the ASCII cats), Space or Enter: next cat and saying. Keys don't count inside
// the header or a drawer, and nothing counts in fullscreen (there only auto-reload changes the picture)
const manualNextAllowed = target => !document.fullscreenElement && !target.closest("header, dialog");
photo.onclick = art.onclick = e => {
    if (manualNextAllowed(e.target)) next();
};
document.onkeydown = e => {
    if ((e.key === " " || e.key === "Enter") && manualNextAllowed(e.target)) {
        e.preventDefault();
        next();
    }
};

// ---------------------------------------------------------------------------
// Start: read the texts, then show the first cat
// ---------------------------------------------------------------------------

const nonEmptyLines = text => text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

// "[name]" starts a section, every following line is one entry
function parseSections(text) {
    const sections = {};
    let current;
    for (const line of nonEmptyLines(text)) {
        const heading = line.match(/^\[(.+)\]$/);
        if (heading) current = sections[heading[1]] = [];
        else current?.push(line);
    }
    return sections;
}

// Cats are separated by "---"; leading spaces are part of the art, empty lines around a cat are not
function parseCats(text) {
    return text.split(/^---\s*$/m)
        .map(block => block.replace(/\s+$/, "").replace(/^\s*\n/, "").split(/\r?\n/))
        .filter(cat => cat.join("").trim());
}

// A missing or broken text file just means fewer texts, not a broken page
const texts = globalThis.TEXTS ?? {};
sayings = nonEmptyLines(texts.sayings ?? "");
phrases = parseSections(texts.phrases ?? "");
cats = parseCats(texts.cats ?? "");
highscoreMessages = nonEmptyLines(texts.highscores ?? "");

loadHistory();
highscoreAtStart = readHighscore();
setInterval(updateClock, 250);
restoreSettings();
applyMode();
