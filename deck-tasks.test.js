/* Owner deck — the ✓ TASKS view (index.html) rendered headlessly, the way
 * deck-lm-render.test.js does it: slice the TASKS block out of index.html, eval it
 * with lm-view.js and the globals it closes over, render as approver / non-approver,
 * and drive the write helpers against a recording fetch. Run: node deck-tasks.test.js */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
const a = src.indexOf('/* ═══════════ TASKS & REVIEW (owner deck)'), b = src.indexOf('/* ═══════════ PAINT', a);
if (a < 0 || b < 0) { console.log('   ! TASKS block markers not found in index.html'); process.exit(1); }
const viewSrc = fs.readFileSync(__dirname + '/lm-view.js', 'utf8'), blockSrc = src.slice(a, b);

const J = 'Jordan Mathis', A = 'Andrew Estrada', MF = 'Michael Fichman';
const z = n => (n < 10 ? '0' : '') + n, dayStr = d => d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
const now = new Date(), TODAY = dayStr(now), YDAY = dayStr(new Date(now.getTime() - 864e5)), ISO = ms => new Date(ms).toISOString();
const TH = ['task_id', 'date', 'owner', 'visibility', 'kind', 'lead', 'contact_id', 'opp_id', 'ask', 'why', 'source', 'due', 'priority', 'status', 'done_at', 'done_by', 'note', 'snoozed_until', 'created_at', 'created_by', 'updated_at', 'ghl_url'];
const RH = ['flag_id', 'created_at', 'from', 'item_type', 'item_key', 'item_owner', 'memo_date', 'reason', 'note', 'evidence', 'status', 'decision_note', 'decided_at', 'decided_by', 'applied_as', 'applied_at'];
const row = (H, o) => H.map(h => o[h] == null ? '' : o[h]);
const T = o => row(TH, Object.assign({ date: TODAY, owner: J, visibility: 'team', kind: 'coaching', source: 'texts', due: TODAY, priority: 2, status: 'open', created_at: ISO(now - 3600e3), created_by: 'routine:call-coaching', updated_at: ISO(now - 3600e3) }, o));
const tasksTab = [TH,
  T({ task_id: 't1', ask: 'ASK-J1 overdue', due: YDAY, lead: 'Seller Alpha', ghl_url: 'https://app.legacy-fusion.com/v2/location/8ZyuO8zm2zuGEdBfB70M/contacts/detail/c1' }),
  T({ task_id: 't2', ask: 'ASK-A1 andrew today', owner: A, kind: 'next-step' }),
  T({ task_id: 't3', ask: 'ASK-M-PRIVATE decide $40,000', owner: MF, visibility: 'owner', kind: 'decide', source: 'step_in' }),
  T({ task_id: 't4', ask: 'ASK-U unassigned', owner: '', source: 'owner' }),
  T({ task_id: 't5', ask: 'ASK-J2 done today', status: 'done', done_at: ISO(now - 60e3), done_by: J }),
  T({ task_id: 't6', ask: 'ASK-A2 skipped today', owner: A, status: 'skipped', updated_at: ISO(now - 60e3) }),
  T({ task_id: 't7', ask: 'ASK-M-TEAM tracker follow-up', owner: MF, kind: 'follow-up', source: 'tracker' })
];
const reviewTab = [RH,
  row(RH, { flag_id: 'f1', created_at: ISO(now - 7200e3), from: J, item_type: 'task', item_key: 'task:t1', item_owner: J, memo_date: YDAY, reason: 'wrong-ask', note: 'FLAG-1 already called her', evidence: '03:12', status: 'pending' }),
  row(RH, { flag_id: 'f2', created_at: ISO(now - 3600e3), from: A, item_type: 'text', item_key: 'text:' + YDAY + ':andrew:1', item_owner: A, memo_date: YDAY, reason: 'score-disagree', note: 'FLAG-2 that was a real conversation', status: 'pending' }),
  row(RH, { flag_id: 'f3', created_at: ISO(now - 86400e3), from: J, item_type: 'call', item_key: 'call:' + YDAY + ':jordan:2', item_owner: J, memo_date: YDAY, reason: 'voicemail-not-conversation', note: 'FLAG-3', status: 'declined', decision_note: 'DECISION-3 two-way on the transcript', decided_by: MF }),
  row(RH, { flag_id: 'f4', created_at: ISO(now - 2 * 86400e3), from: A, item_type: 'pulse', item_key: 'pulse:oppZ', item_owner: A, reason: 'rule-wrong', note: 'FLAG-4', status: 'applied', decision_note: 'DECISION-4 fixed the window', decided_by: MF, applied_as: 'fix-task:t:review:f4' })
];

