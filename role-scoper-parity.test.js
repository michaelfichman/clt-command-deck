/* Proves the in-deck scopeToLM() matches Code-LM.gs: the REAL .gs source runs in a vm on an
 * in-memory workbook, the REAL scoper is lifted out of index.html, and the two payloads are compared
 * tab by tab for each person. Synthetic names and fake dollars, live headers (KPI Staging, read 2026-10-30).
 * Covers AM rows, a Current Owner column and mismatched Leads/Speed populations (audit DECK-10, DECK-18),
 * and the D2 tabs: Role Scorecard, the Deal Board by Team role, and a workbook with neither tab.
 * A separate name from the gitignored local scoper-parity.test.js, which a tracked file of the same
 * name would overwrite with no warning on `git pull`.
 * DECK_DIR points it at a deck checkout; default this directory. Run: node role-scoper-parity.test.js */
const fs = require('fs'), vm = require('vm');
const ROOT = process.env.DECK_DIR || __dirname;
const E = require(ROOT + '/lm-engine.js');

const src = fs.readFileSync(ROOT + '/index.html', 'utf8');
const a = src.indexOf('function scopeToLM(RAW, person){');
const b = src.indexOf('/* ═══════════ VIEWS', a);
const scopeToLM = new Function(src.slice(a, b) + '\nreturn scopeToLM;')();

