/* D2: the owner deck by role. index.html booted whole on a stub DOM, on the owner payload in both shapes: today's live one with
 * neither new tab, and a fake workbook with Role Scorecard and Deal Board. Walks every view on both, plus the stale, empty and
 * old-endpoint shapes, then runs itself again in other device time zones. No test rendered the owner home before this one.
 * Every lead, date and number is fake. The two tabs follow the agreed P4 layouts. Run: node owner-render.test.js */
const fs = require('fs'), vm = require('vm'), cp = require('child_process');
const J = 'Jordan Mathis', A = 'Andrew Estrada', MF = 'Michael Fichman', ED = 'Edward Peugh', STALE = 'source stale', UNPUB = 'Deal Board not published yet';

/* Tue 11/3/2026, 10 AM Eastern, a safe hour past the nightly and the daily sync. */
const RealDate = Date, TEN = RealDate.UTC(2026, 10, 3, 15, 0, 0), EIGHT = RealDate.UTC(2026, 10, 3, 13, 0, 0);
const pinned = t => class PinnedDate extends RealDate { constructor(...a) { if (a.length === 0) super(t); else super(...a); } static now() { return t; } };
const YDAY = '2026-11-02', STAMP = '2026-11-03T10:40:00.000Z', NIGHTLY = '2026-11-03T10:30:00.000Z';

const AH = ['Confirmed Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Gap (Days)'];
const OH = ['Offer Made Date'].concat(AH.slice(1));
const KH = ['Sent Date', 'Signed Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Opportunity ID'];
const CH = ['Closed Date', 'Revenue', 'Booker (LM)', 'AM', 'DM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID'];
const SH = ['Lead Created At', 'First Call At', 'Speed (Min)', 'Lead Source', 'Contact Name', 'Phone', 'Assigned User', 'Contact ID'];
const HS = ['Date', 'Person', 'Role', 'KPI', 'Label', 'Value', 'N', 'Target', 'Target Status', 'Vs Last Week', 'Source', 'Stale', 'Note'];
const HB = ['Opp ID', 'Lead', 'Pipeline', 'Stage', 'Days', 'Red', 'LM', 'AM', 'DM', 'Next Contact', 'Appt At', 'Value', '', 'As Of'];
const TH = ['task_id', 'date', 'owner', 'visibility', 'kind', 'lead', 'contact_id', 'opp_id', 'ask', 'why', 'source', 'due', 'priority', 'status', 'done_at', 'done_by', 'note', 'snoozed_until', 'created_at', 'created_by', 'updated_at', 'ghl_url'];
const RH = ['flag_id', 'created_at', 'from', 'item_type', 'item_key', 'item_owner', 'memo_date', 'reason', 'note', 'evidence', 'status', 'decision_note', 'decided_at', 'decided_by', 'applied_as', 'applied_at'];
const task = o => TH.map(h => { const x = Object.assign({ date: YDAY, owner: J, visibility: 'team', kind: 'coaching', source: 'pulse', due: YDAY, priority: 2, status: 'open', ask: 'ASK', created_at: NIGHTLY, created_by: 'routine:call-coaching', updated_at: NIGHTLY }, o); return x[h] == null ? '' : x[h]; });
const sc = (person, role, kpi, value, x) => HS.map(h => { const o = Object.assign({ Date: YDAY, Person: person, Role: role, KPI: kpi, Label: '', Value: value, N: 5, Target: '', 'Target Status': 'target not set', 'Vs Last Week': '', Source: 'test source', Stale: false, Note: '' }, x); return o[h] === undefined ? '' : o[h]; });
const bd = (opp, pipe, stage, days, red, value, o) => { const x = Object.assign({ lm: A, am: J, dm: MF, next: '', appt: '', stamp: '' }, o); return [opp, 'Lead ' + opp, pipe, stage, days, red, x.lm, x.am, x.dm, x.next, x.appt, value, '', x.stamp]; };
const DIS = 'Dispositions', ACQ = 'Acquisitions';

