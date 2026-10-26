// Kanban Board BD \u2014 DOM wiring. Depends on KanbanLogic + KanbanI18n.
(function () {
  const L = window.KanbanLogic;
  const I18N = window.KanbanI18n;
  const LS_KEY = 'kanban-board-bd-v1';
  const LANG_KEY = 'kanban-board-bd-lang';

  let cards = [];
  let wip = 3;
  let lang = localStorage.getItem(LANG_KEY) || 'en';
  let editingId = null;
  let filters = { q: '', priority: 'all', tag: 'all' };

  function t(key) { return I18N.STR[lang][key] || I18N.STR.en[key] || key; }
  function num(n) { return lang === 'bn' ? I18N.toBnDigits(n) : String(n); }
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function save() {
    localStorage.setItem(LS_KEY, JSON.stringify({ wip: wip, cards: cards }));
  }
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.cards)) {
        const errs = L.validateImport({ app: L.APP, version: L.VERSION, wip: data.wip, cards: data.cards });
        if (!errs.length) { cards = data.cards; wip = data.wip || 3; }
      }
    } catch (e) { /* corrupted storage: start empty, never crash */ }
  }

  function showMsg(text, isError) {
    const el = document.getElementById('msg');
    el.textContent = text;
    el.className = 'msg ' + (isError ? 'err' : 'ok');
    el.style.display = 'block';
    clearTimeout(showMsg._t);
    showMsg._t = setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  function cardEl(c) {
    const today = todayStr();
    const overdue = L.isOverdue(c, today);
    const dueBadge = c.due ? (overdue ? '<span class="badge overdue">' + t('overdue') + '</span>'
      : (c.due === today ? '<span class="badge today">' + t('dueToday') + '</span>' : '')) : '';
    const left = L.stepColumn(c.column, -1), right = L.stepColumn(c.column, 1);
    const div = document.createElement('article');
    div.className = 'card pri-' + c.priority + (overdue ? ' is-overdue' : '');
    div.draggable = true;
    div.dataset.id = c.id;
    div.innerHTML =
      '<div class="card-top"><span class="pri">' + t(c.priority) + '</span>' +
      (c.tag ? '<span class="tag">' + esc(c.tag) + '</span>' : '<span class="tag none">' + t('untagged') + '</span>') + '</div>' +
      '<h3>' + esc(c.title) + '</h3>' +
      (c.desc ? '<p class="desc">' + esc(c.desc) + '</p>' : '') +
      '<div class="card-meta">' + (c.due ? '<span class="due">\ud83d\udcc5 ' + esc(c.due) + '</span>' : '') + dueBadge + '</div>' +
      '<div class="card-actions">' +
      (left ? '<button data-act="move" data-dir="-1" title="' + t('moveLeft') + '">\u25c0</button>' : '') +
      (right ? '<button data-act="move" data-dir="1" title="' + t('moveRight') + '">\u25b6</button>' : '') +
      '<button data-act="edit">' + t('edit') + '</button>' +
      '<button data-act="delete">' + t('delete') + '</button></div>';
    div.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', c.id); });
    div.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'move') {
          const target = L.stepColumn(c.column, parseInt(b.dataset.dir, 10));
          const r = L.moveCard(cards, c.id, target, wip);
          if (!r.ok) showMsg(t('errWipLimit'), true); else { save(); render(); }
        } else if (act === 'delete') {
          cards = cards.filter((x) => x.id !== c.id); save(); render();
        } else if (act === 'edit') { startEdit(c); }
      });
    });
    return div;
  }

  function render() {
    const visible = L.filterCards(cards, filters.q, filters.priority, filters.tag);
    const s = L.stats(cards, todayStr());
    document.getElementById('stat-todo').textContent = num(s.todo);
    document.getElementById('stat-doing').textContent = num(s.doing);
    document.getElementById('stat-done').textContent = num(s.done);
    document.getElementById('stat-pct').textContent = num(s.donePct) + '%';
    document.getElementById('stat-overdue').textContent = num(s.overdue);
    L.COLUMNS.forEach((col) => {
      const list = document.getElementById('col-' + col);
      list.innerHTML = '';
      const items = visible.filter((c) => c.column === col);
      document.getElementById('count-' + col).textContent = num(items.length) + ' ' + t('cardsSuffix');
      if (!items.length) {
        const p = document.createElement('p');
        p.className = 'empty';
        p.textContent = cards.length === 0 ? t('emptyBoard') : t('emptyFilter');
        list.appendChild(p);
      } else items.forEach((c) => list.appendChild(cardEl(c)));
    });
    // Tag filter options from current cards
    const sel = document.getElementById('f-tag');
    const cur = sel.value;
    sel.innerHTML = '<option value="all">' + t('tagFilter') + '</option>' +
      L.tagsOf(cards).map((g) => '<option value="' + esc(g) + '">' + esc(g) + '</option>').join('');
    sel.value = L.tagsOf(cards).includes(cur) ? cur : 'all';
    if (sel.value !== filters.tag) filters.tag = sel.value;
  }

  function applyLang() {
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    document.getElementById('lang-btn').textContent = lang === 'bn' ? 'English' : '\u09ac\u09be\u0982\u09b2\u09be';
    document.getElementById('f-priority').innerHTML =
      '<option value="all">' + t('priorityFilter') + '</option>' +
      '<option value="high">' + t('high') + '</option>' +
      '<option value="medium">' + t('medium') + '</option>' +
      '<option value="low">' + t('low') + '</option>';
    document.getElementById('f-priority').value = filters.priority;
    document.getElementById('form-col').innerHTML = L.COLUMNS.map((c) =>
      '<option value="' + c + '">' + t(c) + '</option>').join('');
    document.getElementById('form-priority').innerHTML = L.PRIORITIES.map((p) =>
      '<option value="' + p + '">' + t(p) + '</option>').join('');
    render();
  }

  function formData() {
    return {
      title: document.getElementById('form-title').value,
      desc: document.getElementById('form-desc').value,
      priority: document.getElementById('form-priority').value,
      tag: document.getElementById('form-tag').value,
      due: document.getElementById('form-due').value,
      column: document.getElementById('form-col').value,
    };
  }
  function showFormErrors(errs) {
    const map = { titleRequired: 'errTitleRequired', titleTooLong: 'errTitleTooLong', descTooLong: 'errDescTooLong', tagTooLong: 'errTagTooLong', dueInvalid: 'errDueInvalid' };
    showMsg(errs.map((e) => t(map[e] || 'errInvalidCard')).join(' '), true);
  }
  function clearForm() {
    ['form-title', 'form-desc', 'form-tag', 'form-due'].forEach((id) => { document.getElementById(id).value = ''; });
    document.getElementById('form-priority').value = 'medium';
    document.getElementById('form-col').value = 'todo';
  }

  function startEdit(c) {
    editingId = c.id;
    document.getElementById('form-title').value = c.title;
    document.getElementById('form-desc').value = c.desc;
    document.getElementById('form-priority').value = c.priority;
    document.getElementById('form-tag').value = c.tag;
    document.getElementById('form-due').value = c.due || '';
    document.getElementById('form-col').value = c.column;
    document.getElementById('form-heading').textContent = t('edit');
    document.getElementById('form-submit').textContent = t('saveBtn');
    document.getElementById('form-cancel').style.display = 'inline-block';
    document.getElementById('form-title').focus();
  }
  function endEdit() {
    editingId = null;
    document.getElementById('form-heading').textContent = t('addCard');
    document.getElementById('form-submit').textContent = t('addBtn');
    document.getElementById('form-cancel').style.display = 'none';
    clearForm();
  }

  function init() {
    load();
    document.getElementById('wip-input').value = wip;
    document.getElementById('wip-input').addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10);
      if (v >= 1 && v <= 20) { wip = v; save(); }
      else e.target.value = wip;
    });
    document.getElementById('lang-btn').addEventListener('click', () => {
      lang = lang === 'bn' ? 'en' : 'bn';
      localStorage.setItem(LANG_KEY, lang);
      applyLang();
    });
    document.getElementById('task-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const d = formData();
      const errs = L.validateCard(d);
      if (errs.length) { showFormErrors(errs); return; }
      if (editingId) {
        const c = cards.find((x) => x.id === editingId);
        if (c && d.column === 'doing' && c.column !== 'doing' && L.countIn(cards, 'doing') >= wip) { showMsg(t('errWipLimit'), true); return; }
        if (c) Object.assign(c, L.normalizeCard(Object.assign({ id: c.id, createdAt: c.createdAt }, d)));
        endEdit();
      } else {
        if (d.column === 'doing' && L.countIn(cards, 'doing') >= wip) { showMsg(t('errWipLimit'), true); return; }
        cards.push(L.normalizeCard(d));
        clearForm();
      }
      save(); render();
    });
    document.getElementById('form-cancel').addEventListener('click', endEdit);
    document.getElementById('f-search').addEventListener('input', (e) => { filters.q = e.target.value; render(); });
    document.getElementById('f-priority').addEventListener('change', (e) => { filters.priority = e.target.value; render(); });
    document.getElementById('f-tag').addEventListener('change', (e) => { filters.tag = e.target.value; render(); });
    document.getElementById('export-btn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(L.exportData(cards, wip), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = t('exportName');
      a.click();
      URL.revokeObjectURL(a.href);
    });
    document.getElementById('import-file').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        let data;
        try { data = JSON.parse(r.result); } catch (err) { showMsg(t('errInvalidFile'), true); return; }
        const errs = L.validateImport(data);
        if (errs.length) { showMsg(t('err' + errs[0][0].toUpperCase() + errs[0].slice(1)), true); return; }
        cards = data.cards.map((c) => L.normalizeCard(c));
        wip = data.wip || 3;
        document.getElementById('wip-input').value = wip;
        save(); render();
        showMsg(t('importOk'), false);
      };
      r.readAsText(f);
      e.target.value = '';
    });
    document.getElementById('clear-btn').addEventListener('click', () => {
      const box = document.getElementById('clear-box');
      box.style.display = box.style.display === 'block' ? 'none' : 'block';
    });
    document.getElementById('clear-confirm').addEventListener('click', () => {
      if (document.getElementById('clear-input').value.trim() !== 'DELETE') {
        showMsg(t('clearConfirm'), true); return;
      }
      cards = []; save();
      document.getElementById('clear-box').style.display = 'none';
      document.getElementById('clear-input').value = '';
      render();
      showMsg(t('clearDone'), false);
    });
    // Drag-and-drop onto columns (WIP enforced on drop)
    document.querySelectorAll('.column').forEach((colEl) => {
      colEl.addEventListener('dragover', (e) => { e.preventDefault(); colEl.classList.add('drag-over'); });
      colEl.addEventListener('dragleave', () => colEl.classList.remove('drag-over'));
      colEl.addEventListener('drop', (e) => {
        e.preventDefault();
        colEl.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        const target = colEl.dataset.col;
        const r = L.moveCard(cards, id, target, wip);
        if (!r.ok) showMsg(t('errWipLimit'), true); else { save(); render(); }
      });
    });
    applyLang();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
