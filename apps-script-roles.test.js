/* D1 endpoint test: role scoping, pay hidden, token + targets safety, kpi_feed.
 * Runs the REAL apps-script/Code-LM.gs and Code-owner.gs source in a vm context
 * with an in-memory SpreadsheetApp, then drives doGet end to end.
 * Contract: apps-script/README.md §5.  Run: node apps-script-roles.test.js
 * No network. Placeholder tokens only (the ones committed in the .gs files).
 *
 * FIXTURE: the header rows are the live KPI Staging headers, read 2026-10-30, and
 * the role/date/outcome cells of APPT, OFFER, CONTRACT and CLOSING are the live rows
 * named in each comment. Seller cells are the SELLER_* sentinels, and every Contact ID,
 * Opportunity ID and dollar amount is fake: no seller data and no company revenue lives
 * in this public repo. A row marked "synthetic" exists because the sheet has no real
 * example of that case yet. */
const fs = require('fs'), vm = require('vm');
const SRC = {
  lm: fs.readFileSync(__dirname + '/apps-script/Code-LM.gs', 'utf8'),
  owner: fs.readFileSync(__dirname + '/apps-script/Code-owner.gs', 'utf8')
};
const TOK = { jordan: 'SET-IN-DEPLOYED-EDITOR-JORDAN', andrew: 'SET-IN-DEPLOYED-EDITOR-ANDREW', routine: 'SET-IN-DEPLOYED-EDITOR-ROUTINE',
  michael: 'SET-IN-DEPLOYED-EDITOR-MICHAEL', ed: 'SET-IN-DEPLOYED-EDITOR-ED' };
const J = 'Jordan Mathis', A = 'Andrew Estrada', M = 'Michael Fichman', E = 'Edward Peugh';
const UNAUTH = JSON.stringify({ ok: false, error: 'unauthorized' });

/* ── stubs ── */
function fakeSheet(values) {
  return {
    _v: values.map(r => r.slice()),
    getDataRange() { const v = this._v; return { getValues() { return v.map(r => r.slice()); } }; },
    getLastRow() { return this._v.length; },
    getRange(r, c, nr, nc) { const v = this._v; return { getValues() {
      const out = []; for (let i = 0; i < nr; i++) out.push(v[r - 1 + i].slice(c - 1, c - 1 + nc)); return out; } }; }
  };
}
const fakeSS = sheets => ({ getSheetByName: n => sheets[n] || null });
function endpoint(which, sheets) {
  const ctx = {
    SpreadsheetApp: { openById: () => fakeSS(sheets), getActiveSpreadsheet: () => fakeSS(sheets) },
    ContentService: { createTextOutput(s) { return { _s: s, setMimeType() { return this; } }; }, MimeType: { JSON: 'json' } },
    console, Date, Math, JSON, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, isFinite
  };
  vm.createContext(ctx);
  vm.runInContext(SRC[which], ctx, { filename: 'Code-' + which + '.gs' });
  ctx.GET = (token, action) => JSON.parse(ctx.doGet({ parameter: action ? { token, action } : { token } })._s);
  return ctx;
}

/* ── the live headers ── */
const HEAD = {
  Leads: ['Created Date', 'Lead Source', 'Contact Name', 'Phone', 'Email', 'Property Address', 'Assigned User', 'Contact ID', 'Current Owner', '', 'Current Owner synced at'],
  Appointments: ['Confirmed Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Gap (Days)'],
  Offers: ['Offer Made Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Gap (Days)'],
  Contracts: ['Sent Date', 'Signed Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Opportunity ID',
    'Gap Sent→Sign', 'Gap Sign→Close', 'Gap Sign→Cancellation', 'Gross Assignment Fee (derived)', 'Derived-gross note (documentation only — read by nothing)'],
  Closings: ['Closed Date', 'Revenue', 'Booker (LM)', 'AM', 'DM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Gross Assignment Fee (derived)'],
  Team: ['Name', 'Role', 'Active', 'Start Date'],
  Targets: ['Metric', 'Lens', 'Person', 'Target', 'Note'],
  Tasks: ['task_id', 'date', 'owner', 'visibility', 'kind', 'lead', 'contact_id', 'opp_id', 'ask', 'why', 'source', 'due', 'priority', 'status', 'done_at', 'done_by', 'note',
    'snoozed_until', 'created_at', 'created_by', 'updated_at', 'ghl_url']
};
const SELLER = ['SELLER_NAME', 'SELLER_ADDRESS', 'SELLER_PHONE', 'SELLER_EMAIL'];