const J = 'Jordan Mathis', A = 'Andrew Estrada', M = 'Michael Fichman';
const pad = o => { const r = new Array(26).fill(''); Object.keys(o).forEach(k => r[+k] = o[k]); return r; };
const SPEED_H = ['Lead Created At', 'First Call At', 'Speed (Min)', 'Lead Source', 'Contact Name', 'Phone', 'Assigned User', 'Contact ID', 'Lead Source', '', 'AVG SPEED BY CHANNEL', '', '', 'Speed Call (min)', 'Speed SMS (min)', 'Speed First Touch (min)', 'First Touch Channel', 'Connected (Y/N)', 'Speed to Connect (min)', 'Connect Basis', 'Connect Channel', 'u', 'v', 'w', 'x', 'y', 'SIDE BLOCK NOT SHIPPED'];
const sp = (d, src2, who, id, min, conn) => { const r = new Array(27).fill(''); r[0] = d; r[1] = d; r[2] = String(min); r[3] = src2; r[4] = 'Lead ' + id; r[6] = who; r[7] = id; r[8] = src2; r[13] = min; r[15] = min; r[16] = 'Call'; r[17] = conn; r[26] = 'SIDE-BLOCK-CELL'; return r; };
const SCORE_H = ['Date', 'Person', 'Role', 'KPI', 'Label', 'Value', 'N', 'Target', 'Target Status', 'Vs Last Week', 'Source', 'Stale', 'Note'];
const BOARD_H = ['Opp ID', 'Lead', 'Pipeline', 'Stage', 'Days', 'Red', 'LM', 'AM', 'DM', 'Next Contact', 'Appt At', 'Value', '', 'As Of'];
const BOARD_STAMP = '2026-06-19T09:30:00.000Z';
const bd = (opp, stage, days, red, lm, am, dm, value, stamp) => [opp, 'Lead ' + opp, 'Acquisitions', stage, days, red, lm, am, dm, '2026-06-20', '', value, '', stamp || ''];
const RAW = {
  'Role Scorecard': [SCORE_H,
    ['2026-06-18', A, 'lm', 'A1', 'First call on time', 0.8, 5, 0.8, 'on_track', 0.1, 'first-call ledger', false, 'median 12 min'],
    ['2026-06-18', A, 'lm', 'A2', 'Untouched leads', 0, '', 0, 'on_track', '', 'pulse', false, ''],
    ['2026-06-18', J, 'am', 'J3', 'Offer to contract', 0.25, 4, 0.25, 'on_track', '', 'kpi_feed', false, 'AM credit since 6/1'],
    ['2026-06-18', M, 'owner', 'M4', 'Closings this month', 555111, 1, 555222, 'behind', '', 'kpi_feed', false, '']],
  'Deal Board': [BOARD_H,
    bd('b1', '5.2: Offer Sent', 3, '', A, J, M, 777333, BOARD_STAMP),   // the handoff: Andrew's as LM, Jordan's as AM
    bd('b2', '5.1: Offer Details', 2, 'TRUE', J, M, M, 777444),         // Jordan's by the LM column only
    bd('b3', '6.1 Contract For Review', 6, 'TRUE', M, J, M, 777555),    // Jordan's by the AM column only
    bd('b4', '5.3: Negotiating', 9, '', J, J, M, 777666),               // Jordan in both columns
    bd('b5', '5.2: Offer Sent', 1, '', A, A, M, 777777),                // Andrew in both: Team makes him an LM only
    bd('b6', '5.4: Follow Up', 1, '', M, A, M, 777888),                 // Andrew in the AM column alone: not his, by Team
    bd('b7', 'Under Contract', 8, '', M, M, J, 777999)],                // Jordan as DM alone: DM scopes nothing
  Leads: [['Created Date', 'Lead Source', 'Contact Name', 'Phone', 'Email', 'Property Address', 'Assigned User', 'Contact ID', 'Current Owner', '', 'Current Owner synced at'],
    ['6/16/2026', 'Google Ads', 'Lead JL', '', '', '', J, 'JL1', '', '', ''],
    ['6/16/2026', 'PPC', 'Lead ML', '', '', '', M, 'ML1', '', '', ''],
    ['6/17/2026', 'MLS', 'Lead Moved', '', '', '', J, 'JL2', A, '', '2026-08-10'],      // a stale backfill says Andrew: Assigned User decides
    ['6/17/2026', 'MLS', 'Lead Back', '', '', '', A, 'AL1', J, '', '2026-08-10'],
    ['6/18/2026', 'MLS', 'Lead Blank', '', '', '', A, 'AL2', '', '', '']],                // blank, as every row from 333 on
  Appointments: [['Confirmed Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Gap (Days)'],
    ['6/16/2026', '', 'Confirmed', J, M, 'Seller One', '', '', '', 'C1', ''],
    ['6/10/2026', '', 'Confirmed', M, M, 'Seller Else', '', '', '', 'X1', ''],
    ['6/17/2026', '', 'Confirmed', A, J, 'Seller Andrew', '', '', '', 'AC1', ''],          // AM row: Andrew's lead, Jordan's walkthrough
    ['', '6/18/2026', 'Showed', A, J, 'Seller Andrew', '', '', '', 'AC1', ''],
    ['', '6/18/2026', 'Cancelled', M, M, 'Seller Andrew', '', '', '', 'AC1', ''],          // a record row on a contact Jordan is the AM of
    ['6/18/2026', '', 'Confirmed', '', J, 'Seller Blank', '', '', '', '', '']],            // a role row with a blank Contact ID still ships
  Offers: [['Offer Made Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Gap (Days)'],
    ['6/15/2026', '', 'Made', J, M, 'Seller Two', '', '', '', 'D1', ''],
    ['', '6/17/2026', 'Declined', M, M, 'Seller Two', '', '', '', 'D1', ''],
    ['6/15/2026', '', 'Made', M, M, 'Seller Other', '', '', '', 'A1', ''],
    ['6/18/2026', '', 'Made', A, J, 'Seller Andrew', '', '', '', 'AC1', ''],
    ['6/19/2026', '', 'Made', M, J, 'Seller Both', '', '', '', 'B1', '']],
  Contracts: [['Sent Date', 'Signed Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Opportunity ID', 'Gap Sent→Sign', 'Gap Sign→Close', 'Gap Sign→Cancellation', 'Gross Assignment Fee (derived)', 'Derived-gross note (documentation only — read by nothing)'],
    ['', '5/12/2026', '', 'Signed', J, M, 'Seller One', '', '', '', 'C1', 'op1', '', '', '', 71111, 'NOTE-1'],
    ['', '1/27/2026', '1/27/2026', 'Closed', M, M, 'Seller Closed', '', '', '', 'MC1', 'op9', '', '', '', 35555, 'NOTE-2'],
    ['', '6/18/2026', '', 'Signed', A, J, 'Seller Andrew', '', '', '', 'AC1', 'op3', '', '', '', 41111, 'NOTE-3'],    // AM row: the gross must not reach Jordan
    ['', '5/20/2026', '', 'Signed', J, M, 'Seller Match', '', '', '', 'C2', 'op2', '', '', '', 12222, 'NOTE-4']],
  Calls: [['Date', 'User', 'Total Calls', 'Inbound Calls', 'Outbound Calls', 'Total Talk Time (min)', 'Inbound Talk Time (min)', 'Outbound Talk Time (min)'],
    ['6/17/2026', J, 61, 0, 61, 16.8, 0, 16.8], ['6/17/2026', M, 1, 0, 1, 4.8, 0, 4.8], ['6/17/2026', 'ALEX', 1, 1, 0, 0.1, 0.1, 0], ['6/17/2026', A, 33, 0, 33, 9, 0, 9]],
  'Speed to Lead': [SPEED_H,                                                                // 1 Jordan lead on Leads this week, 4 Speed rows
    sp('6/16/2026', 'MLS', J, 's1', 9.4, 'Y'), sp('6/16/2026', 'MLS', J, 's3', 12, 'Y'), sp('6/17/2026', 'MLS', J, 's4', 20, 'Y'), sp('6/17/2026', 'MLS', J, 's5', '', ''),
    sp('6/9/2026', 'PPC', M, 's2', 5.2, 'N'), sp('6/18/2026', 'MLS', A, 's6', 4, 'Y')],
  Team: [['Name', 'Role', 'Active', 'Start Date'], [J, 'AM, LM', 'Yes', '4/22/2026'], [M, 'Owner, DM', 'Yes', ''], [A, 'LM', 'Yes', '8/11/2026'], ['Edward Peugh', 'Partner', 'Yes', ''], ['Sample Am', 'AM', 'Yes', ''], ['Sample Realm', 'Realm Lead', 'Yes', '']],   // an AM alone is in; 'LM' inside a word is not
  'Goals & Assumptions': [['GOALS', ''], ['Annual Revenue Goal ($)', 777111], ['Annual Gross Profit Goal ($)', 777222], ['Average Wholesale Profit Per Deal ($)', 20000], ['Appointment → Contract (%)', 0.5], ['Lead → Appointment (%)', 0.15]],
  Pipeline: [pad({ 0: 'Contact Name', 24: 'Fee Stash', 25: 'Fee' }), pad({ 23: 'Under Contract', 24: 'C1', 25: 71111 }), pad({ 24: 'MC1', 25: 999999 }), pad({ 23: 'Under Contract', 24: 'AC1', 25: 888888 })],
  'LM Targets': [['Metric', 'Lens', 'Person', 'Target', 'Note'], ['calls', 'week', J, '', 'x'], ['connected', 'daily', A, 43, 'y'], ['', '', '', '', ''], ['qualifying', 'daily', '', 2, 'everyone']],
  Closings: [['Closed Date', 'Revenue', 'Booker (LM)', 'AM', 'DM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Gross Assignment Fee (derived)'],
    ['6/22/2026', 71111, J, M, M, 'Seller One', '', '', '', 'C1', 71111],
    ['1/27/2026', 35555, M, M, M, 'Seller Closed', '', '', '', 'MC1', 35555],
    ['6/23/2026', 41111, A, J, M, 'Seller Andrew', '', '', '', 'AC1', 41111],              // AM on the closing: his row, no money
    ['6/24/2026', 31111, M, M, J, 'Seller Dispo', '', '', '', 'DM1', 31111],               // DM on the closing: same
    ['6/25/2026', 12222, M, M, M, 'Seller Match', '', '', '', 'C2', 12222]],               // Booker Michael, on Jordan's LM contract: the old contract match
  'Marketing Spend': [['Month', 'Channel', 'Spend'], ['6/1/2026', 'Google Ads', 54321]]
};

