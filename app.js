// ---------------------------------------------------------------------------
// Texts live in plain files next to this page; add or change texts there, not here:
//   texts/sayings.txt     ready-made sayings, one per line
//   texts/phrases.txt     parts for generated sayings: [when] + [what] + [ending], one per line
//   texts/highscores.txt  messages for a new highscore, one per line
//   texts/cats.txt        ASCII cats, separated by a line with ---
// ---------------------------------------------------------------------------

const SAYINGS_FILE = "texts/sayings.txt";
const PHRASES_FILE = "texts/phrases.txt";
const HIGHSCORES_FILE = "texts/highscores.txt";
const CATS_FILE = "texts/cats.txt";

const STORAGE_KEY = "miau-lock-settings";
const HIGHSCORE_KEY = "miau-lock-highscore";

const DEFAULT_RELOAD_SECONDS = 30;
const READY_MADE_CHANCE = 0.5;

// Highlighted words: "Katze…" and "miau…" (the capture group makes split() keep the matches)
const HIGHLIGHT = /(katze\p{L}*|miau\p{L}*)/giu;

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
    const along = n => Array.from({ length: n + 1 }, (_, i) => (i * 100) / n);
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
    return Array.from({ length: Math.min(count, pool.length) },
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
    const rows = Array.from({ length: height }, (_, row) => columns.map(column => column[row]).join("   ").trimEnd());
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
const drawer = $("#config");
const openButton = $("#open");
const modeButton = $("#mode");
const fullscreenButton = $("#fullscreen");
const autoReload = $("#autoreload");
const seconds = $("#seconds");
const resetSettingsButton = $("#reset-settings");
const resetHighscoreButton = $("#reset-highscore");

let sayings = [];            // ready-made
let phrases = {};            // generated: { when: [...], what: [...], ending: [...] }
let highscoreMessages = [];
let cats = [];               // each cat is an array of lines

let currentSaying = "";
let reloadTimeout;

const startedAt = Date.now();
let highscoreAtStart = 0;    // what had to be beaten when this page was opened
let highscoreAnnounced = false;

const isAscii = () => location.hash === "#ascii";

// ---------------------------------------------------------------------------
// Sayings
// ---------------------------------------------------------------------------

function generatedSaying() {
    const { when, what, ending } = phrases;
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

    saying.replaceChildren(...wordsPerLine.map(lineWords => {
        // outer span: tilt, indent and shadow; inner span: the paper itself with its rough edge
        // (the shadow must sit on the outer span, or the clip-path would cut it off)
        const paper = document.createElement("span");
        paper.className = "paper";
        paper.style.setProperty("--clip", roughPolygon(.3, 3, 8));
        paper.append(...lineWords.flatMap((word, i) => (i ? [" ", word] : [word])));

        const strip = document.createElement("span");
        strip.className = "line";
        strip.style.setProperty("--rot", `${randomSigned(.2, .8)}deg`);
        strip.style.setProperty("--indent", `${randomBetween(0, .9)}em`);
        // each strip wobbles a little, at its own pace
        strip.style.setProperty("--wobble", `${randomSigned(.3, .5)}deg`);
        strip.style.setProperty("--wobble-time", `${randomBetween(5.25, 9)}s`);
        strip.style.setProperty("--wobble-delay", `-${randomBetween(0, 9)}s`);
        strip.append(paper);
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

function showPhoto(text) {
    img.src = "https://cataas.com/cat?" + Date.now(); // timestamp defeats the cache
    setSaying(text);
}

function showAsciiCat(text) {
    art.textContent = sideBySide(pickDistinct(cats, pick([1, 2, 2, 3])));
    setSaying(toAscii(text));
}

function next() {
    const text = randomSaying();
    // Easter egg: a Comic Sans saying switches the whole page to Comic Sans
    document.body.classList.toggle("comic", /comic sans/i.test(text));
    if (isAscii()) showAsciiCat(text);
    else showPhoto(text);
    scheduleReload();
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
    saveSettings();
    next();
}

// ---------------------------------------------------------------------------
// Timer and highscore: the highscore is the longest counter ever (shared by all open tabs)
// ---------------------------------------------------------------------------

function readHighscore() {
    try { return Number(localStorage.getItem(HIGHSCORE_KEY)) || 0; } catch { return 0; }
}

function updateClock() {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    clock.textContent = formatTime(elapsed);
    updateHighscore(elapsed);
}

function updateHighscore(elapsed) {
    const best = readHighscore();
    if (elapsed > best) {
        try { localStorage.setItem(HIGHSCORE_KEY, elapsed); } catch { /* storage blocked: no highscore */ }
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

function saveSettings() {
    const settings = { ascii: isAscii(), autoReload: autoReload.checked, seconds: seconds.value };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* storage blocked: don't persist */ }
}

function restoreSettings() {
    let settings = {};
    try { settings = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}; } catch { /* unreadable: use defaults */ }
    autoReload.checked = settings.autoReload === true;
    if (Number(settings.seconds) >= 1) seconds.value = settings.seconds;
    // An explicit #hash in the URL wins over the saved mode
    if (settings.ascii && !location.hash) history.replaceState(null, "", "#ascii");
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

// Mode (photos / ASCII) lives in the URL hash
modeButton.onclick = () => { location.hash = isAscii() ? "" : "ascii"; };
window.onhashchange = applyMode;

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

// Fullscreen button, shown only where the browser supports it
fullscreenButton.hidden = !document.fullscreenEnabled;
fullscreenButton.onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
};

// Settings drawer: a click on the backdrop closes it
openButton.onclick = () => drawer.showModal();
drawer.onclick = e => { if (e.target === drawer) drawer.close(); };

// Click anywhere, Space or Enter: next cat and saying, but not on the header or inside the drawer,
// and not while in fullscreen (there only auto-reload changes the picture)
const manualNextAllowed = target => !document.fullscreenElement && !target.closest("header, #config");
document.onclick = e => { if (manualNextAllowed(e.target)) next(); };
document.onkeydown = e => {
    if ((e.key === " " || e.key === "Enter") && manualNextAllowed(e.target)) {
        e.preventDefault();
        next();
    }
};

// ---------------------------------------------------------------------------
// Start: load the text files, then show the first cat
// ---------------------------------------------------------------------------

const loadFile = file => fetch(file).then(res => res.ok ? res.text() : "").catch(() => "");
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

Promise.all([SAYINGS_FILE, PHRASES_FILE, CATS_FILE, HIGHSCORES_FILE].map(loadFile))
    .then(([sayingsText, phrasesText, catsText, highscoresText]) => {
        sayings = nonEmptyLines(sayingsText);
        phrases = parseSections(phrasesText);
        cats = parseCats(catsText);
        highscoreMessages = nonEmptyLines(highscoresText);

        highscoreAtStart = readHighscore();
        setInterval(updateClock, 250);
        restoreSettings();
        applyMode();
    });
