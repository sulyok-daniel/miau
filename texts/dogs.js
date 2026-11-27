// ASCII dogs, separated by a line with ---.
// Write the texts between the two backticks; just don't use a backtick ` or ${ inside them.
// (A .js file instead of .txt, so the page also works when opened straight from disk.)
globalThis.TEXTS ??= {};
TEXTS.dogs = String.raw`
 __       __
/  \_____/  \
\_/ o   o \_/
   |  ^  |
    \ w /
     '-'
---
 __       __
/  \_____/  \
\_/ -   - \_/  zzZ
   |  ^  |
    \___/
---
  __
o'  \_____
 \__       \
    |  ||  |\
    |__||__| \
---
 __       __
/  \_____/  \
\_/ o   o \_/
   |  ^  |
    \ U /
---
 U^.^U
 (   )_
 (")(")
`;