/* ── harness globals the block closes over ── */
const els = {};
const $ = id => { if (!els[id]) els[id] = { id, value: '', textContent: '', innerHTML: '', hidden: false, checked: false, _c: {}, classList: { add(c) { els[id]._c[c] = 1; }, remove(c) { delete els[id]._c[c]; }, contains(c) { return !!els[id]._c[c]; } } }; return els[id]; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const calls = { post: [], load: 0 }; let reply = () => ({ ok: true });
const cfg = { url: 'https://script.google.com/macros/s/AKx/exec', tok: 'michaeltok' };
const fetch = (url, init) => { calls.post.push({ url, init, body: JSON.parse(init.body) }); return Promise.resolve({ json: () => Promise.resolve(reply(calls.post[calls.post.length - 1].body)) }); };
async function load() { calls.load++; }
const window = {}, document = { querySelectorAll: () => [] };
const VIEWS = {};
let RAW = { Tasks: tasksTab, Review: reviewTab, Team: [['Name', 'Role'], [J, 'LM'], [A, 'LM'], [MF, 'AM, DM']] }, META = { role: 'owner', person: MF, approver: true };
function lmTeam() { return [J, A]; }
eval(viewSrc + '\n' + blockSrc);

let pass = 0, fail = 0;
const ok = (l, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + l); c ? pass++ : fail++; };
const before = (h, x, y) => h.indexOf(x) > -1 && h.indexOf(y) > -1 && h.indexOf(x) < h.indexOf(y);
const ct = name => 'tcol-h"><span>' + name + '</span>';   // a column title (a person's name also appears in the review queue)

