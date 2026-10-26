// Kanban Board BD unit tests. Run: node tests/logic.test.js (exit non-zero on failure).
const assert = require('assert');
const L = require('../js/logic.js');
const I18N = require('../js/i18n.js');

let n = 0;
function check(name, fn) { n++; fn(); console.log('ok - ' + name); }
function card(over) { return Object.assign({ title: 'T', desc: '', priority: 'medium', tag: '', due: null, column: 'todo' }, over); }

// --- Validation ---
check('empty title rejected', () => {
  assert.deepStrictEqual(L.validateCard(card({ title: '   ' })), ['titleRequired']);
});
check('over-long title rejected', () => {
  assert.deepStrictEqual(L.validateCard(card({ title: 'x'.repeat(121) })), ['titleTooLong']);
});
check('bad priority / bad due / bad column rejected', () => {
  assert.ok(L.validateCard(card({ priority: 'urgent' })).includes('priorityInvalid'));
  assert.ok(L.validateCard(card({ due: '2026-13-40' })).includes('dueInvalid'));
  assert.ok(L.validateCard(card({ column: 'archive' })).includes('columnInvalid'));
});
check('valid card passes, normalize trims and defaults due to null', () => {
  assert.deepStrictEqual(L.validateCard(card({ title: '  Do homework ', due: '' })), []);
  const c = L.normalizeCard(card({ title: '  Do homework ', due: '' }));
  assert.strictEqual(c.title, 'Do homework');
  assert.strictEqual(c.due, null);
});

// --- WIP / moves ---
check('WIP: doing full at limit 3 blocks, below limit allows, done unlimited', () => {
  const cards = [card({ column: 'doing' }), card({ column: 'doing' }), card({ column: 'doing' })];
  assert.deepStrictEqual(L.canMove(cards, 'doing', 3), { ok: false, reason: 'wipLimit' });
  assert.deepStrictEqual(L.canMove(cards.slice(0, 2), 'doing', 3), { ok: true });
  assert.deepStrictEqual(L.canMove(cards, 'done', 3), { ok: true });
  assert.deepStrictEqual(L.canMove(cards, 'archive'), { ok: false, reason: 'columnInvalid' });
});
check('moveCard moves, same-column no-op, unknown id fails', () => {
  const cards = [Object.assign(L.normalizeCard(card()), { id: 'a' })];
  const r = L.moveCard(cards, 'a', 'doing', 3);
  assert.strictEqual(r.ok, true); assert.strictEqual(r.moved, true);
  assert.strictEqual(cards[0].column, 'doing');
  assert.deepStrictEqual(L.moveCard(cards, 'a', 'doing', 3), { ok: true, moved: false });
  assert.deepStrictEqual(L.moveCard(cards, 'zz', 'done', 3), { ok: false, reason: 'notFound' });
});
check('stepColumn edges', () => {
  assert.strictEqual(L.stepColumn('todo', 1), 'doing');
  assert.strictEqual(L.stepColumn('doing', -1), 'todo');
  assert.strictEqual(L.stepColumn('todo', -1), null);
  assert.strictEqual(L.stepColumn('done', 1), null);
});

// --- Overdue / stats ---
check('isOverdue: past+todo true, done false, future false, today false', () => {
  assert.strictEqual(L.isOverdue(card({ due: '2026-10-25', column: 'todo' }), '2026-10-26'), true);
  assert.strictEqual(L.isOverdue(card({ due: '2026-10-25', column: 'done' }), '2026-10-26'), false);
  assert.strictEqual(L.isOverdue(card({ due: '2026-10-27', column: 'todo' }), '2026-10-26'), false);
  assert.strictEqual(L.isOverdue(card({ due: '2026-10-26', column: 'todo' }), '2026-10-26'), false);
});
check('stats: 2 todo / 1 doing / 1 done -> donePct 25, overdue 1', () => {
  const cards = [
    card({ column: 'todo', due: '2026-10-25' }),
    card({ column: 'todo' }),
    card({ column: 'doing' }),
    card({ column: 'done' }),
  ];
  assert.deepStrictEqual(L.stats(cards, '2026-10-26'),
    { todo: 2, doing: 1, done: 1, total: 4, overdue: 1, donePct: 25 });
});
check('stats empty board is all zero', () => {
  assert.deepStrictEqual(L.stats([], '2026-10-26'),
    { todo: 0, doing: 0, done: 0, total: 0, overdue: 0, donePct: 0 });
});

// --- Filter / tags ---
check('filterCards: search across title/desc/tag, priority, tag', () => {
  const cards = [
    card({ title: 'Buy rice', tag: 'bazar' }),
    card({ title: 'Read book', desc: 'rice recipes', priority: 'high' }),
    card({ title: 'Gym', tag: 'health', priority: 'low' }),
  ];
  assert.strictEqual(L.filterCards(cards, 'rice', 'all', 'all').length, 2);
  assert.strictEqual(L.filterCards(cards, '', 'high', 'all').length, 1);
  assert.strictEqual(L.filterCards(cards, '', 'all', 'health').length, 1);
  assert.strictEqual(L.filterCards(cards, 'zzz', 'all', 'all').length, 0);
});
check('tagsOf dedupes and sorts', () => {
  assert.deepStrictEqual(L.tagsOf([card({ tag: 'b' }), card({ tag: 'a' }), card({ tag: 'b' }), card({ tag: '' })]), ['a', 'b']);
});

// --- Import validation ---
check('validateImport rejects wrong app/version/dup ids/bad card, accepts round-trip', () => {
  const good = L.exportData([L.normalizeCard(card({ title: 'X' }))], 3);
  assert.deepStrictEqual(L.validateImport(good), []);
  assert.deepStrictEqual(L.validateImport(Object.assign({}, good, { app: 'other' })), ['wrongApp']);
  assert.deepStrictEqual(L.validateImport(Object.assign({}, good, { version: 2 })), ['wrongVersion']);
  const dup = L.exportData([L.normalizeCard(card({ title: 'X' })), L.normalizeCard(card({ title: 'Y' }))], 3);
  dup.cards[1].id = dup.cards[0].id;
  assert.deepStrictEqual(L.validateImport(dup), ['duplicateId']);
  assert.deepStrictEqual(L.validateImport(Object.assign({}, good, { cards: [{ title: '' }] })), ['cardInvalid']);
  assert.deepStrictEqual(L.validateImport(null), ['invalidFile']);
});

// --- i18n sanity ---
check('i18n: both languages carry the same keys, Bengali digits convert', () => {
  const enKeys = Object.keys(I18N.STR.en).sort();
  const bnKeys = Object.keys(I18N.STR.bn).sort();
  assert.deepStrictEqual(bnKeys, enKeys);
  assert.strictEqual(I18N.toBnDigits('2026'), '২০২৬');
  assert.strictEqual(I18N.toBnDigits('3'), '৩');
});

console.log(n + '/' + n + ' unit checks passed');