/* Appointments R80:R103. [row, confirmed, dispo, outcome, booker, am, contact] */
const APPT = [
  [80, '9/25/2026 6:25 PM', '', 'Confirmed', A, J, 'ca'], [81, '9/25/2026 2:37 PM', '', 'Confirmed', J, J, 'cb'],
  [82, '9/28/2026 3:12 PM', '', 'Confirmed', J, J, 'cc'], [83, '9/28/2026 3:10 PM', '', 'Confirmed', A, J, 'cd'],
  [84, '9/28/2026 1:18 PM', '', 'Confirmed', J, J, 'ce'], [85, '9/29/2026 2:34 PM', '', 'Confirmed', J, J, 'cc'],
  [86, '10/7/2026 10:39 AM', '', 'Confirmed', J, J, 'cf'], [87, '', '9/16/2026 5:01 PM', 'Showed', J, M, 'cg'],
  [88, '', '9/19/2026 9:51 AM', 'Showed', J, J, 'ch'], [89, '', '9/24/2026 2:01 PM', 'Showed', J, J, 'ci'],
  [90, '', '9/28/2026 11:02 AM', 'Showed', A, J, 'ca'], [91, '', '10/1/2026 11:09 AM', 'Showed', J, J, 'ce'],
  [92, '', '10/3/2026 9:41 PM', 'Showed', J, J, 'cc'], [93, '', '10/11/2026 5:23 PM', 'Showed', J, J, 'cf'],
  [94, '10/20/2026 2:20 PM', '', 'Confirmed', A, J, 'cj'], [95, '', '10/21/2026 4:53 PM', 'Showed', A, J, 'cj'],
  [96, '10/22/2026 4:52 PM', '', 'Confirmed', A, A, 'ck'], [97, '', '10/22/2026 5:49 PM', 'Cancelled', A, A, 'ck'],
  [98, '10/22/2026 5:50 PM', '', 'Confirmed', A, J, 'ck'], [99, '', '10/23/2026 1:52 PM', 'Showed', A, J, 'cl'],
  [100, '', '10/23/2026 1:52 PM', 'Showed', A, J, 'ck'], [101, '', '10/23/2026 2:11 PM', 'Showed', A, J, 'ck'],
  [102, '10/27/2026 2:26 PM', '', 'Confirmed', A, J, 'cm'], [103, '', '10/29/2026 1:03 PM', 'Showed', A, J, 'cm']
];
/* Offers: real rows, same columns as APPT. */
const OFFER = [
  [107, '7/15/2026 8:07:00', '', 'Made', J, M, 'co'], [110, '7/20/2026 15:39:00', '', 'Made', J, M, 'cp'],
  [111, '', '7/20/2026 3:51 PM', 'Declined', M, M, 'co'], [112, '', '7/20/2026', 'Declined', M, M, 'cq'],
  [113, '', '7/21/2026 12:19 PM', 'Declined', M, M, 'cp'], [191, '9/30/2026 15:17:00', '', 'Made', A, J, 'cr'],
  [192, '10/7/2026 12:46:00', '', 'Made', M, J, 'cs'], [193, '10/8/2026 9:36:00', '', 'Made', J, J, 'ct'],
  [194, '10/19/2026 10:51:00', '', 'Made', M, M, 'cu'], [195, '', '10/19/2026 10:51 AM', 'Accepted', M, M, 'cu'],
  [196, '10/28/2026 11:07:00', '', 'Made', A, J, 'ck']
];
/* Contracts: [row, sent, signed, dispo, outcome, booker, am, contact, opp, gross]. Real roles and dates, FAKE dollars: this repo is public. */
const CONTRACT = [
  [37, '6/4/2026', '', '', 'Sent', J, M, 'd1', 'o1', 1111], [38, '', '6/5/2026 18:42:58', '', 'Signed', J, M, 'd1', 'o1', 1111],
  [46, '', '', '7/17/2026 5:47 PM', 'Closed', J, M, 'd1', 'o1', 1111], [44, '', '7/3/2026 4:59 PM', '', 'Signed', J, M, 'd2', 'o2', 2222],
  [53, '', '', '8/13/2026', 'Closed', J, M, 'd2', 'o3', 2222], [60, '', '', '8/27/2026 2:11 PM', 'Closed', M, M, 'd3', 'o4', 3333],
  [64, '9/9/2026', '', '', 'Sent', A, M, 'd4', 'o5', 4444], [67, '', '10/19/2026 10:49 AM', '', 'Signed', M, J, 'cu', 'o6', 5555],
  [68, '', '9/21/2026 3:12 PM', '', 'Signed', J, M, 'cg', 'o7', 6666],
  ['synthetic-1', '', '', '9/30/2026', 'Cancelled', M, M, 'cg', 'o7', 6666],   // Michael logs the end of Jordan's deal
  ['synthetic-2', '', '', '10/2/2026', 'Cancelled', M, M, 'cu', 'o6', 5555]    // ...and of a deal Jordan is only the AM of
];
/* Closings: [row, closed, revenue, booker, am, dm, contact, gross]. Fake dollars, as above. */
const CLOSING = [
  [8, '6/15/2026 1:05 PM', 7777, M, M, M, 'd5', 7777], [9, '7/17/2026 5:48 PM', 1111, J, M, M, 'd1', 1111],
  [11, '8/14/2026 1:27 AM', 2222, J, M, M, 'd2', 2222], [12, '8/27/2026 2:11 PM', 3333, M, M, M, 'd3', 3333],
  ['synthetic-am', '10/25/2026 2:00 PM', 8888, A, J, M, 'd6', 8888],   // no live row has a Jordan AM yet
  ['synthetic-dm', '10/26/2026 2:00 PM', 9999, M, M, J, 'd7', 9999],
  ['synthetic-lm-by-contract', '10/27/2026 2:00 PM', 6666, M, M, M, 'cg', 6666]   // Booker Michael, on Jordan's LM contract
];
const apptRow = r => [r[1], r[2], r[3], r[4], r[5], ...SELLER, r[6], ''];
const contractRow = r => [r[1], r[2], r[3], r[4], r[5], r[6], ...SELLER, r[7], r[8], '', '', '', r[9], ''];
const closingRow = r => [r[1], r[2], r[3], r[4], r[5], ...SELLER, r[6], r[7]];
const pipe = (stage, contact, fee) => { const r = new Array(26).fill(''); r[0] = 'PIPELINE_NAME'; r[23] = stage; r[24] = contact; r[25] = fee; return r; };
const taskRow = o => HEAD.Tasks.map(h => o[h] == null ? '' : o[h]);