(async function () {
  console.log('NAV + VERSIONS');
  ok('nav has ✓ TASKS', src.indexOf('<button data-v="tasks"><span class="g">✓</span>TASKS</button>') > -1);
  ok('index.html loads lm-view.js/css at ?v=45, sw.js cache clt-deck-v45', (src.match(/\?v=45/g) || []).length === 4 && src.indexOf('v=44') === -1 && fs.readFileSync(__dirname + '/sw.js', 'utf8').indexOf("'clt-deck-v45'") > -1);
  ok('load() keeps role/person/approver from the payload', src.indexOf("META={role:j.role||'',person:j.person||'',approver:j.approver===true}") > -1);

  console.log('APPROVER (Michael)');
  let v = VIEWS.tasks().html;
  ok('columns in order: Michael (private) → Jordan → Andrew → Unassigned', before(v, ct('Michael (private)'), ct(J)) && before(v, ct(J), ct(A)) && before(v, ct(A), ct('Unassigned')));
  ok('private column carries the private row (and only there)', v.indexOf('ASK-M-PRIVATE') > -1 && v.split('ASK-M-PRIVATE').length === 2 && before(v, ct('Michael (private)'), 'ASK-M-PRIVATE') && before(v, 'ASK-M-PRIVATE', ct(J)));
  ok('Michael\'s team-visible row gets its own column after the LMs', before(v, ct(A), ct(MF)) && before(v, ct(MF), 'ASK-M-TEAM'));
  const jCol = v.slice(v.indexOf(ct(J)), v.indexOf(ct(A)));   // the ask also appears in the review card above — look inside the column
  ok('Jordan column: overdue row with lead link, 1 open · 1 overdue', jCol.indexOf('ASK-J1') > -1 && jCol.indexOf('contacts/detail/c1"') > -1 && jCol.indexOf('1 open · <span class="late">1 overdue</span>') > -1 && jCol.indexOf('lm-task-due late') > -1);
  ok('Unassigned column holds ASK-U', before(v, ct('Unassigned'), 'ASK-U'));
  ok('done/skipped today collapsed per column', v.indexOf('<summary>Done / skipped today · 1</summary>') > -1 && v.indexOf('ASK-J2') > -1 && v.indexOf('ASK-A2') > -1);
  ok('row controls: ✓ done · ⏭ skip · ⇄ reassign select · ✎ note', v.indexOf(`onclick="deckTask('set_status',{task_id:'t1',status:'done'},'lmt-t1')" aria-label="Mark done">✓ done</button>`) > -1 && v.indexOf(`{task_id:'t1',status:'skipped'}`) > -1 && v.indexOf('aria-label="Reassign" onchange="deckTask(\'assign\',{task_id:\'t1\',owner:this.value}') > -1 && v.indexOf('⇄ Unassigned') > -1 && v.indexOf('⇄ ' + A) > -1 && v.indexOf('aria-label="Add a note">✎ note</button>') > -1);
  ok('review queue at the top with the 2 pending flags, newest first', before(v, 'Review queue', ct('Michael (private)')) && before(v, 'FLAG-2', 'FLAG-1') && v.indexOf('2 to review') > -1);
  ok('each flag: from · type · key · reason · note · evidence · the task\'s ask for a task item', v.indexOf('<b>' + J + '</b> · task · <span class="mono">task:t1</span> · memo ' + YDAY) > -1 && v.indexOf('wrong-ask') > -1 && v.indexOf('FLAG-1') > -1 && v.indexOf('evidence: 03:12') > -1 && v.indexOf('task: ASK-J1 overdue — Seller Alpha') > -1);
  ok('Accept / Decline with required decision note + applied_as select (fix-task · rescore · pr · reassigned · closed · none)', v.indexOf(`onclick="deckDecide('f1','accepted','lmt-flag-f1')">Accept</button>`) > -1 && v.indexOf(`deckDecide('f1','declined','lmt-flag-f1')">Decline</button>`) > -1 && v.indexOf('id="lmt-flag-f1-dn"') > -1 && ['none', 'fix-task', 'rescore', 'pr', 'reassigned', 'closed'].every(o => v.indexOf('<option value="' + o + '"') > -1));
  ok('decided flags (last 20) with a filter; both decision notes shown', v.indexOf('Decided flags') > -1 && v.indexOf('DECISION-3') > -1 && v.indexOf('DECISION-4') > -1 && v.indexOf('id="tflt-q"') > -1 && v.indexOf('fix-task:t:review:f4') > -1);
  ok('+ Add task: owner select (Unassigned + people), kind, due, priority, private toggle', v.indexOf('+ Add task') > -1 && v.indexOf('<option value="">Unassigned</option>') > -1 && v.indexOf('<option value="' + J + '">') > -1 && v.indexOf('id="tadd-kind"') > -1 && v.indexOf('id="tadd-due" class="lm-in" type="date" value="' + TODAY + '"') > -1 && v.indexOf('id="tadd-private"') > -1);

  console.log('NON-APPROVER (Ed) — even though RAW carries private rows and a Review tab');
  META = { role: 'owner', person: 'Ed Peugh', approver: false };
  v = VIEWS.tasks().html;
  ok('no private column, private row nowhere, $40,000 nowhere', v.indexOf('Michael (private)') === -1 && v.indexOf('ASK-M-PRIVATE') === -1 && v.indexOf('$40,000') === -1);
  ok('no review queue, no decided list, no flag text', v.indexOf('Review queue') === -1 && v.indexOf('Decided flags') === -1 && v.indexOf('FLAG-1') === -1 && v.indexOf('to review') === -1);
  ok('no private toggle on + Add task; columns Jordan → Andrew → Michael → Unassigned still there', v.indexOf('tadd-private') === -1 && before(v, ct(J), ct(A)) && before(v, ct(MF), ct('Unassigned')) && v.indexOf('ASK-M-TEAM') > -1);
  META = { role: '', person: '', approver: false };
  ok('old endpoint (no role field) renders as a non-approver', VIEWS.tasks().html.indexOf('Review queue') === -1 && VIEWS.tasks().html.indexOf('ASK-M-PRIVATE') === -1);
  META = { role: 'owner', person: MF, approver: true };

  console.log('NO TASKS TAB');
  const saved = RAW; RAW = { Team: saved.Team, Tasks: null, Review: null };
  ok('explains instead of throwing', VIEWS.tasks().html.indexOf('sent no Tasks tab') > -1);
  RAW = saved;

  console.log('WRITES — post(action, fields) mirrors the LM app');
  let r = await post('set_status', { task_id: 't1', status: 'done' });
  let p = calls.post[0];
  ok('POST to /exec, text/plain;charset=utf-8, redirect follow, JSON string body with token + action', r.ok && p.url === cfg.url && p.init.method === 'POST' && p.init.headers['Content-Type'] === 'text/plain;charset=utf-8' && p.init.redirect === 'follow' && p.body.token === 'michaeltok' && p.body.action === 'set_status' && p.body.task_id === 't1' && p.body.status === 'done');
  ok('ok → load() re-run once', calls.load === 1);
  reply = () => ({ ok: false, error: 'forbidden' });
  r = await deckTask('set_status', { task_id: 't3', status: 'done' }, 'lmt-t3');
  ok('server forbidden → inline error on the row, busy cleared, no reload', !r.ok && $('lmt-t3-err').textContent === 'Could not save: forbidden' && !$('lmt-t3').classList.contains('busy') && calls.load === 1);
  reply = () => ({ ok: true });
  r = await deckDecide('f1', 'accepted', 'lmt-flag-f1');
  ok('Accept without a decision note → no POST, inline error', !r.ok && calls.post.length === 2 && $('lmt-flag-f1-err').textContent.indexOf('required') > -1);
  $('lmt-flag-f1-dn').value = 'Agreed, logged the call'; $('lmt-flag-f1-ap').value = 'fix-task';
  r = await deckDecide('f1', 'accepted', 'lmt-flag-f1'); p = calls.post[2];
  ok('Accept + fix-task → decide {flag_id, decision accepted, decision_note, applied_as fix-task}', r.ok && p.body.action === 'decide' && p.body.flag_id === 'f1' && p.body.decision === 'accepted' && p.body.decision_note === 'Agreed, logged the call' && p.body.applied_as === 'fix-task');
  $('lmt-flag-f2-dn').value = 'Only one side on the transcript'; $('lmt-flag-f2-ap').value = 'pr';
  r = await deckDecide('f2', 'declined', 'lmt-flag-f2');
  ok('applied_as pr without a URL → inline error, no POST', !r.ok && calls.post.length === 3);
  $('lmt-flag-f2-pr').value = 'https://github.com/x/y/pull/9';
  r = await deckDecide('f2', 'declined', 'lmt-flag-f2'); p = calls.post[3];
  ok('Decline + pr → applied_as "pr:<url>"', r.ok && p.body.decision === 'declined' && p.body.applied_as === 'pr:https://github.com/x/y/pull/9');
  $('tadd-ask').value = 'Call the title company'; $('tadd-owner').value = A; $('tadd-kind').value = 'follow-up'; $('tadd-due').value = TODAY; $('tadd-pri').value = '1'; $('tadd-private').checked = true;
  r = await deckTaskAdd(); p = calls.post[4];
  ok('+ Add task (approver, private checked) → add_task {ask, owner, kind, due, priority, visibility owner}', r.ok && p.body.action === 'add_task' && p.body.ask === 'Call the title company' && p.body.owner === A && p.body.kind === 'follow-up' && p.body.due === TODAY && p.body.priority === '1' && p.body.visibility === 'owner');
  META = { role: 'owner', person: 'Ed Peugh', approver: false };
  r = await deckTaskAdd(); p = calls.post[5];
  ok('non-approver: the private flag is never sent even if the box were checked', r.ok && !('visibility' in p.body));
  $('tadd-ask').value = '';
  r = await deckTaskAdd();
  ok('empty ask → no POST, inline error', !r.ok && calls.post.length === 6 && $('tadd-err').textContent.indexOf('Write the task') > -1);
  $('lmt-t1-note-in').value = '  left vm 2x  ';
  r = await deckTaskNote('t1', 'lmt-t1', 'open', ''); p = calls.post[6];
  ok('✎ note → set_status open + trimmed note', r.ok && p.body.action === 'set_status' && p.body.status === 'open' && p.body.note === 'left vm 2x');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('   ! harness threw: ' + (e && e.stack || e)); process.exit(1); });
