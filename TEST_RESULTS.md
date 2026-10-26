# TEST RESULTS — kanban-board-bd (run #140, 2026-10-26, 10:00 slot)

## Unit tests — 14/14 passed

Run: `node tests/logic.test.js`

- Validation: empty title → titleRequired; 121-char title → titleTooLong; bad priority /
  bad due date / bad column rejected; valid card passes and normalizes (trims, due '' → null).
- WIP: Doing full at limit 3 blocks with reason wipLimit; below limit allows; Done unlimited;
  invalid column rejected.
- Moves: moveCard moves todo → doing; same-column move is a no-op; unknown id → notFound.
- Columns: stepColumn edges (todo−1 = null, done+1 = null) exact.
- Overdue: past due + todo → true; done → false; future → false; due today → false.
- Stats: 2 todo / 1 doing / 1 done → donePct 25, overdue 1; empty board all zero.
- Filters: search matches title/desc/tag (2 hits for 'rice'); priority and tag filters exact.
- Tags: dedupe + sort exact.
- Import: export → validate round-trip passes; wrong app / wrong version / duplicate ids /
  bad card / null all rejected with the right error key.
- i18n: EN and BN key sets identical; toBnDigits('2026') = '২০২৬'.

Repairs during testing: 1 test-side fix (smoke ready-poll waited for a static element instead
of post-init render state) and 1 i18n fix (BN was missing the errCardsInvalid key). 0 app-logic
bugs found after those fixes.

## Headless-Chrome smoke — 11/11 passed, 0 console errors

Run: `node tests/smoke.mjs` (raw CDP, /opt/meta-chromium/chrome, file://)

- Page renders with title + 3 columns.
- Added task 'Buy rice' (tag 'bazar') appears in To Do; stats show 1 todo.
- Move button shifts the card to Doing.
- WIP limit 1 with Doing occupied blocks adding a second Doing card (error message shown).
- Search 'zzz' empties the column; clearing search restores the card.
- Card persists across page reload (localStorage).
- বাংলা toggle renders the Bengali title and Bengali digit '১' for the Doing count.
- 390 px mobile: no horizontal overflow (scrollWidth ≤ 390).
- Zero console errors / page exceptions.

## ASCII hygiene

App sources (`js/*.js`, `index.html`) are pure ASCII — Bengali text is emitted as
`\uXXXX` escapes (JS) / numeric entities (HTML) so the push path cannot corrupt it.
Verified with `grep -P '[^\x00-\x7F]'` (no matches in app sources) and by the smoke
test still rendering Bengali correctly after escaping.
