// Kanban Board BD \u2014 pure board logic (no DOM). Shared by the app and node tests.
(function (root) {
  const COLUMNS = ['todo', 'doing', 'done'];
  const PRIORITIES = ['high', 'medium', 'low'];
  const APP = 'kanban-board-bd';
  const VERSION = 1;

  function uid() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function isDateStr(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
  }

  // Validate a card object coming from a form or an import file.
  // Returns an array of error keys (empty = valid).
  function validateCard(c) {
    const errs = [];
    if (!c || typeof c !== 'object') return ['invalidCard'];
    if (typeof c.title !== 'string' || c.title.trim().length === 0) errs.push('titleRequired');
    if (c.title && c.title.trim().length > 120) errs.push('titleTooLong');
    if (c.desc != null && typeof c.desc !== 'string') errs.push('descInvalid');
    if (c.desc && c.desc.length > 500) errs.push('descTooLong');
    if (!PRIORITIES.includes(c.priority)) errs.push('priorityInvalid');
    if (c.tag != null && typeof c.tag !== 'string') errs.push('tagInvalid');
    if (c.tag && c.tag.length > 30) errs.push('tagTooLong');
    if (c.due != null && c.due !== '' && !isDateStr(c.due)) errs.push('dueInvalid');
    if (!COLUMNS.includes(c.column)) errs.push('columnInvalid');
    return errs;
  }

  function normalizeCard(c, now) {
    return {
      id: (c.id && typeof c.id === 'string') ? c.id : uid(),
      title: c.title.trim(),
      desc: (c.desc || '').trim(),
      priority: c.priority,
      tag: (c.tag || '').trim(),
      due: (c.due && c.due !== '') ? c.due : null,
      column: c.column,
      createdAt: (typeof c.createdAt === 'number') ? c.createdAt : (now || Date.now()),
    };
  }

  function countIn(cards, column) {
    return cards.filter((c) => c.column === column).length;
  }

  // Can card move into `target`? Doing-column WIP limit enforced (done/todo unlimited).
  function canMove(cards, target, wipLimit) {
    if (!COLUMNS.includes(target)) return { ok: false, reason: 'columnInvalid' };
    if (target === 'doing' && typeof wipLimit === 'number' && wipLimit > 0 &&
        countIn(cards, 'doing') >= wipLimit) {
      return { ok: false, reason: 'wipLimit' };
    }
    return { ok: true };
  }

  function moveCard(cards, id, target, wipLimit) {
    const card = cards.find((c) => c.id === id);
    if (!card) return { ok: false, reason: 'notFound' };
    if (card.column === target) return { ok: true, moved: false };
    const chk = canMove(cards, target, wipLimit);
    if (!chk.ok) return chk;
    card.column = target;
    return { ok: true, moved: true };
  }

  function stepColumn(column, dir) {
    const i = COLUMNS.indexOf(column);
    const j = i + dir;
    return (j >= 0 && j < COLUMNS.length) ? COLUMNS[j] : null;
  }

  function isOverdue(card, todayStr) {
    return !!card.due && card.column !== 'done' && card.due < todayStr;
  }

  function stats(cards, todayStr) {
    const todo = countIn(cards, 'todo');
    const doing = countIn(cards, 'doing');
    const done = countIn(cards, 'done');
    const total = cards.length;
    const overdue = cards.filter((c) => isOverdue(c, todayStr)).length;
    return {
      todo, doing, done, total, overdue,
      donePct: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  }

  function filterCards(cards, q, priority, tag) {
    const needle = (q || '').trim().toLowerCase();
    return cards.filter((c) => {
      if (needle && !(c.title.toLowerCase().includes(needle) ||
          c.desc.toLowerCase().includes(needle) ||
          c.tag.toLowerCase().includes(needle))) return false;
      if (priority && priority !== 'all' && c.priority !== priority) return false;
      if (tag && tag !== 'all' && c.tag !== tag) return false;
      return true;
    });
  }

  function tagsOf(cards) {
    const out = [];
    for (const c of cards) if (c.tag && !out.includes(c.tag)) out.push(c.tag);
    return out.sort();
  }

  function validateImport(data) {
    if (!data || typeof data !== 'object') return ['invalidFile'];
    if (data.app !== APP) return ['wrongApp'];
    if (data.version !== VERSION) return ['wrongVersion'];
    if (!Array.isArray(data.cards)) return ['cardsInvalid'];
    if (data.wip != null && (typeof data.wip !== 'number' || data.wip < 1 || data.wip > 20)) return ['wipInvalid'];
    for (const c of data.cards) {
      if (validateCard(c).length) return ['cardInvalid'];
      if (typeof c.id !== 'string' || !c.id) return ['cardInvalid'];
    }
    const ids = data.cards.map((c) => c.id);
    if (new Set(ids).size !== ids.length) return ['duplicateId'];
    return [];
  }

  function exportData(cards, wip) {
    return { app: APP, version: VERSION, wip: wip, cards: cards };
  }

  const api = {
    COLUMNS, PRIORITIES, APP, VERSION, uid, isDateStr, validateCard, normalizeCard,
    countIn, canMove, moveCard, stepColumn, isOverdue, stats, filterCards, tagsOf,
    validateImport, exportData,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KanbanLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
