// Messages for a new highscore, one per line.
// Write the texts between the two backticks; just don't use a backtick ` or ${ inside them.
// (A .js file instead of .txt, so the page also works when opened straight from disk.)
globalThis.TEXTS ??= {};
TEXTS.highscores = String.raw`
Neuer Highscore! Wohooo!
Rekord! Der Bildschirm bleibt tapfer offen.
Bestzeit im Nicht-Sperren geknackt!
Neuer Highscore! Die Katze ist beeindruckt.
Noch nie war er so lange entsperrt. Miau!
`;
