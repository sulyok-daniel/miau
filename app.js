// ---------------------------------------------------------------------------
// Everything that differs per animal lives in animals/<name>/animal.js (labels, image source, highlighted words)
// and the other files in that folder (sayings, phrases, highscore messages, ASCII art); see animals/cat/animal.js for how to add one.
// They are .js files loaded by index.html rather than .txt files fetched here, because browsers block
// fetch() on pages opened straight from disk (file://)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "miau-lock-settings";
const HIGHSCORE_KEY = "miau-lock-highscore";
const HISTORY_KEY = "miau-lock-history";

const HISTORY_SIZE = 50;     // how many shown pictures the history keeps

const DEFAULT_RELOAD_SECONDS = 30;
const READY_MADE_CHANCE = 0.75;

// Highlighted words in every animal's mode, besides the animal's own (animals/<name>/animal.js)
const COMMON_HIGHLIGHT = ["kaffee", "kuchen"];

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
    [/[„“”]/g, '"'], [/[‚‘’]/g, "'"], [/[–—]/g, "-"], [/…/g, "..."],
    [/[^\x00-\x7F]/g, ""],
];
const toAscii = text =>
    ASCII_REPLACEMENTS.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement),
        text.replace(animal().emojiPattern, animal().face)).trim();

// Put ASCII arts next to each other, bottom-aligned, as one block of text
const sideBySide = arts => {
    const height = Math.max(0, ...arts.map(art => art.length));
    const columns = arts.map(art => {
        const width = Math.max(...art.map(line => line.length));
        const padding = Array(height - art.length).fill("");
        return [...padding, ...art].map(line => line.padEnd(width));
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
const animalSelect = $("#animal");

// The registered animals (animals/*/animal.js); the default is always the cat
const animals = globalThis.ANIMALS ?? {};
const DEFAULT_ANIMAL = "cat";

// Texts per animal, parsed at the start from animals/<name>/*.js:
// { sayings: [...] (ready-made), phrases: { when, what, ending } (generated), highscores: [...], arts: [[lines], ...] }
const texts = {};

let currentSaying = "";
let reloadTimeout;
let showCount = 0;           // detects outdated cataas answers after a quick second click

// Shown pictures, newest first: { kind: "photo", animal, src, thumb?, saying } or { kind: "ascii", animal, art, saying }
let shownEntries = [];
let currentEntry;
let pendingEntry;            // shown after a mode switch instead of a new random cat

const startedAt = Date.now();
let highscoreAtStart = 0;    // what had to be beaten when this page was opened
let highscoreAnnounced = false;

// Animal and mode live in the URL hash: "<animal>", "<animal>-ascii" or "ascii"; the default animal may be left out
// (the start URL may also carry ?animal=<name>, see restoreSettings)
const hashParts = () => location.hash.slice(1).split("-");
const isAscii = () => hashParts().includes("ascii");
const currentAnimal = () => hashParts().find(part => animals[part]) ?? DEFAULT_ANIMAL;
const hashFor = (name, ascii) => [name !== DEFAULT_ANIMAL && name, ascii && "ascii"].filter(Boolean).join("-");
const animal = () => animals[currentAnimal()];

// ---------------------------------------------------------------------------
// Sayings
// ---------------------------------------------------------------------------

function generatedSaying({when, what, ending} = {}) {
    if (!when?.length || !what?.length || !ending?.length) return "";
    const end = pick(ending);
    const separator = /^[.,!?…]/.test(end) ? "" : " ";
    return `${pick(when)} ${pick(what)}${separator}${end}`;
}

function randomSaying() {
    const {sayings, phrases} = texts[currentAnimal()];
    const generated = generatedSaying(phrases);
    const useReadyMade = sayings.length && (Math.random() < READY_MADE_CHANCE || !generated);
    return useReadyMade ? pick(sayings) : generated;
}

// A word as DOM nodes; highlighted parts become <mark>
function wordNodes(word) {
    return word.split(animal().highlight).map((part, i) => {
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

async function newEntry() {
    const name = currentAnimal();
    const saying = randomSaying();
    if (isAscii()) return {kind: "ascii", animal: name, art: sideBySide(pickDistinct(texts[name].arts, pick([1, 2, 2, 3]))), saying};
    return {kind: "photo", animal: name, saying, ...await animal().randomPhoto()};
}

function show(entry) {
    currentEntry = entry;
    // Easter egg: a Comic Sans saying switches the whole page to Comic Sans
    document.body.classList.toggle("comic", /comic sans/i.test(entry.saying));
    // the saying leans to the left or to the right, differently for every cat
    saying.parentElement.style.setProperty("--tilt", `${randomSigned(1.5, 2.5)}deg`);
    if (entry.kind === "ascii") {
        art.textContent = entry.art;
        setSaying(toAscii(entry.saying));
    } else {
        // no image (photo service unavailable): the last photo stays, only the saying changes
        if (entry.src) img.src = entry.src;
        setSaying(entry.saying);
    }
    if (historyDrawer.open) renderHistory();
    scheduleReload();
}

async function next() {
    const count = ++showCount;
    const entry = await newEntry();
    if (count !== showCount) return; // a newer click, mode switch or history pick took over meanwhile
    if (!entry.transient && (entry.kind === "ascii" || entry.src)) addToHistory(entry);
    show(entry);
}

// Show a picture from the history again, switching animal and photos/ASCII if needed
function restore(entry) {
    ++showCount;
    const ascii = entry.kind === "ascii";
    if (entry.animal === currentAnimal() && ascii === isAscii()) {
        show(entry);
    } else {
        pendingEntry = entry;
        location.hash = hashFor(entry.animal, ascii); // hashchange shows pendingEntry
    }
}

// Auto-reload: new cat and saying after the configured seconds (the timer keeps running)
function scheduleReload() {
    clearTimeout(reloadTimeout);
    if (!autoReload.checked) return;
    const delay = Math.max(1, Number(seconds.value) || DEFAULT_RELOAD_SECONDS);
    reloadTimeout = setTimeout(next, delay * 1000);
}

// Texts that name the animal: every element with a data-text attribute gets that entry of the animal's ui
function applyAnimal() {
    const {ui, face} = animal();
    for (const el of document.querySelectorAll("[data-text]")) {
        el.textContent = el.dataset.text === "face" ? face : ui[el.dataset.text];
    }
    document.title = ui.title;
    img.alt = ui.photoAlt;
    art.setAttribute("aria-label", ui.artLabel);
    animalSelect.value = currentAnimal();
}

function applyMode() {
    document.body.classList.toggle("ascii", isAscii());
    document.body.dataset.animal = currentAnimal(); // for animal specific styling in style.css
    applyAnimal();
    modeButton.title = isAscii() ? "Mit Bildern" : animal().ui.toAscii;
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
        shownEntries = JSON.parse(localStorage.getItem(HISTORY_KEY)) ?? [];
    } catch {
        shownEntries = [];
    }
    if (!Array.isArray(shownEntries)) shownEntries = [];
    // entries from before the animals were configurable have no animal (cats) and a cataas id (or, dogs, a url) instead of a src
    shownEntries = shownEntries.map(entry => ({animal: "cat", ...(entry.url && {src: entry.url}), ...(entry.id && animals.cat?.legacyPhoto(entry.id)), ...entry}))
        .filter(entry => animals[entry.animal]);
}

function addToHistory(entry) {
    shownEntries = [entry, ...shownEntries].slice(0, HISTORY_SIZE);
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(shownEntries));
    } catch { /* storage blocked: history lasts this page only */
    }
}

function historyItem(entry) {
    let preview;
    if (entry.kind === "photo") {
        preview = document.createElement("img");
        preview.src = entry.thumb ?? entry.src; // without a thumbnail the full image, scaled down by style.css
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
    historyDrawer.classList.toggle("has-entries", shownEntries.length > 0);
    historyList.replaceChildren(...shownEntries.map(historyItem));
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
    setClock(formatTime(elapsed));
    updateHighscore(elapsed);
}

// One span per character, so every character can get the same width (see style.css); rebuilt only when
// the length changes (after 99 hours)
function setClock(text) {
    if (clock.children.length !== text.length) {
        clock.replaceChildren(...Array.from(text, () => document.createElement("span")));
    }
    Array.from(text).forEach((character, i) => { clock.children[i].textContent = character; });
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
            highscoreRecord.textContent = pick(texts[currentAnimal()].highscores) ?? "";
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
        ascii: isAscii(), animal: currentAnimal(), effects: effectsToggle.checked, autoReload: autoReload.checked, seconds: seconds.value,
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
    // Explicit URL wins over the saved animal and mode: ?animal=<name>, then #hash
    const url = new URL(location.href);
    const queryAnimal = url.searchParams.get("animal")?.toLowerCase();
    if (animals[queryAnimal]) {
        // taken over once into the hash (which the animal select and mode button use), then dropped from the URL
        const ascii = location.hash ? isAscii() : settings.ascii;
        url.searchParams.delete("animal");
        url.hash = hashFor(queryAnimal, ascii);
        history.replaceState(null, "", url);
    } else {
        const hash = hashFor(animals[settings.animal] ? settings.animal : DEFAULT_ANIMAL, settings.ascii);
        if (hash && !location.hash) history.replaceState(null, "", `#${hash}`);
    }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

// Animal and mode (photos / ASCII) live in the URL hash
modeButton.onclick = () => {
    location.hash = hashFor(currentAnimal(), !isAscii());
};
animalSelect.replaceChildren(...Object.entries(animals).map(([name, {emoji, plural}]) => new Option(`${emoji} ${plural}`, name)));
animalSelect.onchange = () => {
    location.hash = hashFor(animalSelect.value, isAscii());
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
    if (location.hash.slice(1)) location.hash = ""; // hashchange switches back to the default animal's photos
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
    shownEntries = [];
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

// The arts are separated by "---"; leading spaces are part of the art, empty lines around one are not
function parseArts(text) {
    return text.split(/^---\s*$/m)
        .map(block => block.replace(/\s+$/, "").replace(/^\s*\n/, "").split(/\r?\n/))
        .filter(art => art.join("").trim());
}

// A missing or broken text file just means fewer texts, not a broken page
for (const [name, animal] of Object.entries(animals)) {
    const loaded = globalThis.TEXTS?.[name] ?? {};
    texts[name] = {
        sayings: nonEmptyLines(loaded.sayings ?? ""),
        phrases: parseSections(loaded.phrases ?? ""),
        highscores: nonEmptyLines(loaded.highscores ?? ""),
        arts: parseArts(loaded.arts ?? ""),
    };
    // the capture group makes split() keep the matches
    animal.highlight = new RegExp(`(${[...COMMON_HIGHLIGHT, ...animal.highlight].map(word => `${word}\\p{L}*`).join("|")})`, "giu");
}

loadHistory();
highscoreAtStart = readHighscore();
setInterval(updateClock, 250);
// The timer strips get rough edges like the sayings (their shape is set once; the strips scale with their content)
for (const strip of document.querySelectorAll("#timer > span, #timer > time, #highscore .record")) {
    strip.style.setProperty("--clip", roughPolygon(.3, 3, 8));
}

restoreSettings();
applyMode();