/* the owner payload's tabs today: D1's shape, neither new tab */
function liveRaw() {
  const calls = [['Date', 'User', 'Total Calls']];
  for (let i = 0; i < 10; i++) { const d = new RealDate(2026, 7, 24 + 7 * i), s = (d.getMonth() + 1) + '/' + d.getDate() + '/2026'; calls.push([s, A, 40 + i], [s, J, 10 + i]); }
  return {
    Team: [['Name', 'Role', 'Active', 'Start Date'], [J, 'AM, LM', 'Yes', '4/22/2026'], [MF, 'Owner, DM', 'Yes', ''], [A, 'LM', 'Yes', '8/11/2026'], [ED, 'Partner', 'Yes', '']],
    Leads: [['Created Date', 'Lead Source', 'Contact Name', 'Phone', 'Email', 'Property Address', 'Assigned User', 'Contact ID'],
      ['10/20/2026', 'Google Ads', 'Lead', '', '', '', A, 'c1'], ['10/21/2026', 'PPL', 'Lead', '', '', '', A, 'c2'], ['10/22/2026', 'Google Ads', 'Lead', '', '', '', A, 'c3'], ['10/23/2026', 'PPL', 'Lead', '', '', '', A, 'c4'],
      ['10/24/2026', 'Cardinal', 'Lead', '', '', '', J, 'c9'], ['10/25/2026', 'Google Ads', 'Lead', '', '', '', J, 'c8']],
    Appointments: [AH,
      ['10/20/2026 4:53 PM', '', 'Confirmed', A, J, 'S', 'P', '', '', 'c1', ''], ['10/20/2026 5:00 PM', '', 'Confirmed', A, J, 'S', 'P', '', '', 'c2', ''], ['10/21/2026 5:00 PM', '', 'Confirmed', A, MF, 'S', 'P', '', '', 'c3', ''], ['9/21/2026 5:00 PM', '', 'Confirmed', J, MF, 'S', 'P', '', '', 'c6', ''], ['', '9/22/2026 5:00 PM', 'Showed', J, MF, 'S', 'P', '', '', 'c6', ''],
      ['', '10/22/2026 1:52 PM', 'Showed', A, J, 'S', 'P', '', '', 'c1', ''], ['', '10/22/2026 1:52 PM', 'Showed', A, J, 'S', 'P', '', '', 'c1', ''], ['', '10/23/2026 2:11 PM', 'Showed', A, J, 'S', 'P', '', '', 'c2', '']],
    Offers: [OH,
      ['2026-10-01T03:30:00.000Z', '', 'Made', A, J, 'S', 'P', '', '', 'c1', ''], ['10/5/2026 9:00 AM', '', 'Made', A, J, 'S', 'P', '', '', 'c5', ''], ['10/6/2026', '', 'Made', A, MF, 'S', 'P', '', '', 'c8', ''], ['', '10/7/2026', 'Declined', MF, J, 'S', 'P', '', '', 'c1', '']],
    Contracts: [KH, ['', '10/9/2026', '', 'Signed', A, J, 'S', 'P', '', '', 'c1', 'k-op-1'], ['', '10/10/2026', '', 'Signed', A, MF, 'S', 'P', '', '', 'c8', 'k-op-2'], ['', '', '10/11/2026', 'Cancelled', A, J, 'S', 'P', '', '', 'c5', 'k-op-3']],
    Closings: [CH, ['10/20/2026', 12341, A, J, MF, 'Closed Deal', 'P', '', '', 'c8'], ['12/15/2025', 7001, A, J, MF, 'Old Partner Deal', 'P', '', '', 'c9']],
    Calls: calls,
    'Speed to Lead': [SH, ['10/20/2026', '10/20/2026', 40, 'Google Ads', 'L', '', A, 'c1'], ['10/21/2026', '10/21/2026', 5, 'PPL', 'L', '', A, 'c2']],
    'Marketing Spend': [['Month', 'Channel', 'Spend'], ['10/1/2026', 'Google Ads', 2345], ['10/1/2026', 'MLS', 1234]],
    OpEx: [['Month', 'Type', 'Monthly Cost'], ['10/1/2026', 'Cash', 111]],
    Pipeline: [['Contact Name', 'Property Address', 'Signed Date', 'Days Since Signed', 'Expected Fee', 'Contact ID', 'Status Note'], ['Tab Deal Aged', 'P', '9/1/2026', 60, 15551, 'c1', ''], ['Tab Deal New', 'P', '10/20/2026', 12, 0, 'c2', '']],
    'Goals & Assumptions': [['Metric', 'Value'], ['Annual Revenue Goal', 456789], ['Lead → Appointment %', 0.15], ['Offer → Contract %', 0.25], ['Contract → Close %', 0.7], ['Appointment → Contract %', 0.5]],
    'LM Targets': [['Metric', 'Lens', 'Person', 'Target', 'Note']],
    'Channel Map': [['Lead Source', 'Channel', 'Channel Type'], ['Google Ads', 'Google Ads', 'Paid'], ['Cardinal', 'Cardinal', 'Partner'],
      ['Channel', 'Monthly Cost', '', 'In Capital Table'], ['Google Ads', 100, '', 'yes'], ['Cardinal', 0, '', 'yes'], ['MLS', 100, '', 'yes'],
      ['Channel', 'Effective From', 'Effective To', 'Rate'], ['Cardinal', '1/1/2026', '1/31/2027', 0.3]],
    Tasks: [TH, task({ task_id: 't1', ask: 'ASK-J', opp_id: 'k1', ghl_url: 'https://app.example.test/contacts/detail/x1' }), task({ task_id: 't2', owner: A }), task({ task_id: 't3', owner: MF }), task({ task_id: 't4', owner: '' })],
    Review: [RH]
  };
}
function fullRaw() {
  const raw = liveRaw();
  raw['Role Scorecard'] = [HS,
    sc(A, 'lm', 'A1', 0.85, { Target: 0.8, 'Target Status': 'on_track', Note: '17 of 20 · 2 pending · median 12 working min · last 7 days' }),
    sc(A, 'lm', 'A2', 0, { Target: 0, 'Target Status': 'on_track' }),
    sc(A, 'lm', 'A3', 2, { Target: 0, 'Target Status': 'behind' }),
    sc(A, 'lm', 'A4', 1, { Target: 0, 'Target Status': 'weekend' }),
    sc(A, 'lm', 'A5', 3, { Date: '2026-11-01' }),               // a row behind the tab
    sc(A, 'lm', 'A6', '', { 'Target Status': 'source stale', Stale: true, Note: 'needs a touch count' }),
    sc(A, 'lm', 'A7', 0.97, { Target: 1, 'Target Status': 'behind' }),
    sc(A, 'lm', 'A8', 7),
    sc(A, 'lm', 'A10', 0.14, { Target: 0.15, 'Target Status': 'behind', Label: 'lead to contract $ words' }),   // the phone drops these words, the owner reads them
    sc(J, 'am', 'J1', 18.5, { Target: 24, 'Target Status': 'on_track' }),
    sc(J, 'am', 'J3', 0.2, { Target: 0.25, 'Target Status': 'behind', Note: 'AM credit since 9/30 · team 24%' }),
    sc(J, 'am', 'J4', 0.03, { Target: 0.05, 'Target Status': 'on_track' }),
    sc(J, 'am', 'J5', 0.6, { Target: 1, 'Target Status': 'behind' }),   // parked: must not colour, whatever the row says
    sc(J, 'am', 'J6', 2, { Target: 0, 'Target Status': 'behind' }),
    sc(J, 'am', 'J9', 0, { Target: 0, 'Target Status': 'on_track' }),
    sc(J, 'am', 'J10', 4, { Note: 'AM credit since 9/30 · team 6' }),
    sc(MF, 'owner', 'M1', 9)];
  raw['Deal Board'] = [HB,
    bd('d1', DIS, '1: Deal Analysis', 3, '', 11111, { stamp: STAMP }),
    bd('d2', DIS, '3: Marketing', 20, 'TRUE', 22222),
    bd('d3', DIS, '6: Under Contract', 50, 'TRUE', 33333),
    bd('d4', DIS, '6: Under Contract', 10, '', 44444),
    bd('d5', DIS, '3: Marketing', 1, '', ''),
    bd('o1', ACQ, '5.2: Offer Sent', 9, 'TRUE', '', { next: '11/5/2026' }),
    bd('o2', ACQ, '5.1: Offer Details', 8, '', ''),              // past 7 with Red blank: the cell decides, nothing recomputes it
    bd('k1', ACQ, '6.1 Contract For Review', 8, '', ''),         // more days than k2, no Red: the red row still leads
    bd('k2', ACQ, '6.2 Contract Sent', 6, 'TRUE', ''),
    bd('k3', ACQ, '6.3 Under Contract', 1, '', ''),
    bd('w1', ACQ, '4: Lead Appointment', 2, '', '', { am: MF })];
  return raw;
}
const payload = (raw, x) => Object.assign({ ok: true, role: 'owner', person: MF, approver: true, fetchedAt: STAMP, tasksAsOf: STAMP,
  syncStatus: { day: '2026-11-03', lastRun: '2026-11-03T08:43:44-05:00', ok: ['calls', 'pipeline', 'speed'], failed: [], covered: [] }, tabs: raw }, x);
