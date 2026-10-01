/* Tasks & Review endpoint test — runs the REAL apps-script/Code-LM.gs and
 * Code-owner.gs source in a vm context with an in-memory SpreadsheetApp,
 * LockService and ContentService, then drives doGet / doPost end to end.
 * Contract: apps-script/TASKS.md.  Run: node apps-script-tasks.test.js
 * No network. Placeholder tokens only (the ones committed in the .gs files). */
const fs = require('fs'), vm = require('vm');
const SRC = {
  lm: fs.readFileSync(__dirname + '/apps-script/Code-LM.gs', 'utf8'),
  owner: fs.readFileSync(__dirname + '/apps-script/Code-owner.gs', 'utf8')
};
const TOK = { jordan: 'SET-IN-DEPLOYED-EDITOR-JORDAN', andrew: 'SET-IN-DEPLOYED-EDITOR-ANDREW', routine: 'SET-IN-DEPLOYED-EDITOR-ROUTINE',
  michael: 'SET-IN-DEPLOYED-EDITOR-MICHAEL', ed: 'SET-IN-DEPLOYED-EDITOR-ED' };
const J = 'Jordan Mathis', A = 'Andrew Estrada', MF = 'Michael Fichman';

/* ── stubs ── */
function fakeSheet(values) {
  return {
    _v: values.map(r => r.slice()),
    getDataRange() { const v = this._v; return { getValues() { return v.map(r => r.slice()); } }; },
    getMaxRows() { return this._v.length; },
    insertRowsAfter(after, n) { const w = this._v[0].length; for (let i = 0; i < n; i++) this._v.push(new Array(w).fill('')); },
    getRange(r, c, nr, nc) { const sh = this; return { setValues(vals) {
      if (vals.length !== nr) throw new Error('setValues rows ' + vals.length + ' != ' + nr);
      for (let i = 0; i < nr; i++) { const ri = r - 1 + i; if (ri >= sh._v.length) throw new Error('range beyond sheet: row ' + (ri + 1));
        if (vals[i].length !== nc) throw new Error('setValues cols ' + vals[i].length + ' != ' + nc);
        for (let j = 0; j < nc; j++) sh._v[ri][c - 1 + j] = vals[i][j]; } } }; }
  };
}
function fakeSS(sheets) { return { getSheetByName(n) { return sheets[n] || null; } }; }
function endpoint(which, sheets) {
  const ctx = {
    SpreadsheetApp: { openById: () => fakeSS(sheets), getActiveSpreadsheet: () => fakeSS(sheets) },
    LockService: { getScriptLock() { return { waitLock() { ctx._locked = (ctx._locked || 0) + 1; }, releaseLock() { ctx._released = (ctx._released || 0) + 1; } }; } },
    ContentService: { createTextOutput(s) { return { _s: s, setMimeType() { return this; } }; }, MimeType: { JSON: 'json' } },
    console, Date, Math, JSON, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, isFinite
  };
  vm.createContext(ctx);
  vm.runInContext(SRC[which], ctx, { filename: 'Code-' + which + '.gs' });
  ctx.GET = tok => JSON.parse(ctx.doGet({ parameter: { token: tok } })._s);
  ctx.POST = body => JSON.parse(ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } })._s);
  ctx.POSTRAW = s => JSON.parse(ctx.doPost({ postData: { contents: s } })._s);
  return ctx;
}

/* ── fixture (header order deliberately shuffled vs the contract: lookups are by name) ── */
const TH = ['task_id', 'owner', 'visibility', 'date', 'kind', 'lead', 'contact_id', 'opp_id', 'ask', 'why', 'source', 'due', 'priority',
  'status', 'done_at', 'done_by', 'note', 'snoozed_until', 'created_at', 'created_by', 'updated_at', 'ghl_url'];
const RH = ['flag_id', 'created_at', 'from', 'item_type', 'item_key', 'item_owner', 'memo_date', 'reason', 'note', 'evidence', 'status',
  'decision_note', 'decided_at', 'decided_by', 'applied_as', 'applied_at'];
const NOW = Date.now(), ISO = ms => new Date(ms).toISOString(), D = 864e5;
const trow = o => TH.map(h => o[h] == null ? '' : o[h]);
const rrow = o => RH.map(h => o[h] == null ? '' : o[h]);
const base = { date: '2026-10-01', visibility: 'team', kind: 'coaching', source: 'texts', due: '2026-10-01', priority: 2, status: 'open',
  created_at: ISO(NOW - D), created_by: 'routine:call-coaching', updated_at: ISO(NOW - D) };