/* The real Code-LM.gs on the same rows. */
function fakeSheet(values) {
  return { getDataRange() { return { getValues: () => values.map(r => r.slice()) }; }, getLastRow() { return values.length; },
    getRange(r, c, nr, nc) { return { getValues() { const out = []; for (let i = 0; i < nr; i++) out.push(values[r - 1 + i].slice(c - 1, c - 1 + nc)); return out; } }; } };
}
function endpoint(raw) {
  const sheets = {}; Object.keys(raw).forEach(k => { sheets[k] = fakeSheet(raw[k]); });
  const ss = { getSheetByName: n => sheets[n] || null };
  const ctx = { SpreadsheetApp: { openById: () => ss }, ContentService: { createTextOutput(s) { return { _s: s, setMimeType() { return this; } }; }, MimeType: { JSON: 'json' } },
    console, Date, Math, JSON, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, isFinite };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(ROOT + '/apps-script/Code-LM.gs', 'utf8'), ctx, { filename: 'Code-LM.gs' });
  return token => JSON.parse(ctx.doGet({ parameter: { token } })._s);
}
const GET = endpoint(RAW);
const TOK = { [J]: 'SET-IN-DEPLOYED-EDITOR-JORDAN', [A]: 'SET-IN-DEPLOYED-EDITOR-ANDREW' };