const clone = x => JSON.parse(JSON.stringify(x));

/* index.html, the whole last script, on a stub DOM */
function deck(pay, o) {
  o = o || {};
  const Pinned = pinned(o.at || TEN), els = {}, charts = [], box = { pay };
  const el = id => (els[id] = els[id] || { id, style: {}, innerHTML: '', textContent: '', className: '', value: '', hidden: false, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } });
  const ctx = {};
  Object.assign(ctx, {
    window: ctx, self: ctx, console, Date: Pinned, Math, JSON, isFinite, isNaN, parseInt, parseFloat, Number, String, Object, Array, RegExp, Promise, URLSearchParams, Error, Intl, Set, Map,
    setInterval: () => 0, clearInterval: () => {}, setTimeout, scrollTo: () => { ctx.scrolls = (ctx.scrolls || 0) + 1; }, addEventListener: () => {}, getComputedStyle: () => ({ getPropertyValue: () => '#3FD0FF' }),
    Chart: Object.assign(function (e, conf) { charts.push(conf); return { destroy() {} }; }, { defaults: { font: {} } }),
    localStorage: { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; } },
    location: { hash: o.hash != null ? o.hash : '#e=https://script.google.com/macros/s/AKx/exec&t=tok', protocol: 'file:' }, history: { pushState() {}, replaceState() {} }, navigator: {},
    document: { getElementById: el, querySelectorAll: () => [], addEventListener: () => {}, documentElement: {}, hidden: false }
  });
  ctx.fetch = () => Promise.resolve({ json: () => Promise.resolve(clone(box.pay)) });
  vm.createContext(ctx);
  ['lm-engine.js', 'lm-gamify.js', 'lm-view.js'].forEach(f => vm.runInContext(fs.readFileSync(__dirname + '/' + f, 'utf8'), ctx, { filename: f }));
  const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
  vm.runInContext(html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>')), ctx, { filename: 'index.html#boot' });
  return { ctx, els, charts, box, view: () => el('view').innerHTML, tape: () => el('tapeInner').innerHTML, go(v, c) { charts.length = 0; ctx.go(v, c || ''); return el('view').innerHTML; }, team(p, lens, m) { ctx.lmGo(p, lens || 'week', m || ''); return el('view').innerHTML; }, run: code => vm.runInContext(code, ctx),
    reload: async p => { box.pay = p; await vm.runInContext('load()', ctx); } };
}
const boot = async (p, o) => { const P = deck(p, o); await new Promise(r => setTimeout(r, 30)); return P; };