function sheets() {
  return {
    Leads: fakeSheet([HEAD.Leads,
      ['10/1/2026', 'MLS', ...SELLER, J, 'l1', A, '', ''],   // Current Owner says Andrew: Assigned User decides
      ['10/2/2026', 'MLS', ...SELLER, A, 'l2', '', '', ''],  // blank Current Owner, as every row from 333 on
      ['10/3/2026', 'MLS', ...SELLER, A, 'l3', J, '', ''],
      ['10/4/2026', 'MLS', ...SELLER, J, 'l4', '', '', '']]),
    Appointments: fakeSheet([HEAD.Appointments, ...APPT.map(apptRow)]),
    Offers: fakeSheet([HEAD.Offers, ...OFFER.map(apptRow)]),
    Contracts: fakeSheet([HEAD.Contracts, ...CONTRACT.map(contractRow)]),
    Closings: fakeSheet([HEAD.Closings, ...CLOSING.map(closingRow)]),
    Calls: fakeSheet([['Date', 'User', 'Total Calls'], ['10/1/2026', J, 12], ['10/1/2026', A, 40]]),
    'Speed to Lead': fakeSheet([['Lead Created At', 'First Call At', 'Speed (Min)', 'Lead Source', 'Contact Name', 'Phone', 'Assigned User', 'Contact ID'],
      ['10/1/2026', '10/1/2026', 5, 'MLS', 'x', 'x', A, 's1'], ['10/1/2026', '10/1/2026', 9, 'MLS', 'x', 'x', J, 's2']]),
    Team: fakeSheet([HEAD.Team, [J, 'AM, LM', 'Yes', '4/22/2026'], [M, 'Owner, DM', 'Yes', ''], [A, 'LM', 'Yes', '8/11/2026'], [E, 'Partner', 'Yes', '']]),
    Pipeline: fakeSheet([new Array(26).fill('h'), pipe('', 'd1', 1111), pipe('Under Contract', 'cg', 6666), pipe('Under Contract', 'cu', 5555), pipe('', 'd4', 4444), pipe('', 'd3', 3333)]),
    'LM Targets': fakeSheet([HEAD.Targets,
      ['calls', 'daily', J, '', 'Dials/day — TARGET_NOTE'], ['connected', 'daily', A, 43, 'Answered'], ['showRate', '', A, 0.8, 'Ratio'],
      ['', '', '', '', ''],                                   // the live tab's blank separator, R17
      ['qualifying', 'daily', '', 2, 'Everyone']]),           // synthetic: a blank-Person row
    'Goals & Assumptions': fakeSheet([['GOALS & ASSUMPTIONS', ''], ['Annual Revenue Goal ($)', 777111], ['Annual Gross Profit Goal ($)', 777222],
      ['Average Wholesale Profit Per Deal ($)', 20000], ['Lead → Appointment (%)', 0.15], ['Contract → Close', 30]]),
    Tasks: fakeSheet([HEAD.Tasks,
      taskRow({ task_id: 't:pulse:o9', owner: A, lead: 'SELLER_NAME', ask: 'TASK_ASK', why: 'TASK_WHY', status: 'open', visibility: 'team', source: 'pulse', created_by: 'routine:call-coaching' }),
      taskRow({ task_id: 't:tracker:follow-up:o8', owner: J, lead: 'SELLER_NAME', status: 'done', done_at: '2026-10-29T15:00:00.000Z', done_by: J, visibility: 'team', source: 'tracker', created_by: 'routine:call-coaching' }),
      taskRow({ task_id: 't:self:1:ab12', owner: J, lead: 'SELLER_NAME', ask: 'HAND_MADE', status: 'open', visibility: 'team', source: 'self', created_by: J })])
  };
}
const col = (tab, name) => tab[0].indexOf(name);
const rowsWhere = (tab, name, value) => tab.slice(1).filter(r => r[col(tab, name)] === value);
const tags = tab => tab.slice(1).map(r => r[col(tab, '_as')]);
const count = (a, v) => a.filter(x => x === v).length;
const oneOf = (tab, name, value) => { const m = rowsWhere(tab, name, value); return m.length === 1 ? m[0] : null; };

let pass = 0, fail = 0;
const ok = (l, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + l); c ? pass++ : fail++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const lm = endpoint('lm', sheets());
const jg = lm.GET(TOK.jordan), ag = lm.GET(TOK.andrew);