const P = scopeToLM(RAW, J);
const blob = JSON.stringify(P);
const TEAM_H = ['Opp ID', 'Contact ID', 'Attached People', '', 'As Of'];
const rows = t => (t && t.length > 1) ? t.slice(1) : [];
const col = (t, n) => t[0].indexOf(n);
const of = (t, n, v) => rows(t).filter(r => r[col(t, n)] === v);
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
let pass = 0, fail = 0;
const ok = (l, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + l); c ? pass++ : fail++; };

console.log('SCOPER PARITY (in-deck scopeToLM)');
ok('role lm, person Jordan', P.role === 'lm' && P.person === J);
ok('teamRole as written, pay hidden', P.teamRole === 'AM, LM' && P.payPlanSet === false && P.splitRate === null);
ok('only whitelisted tabs', Object.keys(P.tabs).every(t => ['Leads', 'Appointments', 'Offers', 'Contracts', 'Calls', 'Speed to Lead', 'Team', 'Team Deals', 'Closings', 'Role Scorecard', 'Deal Board'].includes(t)));
ok('Calls only Jordan (no Michael/ALEX)', rows(P.tabs.Calls).every(r => r[1] === J));
ok('Leads by Assigned User: the stale Current Owner decides nothing', rows(P.tabs.Leads).map(r => r[7]).join() === 'JL1,JL2');
ok('Appointments: Michael X1 absent', of(P.tabs.Appointments, 'Contact ID', 'X1').length === 0);
ok('Appointments: his LM row tagged LM', of(P.tabs.Appointments, 'Contact ID', 'C1')[0].slice(-1)[0] === 'LM');
ok('Appointments: Andrew-booked rows he is the AM of tagged AM', of(P.tabs.Appointments, 'Contact ID', 'AC1').map(r => r.slice(-1)[0]).join() === 'AM,AM,');
ok('Appointments: the record row ships blank', of(P.tabs.Appointments, 'Outcome', 'Cancelled')[0].slice(-1)[0] === '');
ok('Appointments: a role row with a blank Contact ID still ships', of(P.tabs.Appointments, 'Contact Name', 'Seller Blank').length === 1);
ok('Offers: both rows on D1, the Declined blank', of(P.tabs.Offers, 'Contact ID', 'D1').map(r => r.slice(-1)[0]).join() === 'LM,');
ok('Offers: Michael A1 absent', of(P.tabs.Offers, 'Contact ID', 'A1').length === 0);
ok('Offers: Michael-booked, Jordan AM ships tagged AM', of(P.tabs.Offers, 'Contact ID', 'B1')[0].slice(-1)[0] === 'AM');
ok('Contracts: his three, Michael MC1 absent', rows(P.tabs.Contracts).map(r => r[10]).join() === 'C1,AC1,C2');
ok('Contracts: AM row\'s gross + note blanked, his LM row\'s kept', of(P.tabs.Contracts, 'Contact ID', 'AC1')[0][15] === '' && of(P.tabs.Contracts, 'Contact ID', 'AC1')[0][16] === '' && of(P.tabs.Contracts, 'Contact ID', 'C1')[0][15] === 71111);
ok('Closings: LM, AM and DM rows tagged, the contract match kept, Michael\'s own absent', rows(P.tabs.Closings).map(r => r.slice(-1)[0]).join() === 'LM,AM,DM,LM');
ok('Closings: money only on the LM row', of(P.tabs.Closings, 'Contact ID', 'C1')[0][1] === 71111 && ['AC1', 'DM1'].every(c => of(P.tabs.Closings, 'Contact ID', c)[0][1] === '' && of(P.tabs.Closings, 'Contact ID', c)[0][10] === ''));
ok('Team: LM or AM as a whole word (Realm Lead, Owner, Partner out)', rows(P.tabs.Team).map(r => r[0]).join() === J + ',' + A + ',Sample Am');
ok('Speed ships A:Y (25 cols; the side block stays out)', P.tabs['Speed to Lead'][0].length === 25 && blob.indexOf('SIDE-BLOCK-CELL') === -1);
ok('Speed rows carry First Touch value', rows(P.tabs['Speed to Lead'])[0][15] === 9.4);
ok('fee on his LM deal = 71111, the stage ships', P.fees.C1 === 71111 && P.stages.C1 === 'Under Contract');
ok('no fee on an AM deal, none on Michael\'s', !('AC1' in P.fees) && !('MC1' in P.fees) && !('AC1' in P.stages));
ok('goals.avgWholesaleFee = 20000', P.goals.avgWholesaleFee === 20000);
ok('goals: no annual revenue', P.goals.annualRevenueGoal === undefined);
ok('deep scan: no 777111 / 777222 / 999999 / 888888 / 35555 / 31111 / 41111 / 54321', ['777111', '777222', '999999', '888888', '35555', '31111', '41111', '54321'].every(s => blob.indexOf(s) === -1));
ok('lmTargets: his rows + blank-Person rows, never Andrew\'s', P.lmTargets.every(t => t.Person !== A) && P.lmTargets.some(t => t.Person === J) && P.lmTargets.some(t => t.Metric === 'qualifying'));
ok('Role Scorecard: his rows only, every column', rows(P.tabs['Role Scorecard']).map(r => r[3]).join() === 'J3' && P.tabs['Role Scorecard'][0].length === 13);
ok('Deal Board: the first 11 columns plus _as, by name, in order', same(P.tabs['Deal Board'][0], BOARD_H.slice(0, 11).concat(['_as'])));
ok('Deal Board: LM and AM rows tagged, DM alone and Michael\'s out', rows(P.tabs['Deal Board']).map(r => r[0] + ':' + r[11]).join() === 'b1:AM,b2:LM,b3:AM,b4:LM,AM');
ok('Deal Board: no Value, no as-of block, no board or M-row dollar anywhere in his payload', !P.tabs['Deal Board'][0].includes('Value') && !P.tabs['Deal Board'][0].includes('As Of') && ['777333', '777444', '777555', '777666', '555111', '555222'].every(s => blob.indexOf(s) === -1));
ok('the as-of rides at the top level, the stamp reaches no row', P.dealBoardAsOf === BOARD_STAMP && rows(P.tabs['Deal Board']).every(r => r.indexOf(BOARD_STAMP) === -1));
const PA = scopeToLM(RAW, A);
ok('Deal Board for Andrew: by the LM column alone, b6 stays home', rows(PA.tabs['Deal Board']).map(r => r[0] + ':' + r[11]).join() === 'b1:LM,b5:LM');
ok('Andrew\'s network carries no board dollars', ['777333', '777777', '777888'].every(s => JSON.stringify(PA.tabs['Deal Board']).indexOf(s) === -1));