let pass = 0, fail = 0;
const ok = (l, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + l); c ? pass++ : fail++; };
const has = (h, x) => h.indexOf(x) > -1;
const count = (h, re) => (h.match(re) || []).length;
const before = (h, x, y) => has(h, x) && has(h, y) && h.indexOf(x) < h.indexOf(y);
const cell = (h, label) => { const i = h.indexOf('sc-l">' + label + '<'); return i < 0 ? '' : h.slice(h.lastIndexOf('<button', i), h.indexOf('</button>', i)); };
const hc = (h, label) => { const i = h.indexOf('hc-l">' + label + '<'); return i < 0 ? '' : h.slice(h.lastIndexOf('<div class="hc', i), h.indexOf('</div>', i)); };
const rowOf = (h, lead) => { const i = h.search(new RegExp(lead + '(</a>)?</td>')); return i < 0 ? '' : h.slice(h.lastIndexOf('<tr', i), h.indexOf('</tr>', i)); };
const step = (h, label) => { const i = h.indexOf('f-lbl">' + label + '<'); return i < 0 ? '' : h.slice(i, h.indexOf('funnel-row', i)); };
const VIEWS = ['home', 'revenue', 'funnel', 'channels', 'pipeline', 'activity', 'profit', 'pace', 'lm', 'tasks'];
const clean = h => !/undefined(?! by construction)|NaN|\[object|RENDER ERROR|build error/.test(h);
const LM_LABELS = ['First call on time', 'Untouched leads', 'Sellers waiting on us', 'Holding past 1 hour', 'Cadence behind', '15 touches in the first 72 hours', 'Walkthroughs set', 'Lead→walkthrough', 'Dials made vs required'];
const AM_LABELS = ['Stuck in 5.1', 'Hours, 5.1 to offer', 'Offers out', 'Offer→contract', 'Next Contact current', 'MAO accuracy', 'Walkthrough status not set'];

(async function () {
  const src = fs.readFileSync(__dirname + '/index.html', 'utf8');

  console.log("TODAY'S LIVE PAYLOAD: neither new tab");
  {
    const P = await boot(payload(liveRaw())), h = P.view();
    ok('boots to a home with no throw and no broken value', has(h, 'Path to') && clean(h));
    ok('the speed tile is gone, First call on time stands in its place, and says source stale', !has(h, 'Speed to lead') && has(h, '>First call on time</div><div class="t-val stale">' + STALE + '<'));
    ok('both strips, Team order, never ranked: Jordan before Andrew, one line each, not 16 identical cells', before(h, J + ' ›', A + ' ›') && !has(h, 'sc-grid') && count(h, /class="stale">source stale<\/b> · not published yet/g) === 2);
    ok('Owner and Partner get no strip', !has(h, MF + ' ›') && !has(h, ED + ' ›'));
    ok('a name still opens the role screen', has(h, `lmGo('${A}','week','')`) && has(h, `lmGo('${J}','week','')`));
    ok('the reader\'s code reaches nobody: the tile says it in plain words', !/= tab missing/.test(h) && has(h, '= not published yet'));
    ok('something is red, so Data health leads the page, above the tiles', before(h, 'Data health', 'Revenue YTD'));
    ok('data health: Role Scorecard and Deal Board red, the rest green', has(hc(h, 'Role Scorecard'), 'hc bad') && has(hc(h, 'Role Scorecard'), STALE) && has(hc(h, 'Deal Board'), 'hc bad') && has(hc(h, 'Deal Board'), 'not published yet') && has(hc(h, 'Sync Status'), 'hc ok') && has(hc(h, 'Tasks'), 'hc ok'));
    ok('the ticker says 1ST CALL source stale in red, and no S2L', has(P.tape(), '1ST CALL <b class="dn">' + STALE + '</b>') && !has(P.tape(), 'S2L'));
    const p = P.go('pipeline');
    ok('PIPELINE works from the Pipeline tab and says what that is worth', has(p, UNPUB) && has(p, 'Tab Deal Aged') && has(p, 'reading the Pipeline tab: deals and days are live, fees as of the last daily-sync (11/3)') && has(p, 'Active pipeline'));
    ok("it never claims the fees are today's", !has(p, "today's Pipeline tab"));
    ok('PIPELINE names the sections it cannot fill', has(p, 'Dispositions by stage, presumed vs expected fee, Under Contract past 45 days, offers and contracts') && has(p, 'class="stale">' + STALE));
    ok('the doughnut still mounts', P.charts.length === 1);
    ok("no '45+ days vs the 30-day target'", !has(p, '30-day target') && !has(p, '45+ days'));
    ok('funnel, Activity, Team, Tasks, Capital all render', VIEWS.every(v => clean(P.go(v))));
    const ac = P.go('activity');
    ok('Activity: the head says source stale, Jordan\'s row says he has no first-call KPI', has(ac, 'hm-big stale">' + STALE) && has(ac, 'no first-call KPI'));
    ok('Team view: Andrew\'s role screen on the live shape', has(P.team(A), 'First call on time') && !has(P.team(A), 'Offers Made'));
    ok('Team view: Jordan\'s role screen on the live shape', has(P.team(J), 'Stuck in 5.1') && !has(P.team(J), 'Lead→walkthrough'));
  }

  console.log('A FAKE WORKBOOK WITH BOTH TABS');
  const F = await boot(payload(fullRaw()));
  {
    ok('no throw, no broken value on any view', VIEWS.every(v => clean(F.go(v))));
    const home = F.go('home');
    ok('A1 on the tile: the value, green, the Note verbatim', has(home, '<div class="t-val gr">85%</div>') && has(home, '= 17 of 20 · 2 pending · median 12 working min · last 7 days'));
    ok('ticker: 1ST CALL 85% up, and no S2L', has(F.tape(), '1ST CALL <b class="up">85%</b>') && !has(F.tape(), 'S2L'));
    ok('strips in Team order', before(home, J + ' ›', A + ' ›'));
    ok('a name goes to the role screen, a cell to its KPI', has(home, `lmGo('${A}','week','')`) && has(home, `lmGo('${J}','week','kpi-J6')`));
    ok('a real 0 stays 0', has(cell(home, 'Untouched leads'), 'sc-v">0<'));
    ok('on_track is green, behind is red, each with its target', has(cell(home, 'First call on time'), 'lm-ahead') && has(cell(home, 'First call on time'), '🎯 80%') && has(cell(home, 'Sellers waiting on us'), 'lm-behind'));
    ok('D-6: weekend is uncoloured', has(cell(home, 'Holding past 1 hour'), 'sc lm-none') && has(cell(home, 'Holding past 1 hour'), 'weekend'));
    ok('a row behind the tab says source stale, no old number', has(cell(home, 'Cadence behind'), STALE) && !has(cell(home, 'Cadence behind'), 'sc-v">3'));
    ok('a row marked stale says source stale', has(cell(home, '15 touches in the first 72 hours'), STALE));
    ok('all green: Data health sits at the foot, below the strips', before(home, 'Scorecards', 'Data health') && before(home, 'Revenue YTD', 'Data health'));
    ok('D-10: J3 and J10 carry their label and the team rate on the strip, from the Note', has(cell(home, 'Offer→contract'), 'sc-n">AM credit since 9/30 · team 24%<') && has(cell(home, 'Offers out'), 'sc-n">AM credit since 9/30 · team 6<'));
    ok('...and no other cell does', !has(cell(home, 'First call on time'), 'sc-n') && !has(cell(home, 'Stuck in 5.1'), 'sc-n'));
    ok('A9 has no row and is not on the tile set; no KPI invents a tile', !has(home, 'LM-Law'));
    ok('the owner reads the routine\'s words whole', has(home, 'sc-l">lead to contract $ words<'));
    ok('J5: no colour, no target, whatever the row says', has(cell(home, 'Next Contact current'), 'sc lm-none') && has(cell(home, 'Next Contact current'), 'target not set') && !has(cell(home, 'Next Contact current'), '🎯'));
    ok('a number from the routine stays in its format', has(cell(home, 'Hours, 5.1 to offer'), '18.5 h') && has(cell(home, 'Offer→contract'), '20%'));
    ok('data health all green, with the dates', has(hc(home, 'Sync Status'), 'hc ok') && has(hc(home, 'Sync Status'), '11/3') && has(hc(home, 'Role Scorecard'), 'as of 11/2') && has(hc(home, 'Deal Board'), 'as of 11/3') && has(hc(home, 'Deal Board'), '11 deals') && has(hc(home, 'Tasks'), 'nightly 11/3'));
    ok('the old PIPE tile and ticker still read the Pipeline tab', has(home, '>$15,551<') && has(F.tape(), 'PIPE'));
  }

  console.log("P4'S REAL SHAPES ON THE OWNER'S SCREENS");
  {
    const real = fullRaw(), row = id => real['Role Scorecard'].findIndex(r => r[3] === id);
    real['Role Scorecard'][row('A6')] = sc(A, 'lm', 'A6', 1, { N: 2 }); real['Role Scorecard'][row('J5')] = sc(J, 'am', 'J5', 0.071, { N: 14 });
    let h = (await boot(payload(real))).view();
    ok('A6 at 1 reads 100%, J5 at 0.071 reads 7%', has(cell(h, '15 touches in the first 72 hours'), 'sc-v">100%<') && has(cell(h, 'Next Contact current'), 'sc-v">7%<'));
    const staleJ3 = fullRaw(); staleJ3['Role Scorecard'][staleJ3['Role Scorecard'].findIndex(r => r[3] === 'J3')] = sc(J, 'am', 'J3', '', { 'Target Status': 'source stale', Stale: true, Note: 'AM credit since 9/30 · team 24%' });
    h = (await boot(payload(staleJ3))).view();
    ok('a stale J3 prints no Note: its team figure is not today\'s', has(cell(h, 'Offer→contract'), STALE) && !has(cell(h, 'Offer→contract'), 'sc-n'));
    const nil = fullRaw(); nil['Role Scorecard'][1] = sc(A, 'lm', 'A1', '', { N: 0, Target: 0.8, 'Target Status': 'on_track', Note: '0 of 0 · 0 pending · last 7 days' });
    nil['Role Scorecard'][nil['Role Scorecard'].findIndex(r => r[3] === 'A7')] = sc(A, 'lm', 'A7', '', { N: 0, Note: 'no dials required that day' });
    const P = await boot(payload(nil)), n = P.view();
    ok('P4\'s null: a dash on the home tile, no colour, the Note, never source stale', has(n, '<div class="t-val ">—</div>') && has(n, '= 0 of 0 · 0 pending · last 7 days') && !has(n.slice(n.indexOf('First call on time'), n.indexOf('Awaiting value')), STALE));
    ok('...a dash in the strip, no colour, its status word', has(cell(n, 'First call on time'), 'sc lm-none') && has(cell(n, 'First call on time'), 'sc-v">—<') && has(cell(n, 'First call on time'), 'on track'));
    ok('...and the ticker neutral, not a red source stale', has(P.tape(), '1ST CALL <b class="">—</b>'));
    ok('...while Data health is green beside it: nothing false to chase', has(hc(n, 'Role Scorecard'), 'hc ok') && !has(n, 'class="stale">source stale'));
    const ac = P.go('activity');
    ok('Activity: the head a dash, the diagnosis says nothing to measure, not a rate with no number', has(ac, '<span class="hm-big">—</span>') && has(ac, 'First call on time: nothing to measure') && !has(ac, 'First call on time <b class="m">—'));
    ok('the Role row: a dash and the Note', has(ac, '<b class="m">—</b><br>0 of 0 · 0 pending') && !has(ac, 'class="wrap fit late"'));
    const txt = fullRaw(); txt['Role Scorecard'][1] = sc(A, 'lm', 'A1', '#N/A', { Target: 0.8, 'Target Status': 'on_track' });
    const T = await boot(payload(txt));
    ok('text in Value is stale, on the tile, the strip and the ticker, never green', has(T.view(), '<div class="t-val stale">' + STALE) && has(cell(T.view(), 'First call on time'), 'sc lm-stale') && has(T.tape(), '1ST CALL <b class="dn">' + STALE) && !has(T.view(), '#N/A'));
    const words = fullRaw(); words['Role Scorecard'] = words['Role Scorecard'].map((r, i) => i ? ['2026-10-26', ...r.slice(1)] : r);
    const W = await boot(payload(words));
    ok('a stale tab: each person\'s line says how old it is', count(W.view(), /class="stale">source stale<\/b> · last run 10\/26/g) === 2);
    ok('...and the tile', has(W.view(), '= last run 10/26'));
    ok('...and a KPI page opened by hash', has(W.team(A, 'week', 'kpi-A1'), 'last run 10/26'));
  }

  console.log('DATA HEALTH');
  {
    const at = async (x, o, raw) => (await boot(payload(raw || fullRaw(), x), o)).view();
    let h = await at({ syncStatus: { day: '2026-11-02', ok: ['calls'], failed: [], covered: [] } });
    ok('a sync from yesterday is source stale at 10 AM', has(hc(h, 'Sync Status'), 'hc bad') && has(hc(h, 'Sync Status'), STALE) && has(hc(h, 'Sync Status'), 'last ran 11/2'));
    h = await at({ syncStatus: { day: '2026-11-02', ok: ['calls'], failed: [], covered: [] } }, { at: EIGHT });
    ok('and fine at 8 AM, before the run', has(hc(h, 'Sync Status'), 'hc ok'));
    h = await at({ syncStatus: { day: '2026-11-03', ok: ['calls'], failed: ['speed', '<b>x</b>'], covered: [] } });
    ok('a step that failed with no pass is red, by name, escaped', has(hc(h, 'Sync Status'), 'hc bad') && has(hc(h, 'Sync Status'), STALE) && has(hc(h, 'Sync Status'), 'failed: speed') && has(hc(h, 'Sync Status'), '&lt;b&gt;') && !has(h, '<b>x</b>'));
    h = await at({ syncStatus: { day: '2026-11-03', ok: ['calls', 'pipeline', 'speed'], failed: [], covered: ['speed'] } });
    ok('a step covered by the fallback stays in view, amber', has(hc(h, 'Sync Status'), 'hc warn') && has(hc(h, 'Sync Status'), 'failed, then covered: speed'));
    h = await at({ syncStatus: { day: '2027-11-03', ok: ['calls'], failed: [], covered: [] } });
    ok('a day after today is a mistyped row: source stale, with the year lmMD would drop', has(hc(h, 'Sync Status'), 'hc bad') && has(hc(h, 'Sync Status'), STALE) && has(hc(h, 'Sync Status'), '2027-11-03'));
    const noteOf = async s => (await boot(payload(liveRaw(), { syncStatus: s }))).go('pipeline');
    let n = await noteOf({ day: '2026-10-30', ok: ['pipeline'], failed: [], covered: [] });
    ok('PIPELINE: a sync that has not run says so, in the note, not today', has(n, 'fees as of the last daily-sync (<b class="stale">source stale · last ran 10/30') && !has(n, "today's"));
    n = await noteOf({ day: '2026-11-03', ok: ['calls'], failed: ['pipeline'], covered: [] });
    ok('PIPELINE: a run that failed its pipeline step says that', has(n, 'source stale · 11/3 failed: pipeline'));
    h = await at({ syncStatus: null });
    ok('no sync summary is source stale', has(hc(h, 'Sync Status'), 'hc bad') && has(hc(h, 'Sync Status'), STALE));
    const old = fullRaw(); old.Tasks = [TH, task({ task_id: 't1', updated_at: '2026-10-30T10:30:00.000Z' })];
    h = await at({}, {}, old);
    ok('tasksAsOf is fresh on every GET, so an old nightly write still reads source stale', has(hc(h, 'Tasks'), 'hc bad') && has(hc(h, 'Tasks'), STALE) && has(hc(h, 'Tasks'), 'nightly last wrote 10/30'));
    const touched = fullRaw(); touched.Tasks = [TH, task({ task_id: 't1', updated_at: '2026-10-30T10:30:00.000Z' }), task({ task_id: 't2', status: 'done', updated_at: STAMP }), task({ task_id: 't3', created_by: J, updated_at: STAMP })];
    h = await at({}, {}, touched);
    ok('a person closing a routine row or writing their own does not pass for a nightly', has(hc(h, 'Tasks'), 'hc bad') && has(hc(h, 'Tasks'), 'nightly last wrote 10/30'));
    const none = fullRaw(); none.Tasks = null;
    h = await at({}, {}, none);
    ok('no Tasks tab is source stale, not a throw', has(hc(h, 'Tasks'), 'hc bad') && has(hc(h, 'Tasks'), 'tab missing'));
    const pre = payload(liveRaw()); delete pre.syncStatus; delete pre.tasksAsOf; delete pre.fetchedAt; pre.tabs.Tasks = null; pre.tabs.Review = null;
    const P = await boot(pre);
    ok('the owner endpoint before D2: all four read source stale, every view renders', ['Sync Status', 'Role Scorecard', 'Deal Board', 'Tasks'].every(l => has(hc(P.view(), l), STALE)) && VIEWS.every(v => clean(P.go(v))));
  }

  console.log('PIPELINE ON DEAL BOARD');
  {
    const p = F.go('pipeline');
    ok('no not-published note', !has(p, UNPUB));
    ok('Value sits right after Deal, on a phone it is on screen with no swipe', /<th>Deal<\/th><th class="num">Value<\/th><th class="num">Days<\/th><th>LM<\/th><th>AM<\/th><\/tr>/.test(p) && /<th>Deal<\/th><th class="num">Value<\/th><th>Stage<\/th>/.test(p));
    ok('Dispositions drops its DM column: Michael is the only DM', !/<th>DM<\/th>/.test(p) && has(p, 'colspan="5"'));
    ok('the Deal cell wraps', has(p, '<td class="deal">Lead d1'));
    ok('Dispositions by stage, in stage order, each stage once', before(p, '1: Deal Analysis', '3: Marketing') && before(p, '3: Marketing', '6: Under Contract') && count(p, /class="grp"/g) === 3);
    ok('each stage says presumed or expected, from the stage number', /3: Marketing · 2 · \$22,222 <span class="pill a">presumed/.test(p) && /6: Under Contract · 2 · \$77,777 <span class="pill g">expected/.test(p));
    ok('the head is the expected fee, presumed beside it', has(p, '<span class="hm-big">$77,777</span>') && has(p, 'presumed <b>$33.3K</b> · 3 before UC'));
    ok('presumed vs expected card: presumed adds 2 of 3, the blank is unvalued and not a $0', has(p, '3 deals · 1 unvalued') && has(p, '>$33,333</div>') && has(rowOf(p, 'Lead d5'), 'unvalued'));
    ok('an Acquisitions row has no fee to set, so it is never called unvalued', !has(rowOf(p, 'Lead o1'), 'unvalued') && !has(rowOf(p, 'Lead k1'), 'unvalued'));
    ok('UC past 45 days: the row, its fee, and the current split', has(p, 'Under Contract past 45 days') && has(p, '1 deal · $33,333 of the expected fee') && has(p, '>$44,444</div>'));
    ok('red comes from the Red cell: 9 days red, 8 days past the same line not', has(rowOf(p, 'Lead o1'), 'class="num late">9') && has(rowOf(p, 'Lead o2'), 'class="num">8'));
    ok('dispo red past 14 and contract red past 5 as the cell says', has(rowOf(p, 'Lead d2'), 'class="num late">20') && has(rowOf(p, 'Lead k2'), 'class="num late">6'));
    ok('offers hold stage 5, Acquisitions stage 6 is contracts and never Dispositions', before(p, '>Offers</h3>', 'Lead o1') && before(p, '>Contracts</h3>', 'Lead k1') && before(p, 'Lead o1', '>Contracts</h3>'));
    ok('6.3 shows: every tracker contract row, not only 6.1 and 6.2', before(p, '>Contracts</h3>', 'Lead k3') && before(p, 'Lead k3', 'Walkthroughs and other'));
    ok('red rows lead their section, then the most days', before(p, 'Lead o1', 'Lead o2') && before(p, 'Lead k2', 'Lead k1') && before(p, 'Lead k1', 'Lead k3'));
    ok('a stage 4 row is not dropped', has(p, 'Walkthroughs and other') && has(p, 'Lead w1'));
    ok('every board row is on the page', ['d1', 'd2', 'd3', 'd4', 'd5', 'o1', 'o2', 'k1', 'k2', 'k3', 'w1'].every(x => has(p, 'Lead ' + x)));
    ok('Next Contact is plain text, no colour', has(rowOf(p, 'Lead o1'), '<td>11/5</td>'));
    ok('a Tasks row on the same opportunity lends its link, others are plain', has(p, 'href="https://app.example.test/contacts/detail/x1" target="_blank" rel="noopener">Lead k1</a>') && !has(rowOf(p, 'Lead k2'), '<a '));
    ok('the Pipeline tab stays, under its own label', has(p, 'Pipeline tab') && has(p, 'Tab Deal Aged'));
    ok('diagnosis counts the reds, the old UC and the unvalued', has(p, '<b class="m">2</b> Dispositions · <b class="m">1</b> offers · <b class="m">1</b> contracts') && has(p, 'past 45 days carries <b class="m">$33,333</b>') && has(p, 'Dispositions deal unvalued'));
    ok("no '45+ days vs the 30-day target'", !has(p, '30-day target'));

    const raw = fullRaw(); raw['Deal Board'][1][13] = '2026-10-30T10:40:00.000Z';
    const S = await boot(payload(raw)), s = S.go('pipeline');
    ok('a stale board withholds its rows and is not called unpublished', has(s, 'Deal Board ' + STALE + ' · as of 10/30') && !has(s, UNPUB) && !has(s, 'Lead d1') && has(s, 'Tab Deal Aged'));
    const noStamp = fullRaw(); noStamp['Deal Board'][1][13] = '';
    const NS = await boot(payload(noStamp));
    ok('no stamp says so', has(NS.go('pipeline'), 'Deal Board ' + STALE + ' · no as-of') && !has(NS.go('pipeline'), 'Lead d1'));
    const empty = fullRaw(); empty['Deal Board'] = [HB];
    const E = await boot(payload(empty));
    ok('a header-only tab is not published yet', has(E.go('pipeline'), UNPUB));
    const ph = fullRaw(); ph['Deal Board'] = [HB, ['', '', '', '', '', '', '', '', '', '', '', '', '', STAMP]];
    const PH = await boot(payload(ph));
    ok('the N2 stamp alone is no phantom deal', has(PH.go('pipeline'), UNPUB));
    const renamed = (from, to) => { const raw = fullRaw(); raw['Deal Board'][0] = raw['Deal Board'][0].map(c => c === from ? to : c); return raw; };
    for (const [from, to] of [['Red', 'Late'], ['Pipeline', 'Pipe'], ['Value', 'Fee'], ['Days', 'Days In Stage'], ['Stage', 'Stage Name'], ['Opp ID', 'Opp Id']]) {
      const B = await boot(payload(renamed(from, to))), b = B.go('pipeline');
      ok(from + ' renamed: PIPELINE says the board is stale and names why, never an all-clear', has(b, 'Deal Board ' + STALE + ' · header changed') && !has(b, 'Lead d1') && !has(b, 'past its red line') && !has(b, 'Nothing past') && !has(b, '$0 expected'));
      ok('...and Data health goes red', has(hc(B.go('home'), 'Deal Board'), 'hc bad') && has(hc(B.view(), 'Deal Board'), 'header changed'));
    }
    const nasty = fullRaw(); nasty['Deal Board'][2][1] = '<img src=x onerror=1>'; nasty['Deal Board'][2][3] = '__proto__ & co';
    const N = await boot(payload(nasty)), nh = N.go('pipeline');
    ok('sheet text is escaped, and a stage name cannot reach the prototype', !has(nh, '<img') && has(nh, '&lt;img') && has(nh, '__proto__ &amp; co'));
    const txt = fullRaw(); txt['Deal Board'][1][11] = '$11,111'; txt['Deal Board'][2][11] = 'TBD';
    const T = await boot(payload(txt)), th = T.go('pipeline');
    ok('a dollar string reads, text is unvalued, never a 0 passed off', has(rowOf(th, 'Lead d1'), '$11,111') && has(rowOf(th, 'Lead d2'), 'unvalued'));
  }

  console.log('FUNNEL, SPLIT AT THE HANDOFF');
  {
    const f = F.go('funnel');
    ok('one card per lane, Team order, people from Team', before(f, 'Jordan · AM · walkthrough → offer → contract', 'Andrew · LM · lead → walkthrough'));
    const lane = (h, a, b) => h.slice(h.indexOf(a), b ? h.indexOf(b) : undefined);
    const am = lane(f, 'Jordan · AM', 'Andrew · LM'), lm = f.slice(f.indexOf('Andrew · LM'), f.indexOf('Volume cascade'));
    ok('Andrew by Booker (LM): 4 leads, 3 set, 2 showed once each', has(lm, 'Leads<b>4</b>') && has(lm, 'Walkthroughs set<b>3</b>') && has(lm, 'Showed<b>2</b>') && has(step(lm, 'Walkthroughs set'), '<b>75.0%</b>') && has(step(lm, 'Showed') || lm.slice(lm.indexOf('f-lbl">Showed<')), '<b>66.7%</b>'));
    ok('Jordan by the AM column: the row AM = Michael is not his', has(am, 'Walkthroughs<b>2</b>') && has(am, 'Offers<b>2</b>') && has(am, 'Contracts<b>1</b>'));
    ok('a rate joins on the contact: a phone offer has no walkthrough, so 50% and not 100%', has(step(am, 'Offers'), '<b>50.0%</b>') && has(am, '1 offer with no walkthrough on file'));
    ok('offer→contract joins the same way', has(am.slice(am.indexOf('f-lbl">Contracts<')), '<b>50.0%</b>'));
    ok('D-10: the label is computed, on the sheet\'s clock, with the team rate alongside', has(am, 'AM credit since 9/30') && has(am, 'team offer→contract 66.7%'));
    ok('the company view stays', has(f, 'Volume cascade') && has(f, 'Ranked repair list'));
    ok('the stale claim is gone at both sites', !has(f, 'parallel') && !has(f, 'without a sit'));
  }

  console.log('A RENAMED COLUMN ON THE LANES');
  {
    const ren = (tab, from, to) => { const raw = fullRaw(); raw[tab][0] = raw[tab][0].map(c => c === from ? to : c); return raw; };
    const fun = async raw => (await boot(payload(raw))).go('funnel');
    const lane = (f, who) => { const i = f.indexOf(who); return f.slice(i, f.indexOf('</div>', f.indexOf('</p>', i))); };
    for (const [tab, from, to, who, name] of [['Appointments', 'Booker (LM)', 'Booker', 'Andrew · LM', 'Appointments: no Booker (LM) column'], ['Appointments', 'Outcome', 'Offer Outcome', 'Andrew · LM', 'Appointments: no Outcome column'], ['Offers', 'AM', 'Acquisition Manager', 'Jordan · AM', 'Offers: no AM column'], ['Offers', 'Outcome', 'outcome', 'Jordan · AM', 'Offers: no Outcome column'], ['Contracts', 'Outcome', 'Status', 'Jordan · AM', 'Contracts: no Outcome column'], ['Offers', 'Contact ID', 'Contact', 'Jordan · AM', 'Offers: no Contact ID column']]) {
      const f = await fun(ren(tab, from, to)), l = lane(f, who);
      ok(tab + ' ' + from + ' renamed: that lane says source stale and names the column, no 0s', has(l, STALE) && has(l, name) && !has(l, 'f-lbl'));
    }
    const noOffers = fullRaw(); delete noOffers.Offers;
    ok('a tab that is gone says so', has(lane(await fun(noOffers), 'Jordan · AM'), 'Offers tab missing'));
    const head = fullRaw(); head.Offers = [head.Offers[0]];
    const f = await fun(head);
    ok('a header-only tab stays a real 0: the row count cannot tell the two apart, the header can', has(f, 'Offers<b>0</b>') && !has(lane(f, 'Jordan · AM'), STALE));
    ok('the other lane stands', has(await fun(ren('Offers', 'AM', 'Acq')), 'Walkthroughs set<b>3</b>'));
  }

  console.log('A LENS TAP STAYS PUT');
  {
    const P = await boot(payload(fullRaw()));
    P.go('lm', ''); P.ctx.scrolls = 0;
    P.ctx.lmGo(J, 'month', '');
    ok('first landing on Team, person blank in the route: a lens tap on the default person stays', P.ctx.scrolls === 0);
    P.team(A, 'week', ''); P.ctx.scrolls = 0;
    P.team(A, 'month', '');
    ok('a lens tap on the same person stays', P.ctx.scrolls === 0);
    P.team(J, 'month', '');
    ok('the picker changes the person: to the top', P.ctx.scrolls === 1);
    P.team(J, 'month', 'kpi-J3');
    ok('a new page: to the top', P.ctx.scrolls === 2);
    P.go('home');
    ok('every other route still does', P.ctx.scrolls === 3);
  }

  console.log('ACTIVITY');
  {
    const a = F.go('activity');
    ok('head: A1 %, ≤30 working min', has(a, '<span class="hm-big">85%</span>') && has(a, 'first call on time · ≤30 working min · Andrew'));
    ok('per role: Andrew\'s % and median, Jordan has no first-call KPI', before(a, J, A) && has(a, 'median 12 working min') && has(a, 'no first-call KPI'));
    ok('Jordan\'s calls are labelled AM calls, Andrew\'s stay dials', has(a, "Jordan's AM calls") && has(a, "Andrew's dials") && !has(a, "Jordan's dials"));
    const c1 = F.charts.find(c => c.type === 'line'), labels = c1.data.datasets.map(d => d.label);
    ok('the chart labels him too, from Team', labels.indexOf(J + ' · AM calls') > -1 && labels.indexOf(A) > -1);
    ok('the old speed lines and the hard-coded CPL are gone', !has(a, 'industry contact-rate') && !has(a, 'Priority inversion') && !has(a, 'Triage holds') && !has(a, 'CPL) are being reached') && !has(a, 'fastest dots'));
    ok('the legacy column keeps saying first dial, never calls + texts', has(a, 'First dial by source, calls only') && has(a, 'minutes to first dial, calls only'));
    ok('A1 in the diagnosis', has(a, 'First call on time <b class="m">85%</b> inside 30 working minutes'));
  }

  console.log('TEAM, TASKS, CAPITAL');
  {
    ok('the nav says TEAM and still routes lm', has(src, '<button data-v="lm"><span class="g">⊞</span>TEAM</button>'));
    const a = F.team(A), j = F.team(J);
    ok('Andrew opens his LM screen: no Offers or Contracts tile and no $', has(a, 'First call on time') && !has(a, 'Offers Made') && !has(a, '>Contracts<') && !has(a, 'Appt→Contract') && !has(a.replace(/\$\{/g, ''), '$'));
    ok('Jordan opens his AM screen', AM_LABELS.every(l => has(j, 'lm-t-lbl">' + l + '<')));
    ok('his Deals count equals the board rows with AM = Jordan', has(j, 'Deals &amp; Pipeline — 10 deals →'));
    ok('a saved KPI link from a strip opens on the Team view', has(F.team(A, 'week', 'kpi-A1'), 'median 12 working min'));
    ok('the owner\'s preview keeps the Source line the phones drop', has(F.team(A, 'week', 'kpi-A1'), 'Source: test source.'));
    const raw = F.box.pay.tabs;
    const scoped = F.run('scopeToLM')(raw, J), countAM = scoped.tabs['Deal Board'].slice(1).filter(r => String(r[11]).split(',').indexOf('AM') > -1).length;
    ok('and the scoper agrees', countAM === 10);
    const t = F.go('tasks');
    const head = n => { const i = t.indexOf('tcol-h"><span>' + n + '</span>'); return i < 0 ? '' : t.slice(i, t.indexOf('</div>', i)); };
    ok('columns are labelled by lane: AM wins on AM, LM, Owner on Owner, DM', has(head(J), 'pill c">AM<') && has(head(A), 'pill c">LM<') && has(head(MF), 'pill c">Owner<') && has(head('Michael (private)'), 'pill c">Owner<'));
    ok('Unassigned has no lane', !has(head('Unassigned'), 'pill'));
    const c = F.go('channels');
    ok('partner panel: LM split: pay plan not set, no figure', has(c, 'LM split: pay plan not set') && !has(c, 'after the LM') && !has(c, '% of gross ('));
    ok('the rate-error branch still lists a close no term covers', has(c, 'Excluded from the money above') && has(c, 'Old Partner Deal'));
    ok('no June start line', !has(c, 'June start') && has(c, '<b>MLS</b>'));
    const P = await boot(payload(liveRaw()));
    ok('a rate edit wins on the next refresh, the table does not grow', P.run('PARTNER_RATES.length') === 1);
    const edited = liveRaw(); edited['Channel Map'][8][3] = 0.4;
    await P.reload(payload(edited));
    ok('  (edit landed)', P.run('PARTNER_RATES.length') === 1 && P.run("partnerRate('Cardinal',new Date(2026,5,1)).rate") === 0.4);
    const off = liveRaw(); off['Channel Map'].splice(2, 1); off['Channel Map'].pop();
    await P.reload(payload(off));
    ok('a row taken off the tab stops applying', P.run("Object.keys(PARTNER_CH).length") === 0 && P.run('PARTNER_RATES.length') === 0 && P.run("!!CAPITAL_CH['MLS']") === true);
    const gone = liveRaw(); delete gone['Channel Map'];
    await P.reload(payload(gone));
    ok('a tab that stops being served says so, and the seed map stays', has(P.go('channels'), 'Channel Map tab not served') && P.run('Object.keys(CAPITAL_CH).length') === 0 && P.run("CHANNEL_MAP['Google Ads']") === 'Google Ads');
  }

  console.log('RENAMED ED, A NON-APPROVER');
  {
    const P = await boot(payload(fullRaw(), { person: ED, approver: false }));
    ok('Edward Peugh: every view renders, and he holds no lane', VIEWS.every(v => clean(P.go(v))) && !has(P.go('home'), ED + ' ›') && !has(P.go('tasks'), 'pill c">Partner'));
    ok('no private column for him', !has(P.go('tasks'), 'Michael (private)'));
  }

  console.log('A TEAM TAB WITH NO ROWS');
  {
    const raw = liveRaw(); raw.Team = [];
    const P = await boot(payload(raw));
    ok('the home renders with no strip, and Team says so', has(P.view(), 'Path to') && !has(P.view(), 'Scorecards') && has(P.go('lm'), 'No LM or AM found'));
    ok('every view renders', VIEWS.every(v => clean(P.go(v))));
  }

  console.log('NOTHING LEFT BEHIND');
  ['speedAvg', 'LM_SPLIT', 'netAfterLm', 'chLmCut', 'lmCut', 'June start', 'paid, ~', 'Priority inversion', 'Triage holds', '30-day target', 'without a sit', 'since 10/19', "'S2L'"].forEach(x => ok(x + ' is gone from index.html', !has(src, x)));
  ok('the local capital test keeps its two lifted functions', has(src, 'function partnerRate(') && has(src, 'function contribPerDeal('));

  /* A date cell reaches JSON as a UTC instant and neither clock here is the device's */
  if (!process.env.OWNER_RENDER_TZ) {
    console.log('THE SAME, ON A DEVICE IN ANOTHER ZONE');
    ['America/Los_Angeles', 'Pacific/Honolulu', 'Asia/Tokyo'].forEach(tz => {
      const r = cp.spawnSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { TZ: tz, OWNER_RENDER_TZ: '1' }), encoding: 'utf8' });
      if (r.status) console.log(r.stdout.split('\n').filter(l => /✗|!/.test(l)).join('\n'));
      ok(tz + ': every check above', r.status === 0);
    });
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('   ! harness threw: ' + (e && e.stack || e)); process.exit(1); });