/* ═══ 1. role scoping on the real rows ═══ */
console.log('SCOPING — Appointments (real R80:R103)');
{
  const T = jg.tabs.Appointments, t = tags(T);
  ok('header is the sheet\'s, plus a trailing _as', same(T[0], HEAD.Appointments.concat(['_as'])));
  ok('Jordan: 24 rows = 10 LM,AM + 1 LM + 11 AM + 2 record', T.length === 25 && count(t, 'LM,AM') === 10 && count(t, 'LM') === 1 && count(t, 'AM') === 11 && count(t, '') === 2);
  ok('R94 (Booker Andrew, AM Jordan) is AM for Jordan, LM for Andrew',
    oneOf(T, 'Confirmed Date', '10/20/2026 2:20 PM')[col(T, '_as')] === 'AM' && oneOf(ag.tabs.Appointments, 'Confirmed Date', '10/20/2026 2:20 PM')[col(ag.tabs.Appointments, '_as')] === 'LM');
  ok('R87 (Booker Jordan, AM Michael) is LM', oneOf(T, 'Disposition Date', '9/16/2026 5:01 PM')[col(T, '_as')] === 'LM');
  ok('R96 + R97 (Andrew on both, a contact Jordan is AM of) ride along blank: record rows, not his',
    oneOf(T, 'Confirmed Date', '10/22/2026 4:52 PM')[col(T, '_as')] === '' && oneOf(T, 'Disposition Date', '10/22/2026 5:49 PM')[col(T, '_as')] === '');
  const a = ag.tabs.Appointments, at = tags(a);
  ok('Andrew: his 13 rows, R96 + R97 LM,AM, never a Jordan-booked row', a.length === 14 && count(at, 'LM,AM') === 2 && count(at, 'LM') === 11 && a.slice(1).every(r => r[col(a, 'Booker (LM)')] === A));
  ok('every tag is one of LM, AM, LM,AM or blank', [...t, ...at].every(x => ['LM', 'AM', 'LM,AM', ''].indexOf(x) > -1));
}
console.log('SCOPING — Offers (real rows)');
{
  const T = jg.tabs.Offers, by = d => (oneOf(T, 'Offer Made Date', d) || oneOf(T, 'Disposition Date', d) || [])[col(T, '_as')];
  ok('R107 (Jordan booked) LM; R193 (Jordan both) LM,AM', by('7/15/2026 8:07:00') === 'LM' && by('10/8/2026 9:36:00') === 'LM,AM');
  ok('R191 + R196 (Andrew booked, Jordan AM) AM', by('9/30/2026 15:17:00') === 'AM' && by('10/28/2026 11:07:00') === 'AM');
  ok('R192 (Michael booked, Jordan AM) AM', by('10/7/2026 12:46:00') === 'AM');
  ok('R111 + R113: Michael\'s Declined on Jordan\'s offers ships blank (the deal\'s end, not his count)', by('7/20/2026 3:51 PM') === '' && by('7/21/2026 12:19 PM') === '');
  ok('no Michael-only row outside Jordan\'s contacts ships (R112, R194, R195)', ['7/20/2026', '10/19/2026 10:51:00', '10/19/2026 10:51 AM'].every(d => by(d) === undefined));
  ok('a row Michael holds both roles on is never tagged', T.slice(1).every(r => !(r[col(T, 'Booker (LM)')] === M && r[col(T, 'AM')] === M) || r[col(T, '_as')] === ''));
}
console.log('SCOPING — Leads, Calls, Speed, edge cases');
{
  const L = jg.tabs.Leads, ids = t => t.slice(1).map(r => r[col(t, 'Contact ID')]);
  ok('Leads by Assigned User alone: Current Owner moves nothing', same(ids(L), ['l1', 'l4']) && same(ids(ag.tabs.Leads), ['l2', 'l3']));
  ok('Leads, Calls, Speed carry no _as column', ['Leads', 'Calls', 'Speed to Lead'].every(n => col(jg.tabs[n], '_as') === -1));
  ok('Calls + Speed still scoped to the caller', jg.tabs.Calls.length === 2 && jg.tabs.Calls[1][2] === 12 && jg.tabs['Speed to Lead'].length === 2 && jg.tabs['Speed to Lead'][1][2] === 9);
  const s = sheets();
  s.Appointments = fakeSheet([HEAD.Appointments, apptRow([1, '10/1/2026', '', 'Confirmed', J, M, ''])]);
  ok('a role row with a blank Contact ID still ships', endpoint('lm', s).GET(TOK.jordan).tabs.Appointments.length === 2);
  const noAM = sheets(), h = HEAD.Offers.map(x => x === 'AM' ? 'Acquisitions' : x);
  noAM.Offers = fakeSheet([h, ...OFFER.map(apptRow)]);
  const n = endpoint('lm', noAM).GET(TOK.jordan).tabs.Offers;
  ok('AM header renamed: Booker still scopes, nobody is tagged AM, no throw', n.length > 1 && tags(n).every(x => x === 'LM' || x === ''));
  const shuffled = sheets();
  shuffled.Offers = fakeSheet([HEAD.Offers.slice().reverse(), ...OFFER.map(apptRow).map(r => r.slice().reverse())]);
  const sh = endpoint('lm', shuffled).GET(TOK.jordan).tabs.Offers;
  ok('columns resolve by header name, not position', same(tags(sh).sort(), tags(jg.tabs.Offers).sort()));
}