function fixture() {
  const T = [TH,
    trow({ ...base, task_id: 't1', owner: J, ask: 'Call Seller One back', due: '2026-09-30', lead: 'Seller One', contact_id: 'c1' }),
    trow({ ...base, task_id: 't2', owner: J, ask: 'OLD done', status: 'done', done_at: ISO(NOW - 20 * D), done_by: J, updated_at: ISO(NOW - 20 * D) }),
    trow({ ...base, task_id: 't3', owner: J, ask: 'Recent done', status: 'done', done_at: ISO(NOW - 3600e3), done_by: J, updated_at: new Date(NOW - 3600e3) }),
    trow({ ...base, task_id: 't4', owner: A, ask: 'Andrew task' }),
    trow({ ...base, task_id: 't5', owner: MF, visibility: 'owner', kind: 'decide', source: 'step_in', ask: 'PRIVATE Michael decide $40,000' }),
    trow({ ...base, task_id: 't6', owner: J, visibility: 'owner', kind: 'assign', source: 'pulse', ask: 'PRIVATE but owner=Jordan (must never ship to an LM)' }),
    trow({ ...base, task_id: 't7', owner: '', ask: 'Unassigned task', source: 'owner' }),
    trow({ ...base, task_id: 't:pulse:oppA', owner: J, source: 'pulse', kind: 'cadence', ask: 'pulse A old ask', opp_id: 'oppA' }),
    trow({ ...base, task_id: 't:pulse:oppB', owner: A, source: 'pulse', kind: 'cadence', ask: 'pulse B', opp_id: 'oppB', status: 'snoozed', snoozed_until: ISO(NOW + D) }),
    trow({ ...base, task_id: 't:pulse:oppD', owner: J, source: 'pulse', kind: 'cadence', ask: 'pulse D old ask', opp_id: 'oppD', status: 'done', done_at: ISO(NOW - 60e3), done_by: J, updated_at: ISO(NOW - 60e3) }),
    trow({ ...base, task_id: 't:pulse:oppE', owner: J, source: 'pulse', kind: 'cadence', ask: 'pulse E (expired earlier)', opp_id: 'oppE', status: 'expired' }),
    trow({ ...base, task_id: 't:tracker:follow-up:oppC', owner: J, source: 'tracker', kind: 'follow-up', ask: 'tracker C', opp_id: 'oppC' })
  ];
  const R = [RH,
    rrow({ flag_id: 'f1', created_at: ISO(NOW - D), from: J, item_type: 'task', item_key: 'task:t1', item_owner: J, memo_date: '2026-09-30', reason: 'wrong-ask', note: 'already spoke to her', status: 'pending' }),
    rrow({ flag_id: 'f2', created_at: ISO(NOW - D), from: A, item_type: 'text', item_key: 'text:2026-09-30:andrew:2', item_owner: A, memo_date: '2026-09-30', reason: 'score-disagree', note: 'that was a conversation', status: 'pending' }),
    rrow({ flag_id: 'f3', created_at: ISO(NOW - 2 * D), from: J, item_type: 'call', item_key: 'call:2026-09-29:jordan:1', item_owner: J, memo_date: '2026-09-29', reason: 'voicemail-not-conversation', note: 'vm drop', status: 'declined', decision_note: 'Transcript shows 4 min two-way', decided_at: ISO(NOW - D), decided_by: MF })
  ];
  return { Tasks: fakeSheet(T), Review: fakeSheet(R) };
}
const col = (tab, name) => tab[0].indexOf(name);
const ids = (tab, name) => tab.slice(1).map(r => r[col(tab, name || 'task_id')]);
const sheetObj = (sh, idCol, id) => { const v = sh._v, c = v[0].indexOf(idCol), r = v.find((row, i) => i > 0 && row[c] === id); if (!r) return null; const o = {}; v[0].forEach((h, i) => o[h] = r[i]); return o; };

let pass = 0, fail = 0;
const ok = (l, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + l); c ? pass++ : fail++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ═══ 0. the two files carry one identical block ═══ */
console.log('SHARED BLOCK');
const MARK = '/* ════════════════════════════════════════════════════════════════════════════\n * TASKS & REVIEW (Phase 1)';
const blk = s => s.slice(s.indexOf(MARK));
ok('Tasks block present in both files', SRC.lm.indexOf(MARK) > -1 && SRC.owner.indexOf(MARK) > -1);
ok('Tasks block byte-identical in Code-LM.gs and Code-owner.gs', blk(SRC.lm) === blk(SRC.owner));
ok('no real-looking token: every token literal is a SET-IN-DEPLOYED-EDITOR placeholder, all distinct',
  (() => { const m = (SRC.lm + SRC.owner).match(/'SET-IN-DEPLOYED-EDITOR-[A-Z]+'/g) || []; return m.length === 5 && new Set(m).size === 5; })());
