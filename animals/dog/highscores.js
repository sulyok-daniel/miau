// Messages for a new highscore, one per line. (dog mode)
// Write the texts between the two backticks; just don't use a backtick ` or ${ inside them.
// (A .js file instead of .txt, so the page also works when opened straight from disk.)
globalThis.TEXTS ??= {};
(TEXTS.dog ??= {}).highscores = String.raw`
Neuer Rekord! Der Hund wedelt mit dem Schwanz.
Guter Bildschirm! Feiner Bildschirm! Bleibt so schön offen!
Neuer Highscore! Wuff wuff!
Bestzeit im Nicht-Sperren. Der Hund will ein Leckerli dafür.
Noch nie war er so lange entsperrt. Der Hund ist stolz auf dich.
`;