/* ═══ 2. Team + the person's role ═══ */
console.log('TEAM + ROLE');
{
  ok('teamRole is the Team-tab Role as written', jg.teamRole === 'AM, LM' && ag.teamRole === 'LM');
  ok('role stays the endpoint\'s: lm', jg.role === 'lm' && ag.role === 'lm');
  ok('tabs.Team = header + Jordan + Andrew; Owner, DM and Partner stay out', same(jg.tabs.Team.map(r => r[0]), ['Name', J, A]));
  const s = sheets();
  s.Team = fakeSheet([HEAD.Team, ['Only AM', 'AM', 'Yes', ''], ['Slash', 'dm/am', 'Yes', ''], ['Team Lead', 'Team Lead', 'Yes', ''], ['Family', 'Family', 'Yes', ''], ['Blank', '', 'Yes', '']]);
  ok('teamRoles_: whole words, any case; "Team Lead" and "Family" are not AMs', same(endpoint('lm', s).teamRoles_(fakeSS(s)).map(r => r[0]), ['Name', 'Only AM', 'Slash']));
  const off = sheets(); off.Team = fakeSheet([HEAD.Team, [M, 'Owner, DM', 'Yes', '']]);
  ok('a person off the Team tab gets teamRole "", no throw', endpoint('lm', off).GET(TOK.jordan).teamRole === '');
  const none = sheets(); delete none.Team;
  ok('Team tab missing: tabs.Team null, teamRole "", still ok', (g => g.ok && g.tabs.Team === null && g.teamRole === '')(endpoint('lm', none).GET(TOK.jordan)));
  const noRole = sheets(); noRole.Team = fakeSheet([['Name', 'Job'], [J, 'AM, LM']]);
  ok('no Role column: visibly empty, never everyone', same(endpoint('lm', noRole).GET(TOK.jordan).tabs.Team, [['Name', 'Job']]));
}

/* ═══ 3. pay hidden: fees and money only from LM rows ═══ */
console.log('PAY HIDDEN');
{
  ok('payPlanSet false, splitRate null', jg.payPlanSet === false && jg.splitRate === null && 'splitRate' in jg);
  const on = endpoint('lm', sheets()); on.PAY_PLAN_SET = true;
  ok('flag on: payPlanSet true, the 10% ships', (g => g.payPlanSet === true && g.splitRate === 0.1)(on.GET(TOK.jordan)));
  ok('Jordan\'s fees = his LM contracts only: never cu (he is its AM), d3 (Michael\'s), d4 (Andrew\'s)', same(Object.keys(jg.fees).sort(), ['cg', 'd1']));
  ok('stages follow the same set', same(Object.keys(jg.stages).sort(), ['cg', 'd1']) && jg.stages.cg === 'Under Contract');
  ok('Andrew\'s fees = his LM contract', same(ag.fees, { d4: 4444 }));

  const K = jg.tabs.Contracts, G = col(K, 'Gross Assignment Fee (derived)');
  const signed = oneOf(K, 'Signed Date', '10/19/2026 10:49 AM');
  ok('R67 (Booker Michael, AM Jordan) ships AM with its gross blank', signed[col(K, '_as')] === 'AM' && signed[G] === '');
  const cancelledAM = oneOf(K, 'Disposition Date', '10/2/2026');
  ok('Michael\'s record row on that same AM-only deal ships blank with its gross blank', cancelledAM[col(K, '_as')] === '' && cancelledAM[G] === '');
  ok('Jordan\'s LM row keeps its gross', oneOf(K, 'Signed Date', '6/5/2026 18:42:58')[G] === 1111);
  const cancelledLM = oneOf(K, 'Disposition Date', '9/30/2026');
  ok('Michael\'s record row on Jordan\'s LM deal ships blank-tagged, gross kept (Earned reads it)', cancelledLM[col(K, '_as')] === '' && cancelledLM[G] === 6666);
  ok('R60 + R64 (no role for Jordan on that contact) do not ship', rowsWhere(K, 'Contact ID', 'd3').length === 0 && rowsWhere(K, 'Contact ID', 'd4').length === 0);

  const C = jg.tabs.Closings, R = col(C, 'Revenue'), F = col(C, 'Gross Assignment Fee (derived)'), as = col(C, '_as'), cid = id => oneOf(C, 'Contact ID', id);
  ok('Closings header gains _as, columns C/D/E read by name', same(C[0], HEAD.Closings.concat(['_as'])));
  ok('R9 + R11 are Jordan\'s LM rows with their money', cid('d1')[as] === 'LM' && cid('d1')[R] === 1111 && cid('d2')[as] === 'LM' && cid('d2')[F] === 2222);
  ok('a closing Jordan is the AM of ships AM with no dollar', cid('d6')[as] === 'AM' && cid('d6')[R] === '' && cid('d6')[F] === '');
  ok('a closing Jordan is the DM of ships DM with no dollar', cid('d7')[as] === 'DM' && cid('d7')[R] === '' && cid('d7')[F] === '');
  ok('Booker Michael on Jordan\'s LM contract keeps today\'s rule: LM, with money', cid('cg')[as] === 'LM' && cid('cg')[R] === 6666);
  ok('Michael\'s own closings never ship to Jordan (R8, R12)', !cid('d5') && !cid('d3'));
  const AC = ag.tabs.Closings;
  ok('the LM of that AM closing gets its money', oneOf(AC, 'Contact ID', 'd6')[col(AC, '_as')] === 'LM' && oneOf(AC, 'Contact ID', 'd6')[col(AC, 'Revenue')] === 8888);
  const three = sheets(); three.Closings = fakeSheet([HEAD.Closings, closingRow([1, '10/1/2026', 1234, J, J, J, 'd9', 1234])]);
  ok('all three roles join in a fixed order', oneOf(endpoint('lm', three).GET(TOK.jordan).tabs.Closings, 'Contact ID', 'd9')[as] === 'LM,AM,DM');
  const none = sheets(); delete none.Closings;
  ok('Closings tab missing: null, no throw', (g => g.ok && g.tabs.Closings === null)(endpoint('lm', none).GET(TOK.jordan)));
}

