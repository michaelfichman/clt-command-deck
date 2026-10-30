/* Proves the in-deck scopeToLM() matches Code-LM.gs: the REAL .gs source runs in a vm on an
 * in-memory workbook, the REAL scoper is lifted out of index.html, and the two payloads are compared
 * tab by tab for each person. Synthetic names and fake dollars, live headers (KPI Staging, read 2026-10-30).
 * Covers AM rows, a Current Owner column and mismatched Leads/Speed populations (audit DECK-10, DECK-18).
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
const RAW = {
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
function endpoint() {
  const sheets = {}; Object.keys(RAW).forEach(k => { sheets[k] = fakeSheet(RAW[k]); });
  const ss = { getSheetByName: n => sheets[n] || null };
  const ctx = { SpreadsheetApp: { openById: () => ss }, ContentService: { createTextOutput(s) { return { _s: s, setMimeType() { return this; } }; }, MimeType: { JSON: 'json' } },
    console, Date, Math, JSON, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, isFinite };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(ROOT + '/apps-script/Code-LM.gs', 'utf8'), ctx, { filename: 'Code-LM.gs' });
  return token => JSON.parse(ctx.doGet({ parameter: { token } })._s);
}
const GET = endpoint();
const TOK = { [J]: 'SET-IN-DEPLOYED-EDITOR-JORDAN', [A]: 'SET-IN-DEPLOYED-EDITOR-ANDREW' };

const P = scopeToLM(RAW, J);
const blob = JSON.stringify(P);
const rows = t => (t && t.length > 1) ? t.slice(1) : [];
const col = (t, n) => t[0].indexOf(n);
const of = (t, n, v) => rows(t).filter(r => r[col(t, n)] === v);
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
let pass = 0, fail = 0;
const ok = (l, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + l); c ? pass++ : fail++; };

console.log('SCOPER PARITY (in-deck scopeToLM)');
ok('role lm, person Jordan', P.role === 'lm' && P.person === J);
ok('teamRole as written, pay hidden', P.teamRole === 'AM, LM' && P.payPlanSet === false && P.splitRate === null);
ok('only whitelisted tabs', Object.keys(P.tabs).every(t => ['Leads', 'Appointments', 'Offers', 'Contracts', 'Calls', 'Speed to Lead', 'Team', 'Closings'].includes(t)));
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

const lmTeam = new Function('RAW', src.slice(src.indexOf('function lmTeam(){'), src.indexOf('function lmState(){')) + '\nreturn lmTeam();');
ok('owner picker: LM or AM as a whole word, the same people as tabs.Team', lmTeam(RAW).join() === [J, A, 'Sample Am'].join() && lmTeam(RAW).join() === rows(P.tabs.Team).map(r => r[0]).join());

console.log('LINE FOR LINE WITH Code-LM.gs (the real source, same rows)');
[J, A].forEach(person => {
  const first = person.split(' ')[0], g = GET(TOK[person]), d = scopeToLM(RAW, person);
  ['Leads', 'Appointments', 'Offers', 'Contracts', 'Calls', 'Speed to Lead', 'Team', 'Closings'].forEach(t => ok(first + ' ' + t + ' identical', same(g.tabs[t], d.tabs[t])));
  ['teamRole', 'payPlanSet', 'splitRate', 'fees', 'stages', 'goals', 'lmTargets', 'person', 'role'].forEach(k => ok(first + ' ' + k + ' identical', same(g[k], d[k])));
  const gm = E.buildModel(g, '6/19/2026 11:50:00'), dm = E.buildModel(d, '6/19/2026 11:50:00');
  ok(first + ': phone and preview show the same Leads count', gm.lenses.week.leads.current === dm.lenses.week.leads.current && gm.lenses.ytd.leads.current === dm.lenses.ytd.leads.current);
  ok(first + ': the same tiles on every lens', E.LENSES.every(l => Object.keys(gm.lenses[l]).every(k => gm.lenses[l][k].current === dm.lenses[l][k].current)));
  ok(first + ': the same comp', same(gm.comp, dm.comp));
});

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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
