// Messages for a new highscore, one per line. (capybara mode)
// Write the texts between the two backticks; just don't use a backtick ` or ${ inside them.
// (A .js file instead of .txt, so the page also works when opened straight from disk.)
globalThis.TEXTS ??= {};
(TEXTS.capybara ??= {}).highscores = String.raw`
Neuer Rekord! Das Capybara bleibt gelassen. Wie immer.
Bestzeit im Nicht-Sperren. Das Capybara nickt langsam.
Neuer Highscore! Das Capybara gönnt sich ein Bad.
Noch nie war er so lange entsperrt. Alle Tiere setzen sich zur Feier auf das Capybara.
Rekord! Und das Capybara hat nicht mal geblinzelt.
`;