const lmTeam = new Function('RAW', src.slice(src.indexOf('function lmTeam(){'), src.indexOf('function lmState(){')) + '\nreturn lmTeam();');
ok('owner picker: LM or AM as a whole word, the same people as tabs.Team', lmTeam(RAW).join() === [J, A, 'Sample Am'].join() && lmTeam(RAW).join() === rows(P.tabs.Team).map(r => r[0]).join());

console.log('LINE FOR LINE WITH Code-LM.gs (the real source, same rows)');
[J, A].forEach(person => {
  const first = person.split(' ')[0], g = GET(TOK[person]), d = scopeToLM(RAW, person);
  ['Leads', 'Appointments', 'Offers', 'Contracts', 'Calls', 'Speed to Lead', 'Team', 'Closings', 'Role Scorecard', 'Deal Board'].forEach(t => ok(first + ' ' + t + ' identical', same(g.tabs[t], d.tabs[t])));
  ['teamRole', 'payPlanSet', 'splitRate', 'fees', 'stages', 'goals', 'lmTargets', 'person', 'role', 'dealBoardAsOf'].forEach(k => ok(first + ' ' + k + ' identical', same(g[k], d[k])));
  const gm = E.buildModel(g, '6/19/2026 11:50:00'), dm = E.buildModel(d, '6/19/2026 11:50:00');
  ok(first + ': phone and preview show the same Leads count', gm.lenses.week.leads.current === dm.lenses.week.leads.current && gm.lenses.ytd.leads.current === dm.lenses.ytd.leads.current);
  ok(first + ': the same tiles on every lens', E.LENSES.every(l => Object.keys(gm.lenses[l]).every(k => gm.lenses[l][k].current === dm.lenses[l][k].current)));
  ok(first + ': the same comp', same(gm.comp, dm.comp));
});