/* ═══ 4. token + targets safety ═══ */
console.log('SAFETY');
{
  ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty'].forEach(t =>
    ok('inherited name "' + t + '" is not a token, on either door', same(lm.GET(t), JSON.parse(UNAUTH)) && same(lm.GET(t, 'kpi_feed'), JSON.parse(UNAUTH))));
  ok('empty + bad token unauthorized', same(lm.GET(''), JSON.parse(UNAUTH)) && same(lm.GET('nope'), JSON.parse(UNAUTH)));
  ok('routine token still gets no scoreboard', same(lm.GET(TOK.routine), JSON.parse(UNAUTH)));
  ok('Jordan\'s targets = his row + the blank-Person rows, none of Andrew\'s', same(jg.lmTargets.map(t => t.Metric), ['calls', '', 'qualifying']));
  ok('Andrew\'s targets = his two + the blank-Person rows', same(ag.lmTargets.map(t => t.Metric), ['connected', 'showRate', '', 'qualifying']));
  ok('Andrew\'s target value is nowhere in Jordan\'s lmTargets', JSON.stringify(jg.lmTargets).indexOf('43') === -1);
  const s = sheets(); s['LM Targets'] = fakeSheet([['Metric', 'Lens', 'Who', 'Target'], ['calls', 'daily', A, 9]]);
  ok('no Person column: [], never everyone\'s', same(endpoint('lm', s).GET(TOK.jordan).lmTargets, []));
  const none = sheets(); delete none['LM Targets'];
  ok('LM Targets tab missing: []', same(endpoint('lm', none).GET(TOK.jordan).lmTargets, []));
}

