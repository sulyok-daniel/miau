// ASCII art, separated by a line with ---. (capybara mode)
// Write the texts between the two backticks; just don't use a backtick ` or ${ inside them.
// (A .js file instead of .txt, so the page also works when opened straight from disk.)
globalThis.TEXTS ??= {};
(TEXTS.capybara ??= {}).arts = String.raw`
  ____
 /    \___
| o      _\
|   ____/
 \_/  \_/
---
  ____
 / -  \___  zzZ
|        _\
|   ____/
 \_/  \_/
---
   (@)
  ____
 / o  \___
|        _\
|   ____/
 \_/  \_/
---
   ,--.
  ( () )
  ____
 / o  \___
|        _\
|   ____/
 \_/  \_/
`;