console.log('THE D2 TABS IN EVERY STATE, LINE FOR LINE');
{
  const without = (...names) => { const r = Object.assign({}, RAW); names.forEach(n => delete r[n]); return r; };
  const board = t => Object.assign({}, RAW, { 'Deal Board': t });
  const STATES = {
    'neither tab (today\'s live workbook)': without('Role Scorecard', 'Deal Board'),
    'header only': Object.assign({}, RAW, { 'Role Scorecard': [SCORE_H], 'Deal Board': [BOARD_H] }),
    'a blank sheet': Object.assign({}, RAW, { 'Role Scorecard': [['']], 'Deal Board': [['']] }),
    'no stamp': board([BOARD_H, RAW['Deal Board'][2]]),
    'no deals, only the stamp at N2': board([BOARD_H, ['', '', '', '', '', '', '', '', '', '', '', '', '', BOARD_STAMP]]),
    'Value moved into the first 11 columns': board(RAW['Deal Board'].map(r => [r[0], r[11], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[12], r[13]])),
    'a renamed LM header': board(RAW['Deal Board'].map((r, i) => i ? r : r.map(c => c === 'LM' ? 'Lead Manager' : c))),
    'a renamed AM header': board(RAW['Deal Board'].map((r, i) => i ? r : r.map(c => c === 'AM' ? 'Acq Mgr' : c))),
    'a renamed Stage header': board(RAW['Deal Board'].map((r, i) => i ? r : r.map(c => c === 'Stage' ? 'Stage Name' : c))),
    'a stage with no number': board(RAW['Deal Board'].map(r => r[0] === 'b2' ? r.map((c, i) => i === 3 ? 'Contract Review' : c) : r)),
    'a Team tab with no Role column': Object.assign({}, RAW, { Team: RAW.Team.map(r => [r[0], r[2], r[3]]) }),
    'LM inside a word on Team': Object.assign({}, RAW, { Team: RAW.Team.map(r => r[0] === A ? [A, 'AM, LMT', r[2], r[3]] : r) }),
    'roles split by a slash on Team': Object.assign({}, RAW, { Team: RAW.Team.map(r => r[0] === A ? [A, 'AM/LM', r[2], r[3]] : r) }),
    'no Team tab': without('Team')
  };
  Object.keys(STATES).forEach(name => {
    const g2 = endpoint(STATES[name]);
    [J, A].forEach(person => {
      const g = g2(TOK[person]), d = scopeToLM(STATES[name], person), first = person.split(' ')[0];
      ok(name + ': ' + first + ' identical', same(g.tabs['Role Scorecard'], d.tabs['Role Scorecard']) && same(g.tabs['Deal Board'], d.tabs['Deal Board']) && same(g.dealBoardAsOf, d.dealBoardAsOf) && same(g.teamRole, d.teamRole));
    });
  });
  const boardOf = (name, who) => [endpoint(STATES[name])(TOK[who]).tabs['Deal Board'], scopeToLM(STATES[name], who).tabs['Deal Board']];
  boardOf('a renamed LM header', A).concat(boardOf('a renamed LM header', J), boardOf('a renamed AM header', J)).forEach((t, i) => ok('a renamed column for a role they hold: null on both sides (' + i + ')', t === null));
  [[A, 'b1:LM|b5:LM'], [J, 'b1:AM|b2:LM|b3:AM|b4:LM,AM']].forEach(([who, want]) => {
    const g = endpoint(RAW)(TOK[who]).tabs['Deal Board'], d = scopeToLM(RAW, who).tabs['Deal Board'], si = g[0].indexOf('Stage'), tag = r => r[r.length - 1], first = who.split(' ')[0];
    ok(first + ': the rows, for the checks below', g.slice(1).map(r => r[0] + ':' + tag(r)).join('|') === want);
    [['the phone', g], ['the preview', d]].forEach(([side, t]) => {
      const lmOnly = t.slice(1).filter(r => tag(r) === 'LM'), rest = t.slice(1).filter(r => tag(r) !== 'LM');
      ok(first + ', ' + side + ': no offer or contract word in an LM-only row', lmOnly.every(r => /^\d+(\.\d+)?$/.test(r[si]) && !/offer|contract/i.test(r.join(' '))));
      ok(first + ', ' + side + ': a row he holds as AM keeps the stage in words', rest.every(r => /[a-z]/i.test(r[si])));
    });
  });
  ok('a stage with no number ships blank on an LM-only row, not the words', (t => t.slice(1).find(r => r[0] === 'b2')[3] === '')(endpoint(STATES['a stage with no number'])(TOK[J]).tabs['Deal Board']));
  const n = scopeToLM(STATES['neither tab (today\'s live workbook)'], J);
  ok('neither tab: null tabs, null as-of, the rest of the payload whole', n.tabs['Role Scorecard'] === null && n.tabs['Deal Board'] === null && n.dealBoardAsOf === null && rows(n.tabs.Offers).length > 0);
  ok('the model builds on a payload with neither tab', E.buildModel(n, '6/19/2026 11:50:00').person === J);
  const v = scopeToLM(STATES['Value moved into the first 11 columns'], J);
  ok('Value moved left: still not shipped, the 11 columns stay in order', same(v.tabs['Deal Board'][0], BOARD_H.slice(0, 11).concat(['_as'])) && JSON.stringify(v.tabs['Deal Board']).indexOf('7776') === -1);
}