/* ═══ 5. kpi_feed ═══ */
console.log('KPI_FEED — auth');
{
  const ow = endpoint('owner', sheets());
  ok('routine token on the LM /exec: ok, role routine', (f => f.ok && f.role === 'routine')(lm.GET(TOK.routine, 'kpi_feed')));
  ok('Jordan + Andrew tokens unauthorized', JSON.stringify(lm.GET(TOK.jordan, 'kpi_feed')) === UNAUTH && JSON.stringify(lm.GET(TOK.andrew, 'kpi_feed')) === UNAUTH);
  ok('owner tokens unauthorized on the LM /exec', JSON.stringify(lm.GET(TOK.michael, 'kpi_feed')) === UNAUTH && JSON.stringify(lm.GET(TOK.ed, 'kpi_feed')) === UNAUTH);
  ok('owner /exec refuses kpi_feed for Michael, Ed and the routine', [TOK.michael, TOK.ed, TOK.routine].every(t => JSON.stringify(ow.GET(t, 'kpi_feed')) === UNAUTH));
  ok('owner /exec still serves Michael without the action', ow.GET(TOK.michael).ok === true);
  ok('empty + bad token unauthorized', JSON.stringify(lm.GET('', 'kpi_feed')) === UNAUTH && JSON.stringify(lm.GET('nope', 'kpi_feed')) === UNAUTH);
  const both = endpoint('lm', sheets()); both.ROUTINE_TOKEN = TOK.jordan;
  ok('a token pasted into both slots is the LM, never the routine', JSON.stringify(both.GET(TOK.jordan, 'kpi_feed')) === UNAUTH);
  const unset = endpoint('lm', sheets()); unset.ROUTINE_TOKEN = '';
  ok('an empty ROUTINE_TOKEN opens nothing', JSON.stringify(unset.GET('', 'kpi_feed')) === UNAUTH);
  ok('an LM with some other action still gets the scoreboard, untouched', lm.GET(TOK.jordan, 'other').role === 'lm');
}
console.log('KPI_FEED — allow-list');
{
  const f = lm.GET(TOK.routine, 'kpi_feed'), wire = JSON.stringify(f);
  const EXPECT = {
    Appointments: ['Confirmed Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact ID'],
    Offers: ['Offer Made Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact ID'],
    Contracts: ['Sent Date', 'Signed Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact ID', 'Opportunity ID'],
    Closings: ['Closed Date', 'Booker (LM)', 'AM', 'DM', 'Contact ID', 'Gross Assignment Fee (derived)']
  };
  ok('the source list is exactly the agreed list', same(JSON.parse(JSON.stringify(lm.KPI_FEED_TABS)), EXPECT));
  ok('each tab ships exactly its allow-listed headers, in order', Object.keys(EXPECT).every(n => same(f.tabs[n][0], EXPECT[n])));
  const all = [].concat(...Object.values(EXPECT));
  ok('no name, phone, email or address header on any list', all.every(h => !/name|phone|email|address|property/i.test(h)));
  ok('Booker (LM), AM, DM are the only staff-name columns', all.filter(h => /booker|^am$|^dm$/i.test(h)).length === 9);
  ok('no sentinel seller cell anywhere on the wire', !/SELLER_|PIPELINE_NAME/.test(wire));
  ok('every row of every tab has the header\'s width', Object.values(f.tabs).every(t => t.slice(1).every(r => r.length === t[0].length)));
  ok('row counts: every source row ships', f.tabs.Appointments.length === APPT.length + 1 && f.tabs.Offers.length === OFFER.length + 1 && f.tabs.Contracts.length === CONTRACT.length + 1 && f.tabs.Closings.length === CLOSING.length + 1);
  ok('R94 reads through intact', same(f.tabs.Appointments[15], ['10/20/2026 2:20 PM', '', 'Confirmed', A, J, 'cj']));
  ok('Contracts carry the Opp ID and NOT the gross', f.tabs.Contracts[1][7] === 'o1' && wire.indexOf('Derived-gross') === -1);
  ok('Closings carry the fee and NOT net Revenue', f.tabs.Closings[2][5] === 1111 && wire.indexOf('Revenue') === -1);
  ok('Goals = the allow-listed keys only; no revenue or gross-profit row', same(Object.keys(f.goals).sort(), ['avgWholesaleFee', 'leadToAppt', 'velContractToClose']) && !/777111|777222/.test(wire));
  ok('LM Targets: every person, no blank separator, no Note', same(f.lmTargets.map(t => t.Metric), ['calls', 'connected', 'showRate', 'qualifying']) && same(Object.keys(f.lmTargets[1]), ['Metric', 'Lens', 'Person', 'Target']) && wire.indexOf('TARGET_NOTE') === -1);
  ok('Tasks = routine rows only, as task_id -> {status, done_at}', same(f.tasks, {
    't:pulse:o9': { status: 'open', done_at: '' }, 't:tracker:follow-up:o8': { status: 'done', done_at: '2026-10-29T15:00:00.000Z' } }));
  ok('a person\'s task and every task text stay home', !/t:self|HAND_MADE|TASK_ASK|TASK_WHY/.test(wire));
  ok('the top-level keys are exactly the documented ones', same(Object.keys(f).sort(), ['fetchedAt', 'goals', 'lastWrite', 'lmTargets', 'missing', 'ok', 'role', 'tabs', 'tasks']));

  const s = sheets(), hh = HEAD.Appointments.map(h => h === 'Contact ID' ? 'Contact Key' : h);
  s.Appointments = fakeSheet([hh, ...APPT.map(apptRow)]);
  const r = endpoint('lm', s).GET(TOK.routine, 'kpi_feed');
  ok('a renamed header is named in missing and ships nothing in its place', same(r.missing, { Appointments: ['Contact ID'] }) && same(r.tabs.Appointments[0], EXPECT.Appointments.slice(0, 5)));
  const nw = sheets();
  nw.Offers = fakeSheet([[...HEAD.Offers, 'Seller Phone 2', 'Notes'], ...OFFER.map(apptRow).map(x => [...x, 'SELLER_PHONE_2', 'SELLER_NOTES'])]);
  ok('a column inserted tomorrow never leaves (allow-list, not deny-list)', !/SELLER_/.test(JSON.stringify(endpoint('lm', nw).GET(TOK.routine, 'kpi_feed'))));
  const shuf = sheets();
  shuf.Closings = fakeSheet([HEAD.Closings.slice().reverse(), ...CLOSING.map(closingRow).map(x => x.slice().reverse())]);
  const sf = endpoint('lm', shuf).GET(TOK.routine, 'kpi_feed');
  ok('columns resolve by header name, output order is the list\'s', same(sf.tabs.Closings[2], f.tabs.Closings[2]));
}
console.log('KPI_FEED — lastWrite + missing tabs');
{
  const us = ms => { const d = new Date(ms); return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear() + ' 12:00 PM'; };
  const iso = ms => { const d = new Date(ms), z = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
  const D = 864e5, now = Date.now(), s = sheets();
  s.Closings = fakeSheet([HEAD.Closings, closingRow([1, us(now - 9 * D), 1, M, M, M, 'a', 1]), closingRow([2, us(now - 2 * D), 1, M, M, M, 'b', 1]), closingRow([3, us(now + 30 * D), 1, M, M, M, 'c', 1])]);
  s.Offers = fakeSheet([HEAD.Offers, apptRow([1, us(now - 8 * D), us(now - 3 * D), 'Declined', M, M, 'a'])]);
  s.Contracts = fakeSheet([HEAD.Contracts, contractRow([1, new Date(now - 5 * D), '', 'not a date', 'Sent', M, M, 'a', 'o', 1])]);
  s.Appointments = fakeSheet([HEAD.Appointments, apptRow([1, '', '', 'Confirmed', M, M, 'a'])]);
  const f = endpoint('lm', s).GET(TOK.routine, 'kpi_feed');
  ok('latest date in the tab; a future-dated cell is not a write', f.lastWrite.Closings === iso(now - 2 * D));
  ok('reads every date column of the tab', f.lastWrite.Offers === iso(now - 3 * D));
  ok('a real Date cell counts and ships as an ISO string; an unreadable cell is skipped', f.lastWrite.Contracts === iso(now - 5 * D) && /^\d{4}-\d{2}-\d{2}T/.test(f.tabs.Contracts[1][0]));
  ok('no readable date: null', f.lastWrite.Appointments === null);
  const b = sheets(); delete b.Offers; delete b.Tasks; delete b['LM Targets']; delete b['Goals & Assumptions'];
  const g = endpoint('lm', b).GET(TOK.routine, 'kpi_feed');
  ok('a missing tab is null, never a throw', g.ok && g.tabs.Offers === null && g.lastWrite.Offers === null && g.tasks === null && same(g.lmTargets, []) && same(g.goals, {}) && Array.isArray(g.tabs.Closings));
  const bare = endpoint('lm', {}).GET(TOK.routine, 'kpi_feed');
  ok('an empty workbook still answers ok', bare.ok && Object.values(bare.tabs).every(t => t === null));
}

/* ═══ end to end: the real rows through Code-LM.gs into the engine the phones and the nightly run ═══ */
console.log('END TO END — Code-LM.gs payload → lm-engine + lm-gamify');
{
  const ENG = require('./lm-engine.js'), GM = require('./lm-gamify.js');
  const AS_OF = '10/30/2026 12:00:00';
  const jm = GM.gamify(ENG.buildModel(jg, AS_OF)), am = GM.gamify(ENG.buildModel(ag, AS_OF));
  const y = jm.lenses.ytd, ay = am.lenses.ytd;
  const n = (rows, pred) => rows.filter(pred).length;
  ok('roles: Jordan counts deals as the AM, Andrew as the LM', jm.dealRole === 'AM' && am.dealRole === 'LM');
  ok('Jordan booked = the Confirmed rows HE booked: R94 and every Andrew- or Michael-booked row stay out',
    y.apptsBooked.current === n(APPT, r => r[3] === 'Confirmed' && r[4] === J) && y.apptsBooked.current === 5);
  ok('Jordan showed = the Showed rows he booked', y.apptsShowed.current === n(APPT, r => r[3] === 'Showed' && r[4] === J) && y.apptsShowed.current === 6);
  ok('Jordan offers = Made rows where he is the AM (R191, R192, R193, R196), his LM-era rows out',
    y.offersMade.current === n(OFFER, r => r[3] === 'Made' && r[5] === J) && y.offersMade.current === 4);
  ok('Jordan contracts = Signed rows where he is the AM', y.contractsSigned.current === n(CONTRACT, r => r[4] === 'Signed' && r[6] === J) && y.contractsSigned.current === 1);
  ok('Andrew booked + showed = his rows', ay.apptsBooked.current === n(APPT, r => r[3] === 'Confirmed' && r[4] === A) && ay.apptsShowed.current === n(APPT, r => r[3] === 'Showed' && r[4] === A));
  ok('Andrew offers = Made rows he booked', ay.offersMade.current === n(OFFER, r => r[3] === 'Made' && r[4] === A) && ay.offersMade.current === 2);
  const capped = (m, k) => ENG.LENSES.every(l => { const x = m.lenses[l][k]; return (x.current == null || x.current <= 1) && (x.bar == null || x.bar <= 1) && x.trend.every(b => b.value == null || b.value <= 1); });
  ok('Show Rate <= 100% for both, every lens, every trend bucket', capped(jm, 'showRate') && capped(am, 'showRate'));
  ok('Jordan\'s raw 6 showed on 5 booked is flagged, not hidden', y.showRate.current === 1 && y.showRate.capped === true);
  ok('appt→contract: one population (AM signed ÷ AM showed), every ratio <= 100%',
    y.apptToContract.current === 1 / n(APPT, r => r[3] === 'Showed' && r[5] === J) && ['leadToAppt', 'apptToContract', 'reached', 'attemptConnect'].every(k => capped(jm, k) && capped(am, k)));
  ok('pay: hidden for both, the 10% fallback only inside comp', jm.payPlanSet === false && am.payPlanSet === false && jm.comp.split === 0.10);
  const dn = a => a.map(d => d.name);
  ok('Jordan\'s comp: no AM deal, no AM or DM closing, no $0 rows', jm.comp.earnedDeals.length === 3 && jm.comp.earnedDeals.every(d => d.fee > 0) && jm.comp.projectedDeals.length === 0 && jm.comp.earmarkedDeals.length === 0);
  ok('...Michael\'s Cancelled on his LM deal holds (the record row stays in comp)', dn(jm.comp.projectedDeals.concat(jm.comp.earmarkedDeals)).length === 0);
  ok('Jordan\'s open offers are his LM offers, never an AM row (R191, R192, R196 out)', jm.comp.openOffers.length === 1 && jm.comp.openOffers[0].contactId === 'ct');
  ok('Andrew\'s open offers are the two he booked', am.comp.openOffers.map(o => o.contactId).sort().join() === 'ck,cr');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
