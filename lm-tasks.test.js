/* Tasks & Review in the LM app (lm.html + lm-view.js) — headless boot with a
 * SYNTHETIC payload (no private fixture), a cached fake DOM and a fetch stub that
 * records every POST. Contract: apps-script/TASKS.md.  Run: node lm-tasks.test.js */
const fs = require('fs'), vm = require('vm');
const J = 'Jordan Mathis', A = 'Andrew Estrada', MF = 'Michael Fichman';
const z = n => (n < 10 ? '0' : '') + n, dayStr = d => d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
const now = new Date(), TODAY = dayStr(now), YDAY = dayStr(new Date(now.getTime() - 864e5)), TMRW = dayStr(new Date(now.getTime() + 864e5));
const ISO = ms => new Date(ms).toISOString();

const TH = ['task_id', 'date', 'owner', 'visibility', 'kind', 'lead', 'contact_id', 'opp_id', 'ask', 'why', 'source', 'due', 'priority', 'status', 'done_at', 'done_by', 'note', 'snoozed_until', 'created_at', 'created_by', 'updated_at', 'ghl_url'];
const RH = ['flag_id', 'created_at', 'from', 'item_type', 'item_key', 'item_owner', 'memo_date', 'reason', 'note', 'evidence', 'status', 'decision_note', 'decided_at', 'decided_by', 'applied_as', 'applied_at'];
const row = (H, o) => H.map(h => o[h] == null ? '' : o[h]);
const T = o => row(TH, Object.assign({ date: TODAY, owner: J, visibility: 'team', kind: 'coaching', source: 'texts', due: TODAY, priority: 2, status: 'open', created_at: ISO(now - 3600e3), created_by: 'routine:call-coaching', updated_at: ISO(now - 3600e3) }, o));
const tasksTab = [TH,
  T({ task_id: 'tA', ask: 'ASK-A overdue call', due: YDAY, lead: 'Seller Alpha', contact_id: 'c1', ghl_url: 'https://app.legacy-fusion.com/v2/location/8ZyuO8zm2zuGEdBfB70M/contacts/detail/c1', why: 'WHY-A no answer twice' }),
  T({ task_id: 'tB', ask: 'ASK-B now priority one', priority: 1, kind: 'call-seller' }),
  T({ task_id: 'tC', ask: 'ASK-C today normal', kind: 'next-step', note: 'NOTE-C left vm' }),
  T({ task_id: 'tD', ask: 'ASK-D snoozed till tomorrow', status: 'snoozed', snoozed_until: ISO(now.getTime() + 864e5) }),
  T({ task_id: 'tE', ask: 'ASK-E this week', priority: 3, due: TMRW }),
  T({ task_id: 'tF', ask: 'ASK-F done earlier today', status: 'done', done_at: ISO(now.getTime() - 60e3), done_by: J }),
  T({ task_id: 'tG', ask: 'ASK-G PRIVATE-OWNER-ROW', visibility: 'owner', kind: 'decide' }),
  T({ task_id: 'tH', ask: 'ASK-H ANDREWS-ROW', owner: A }),
  T({ task_id: 'tI', ask: 'ASK-I EXPIRED-ROW', status: 'expired', source: 'pulse' })
];
const reviewTab = [RH,
  row(RH, { flag_id: 'f1', created_at: ISO(now - 7200e3), from: J, item_type: 'text', item_key: 'text:' + YDAY + ':jordan:1', item_owner: J, memo_date: YDAY, reason: 'wrong-ask', note: 'FLAGNOTE-1', status: 'pending' }),
  row(RH, { flag_id: 'f2', created_at: ISO(now - 86400e3), from: J, item_type: 'call', item_key: 'call:' + YDAY + ':jordan:2', item_owner: J, memo_date: YDAY, reason: 'voicemail-not-conversation', note: 'FLAGNOTE-2', status: 'declined', decision_note: 'DECISION-2 transcript shows two-way', decided_by: MF }),
  row(RH, { flag_id: 'f3', created_at: ISO(now - 3600e3), from: A, item_type: 'text', item_key: 'text:' + YDAY + ':andrew:1', item_owner: A, memo_date: YDAY, reason: 'other', note: 'FLAGNOTE-3-ANDREW', status: 'pending' })
];
function payload(opts) {
  opts = opts || {};
  return { ok: true, role: 'lm', person: J, splitRate: 0.1, fetchedAt: ISO(now), tasksAsOf: ISO(now), fees: {}, stages: {}, goals: { avgWholesaleFee: 20000 }, lmTargets: [],
    tabs: {
      Calls: [['Date', 'User', 'Total Calls', 'Inbound Calls', 'Outbound Calls', 'Total Talk Time (min)', 'Inbound Talk Time (min)', 'Outbound Talk Time (min)'], ['6/17/2026', J, 61, 0, 61, 17, 0, 17]],
      Leads: [['Created Date', 'Lead Source', 'Contact Name', 'Phone', 'Email', 'Property Address', 'Assigned User', 'Contact ID'], ['6/16/2026', 'Google Ads', 'Lead One', '', '', '', J, 'L1']],
      Appointments: [['Confirmed Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Gap (Days)'], ['6/16/2026', '', 'Confirmed', J, MF, 'Appt One', '', '', '', 'C1', '']],
      Offers: [['Offer Made Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Gap (Days)'], ['6/15/2026', '', 'Made', J, MF, 'Offer One', '', '', '', 'D1', '']],
      Contracts: [['Sent Date', 'Signed Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Opportunity ID'], ['', '5/12/2026', '', 'Signed', J, MF, 'Deal One', '', '', '', 'C1', 'op1']],
      Closings: [['Closed', 'Revenue', 'Contact ID', 'Contact Name']],
      'Speed to Lead': [['Lead Created At', 'First Call At', 'Speed (Min)', 'Lead Source', 'Contact Name', 'Phone', 'Assigned User', 'Contact ID'], ['6/16/2026', '6/16/2026', '9', 'MLS', 'Lead One', '', J, 's1']],
      Team: [['Name', 'Role', 'Active', 'Start Date'], [J, 'LM', 'Yes', '4/22/2026']],
      Tasks: opts.noTasks ? null : tasksTab, Review: opts.noTasks ? null : reviewTab
    } };
}