console.log('TEAM DEALS IN EVERY STATE, LINE FOR LINE');
{
  const STAMPED = '2026-06-19T09:40:00-05:00', team = t => Object.assign({}, RAW, { 'Team Deals': t });
  /* every contact on the fixture's deal rows, by what the rule should do with it */
  const ids = [...new Set(['Appointments', 'Offers', 'Contracts', 'Closings'].flatMap(n => { const t = RAW[n], c = t[0].indexOf('Contact ID'); return t.slice(1).map(r => r[c]).filter(Boolean); }))];
  /* turn = 0 to 3 walks every contact through every verdict: Jordan alone, both, Andrew alone, neither */
  const cardsAt = turn => ids.map((c, i) => { const n = (i + turn) % 4; return ['opp-' + c, c, n === 0 ? J : n === 1 ? A + ', ' + J : n === 2 ? A : '', '', i ? '' : STAMPED]; });
  const cards = cardsAt(0);
  const opps = RAW.Contracts.slice(1).map(r => [r[RAW.Contracts[0].indexOf('Opportunity ID')], r[RAW.Contracts[0].indexOf('Contact ID')]]).filter(x => x[0]);
  const STATES = {
    'no tab': RAW,
    'a live tab': team([TEAM_H, ...cards]),
    'a live tab, turned once': team([TEAM_H, ...cardsAt(1)]),
    'a live tab, turned twice': team([TEAM_H, ...cardsAt(2)]),
    'a live tab, turned three times': team([TEAM_H, ...cardsAt(3)]),
    'a live tab with Contracts on their own cards': team([TEAM_H, ...cards, ...opps.map(([o, c], i) => [o, c, i % 2 ? J : '', '', ''])]),
    'an empty tab': team([TEAM_H]),
    'a blank sheet': team([['']]),
    'no rows at all': team([]),
    'only the stamp at E2': team([TEAM_H, ['', '', '', '', STAMPED]]),
    'a stale stamp': team([TEAM_H, ...cards.map((r, i) => i ? r : [r[0], r[1], r[2], r[3], '2026-01-01T09:40:00-05:00'])]),
    'no stamp': team([TEAM_H, ...cards.map(r => r.slice(0, 4).concat(['']))]),
    'a renamed Opp ID': team([TEAM_H.map(c => c === 'Opp ID' ? 'Opp' : c), ...cards]),
    'a renamed Contact ID': team([TEAM_H.map(c => c === 'Contact ID' ? 'Contact' : c), ...cards]),
    'a renamed Attached People': team([TEAM_H.map(c => c === 'Attached People' ? 'People' : c), ...cards]),
    'nobody attached anywhere': team([TEAM_H, ...cards.map(r => [r[0], r[1], '', '', r[4]])]),
    'names in odd case and spacing': team([TEAM_H, ...cards.map(r => [r[0], r[1], String(r[2]).toUpperCase().replace(', ', ' ,  '), '', r[4]])]),
    'a card with no Contact ID': team([TEAM_H, ['opp-only', '', J, '', STAMPED], ...cards.slice(1)]),
    'a contact with no Opp ID': team([TEAM_H, ['', ids[0], J, '', STAMPED], ...cards.slice(1)])
  };
  Object.keys(STATES).forEach(name => {
    const g2 = endpoint(STATES[name]);
    [J, A].forEach(person => {
      const g = g2(TOK[person]), d = scopeToLM(STATES[name], person), first = person.split(' ')[0];
      ok(name + ': ' + first + ', every deal tab, Team Deals, fees and stages identical', ['Appointments', 'Offers', 'Contracts', 'Closings', 'Team Deals'].every(t => same(g.tabs[t], d.tabs[t])) && same(g.fees, d.fees) && same(g.stages, d.stages));
      const gm = E.buildModel(g, '6/19/2026 11:50:00'), dm = E.buildModel(d, '6/19/2026 11:50:00');
      ok(name + ': ' + first + ', the same tiles and the same comp', E.LENSES.every(l => Object.keys(gm.lenses[l]).every(k => gm.lenses[l][k].current === dm.lenses[l][k].current)) && same(gm.comp, dm.comp));
    });
  });
  const on = scopeToLM(STATES['a live tab'], J), offT = scopeToLM(RAW, J);
  ok('the states are not all the same payload: the live tab does take rows off', JSON.stringify(on.tabs.Offers) !== JSON.stringify(offT.tabs.Offers));
  ok('no tab: null on the preview', offT.tabs['Team Deals'] === null);
  /* an inherited name for an id is no card, on either side. The tabs alone: the engine's own maps are older than this rule */
  const ck = RAW.Contracts[0].indexOf('Contact ID'), co = RAW.Contracts[0].indexOf('Opportunity ID'), odd = RAW.Contracts[1].slice(); odd[ck] = 'constructor'; odd[co] = 'constructor';
  const inherited = team([TEAM_H, ...cards]); inherited.Contracts = RAW.Contracts.concat([odd]);
  [J, A].forEach(person => ok('an id that is an inherited name: ' + person.split(' ')[0] + ', no throw, identical', same(endpoint(inherited)(TOK[person]).tabs.Contracts, scopeToLM(inherited, person).tabs.Contracts)));
}