ok('Code-owner TOKENS is an object (token -> name) + APPROVERS', /var TOKENS = \{/.test(SRC.owner) && /var APPROVERS = \['Michael Fichman'\]/.test(SRC.owner));

/* ═══ 1. GET scoping ═══ */
console.log('GET — LM endpoint');
{
  const lm = endpoint('lm', fixture());
  const g = lm.GET(TOK.jordan);
  ok('ok + role lm + tasksAsOf ISO', g.ok && g.role === 'lm' && /^\d{4}-\d{2}-\d{2}T/.test(g.tasksAsOf));
  const T = g.tabs.Tasks;
  ok('Tasks ships header + own rows only', same(ids(T).sort(), ['t1', 't3', 't:pulse:oppA', 't:pulse:oppD', 't:pulse:oppE', 't:tracker:follow-up:oppC'].sort()));
  ok('no visibility=owner row, even one whose owner is Jordan (t6)', ids(T).indexOf('t6') === -1 && ids(T).indexOf('t5') === -1);
  ok('no other person\'s row (t4 Andrew) and no unassigned (t7)', ids(T).indexOf('t4') === -1 && ids(T).indexOf('t7') === -1);
  ok('closed row older than 14 days dropped (t2), recent closed kept (t3)', ids(T).indexOf('t2') === -1 && ids(T).indexOf('t3') > -1);
  const t3 = T.find(r => r[col(T, 'task_id')] === 't3');
  ok('Date cells ship as ISO strings (t3 updated_at)', typeof t3[col(T, 'updated_at')] === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(t3[col(T, 'updated_at')]));
  ok('whole payload never mentions the private rows', JSON.stringify(g).indexOf('PRIVATE') === -1 && JSON.stringify(g).indexOf('$40,000') === -1);
  const R = g.tabs.Review;
  ok('Review = own flags only (f1, f3), never Andrew\'s f2', same(ids(R, 'flag_id').sort(), ['f1', 'f3']) && JSON.stringify(g).indexOf('that was a conversation') === -1);
  const g2 = lm.GET(TOK.andrew);
  ok('Andrew sees t4 + pulse B and nothing of Jordan\'s', same(ids(g2.tabs.Tasks).sort(), ['t4', 't:pulse:oppB']) && same(ids(g2.tabs.Review, 'flag_id'), ['f2']));
  ok('routine token gets NO GET payload', same(lm.GET(TOK.routine), { ok: false, error: 'unauthorized' }));
  ok('bad token → unauthorized', same(lm.GET('nope'), { ok: false, error: 'unauthorized' }));
  const lm2 = endpoint('lm', { Review: fixture().Review });
  const g3 = lm2.GET(TOK.jordan);
  ok('Tasks tab missing → tabs.Tasks = null, still ok', g3.ok && g3.tabs.Tasks === null && Array.isArray(g3.tabs.Review));
  const lm3 = endpoint('lm', {});
  ok('both tabs missing → both null, no throw', lm3.GET(TOK.jordan).ok && lm3.GET(TOK.jordan).tabs.Tasks === null && lm3.GET(TOK.jordan).tabs.Review === null);
}
console.log('GET — owner endpoint');
{
  const ow = endpoint('owner', fixture());
  const e = ow.GET(TOK.ed);
  ok('Ed: role owner, person Ed Peugh, approver false', e.ok && e.role === 'owner' && e.person === 'Ed Peugh' && e.approver === false);
  ok('Ed: no private rows (t5, t6), everything else', ids(e.tabs.Tasks).indexOf('t5') === -1 && ids(e.tabs.Tasks).indexOf('t6') === -1 && ids(e.tabs.Tasks).length === 10);
  ok('Ed: Review is null', e.tabs.Review === null);
  ok('Ed: payload never mentions a private row', JSON.stringify(e).indexOf('PRIVATE') === -1);
  const m = ow.GET(TOK.michael);
  ok('Michael: approver true, all 12 task rows, all 3 flags', m.approver === true && ids(m.tabs.Tasks).length === 12 && ids(m.tabs.Review, 'flag_id').length === 3);
  ok('existing tabs still served (null when absent) alongside Tasks/Review', 'Leads' in m.tabs && m.tabs.Leads === null && 'Tasks' in m.tabs && 'Review' in m.tabs);
  ok('bad / empty token → unauthorized', same(ow.GET('x'), { ok: false, error: 'unauthorized' }) && same(ow.GET(''), { ok: false, error: 'unauthorized' }));
  // legacy array shape pasted by mistake → authenticates as a non-approver named 'owner'
  const legacy = endpoint('owner', fixture()); legacy.TOKENS = ['legacy-only-token'];
  const l = legacy.GET('legacy-only-token');
  ok('legacy array TOKENS: person "owner", approver false, no private rows, Review null', l.ok && l.person === 'owner' && l.approver === false && ids(l.tabs.Tasks).indexOf('t5') === -1 && l.tabs.Review === null);
  ok('legacy array: empty string never authorizes', same(legacy.GET(''), { ok: false, error: 'unauthorized' }));
  const ow2 = endpoint('owner', {});
  ok('owner: tabs missing → nulls, no throw', ow2.GET(TOK.michael).ok && ow2.GET(TOK.michael).tabs.Tasks === null);
}

/* ═══ 2. POST — auth + errors ═══ */
console.log('POST — auth, parsing, unknown action');
{
  const lm = endpoint('lm', fixture());
  ok('bad token → unauthorized (and nothing else)', same(lm.POST({ token: 'bad', action: 'set_status', task_id: 't1', status: 'done' }), { ok: false, error: 'unauthorized' }));
  ok('missing token → unauthorized', same(lm.POST({ action: 'set_status' }), { ok: false, error: 'unauthorized' }));
  ok('unknown action → unknown action', same(lm.POST({ token: TOK.jordan, action: 'nuke' }), { ok: false, error: 'unknown action' }));
  ok('bad json body → bad json', same(lm.POSTRAW('{not json'), { ok: false, error: 'bad json' }) && same(lm.POSTRAW(''), { ok: false, error: 'bad json' }));
  ok('routine token on anything but upsert_tasks → forbidden', same(lm.POST({ token: TOK.routine, action: 'set_status', task_id: 't1', status: 'done' }), { ok: false, error: 'forbidden' }));
  const noTasks = endpoint('lm', { Review: fixture().Review });
  ok('Tasks tab missing → {ok:false,error:"Tasks tab missing"}', same(noTasks.POST({ token: TOK.jordan, action: 'set_status', task_id: 't1', status: 'done' }), { ok: false, error: 'Tasks tab missing' }));
  const noReview = endpoint('lm', { Tasks: fixture().Tasks });
  ok('Review tab missing → flag answers "Review tab missing"', same(noReview.POST({ token: TOK.jordan, action: 'flag', item_type: 'text', item_key: 'text:2026-10-01:jordan:1', item_owner: J, reason: 'other', note: 'x' }), { ok: false, error: 'Review tab missing' }));
  const ow = endpoint('owner', fixture());
  ok('owner endpoint: bad token → unauthorized', same(ow.POST({ token: 'bad', action: 'assign', task_id: 't1', owner: A }), { ok: false, error: 'unauthorized' }));
  ok('owner endpoint: unknown action', same(ow.POST({ token: TOK.michael, action: 'frobnicate' }), { ok: false, error: 'unknown action' }));
}

/* ═══ 3. set_status ═══ */
console.log('POST — set_status');
{
  const S = fixture(), lm = endpoint('lm', S);
  const r = lm.POST({ token: TOK.jordan, action: 'set_status', task_id: 't4', status: 'done' });
  ok('LM on another person\'s task → forbidden, nothing about the row', same(r, { ok: false, error: 'forbidden' }) && sheetObj(S.Tasks, 'task_id', 't4').status === 'open');
  ok('LM on own row that is visibility=owner → forbidden', same(lm.POST({ token: TOK.jordan, action: 'set_status', task_id: 't6', status: 'done' }), { ok: false, error: 'forbidden' }));
  ok('bad status → bad status', same(lm.POST({ token: TOK.jordan, action: 'set_status', task_id: 't1', status: 'expired' }), { ok: false, error: 'bad status' }));
  ok('unknown task → not found', same(lm.POST({ token: TOK.jordan, action: 'set_status', task_id: 'zzz', status: 'done' }), { ok: false, error: 'not found' }));
  const d = lm.POST({ token: TOK.jordan, action: 'set_status', task_id: 't1', status: 'done', note: 'spoke 10:40' });
  const t1 = sheetObj(S.Tasks, 'task_id', 't1');
  ok('own task → done: ok + sheet row status/done_at/done_by/note/updated_at', d.ok && d.status === 'done' && t1.status === 'done' && t1.done_by === J && /^\d{4}-\d{2}-\d{2}T/.test(t1.done_at) && t1.note === 'spoke 10:40' && t1.updated_at === d.updated_at);
  ok('script lock taken on every POST that reaches an action, and released each time', lm._locked >= 1 && lm._released === lm._locked);
  const s = lm.POST({ token: TOK.jordan, action: 'set_status', task_id: 't:pulse:oppA', status: 'snoozed', snoozed_until: ISO(NOW + 7200e3) });
  ok('snoozed stores snoozed_until', s.ok && sheetObj(S.Tasks, 'task_id', 't:pulse:oppA').snoozed_until === ISO(NOW + 7200e3));
  const o = lm.POST({ token: TOK.jordan, action: 'set_status', task_id: 't1', status: 'open' });
  const t1b = sheetObj(S.Tasks, 'task_id', 't1');
  ok('reopen clears done_at / done_by / snoozed_until', o.ok && t1b.status === 'open' && t1b.done_at === '' && t1b.done_by === '' && t1b.snoozed_until === '');
  ok('other rows untouched by the row write (t3 still done, t4 still open)', sheetObj(S.Tasks, 'task_id', 't3').status === 'done' && sheetObj(S.Tasks, 'task_id', 't4').status === 'open');
  const S2 = fixture(), ow = endpoint('owner', S2);
  ok('owner non-approver (Ed) on a private row → forbidden', same(ow.POST({ token: TOK.ed, action: 'set_status', task_id: 't5', status: 'done' }), { ok: false, error: 'forbidden' }));
  ok('owner non-approver (Ed) on a team row → ok', ow.POST({ token: TOK.ed, action: 'set_status', task_id: 't4', status: 'skipped' }).ok && sheetObj(S2.Tasks, 'task_id', 't4').status === 'skipped');
  ok('approver on a private row → ok, done_by Michael', ow.POST({ token: TOK.michael, action: 'set_status', task_id: 't5', status: 'done' }).ok && sheetObj(S2.Tasks, 'task_id', 't5').done_by === MF);
}

/* ═══ 4. add_task ═══ */
console.log('POST — add_task');
{
  const S = fixture(), lm = endpoint('lm', S);
  ok('ask required', same(lm.POST({ token: TOK.jordan, action: 'add_task', ask: '  ' }), { ok: false, error: 'ask required' }));
  const before = S.Tasks._v.length;
  const r = lm.POST({ token: TOK.jordan, action: 'add_task', ask: 'Pull comps for 12 Oak', owner: A, visibility: 'owner', contact_id: 'c9', priority: '1' });
  const row = sheetObj(S.Tasks, 'task_id', r.task_id);
  ok('LM add: appended one row, task_id t:self:<epoch>:<rand4>', r.ok && S.Tasks._v.length === before + 1 && /^t:self:\d{13}:[0-9a-f]{4}$/.test(r.task_id));
  ok('LM add: owner forced to person, visibility team, source self, kind self (body owner/visibility ignored)', row.owner === J && row.visibility === 'team' && row.source === 'self' && row.kind === 'self');
  ok('LM add: status open, created_by Jordan, due defaults to today, priority 1, ghl_url built from contact_id', row.status === 'open' && row.created_by === J && /^\d{4}-\d{2}-\d{2}$/.test(row.due) && row.priority === 1 && row.ghl_url.endsWith('/contacts/detail/c9'));
  const S2 = fixture(), ow = endpoint('owner', S2);
  const m = ow.POST({ token: TOK.michael, action: 'add_task', ask: 'Decide on Kent offer', owner: '', visibility: 'owner', kind: 'decide', due: '2026-10-03', priority: 3 });
  const mr = sheetObj(S2.Tasks, 'task_id', m.task_id);
  ok('approver add: private row allowed, owner "" (unassigned), source owner, kind/due/priority honored', m.ok && mr.visibility === 'owner' && mr.owner === '' && mr.source === 'owner' && mr.kind === 'decide' && mr.due === '2026-10-03' && mr.priority === 3);
  const e = ow.POST({ token: TOK.ed, action: 'add_task', ask: 'Ed asks Jordan', owner: J, visibility: 'owner' });
  ok('non-approver add: visibility forced to team, owner any Team name, created_by Ed', e.ok && sheetObj(S2.Tasks, 'task_id', e.task_id).visibility === 'team' && sheetObj(S2.Tasks, 'task_id', e.task_id).owner === J && sheetObj(S2.Tasks, 'task_id', e.task_id).created_by === 'Ed Peugh');
}

/* ═══ 5. assign ═══ */
console.log('POST — assign');
{
  const S = fixture(), lm = endpoint('lm', S), ow = endpoint('owner', S);
  ok('LM → forbidden', same(lm.POST({ token: TOK.jordan, action: 'assign', task_id: 't1', owner: A }), { ok: false, error: 'forbidden' }) && sheetObj(S.Tasks, 'task_id', 't1').owner === J);
  const r = ow.POST({ token: TOK.ed, action: 'assign', task_id: 't7', owner: A });
  ok('owner reassigns the unassigned task to Andrew, updated_at set', r.ok && r.owner === A && sheetObj(S.Tasks, 'task_id', 't7').owner === A && sheetObj(S.Tasks, 'task_id', 't7').updated_at === r.updated_at);
  ok('non-approver cannot reassign a private row', same(ow.POST({ token: TOK.ed, action: 'assign', task_id: 't5', owner: J }), { ok: false, error: 'forbidden' }));
  ok('approver can', ow.POST({ token: TOK.michael, action: 'assign', task_id: 't5', owner: J }).ok && sheetObj(S.Tasks, 'task_id', 't5').owner === J);
  ok('unknown task → not found', same(ow.POST({ token: TOK.michael, action: 'assign', task_id: 'nope', owner: J }), { ok: false, error: 'not found' }));
}

/* ═══ 6. flag ═══ */
console.log('POST — flag');
{
  const S = fixture(), lm = endpoint('lm', S);
  const n0 = S.Review._v.length;
  const F = x => Object.assign({ token: TOK.jordan, action: 'flag', item_type: 'text', item_key: 'text:2026-10-01:jordan:2', item_owner: J, memo_date: '2026-10-01', reason: 'wrong-fact', note: 'she is the daughter, not the owner' }, x);
  ok('item_owner != person → forbidden, nothing appended', same(lm.POST(F({ item_owner: A })), { ok: false, error: 'forbidden' }) && S.Review._v.length === n0);
  ok('mis-cased item_owner is still != person (exact match)', same(lm.POST(F({ item_owner: 'jordan mathis' })), { ok: false, error: 'forbidden' }));
  ok('item_type task on another person\'s task → forbidden even with item_owner = person', same(lm.POST(F({ item_type: 'task', item_key: 'task:t4' })), { ok: false, error: 'forbidden' }));
  ok('item_type task on a task that does not exist → forbidden', same(lm.POST(F({ item_type: 'task', item_key: 'task:nope' })), { ok: false, error: 'forbidden' }));
  ok('bad reason / bad item_type / missing note / missing item_key rejected', lm.POST(F({ reason: 'meh' })).error === 'bad reason' && lm.POST(F({ item_type: 'memo' })).error === 'bad item_type' && lm.POST(F({ note: '' })).error === 'note required' && lm.POST(F({ item_key: '' })).error === 'item_key required');
  const r = lm.POST(F({}));
  const fr = sheetObj(S.Review, 'flag_id', r.flag_id);
  ok('valid flag → ok + flag_id f:<epoch>:<rand4>, row appended', r.ok && /^f:\d{13}:[0-9a-f]{4}$/.test(r.flag_id) && S.Review._v.length === n0 + 1);
  ok('row: from = person, status pending, fields stored, evidence ""', fr.from === J && fr.status === 'pending' && fr.item_key === 'text:2026-10-01:jordan:2' && fr.reason === 'wrong-fact' && fr.memo_date === '2026-10-01' && fr.evidence === '');
  const r2 = lm.POST(F({ item_type: 'task', item_key: 'task:t1', evidence: '03:12' }));
  ok('own task flag ok, evidence kept', r2.ok && sheetObj(S.Review, 'flag_id', r2.flag_id).evidence === '03:12');
  const S2 = fixture(), ow = endpoint('owner', S2);
  const r3 = ow.POST({ token: TOK.ed, action: 'flag', item_type: 'pulse', item_key: 'pulse:oppB', item_owner: A, reason: 'rule-wrong', note: 'Holding window is wrong here' });
  ok('owner may flag another person\'s item; from = Ed Peugh', r3.ok && sheetObj(S2.Review, 'flag_id', r3.flag_id).from === 'Ed Peugh' && sheetObj(S2.Review, 'flag_id', r3.flag_id).item_owner === A);
}

/* ═══ 7. decide ═══ */
console.log('POST — decide');
{
  const S = fixture(), lm = endpoint('lm', S), ow = endpoint('owner', S);
  const Dc = x => Object.assign({ token: TOK.michael, action: 'decide', flag_id: 'f1', decision: 'accepted', decision_note: 'Agreed — close it out and log the 10:40 call' }, x);
  ok('LM → forbidden', same(lm.POST(Dc({ token: TOK.jordan })), { ok: false, error: 'forbidden' }));
  ok('owner non-approver (Ed) → forbidden', same(ow.POST(Dc({ token: TOK.ed })), { ok: false, error: 'forbidden' }));
  ok('flag still pending after the rejections', sheetObj(S.Review, 'flag_id', 'f1').status === 'pending');
  ok('bad decision / missing decision_note / unknown flag', ow.POST(Dc({ decision: 'maybe' })).error === 'bad decision' && ow.POST(Dc({ decision_note: ' ' })).error === 'decision_note required' && ow.POST(Dc({ flag_id: 'f9' })).error === 'not found');
  const nT = S.Tasks._v.length;
  const r = ow.POST(Dc({ applied_as: 'fix-task' }));
  const f1 = sheetObj(S.Review, 'flag_id', 'f1'), fix = sheetObj(S.Tasks, 'task_id', 't:review:f1');
  ok('approver accept + fix-task → ok, status applied, task_id returned', r.ok && r.status === 'applied' && r.task_id === 't:review:f1');
  ok('flag row: status applied, decision_note, decided_at/by Michael, applied_as fix-task:<id>, applied_at', f1.status === 'applied' && f1.decision_note === Dc({}).decision_note && f1.decided_by === MF && /T/.test(f1.decided_at) && f1.applied_as === 'fix-task:t:review:f1' && /T/.test(f1.applied_at));
  ok('fix-it task appended: owner = item_owner, kind fix-record, source review, ask = decision_note, open, lead/contact copied from t1', S.Tasks._v.length === nT + 1 && fix && fix.owner === J && fix.kind === 'fix-record' && fix.source === 'review' && fix.ask === Dc({}).decision_note && fix.status === 'open' && fix.lead === 'Seller One' && fix.contact_id === 'c1' && fix.ghl_url.endsWith('/c1'));
  const r2 = ow.POST(Dc({ applied_as: 'fix-task:t:review:f1' }));
  ok('re-deciding the same flag never doubles the fix-it task', r2.ok && S.Tasks._v.length === nT + 1);
  const r3 = ow.POST(Dc({ flag_id: 'f2', decision: 'declined', decision_note: 'Only your side is on the transcript', applied_as: 'none' }));
  const f2 = sheetObj(S.Review, 'flag_id', 'f2');
  ok('decline with applied_as none → status declined, applied_as none, no task', r3.ok && r3.status === 'declined' && f2.status === 'declined' && f2.applied_as === 'none' && S.Tasks._v.length === nT + 1 && f2.decision_note === 'Only your side is on the transcript');
  ok('decided_by is the approver\'s Team-tab name', f2.decided_by === MF);
}

/* ═══ 8. upsert_tasks ═══ */
console.log('POST — upsert_tasks');
{
  const batch = {
    date: '2026-10-01',
    tasks: [
      { task_id: 't:pulse:oppA', owner: J, ask: 'pulse A NEW ASK', why: 'why A', due: '2026-10-01', priority: 1, lead: 'Lead A', ghl_url: 'https://x/a' },
      { task_id: 't:pulse:oppD', owner: J, ask: 'pulse D NEW ASK', priority: 2 },
      { task_id: 't:pulse:oppE', owner: J, ask: 'pulse E is back', priority: 2 },
      { task_id: 't:2026-10-01:jordan:texts:1', owner: J, visibility: 'team', kind: 'coaching', source: 'texts', ask: 'Lead with the timeline question', why: 'from today\'s memo', due: '2026-10-01', priority: 2, lead: 'Seller Two', contact_id: 'c2' },
      { task_id: 't:2026-10-01:michael:step_in:decide:abcd1234', date: '2026-10-01', owner: MF, visibility: 'owner', kind: 'decide', source: 'step_in', ask: 'Decide the Kent counter', priority: 1, status: 'done' },
      { ask: 'no task_id → skipped' },
      { task_id: 't:pulse:oppA', ask: 'duplicate id in batch → skipped' }
    ],
    expire_sources: ['pulse', 'tracker']
  };
  const S = fixture(), lm = endpoint('lm', S);
  ok('LM token → forbidden', same(lm.POST(Object.assign({ token: TOK.jordan, action: 'upsert_tasks' }, batch)), { ok: false, error: 'forbidden' }));
  ok('tasks must be an array', same(lm.POST({ token: TOK.routine, action: 'upsert_tasks', date: '2026-10-01' }), { ok: false, error: 'tasks required' }));
  const r = lm.POST(Object.assign({ token: TOK.routine, action: 'upsert_tasks' }, batch));
  if (!(r.ok && r.appended === 2 && r.refreshed === 3)) console.log("   actual:", JSON.stringify(r));
  ok('routine token → ok {appended 2, refreshed 3, expired 3, reopened 1, skipped 2}', r.ok && r.appended === 2 && r.refreshed === 3 && r.expired === 3 && r.reopened === 1 && r.skipped === 2);
  const a = sheetObj(S.Tasks, 'task_id', 't:pulse:oppA');
  ok('refresh: ask/why/due/priority/lead/ghl_url/owner updated, status untouched (open), created_* untouched', a.ask === 'pulse A NEW ASK' && a.why === 'why A' && a.priority === 1 && a.lead === 'Lead A' && a.ghl_url === 'https://x/a' && a.status === 'open' && a.created_by === 'routine:call-coaching' && a.created_at === base.created_at && a.updated_at !== base.updated_at);
  const d = sheetObj(S.Tasks, 'task_id', 't:pulse:oppD');
  ok('refresh never reopens a DONE row (done_at/done_by kept, ask refreshed)', d.status === 'done' && d.done_by === J && d.ask === 'pulse D NEW ASK');
  ok('refresh of an EXPIRED row the producer sends again → open', sheetObj(S.Tasks, 'task_id', 't:pulse:oppE').status === 'open');
  const n = sheetObj(S.Tasks, 'task_id', 't:2026-10-01:jordan:texts:1');
  ok('append: status open, created_by routine:call-coaching, created_at/updated_at ISO, ghl_url built from contact_id', n && n.status === 'open' && n.created_by === 'routine:call-coaching' && /T/.test(n.created_at) && n.updated_at === n.created_at && n.ghl_url.endsWith('/c2') && n.lead === 'Seller Two' && n.kind === 'coaching' && n.source === 'texts');
  const m = sheetObj(S.Tasks, 'task_id', 't:2026-10-01:michael:step_in:decide:abcd1234');
  ok('append: incoming status ignored (always open), visibility owner kept, date from row', m.status === 'open' && m.visibility === 'owner' && m.date === '2026-10-01' && m.note === '' && m.done_at === '');
  ok('expire: pulse B (snoozed) + tracker C (open) + private pulse t6 — every open/snoozed row of an expired source not in the batch', sheetObj(S.Tasks, 'task_id', 't:pulse:oppB').status === 'expired' && sheetObj(S.Tasks, 'task_id', 't:tracker:follow-up:oppC').status === 'expired' && sheetObj(S.Tasks, 'task_id', 't6').status === 'expired');
  ok('expire never touches other sources or closed rows (t1 open, t2 done, t4 open)', sheetObj(S.Tasks, 'task_id', 't1').status === 'open' && sheetObj(S.Tasks, 'task_id', 't2').status === 'done' && sheetObj(S.Tasks, 'task_id', 't4').status === 'open');
  const r2 = lm.POST(Object.assign({ token: TOK.routine, action: 'upsert_tasks' }, batch));
  ok('idempotent re-run: 0 appended, 0 expired, 0 reopened, 5 refreshed', r2.ok && r2.appended === 0 && r2.expired === 0 && r2.reopened === 0 && r2.refreshed === 5 && S.Tasks._v.length === 13 + 2);
  const S2 = fixture(), ow = endpoint('owner', S2);
  ok('owner endpoint: non-approver (Ed) → forbidden', same(ow.POST(Object.assign({ token: TOK.ed, action: 'upsert_tasks' }, batch)), { ok: false, error: 'forbidden' }));
  const r3 = ow.POST(Object.assign({ token: TOK.michael, action: 'upsert_tasks' }, batch));
  ok('owner endpoint: approver → same result', r3.ok && r3.appended === 2 && r3.refreshed === 3 && r3.expired === 3);
  const S3 = fixture(), lm3 = endpoint('lm', S3);
  const r4 = lm3.POST({ token: TOK.routine, action: 'upsert_tasks', date: '2026-10-01', tasks: [] });
  ok('empty batch with no expire_sources changes nothing', r4.ok && r4.appended === 0 && r4.expired === 0 && same(S3.Tasks._v, fixture().Tasks._v));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