/* ── fake DOM + boot ── */
function boot(opts) {
  opts = opts || {};
  const els = {};
  function el(id) { if (!els[id]) els[id] = { id, style: {}, innerHTML: '', textContent: '', className: '', value: '', hidden: false, _cls: {}, classList: { add(c) { els[id]._cls[c] = 1; }, remove(c) { delete els[id]._cls[c]; }, contains(c) { return !!els[id]._cls[c]; } }, scrollIntoView() {} }; return els[id]; }
  const calls = { get: 0, post: [] };
  const ctx = {};
  Object.assign(ctx, {
    window: ctx, self: ctx, console, Date, Math, JSON, isFinite, isNaN, parseInt, parseFloat, Number, String, Object, Array, RegExp, Promise, URLSearchParams, Error,
    setInterval: () => 0, clearInterval: () => {}, setTimeout, scrollTo: () => {},
    getComputedStyle: () => ({ getPropertyValue: () => '#3FD0FF' }),
    Chart: function () { return { destroy() {} }; },
    localStorage: { _d: Object.assign({}, opts.ls || {}), getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; } },
    location: { hash: opts.hash != null ? opts.hash : '#e=https://script.google.com/macros/s/AKx/exec&t=jordantok123&r=lm' },
    history: { replaceState() {} }, navigator: {},
    document: { getElementById: el, addEventListener: () => {}, documentElement: { classList: { add() {}, remove() {} } }, createElement: () => el('_tmp'), body: { appendChild() {} } }
  });
  ctx.fetch = (url, init) => {
    if (init && init.method === 'POST') { calls.post.push({ url, init, body: JSON.parse(init.body) }); const r = (opts.postReply || (() => ({ ok: true })))(calls.post[calls.post.length - 1].body); return Promise.resolve({ json: () => Promise.resolve(r) }); }
    calls.get++; return Promise.resolve({ json: () => Promise.resolve(payload(opts)) });
  };
  vm.createContext(ctx);
  ['lm-engine.js', 'lm-gamify.js', 'lm-view.js'].forEach(f => vm.runInContext(fs.readFileSync(__dirname + '/' + f, 'utf8'), ctx, { filename: f }));
  const html = fs.readFileSync(__dirname + '/lm.html', 'utf8');
  vm.runInContext(html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>')), ctx, { filename: 'lm.html#boot' });
  return { ctx, els, calls, el, view: () => els.view.innerHTML, g: name => vm.runInContext(name, ctx) };   // g(): read a top-level const/let from the vm's lexical scope
}
const tick = (ms) => new Promise(r => setTimeout(r, ms || 25));
let pass = 0, fail = 0;
const ok = (l, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + l); c ? pass++ : fail++; };
const before = (h, a, b) => h.indexOf(a) > -1 && h.indexOf(b) > -1 && h.indexOf(a) < h.indexOf(b);