console.log('MISMATCHED LEADS / SPEED POPULATIONS');
{
  const m = E.buildModel(P, '6/19/2026 11:50:00'), w = m.lenses.week;
  ok('Leads tab: 2 this week; Speed tab: 4 rows, 3 reached', w.leads.current === 2 && w.reached.reach.speedLeads === 4 && w.reached.reach.connected === 3);
  ok('reached = 3 of 4 off one tab (off the Leads tab it would read 150%)', w.reached.current === 0.75);
  ok('nothing passes 100% anywhere', E.LENSES.every(l => ['reached', 'attemptConnect', 'showRate', 'leadToAppt', 'apptToContract'].every(k => { const x = m.lenses[l][k]; return (x.current == null || x.current <= 1) && x.trend.every(b => b.value == null || b.value <= 1); })));
}

console.log('ENGINE ON THE SCOPED PAYLOAD');
{
  const m = E.buildModel(P, '6/19/2026 11:50:00');
  ok('lm-engine builds from scoped payload', m && m.person === J);
  ok('Calls week current = 61 (only 6/17 in fixture)', m.lenses.week.calls.current === 61);
  ok('Jordan is the AM here: Offers Made = his 2 AM rows, not his LM row', m.dealRole === 'AM' && m.lenses.ytd.offersMade.current === 2);
  ok('Booked = his 1 LM row', m.lenses.ytd.apptsBooked.current === 1);
  ok('Contracts = his 1 AM row', m.lenses.ytd.contractsSigned.current === 1);
  const am = E.buildModel(scopeToLM(RAW, A), '6/19/2026 11:50:00');
  ok('Andrew is the LM here: his 1 booked, his 1 offer, his 1 contract', am.dealRole === 'LM' && am.lenses.ytd.apptsBooked.current === 1 && am.lenses.ytd.offersMade.current === 1 && am.lenses.ytd.contractsSigned.current === 1);
}

console.log('THE TEAM COUNT, END TO END: Code-LM.gs INTO THE ENGINE');
{
  /* Jordan is the AM on a signed row of a deal nobody on the team is attached to */
  const c = RAW.Contracts, cc = c[0].indexOf('Contact ID'), co = c[0].indexOf('Opportunity ID'), mine = c.slice(1).filter(r => r[c[0].indexOf('AM')] === J && r[c[0].indexOf('Outcome')] === 'Signed');
  const raw = Object.assign({}, RAW, { 'Team Deals': [TEAM_H, ...mine.map((r, i) => [r[co], r[cc], '', '', i ? '' : '2026-06-19T09:40:00-05:00'])] });
  const was = E.buildModel(GET(TOK[J]), '6/19/2026 11:50:00'), now = E.buildModel(endpoint(raw)(TOK[J]), '6/19/2026 11:50:00');
  ok('his AM contract counts with no tab, and not once it reads outside', was.lenses.ytd.contractsSigned.current === mine.length && now.lenses.ytd.contractsSigned.current === 0);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
