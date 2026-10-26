# Kanban Board BD

An offline, bilingual (English / বাংলা) kanban board for study, work and small-shop tasks.
Drag tasks between **To Do**, **Doing** and **Done**, cap how much is in progress at once,
and keep everything in your own browser — no account, no server, no tracking.

Live demo: https://fahad3235.github.io/kanban-board-bd/

## Features

1. **Visual board** — three columns (To Do / Doing / Done) with cards showing title,
   details, priority, tag and due date.
2. **Drag-and-drop + move buttons** — drag cards between columns on desktop; ◀ ▶
   buttons move cards on mobile and keyboards.
3. **WIP limit** — a configurable cap on the Doing column (default 3, 1–20). Moving or
   adding a card into a full Doing column is refused with a clear message.
4. **Priorities, tags, due dates** — High / Medium / Low priority, free-text tags,
   due dates with Overdue and Due-today badges.
5. **Search & filters** — live text search across title, details and tag, plus priority
   and tag filters (tag list is built from your own cards).
6. **Board stats** — counts per column, % done, and overdue count.
7. **Edit, export, import, erase** — edit any card in place; export the board as JSON;
   import with strict validation (wrong app, wrong version, duplicate IDs and invalid
   cards are all rejected with the board left intact); erase-all requires typing DELETE.
8. **Bilingual + Bengali digits** — EN/বাংলা toggle persisted in localStorage; numbers
   render in Bengali digits in বাংলা mode. Fully responsive down to 390 px.

## Stack

- Pure HTML + CSS + vanilla JavaScript (no frameworks, no build step, zero network requests)
- `localStorage` persistence; pure logic in `js/logic.js` shared by the app and the tests
- Tests: node unit tests + headless-Chromium smoke test via raw CDP

## Run locally

Just open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# open http://localhost:8000/
```

## Testing

```sh
node tests/logic.test.js   # 14 unit checks
node tests/smoke.mjs       # 11 headless-Chrome checks (needs /opt/meta-chromium/chrome)
```

## Project structure

```
index.html        Board layout, form, toolbar, columns
styles.css        Responsive board styling
js/logic.js       Pure board logic (validation, WIP, moves, stats, filters, import)
js/i18n.js        English / বাংলা strings + Bengali-digit conversion
js/app.js         DOM wiring, drag-and-drop, persistence
tests/logic.test.js   Node unit tests
tests/smoke.mjs       Headless-Chrome smoke test
```

## Limitations

- Data lives only in the browser's `localStorage` on one device; there is no sync,
  no multi-user sharing and no cloud backup — export JSON regularly if a board matters.
- The board is a personal productivity tool, not project-management software: no
  assignees, comments, attachments or recurring tasks.
- Due-date badges compare against the device's local date.

## Status

MVP complete. See `TEST_RESULTS.md` for the verified test run.