(async function () {
  console.log('ASSET VERSIONS');
  const html = fs.readFileSync(__dirname + '/lm.html', 'utf8'), sw = fs.readFileSync(__dirname + '/sw-lm.js', 'utf8');
  ok('lm.html: engine/gamify/view tags + css link at ?v=45, no v=44 left', (html.match(/\?v=45/g) || []).length === 4 && html.indexOf('v=44') === -1);
  ok('sw-lm.js: cache name clt-lm-v45 and V=45', sw.indexOf("'clt-lm-v45'") > -1 && sw.indexOf("const V = '45'") > -1);

  console.log('HOME — the ✓ Today button');
  const B = boot(); await tick(60);
  const home = B.view();
  ok('app booted on the scoped payload', B.els.app.style.display === '' && home.indexOf(J) > -1);
  ok('home shows "✓ Today — 4 open, 1 overdue →" (snoozed not open; private/other/expired rows ignored)', home.indexOf('✓ Today — 4 open, 1 overdue →') > -1);
  ok('button sits above Make More Money and routes to tasks', before(home, "'tasks')", 'Make More Money') && home.indexOf('class="lm-deals-btn tasksbtn late"') > -1);
  ok('home never leaks the private or other-person rows', home.indexOf('PRIVATE-OWNER-ROW') === -1 && home.indexOf('ANDREWS-ROW') === -1);

  console.log('TASKS VIEW');
  B.ctx.window.lmGo(J, 'week', 'tasks');
  const v = B.view();
  ok('view renders with back button + title', v.indexOf('Your tasks') > -1 && v.indexOf('lm-back') > -1);
  ok('sections in order: Overdue → Now → Today → Later', before(v, '>Overdue<', '>Now<') && before(v, '>Now<', '>Today<') && before(v, '>Today<', '>Later<'));
  ok('Overdue holds ASK-A (red section) with lead link + why', before(v, '>Overdue<', 'ASK-A') && before(v, 'ASK-A', '>Now<') && v.indexOf('class="lm-tsec red"') > -1 && v.indexOf('href="https://app.legacy-fusion.com/v2/location/8ZyuO8zm2zuGEdBfB70M/contacts/detail/c1"') > -1 && v.indexOf('WHY-A') > -1);
  ok('Now holds ASK-B (priority 1)', before(v, '>Now<', 'ASK-B') && before(v, 'ASK-B', '>Today<'));
  ok('Today holds ASK-C with its note', before(v, '>Today<', 'ASK-C') && before(v, 'ASK-C', '>Later<') && v.indexOf('✎ NOTE-C') > -1);
  ok('Later holds the snoozed ASK-D and the priority-3 ASK-E', before(v, '>Later<', 'ASK-D') && before(v, '>Later<', 'ASK-E') && v.indexOf('lm-task snoozed') > -1);
  ok('Done today collapsed (<details>) with ASK-F, read-only', v.indexOf('<details class="lm-tsec dim"><summary>Done today · 1</summary>') > -1 && v.indexOf('ASK-F') > -1 && v.split('ASK-F')[1].indexOf('lmTaskDone') === -1);
  ok('visibility=owner row never rendered even though the payload carried it', v.indexOf('PRIVATE-OWNER-ROW') === -1);
  ok('another person\'s row and the expired row never rendered', v.indexOf('ANDREWS-ROW') === -1 && v.indexOf('EXPIRED-ROW') === -1);
  ok('kind chips', v.indexOf('<span class="lm-task-kind">call-seller</span>') > -1 && v.indexOf('<span class="lm-task-kind">next-step</span>') > -1);
  ok('row buttons are real <button type="button"> with aria-labels: ✓ done · ⏰ later · ✎ note · ⚑ flag', /<button type="button" class="lm-tbtn done" onclick="lmTaskDone\('tA'\)" aria-label="Mark done">✓ done<\/button>/.test(v) && v.indexOf('aria-label="Snooze: show options">⏰ later</button>') > -1 && v.indexOf('aria-label="Add a note">✎ note</button>') > -1 && v.indexOf('aria-label="Flag this task for Michael">⚑ flag</button>') > -1);
  ok('snooze offers +2 hours / Tomorrow 8:30 AM', v.indexOf("lmTaskSnooze('tA','2h')") > -1 && v.indexOf("lmTaskSnooze('tA','tomorrow')") > -1);
  ok('+ Add a task for yourself (ask, due defaults to today, priority)', v.indexOf('+ Add a task for yourself') > -1 && v.indexOf('id="lm-add-due" class="lm-in" type="date" value="' + TODAY + '"') > -1 && v.indexOf('onclick="lmTaskAdd()"') > -1);
  ok('My flags: own flags with status pills + Michael\'s decision_note; Andrew\'s flag absent', v.indexOf('My flags (2)') > -1 && v.indexOf('FLAGNOTE-1') > -1 && v.indexOf('class="lm-pill pending"') > -1 && v.indexOf('class="lm-pill declined"') > -1 && v.indexOf('DECISION-2') > -1 && v.indexOf('FLAGNOTE-3-ANDREW') === -1);
  ok('no inline style attributes in the tasks view (classes in lm-view.css)', v.indexOf('style=') === -1);
  ok('no flag form open yet', v.indexOf('lm-flag-form') === -1);

  console.log('WRITES — LMApp.post');
  await B.ctx.lmTaskDone('tA'); await tick(40);
  let p = B.calls.post[0];
  ok('✓ done → POST set_status {token, task_id, status:done}', p && p.body.action === 'set_status' && p.body.task_id === 'tA' && p.body.status === 'done' && p.body.token === 'jordantok123');
  ok('POST shape: /exec url, text/plain;charset=utf-8, redirect follow, JSON string body', p.url === 'https://script.google.com/macros/s/AKx/exec' && p.init.headers['Content-Type'] === 'text/plain;charset=utf-8' && p.init.redirect === 'follow' && typeof p.init.body === 'string');
  ok('optimistic: row marked done, then the payload re-loaded (GET count 2)', B.el('lmt-tA').classList.contains('lm-task-done') && B.calls.get === 2);
  await B.ctx.lmTaskSnooze('tC', 'tomorrow');
  p = B.calls.post[1]; const t830 = new Date(now); t830.setDate(t830.getDate() + 1); t830.setHours(8, 30, 0, 0);
  ok('⏰ tomorrow → set_status snoozed, snoozed_until = tomorrow 8:30 AM local (ISO)', p.body.action === 'set_status' && p.body.status === 'snoozed' && new Date(p.body.snoozed_until).getTime() === t830.getTime());
  await B.ctx.lmTaskSnooze('tC', '2h');
  p = B.calls.post[2];
  ok('⏰ +2h → snoozed_until ≈ now + 2 h', Math.abs(new Date(p.body.snoozed_until).getTime() - (Date.now() + 7200e3)) < 5000);
  B.el('lmt-tC-note-in').value = '  called, left vm  ';
  await B.ctx.lmTaskNote('tC', 'lmt-tC', 'open', '');
  p = B.calls.post[3];
  ok('✎ note → set_status open + trimmed note', p.body.action === 'set_status' && p.body.status === 'open' && p.body.note === 'called, left vm' && p.body.task_id === 'tC');
  B.el('lm-add-ask').value = 'Pull the Kent comps'; B.el('lm-add-due').value = TMRW; B.el('lm-add-pri').value = '3';
  await B.ctx.lmTaskAdd();
  p = B.calls.post[4];
  ok('+ Add → add_task {ask, due, priority} (owner/visibility left to the server)', p.body.action === 'add_task' && p.body.ask === 'Pull the Kent comps' && p.body.due === TMRW && p.body.priority === '3' && !('owner' in p.body) && !('visibility' in p.body));
  B.el('lm-add-ask').value = '   ';
  const r0 = await B.ctx.lmTaskAdd();
  ok('+ Add with an empty ask: no POST, inline error', !r0.ok && B.calls.post.length === 5 && B.el('lm-add-err').textContent.indexOf('Write the task') > -1);

  console.log('WRITES — error path stays inline');
  const E = boot({ postReply: () => ({ ok: false, error: 'forbidden' }) }); await tick(60);
  E.ctx.window.lmGo(J, 'week', 'tasks');
  const rE = await E.ctx.lmTaskDone('tB'); await tick(20);
  ok('server says forbidden → {ok:false}, optimistic mark reverted, inline error text, no reload', !rE.ok && !E.el('lmt-tB').classList.contains('lm-task-done') && E.el('lmt-tB-err').textContent === 'Could not save: forbidden' && E.calls.get === 1);

  console.log('FLAG — from a task row');
  B.ctx.lmFlagOpen({ item_type: 'task', item_key: 'task:tB', memo_date: TODAY, label: 'ASK-B now priority one' }); await tick(5);
  const fv = B.view();
  ok('⚑ opens the Tasks view with the flag form at the top, prefilled', fv.indexOf('id="lm-flag-form"') > -1 && fv.indexOf('task · task:tB — ASK-B now priority one') > -1 && fv.indexOf('memo ' + TODAY) > -1 && before(fv, 'lm-flag-form', '>Overdue<'));
  ok('reason pick list = the contract\'s 11 reasons, note required, evidence optional', (fv.match(/<option value="/g) || []).length >= 11 && fv.indexOf('value="voicemail-not-conversation"') > -1 && fv.indexOf('What happened (required)') > -1 && fv.indexOf('id="lm-flag-evidence"') > -1);
  const nb = B.calls.post.length, ng = B.calls.get;
  const r1 = await B.ctx.lmFlagSubmit();
  ok('empty note → no POST, inline error', !r1.ok && B.calls.post.length === nb && B.el('lm-flag-form-err').textContent.length > 0);
  B.el('lm-flag-reason').value = 'already-done'; B.el('lm-flag-note').value = 'Spoke to him at 9:10'; B.el('lm-flag-evidence').value = '02:14';
  await B.ctx.lmFlagSubmit(); await tick(40);
  p = B.calls.post[nb];
  ok('submit → POST flag {item_type task, item_key task:tB, item_owner = M.person, memo_date, reason, note, evidence}', p.body.action === 'flag' && p.body.item_type === 'task' && p.body.item_key === 'task:tB' && p.body.item_owner === J && p.body.memo_date === TODAY && p.body.reason === 'already-done' && p.body.note === 'Spoke to him at 9:10' && p.body.evidence === '02:14');
  ok('after ok the form closes (ctx cleared) and the payload re-loads once', B.ctx.LM_FLAG_CTX === null && B.calls.get === ng + 1);

  console.log('FLAG — #flag= deep link from the email (token from localStorage)');
  const D = boot({ hash: '#flag=' + encodeURIComponent('text:' + YDAY + ':jordan:2') + '&type=text&owner=' + encodeURIComponent(A) + '&date=' + YDAY,
    ls: { clt_lm: JSON.stringify({ url: 'https://script.google.com/macros/s/AKx/exec', tok: 'jordantok123' }) } });
  await tick(60);
  const dv = D.view();
  ok('boots straight into the Tasks view (credentials from localStorage)', D.els.app.style.display === '' && dv.indexOf('Your tasks') > -1 && D.calls.get === 1);
  ok('flag form prefilled from the hash: type text, item_key, memo date', dv.indexOf('id="lm-flag-form"') > -1 && dv.indexOf('text · text:' + YDAY + ':jordan:2') > -1 && dv.indexOf('memo ' + YDAY) > -1);
  D.el('lm-flag-note').value = 'That text was mine, not his';
  await D.ctx.lmFlagSubmit(); await tick(20);
  p = D.calls.post[0];
  ok('submitted item_owner is M.person (Jordan) even though the hash said owner=Andrew; hash only prefilled', p && p.body.action === 'flag' && p.body.item_owner === J && p.body.item_key === 'text:' + YDAY + ':jordan:2' && p.body.item_type === 'text' && p.body.memo_date === YDAY && p.body.token === 'jordantok123');

  console.log('NO TASKS TAB (old endpoint) — degrade, never throw');
  const N = boot({ noTasks: true }); await tick(60);
  ok('home: no ✓ Today button', N.view().indexOf('✓ Today') === -1 && N.view().indexOf('Make More Money') > -1);
  N.ctx.window.lmGo(J, 'week', 'tasks');
  ok('tasks route explains instead of throwing', N.view().indexOf('TASKS NOT CONNECTED') > -1 && N.view().indexOf('RENDER ERROR') === -1);

  console.log('PARSER / BUCKETS (pure)');
  const P = B.ctx.lmTasksParse({ Tasks: tasksTab, Review: reviewTab });
  ok('lmTasksParse: objects by header name, priority numeric, present flags', P.present && P.reviewPresent && P.tasks.length === 9 && P.tasks[1].priority === 1 && P.tasks[0].lead === 'Seller Alpha' && P.flags.length === 3);
  const K = B.ctx.lmTaskBuckets(B.g('lmTasksMine')(P, J));
  ok('buckets: overdue [tA], now [tB], today [tC], later [tD,tE], done [tF], open 4', K.overdue.map(t => t.task_id).join() === 'tA' && K.now.map(t => t.task_id).join() === 'tB' && K.today.map(t => t.task_id).join() === 'tC' && K.later.map(t => t.task_id).sort().join() === 'tD,tE' && K.done.map(t => t.task_id).join() === 'tF' && K.open === 4);
  ok('a date-only cell Sheets coerced to midnight ISO still reads as a day, not a "now" time', B.ctx.lmDayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()) === TODAY && isNaN(B.ctx.lmMsOf(new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString())));
  ok('a snoozed task whose snoozed_until has passed counts as open again', B.ctx.lmTaskBuckets([{ task_id: 'x', status: 'snoozed', snoozed_until: ISO(now.getTime() - 60e3), due: TODAY, priority: 2 }]).today.length === 1);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('   ! harness threw: ' + (e && e.stack || e)); process.exit(1); });
