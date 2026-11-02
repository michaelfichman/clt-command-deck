/* D2: the one reader of Role Scorecard and Deal Board (lm-view.js lmRoleTabs + lmKpi + lmBoard*).
 * A missing, empty or stale tab must read 'source stale': never a blank, a 0, a throw, or an old number passed
 * off as today's. Runs the REAL lm-view.js, and at the end the REAL Code-LM.gs, Code-owner.gs and scopeToLM
 * into it, so the three ways a payload reaches the reader agree. Then it runs itself again in other device
 * time zones, because a date cell reaches JSON as a UTC instant. Every lead, dollar and stamp here is fake.
 * The two tabs do not exist on the sheet yet: their layouts are the agreed P4 contract.
 * DECK_DIR points it at a deck checkout; default this directory. Run: node role-tabs.test.js */
const fs = require('fs'), vm = require('vm'), cp = require('child_process');
const ROOT = process.env.DECK_DIR || __dirname;
const J = 'Jordan Mathis', A = 'Andrew Estrada', M = 'Michael Fichman', STALE = 'source stale';

const ctx = { console };
vm.createContext(ctx);
['lm-engine.js', 'lm-gamify.js', 'lm-view.js'].forEach(f => vm.runInContext(fs.readFileSync(ROOT + '/' + f, 'utf8'), ctx, { filename: f }));
const R = vm.runInContext('({lmRoleTabs,lmKpi,lmBoardMine,lmBoardCount,lmSheetDay,lmStaleFloor,LM_SOURCE_STALE})', ctx);

let pass = 0, fail = 0;
const ok = (l, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + l); c ? pass++ : fail++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* Tue 11/3/2026, two days after the clocks went back: Eastern is UTC-5. */
const AT = (h, m, day) => new Date(Date.UTC(2026, 10, day || 3, h + 5, m || 0));
const TEN = AT(10), EIGHT = AT(8), YDAY = '2026-11-02', TWO_BACK = '2026-11-01', THREE_BACK = '2026-10-31';

const HS = ['Date', 'Person', 'Role', 'KPI', 'Label', 'Value', 'N', 'Target', 'Target Status', 'Vs Last Week', 'Source', 'Stale', 'Note'];
const HB = ['Opp ID', 'Lead', 'Pipeline', 'Stage', 'Days', 'Red', 'LM', 'AM', 'DM', 'Next Contact', 'Appt At', 'Value'];
const row = (date, kpi, value, extra, person) => HS.map(h => { const o = Object.assign({ Date: date, Person: person || A, Role: 'lm', KPI: kpi, Label: 'L ' + kpi, Value: value, N: 5, Target: 0.8, 'Target Status': 'on_track', 'Vs Last Week': 0.1, Source: 'S ' + kpi, Stale: false, Note: '' }, extra); return o[h] === undefined ? '' : o[h]; });
const score = (rows, now) => R.lmRoleTabs({ tabs: { 'Role Scorecard': [HS, ...rows] } }, now || TEN).score;
const kpi = (rows, id, now, person) => R.lmKpi(score(rows, now), person || A, id);
const isStale = k => k.stale === true && k.shown === STALE && k.status === STALE && k.value === null && k.n === null && k.target === null && k.vsLastWeek === null;

console.log('ROLE SCORECARD: missing, empty, stale');
{
  ok('the literal the tiles print', R.LM_SOURCE_STALE === STALE);
  const states = {
    'no key at all (an old script)': { tabs: {} },
    'null (the tab is not on the sheet)': { tabs: { 'Role Scorecard': null } },
    '[]': { tabs: { 'Role Scorecard': [] } },
    'a blank sheet': { tabs: { 'Role Scorecard': [['']] } },
    'header only (no rows for this person)': { tabs: { 'Role Scorecard': [HS] } },
    'rows with no Date': { tabs: { 'Role Scorecard': [HS, row('', 'A1', 0.9)] } },
    'an unreadable Date': { tabs: { 'Role Scorecard': [HS, row('soon', 'A1', 0.9)] } },
    'only a future Date': { tabs: { 'Role Scorecard': [HS, row('2026-11-09', 'A1', 0.9)] } },
    'three days old': { tabs: { 'Role Scorecard': [HS, row(THREE_BACK, 'A1', 0.9)] } }
  };
  Object.keys(states).forEach(name => {
    const s = R.lmRoleTabs(states[name], TEN).score, k = R.lmKpi(s, A, 'A1');
    ok(name + ': source stale, no number', s.ok === false && isStale(k));
  });
  ok('a future row does not hide a stale tab', score([row('2026-11-09', 'A1', 0.9), row(THREE_BACK, 'A2', 3)]).ok === false);
  ok('the reason is named, for the data-health strip', score([row(THREE_BACK, 'A1', 0.9)]).why === 'stale' && score([]).why === 'tab empty' && R.lmRoleTabs({}, TEN).score.why === 'tab missing');
  ok('a stale tab still reports its as-of', score([row(THREE_BACK, 'A1', 0.9)]).asOf === THREE_BACK);
  ok('a stale tab hands back no rows at all', Object.keys(score([row(THREE_BACK, 'A1', 0.9)]).latest).length === 0);
}

console.log('THE 9 AM LINE (the nightly runs ~5 AM and writes yesterday\'s date)');
{
  ok('after 9: yesterday is current', score([row(YDAY, 'A1', 0.9)], TEN).ok);
  ok('after 9: two days back is stale', !score([row(TWO_BACK, 'A1', 0.9)], TEN).ok);
  ok('at 8:59: two days back is still current, the run may not have finished', score([row(TWO_BACK, 'A1', 0.9)], AT(8, 59)).ok);
  ok('at 9:00 sharp: two days back goes stale', !score([row(TWO_BACK, 'A1', 0.9)], AT(9, 0)).ok);
  ok('at 8:59: three days back is stale', !score([row(THREE_BACK, 'A1', 0.9)], AT(8, 59)).ok);
  ok('11:59 PM and 12:01 AM read the same Date as current', score([row(TWO_BACK, 'A1', 0.9)], AT(23, 59, 2)).ok && score([row(TWO_BACK, 'A1', 0.9)], AT(0, 1, 3)).ok);
  ok('a weekend runs the same: Sun 7 AM, Friday-dated is current; Sun 10:30 AM it is not', score([row('2026-10-30', 'A1', 0.9)], new Date('2026-11-01T12:00:00Z')).ok && !score([row('2026-10-30', 'A1', 0.9)], new Date('2026-11-01T15:30:00Z')).ok);
  ok('today\'s Date is current too (a rerun)', score([row('2026-11-03', 'A1', 0.9)], TEN).ok);
  ok('lmStaleFloor', R.lmStaleFloor(TEN) === YDAY && R.lmStaleFloor(EIGHT) === TWO_BACK);
}

console.log('DATE CELLS, on the sheet\'s clock whatever the device');
{
  const d = R.lmSheetDay;
  ok('a bare date stands as written', d('2026-11-02') === '2026-11-02');
  ok('midnight on the sheet, EST', d('2026-11-02T05:00:00.000Z') === '2026-11-02');
  ok('midnight on the sheet, EDT, the day before the clocks moved', d('2026-10-31T04:00:00.000Z') === '2026-10-31');
  ok('midnight on the day the clocks moved', d('2026-11-01T04:00:00.000Z') === '2026-11-01');
  ok('an ISO stamp with an offset', d('2026-11-01T07:01:09-05:00') === '2026-11-01');
  ok('a text date, the way the Offers tab writes them', d('11/2/2026') === '2026-11-02' && d('11/2/2026 1:03 PM') === '2026-11-02');
  ok('unreadable reads as no date, never as a number or a throw', d('') === '' && d(null) === '' && d(undefined) === '' && d('soon') === '' && d(46000) === '');
  ok('a date cell keeps the tab fresh', score([row('2026-11-02T05:00:00.000Z', 'A1', 0.9)], TEN).asOf === YDAY);
}

console.log('ONE KPI');
{
  const zero = kpi([row(YDAY, 'A2', 0)], 'A2');
  ok('a real 0 stays 0', zero.value === 0 && zero.shown === 0 && zero.stale === false && zero.status === 'on_track');
  ok('a 0 written as text stays a number', kpi([row(YDAY, 'A2', '0')], 'A2').value === 0);
  ok('a fraction ships as the routine wrote it', kpi([row(YDAY, 'A1', 0.85)], 'A1').value === 0.85);
  ['3 of 5', '#N/A', 'Infinity'].forEach(v => ok('a Value that is no finite number is stale, whatever its status says: ' + v, (k => isStale(k) && k.why === 'unreadable value')(kpi([row(YDAY, 'A1', v)], 'A1'))));
  ok('n, target, vs last week come through', (k => k.n === 5 && k.target === 0.8 && k.vsLastWeek === 0.1)(kpi([row(YDAY, 'A1', 0.9)], 'A1')));
  ok('label, source, note and date come through', (k => k.label === 'L A1' && k.source === 'S A1' && k.note === 'median 12 min' && k.date === YDAY && k.role === 'lm')(kpi([row(YDAY, 'A1', 0.9, { Note: 'median 12 min' })], 'A1')));
  const none = kpi([row(YDAY, 'A7', '', { N: 0, Target: 1, Note: 'no dials required that day' })], 'A7');
  ok('P4\'s null: a blank Value on a row with Stale false and a real status is healthy, and never 0', none.stale === false && none.value === null && none.shown === null && none.why === '' && none.status === 'on_track' && none.target === 1 && none.n === 0 && none.note === 'no dials required that day');
  ok('...with no target too', (k => k.stale === false && k.value === null && k.status === 'target not set')(kpi([row(YDAY, 'A7', null, { Target: '', 'Target Status': 'target not set' })], 'A7')));
  ok('...and on a weekend', kpi([row(YDAY, 'A7', '', { 'Target Status': 'weekend' })], 'A7').stale === false);
  ok('a blank Value with no status P4 writes is stale, never 0', (k => isStale(k) && k.why === 'blank value')(kpi([row(YDAY, 'A1', '', { 'Target Status': '' })], 'A1')) && (k => isStale(k) && k.why === 'blank value')(kpi([row(YDAY, 'A1', '', { 'Target Status': 'maybe' })], 'A1')));
  ['TRUE', true, 'true', 'yes', 1].forEach(v => ok('Stale ' + JSON.stringify(v) + ' suppresses the number', isStale(kpi([row(YDAY, 'A1', 0.9, { Stale: v })], 'A1'))));
  [false, 'FALSE', '', 0, 'no'].forEach(v => ok('Stale ' + JSON.stringify(v) + ' does not', kpi([row(YDAY, 'A1', 0.9, { Stale: v })], 'A1').stale === false));
  const marked = kpi([row(YDAY, 'A6', '', { 'Target Status': 'source stale', Note: 'needs a touch count' })], 'A6');
  ok('Target Status source stale: stale, and its Note survives to say what is missing', isStale(marked) && marked.note === 'needs a touch count' && marked.label === 'L A6');
  ok('...even with a number in the row', isStale(kpi([row(YDAY, 'A6', 4, { 'Target Status': 'source stale' })], 'A6')));
  ok('a KPI with no row is stale, not 0', (k => isStale(k) && k.why === 'no row')(kpi([row(YDAY, 'A1', 0.9)], 'A9')));
  ok('another person\'s row answers nothing', isStale(kpi([row(YDAY, 'A1', 0.9)], 'A1', TEN, J)));
  const behind = [row(YDAY, 'A1', 0.9), row(TWO_BACK, 'A2', 7)];
  ok('a row behind the tab\'s latest Date is stale: yesterday\'s number is not today\'s', (k => isStale(k) && k.why === 'row is behind the tab')(kpi(behind, 'A2')));
  ok('...and it does not spoil the current row', kpi(behind, 'A1').value === 0.9);
  ok('the latest Date wins, in either row order', kpi([row(YDAY, 'A1', 0.9), row(TWO_BACK, 'A1', 0.1)], 'A1').value === 0.9 && kpi([row(TWO_BACK, 'A1', 0.1), row(YDAY, 'A1', 0.9)], 'A1').value === 0.9);
  ok('target not set: the value shows, the target is blank, not 0', (k => k.value === 2 && k.target === null && k.status === 'target not set' && !k.stale)(kpi([row(YDAY, 'J5', 2, { Target: '', 'Target Status': 'target not set' })], 'J5')));
  ok('a blank Target Status reads target not set', kpi([row(YDAY, 'J5', 2, { 'Target Status': '' })], 'J5').status === 'target not set');
  ok('a target of 0 stays 0', kpi([row(YDAY, 'A2', 1, { Target: 0 })], 'A2').target === 0);
  ok('weekend and behind pass through (the view decides the colour)', kpi([row(YDAY, 'A1', 0.5, { 'Target Status': 'weekend' })], 'A1').status === 'weekend' && kpi([row(YDAY, 'A1', 0.5, { 'Target Status': 'behind' })], 'A1').status === 'behind');
  ok('ids and names in any case', kpi([row(YDAY, 'a1', 0.9)], 'A1').value === 0.9 && kpi([row(YDAY, 'A1', 0.9)], 'a1').value === 0.9 && R.lmKpi(score([row(YDAY, 'A1', 0.9)]), ' andrew estrada ', 'A1').value === 0.9);
}

console.log('A RENAMED COLUMN');
{
  const SC = (h, cells) => R.lmRoleTabs({ tabs: { 'Role Scorecard': [h, ...cells] } }, TEN).score;
  ['Date', 'Person', 'KPI', 'Value', 'Target Status', 'Stale'].forEach(n => ok('Role Scorecard, ' + n + ' renamed: stale, by name', (s => !s.ok && s.why === 'header changed' && isStale(R.lmKpi(s, A, 'A1')))(SC(HS.map(h => h === n ? n + ' X' : h), [row(YDAY, 'A1', 0.9)]))));
  ok('Role Scorecard, a column it can live without', SC(HS.map(h => h === 'Source' ? 'From' : h), [row(YDAY, 'A1', 0.9)]).ok);
}

console.log('DEAL BOARD: the phone\'s shape');
{
  const HP = [...HB.slice(0, 11), '_as'];
  const pr = (opp, as, extra) => HP.map(h => { const o = Object.assign({ 'Opp ID': opp, Lead: 'Lead ' + opp, Pipeline: 'Acquisitions', Stage: '5.2', Days: 3, Red: '', LM: A, AM: J, DM: M, 'Next Contact': '2026-11-05', 'Appt At': '', _as: as }, extra); return o[h] === undefined ? '' : o[h]; });
  const STAMP = '2026-11-03T10:40:00.000Z';   // 5:40 AM Eastern today
  const b = (rows, asOf, now) => R.lmRoleTabs({ tabs: { 'Deal Board': rows }, dealBoardAsOf: asOf }, now || TEN).board;
  const isStaleBoard = x => x.ok === false && x.rows.length === 0 && R.lmBoardCount(x, 'AM', J) === STALE && R.lmBoardMine(x, 'AM', J).length === 0;
  ok('no key at all (an old script)', isStaleBoard(R.lmRoleTabs({ tabs: {} }, TEN).board));
  ok('null', isStaleBoard(b(null, null)));
  ok('[]', isStaleBoard(b([], null)));
  ok('a blank sheet', isStaleBoard(b([['']], null)));
  ok('header only with no stamp', isStaleBoard(b([HP], null)));
  ok('rows but no stamp: never trusted', isStaleBoard(b([HP, pr('o1', 'AM')], null)));
  ok('an unreadable stamp', isStaleBoard(b([HP, pr('o1', 'AM')], 'soon')));
  ok('an empty-string stamp', isStaleBoard(b([HP, pr('o1', 'AM')], '')));
  ok('a future stamp', isStaleBoard(b([HP, pr('o1', 'AM')], '2026-11-09T10:00:00.000Z')));
  ok('yesterday\'s stamp after 9: stale, its rows withheld', isStaleBoard(b([HP, pr('o1', 'AM')], '2026-11-02T10:40:00.000Z')));
  ok('yesterday\'s stamp before 9: still current', b([HP, pr('o1', 'AM')], '2026-11-02T10:40:00.000Z', AT(8, 59)).ok);
  ok('two days back before 9: stale', isStaleBoard(b([HP, pr('o1', 'AM')], '2026-11-01T10:40:00.000Z', AT(8, 59))));
  ok('a stale board still reports its stamp for the strip', b([HP, pr('o1', 'AM')], '2026-11-02T10:40:00.000Z').asOf === '2026-11-02T10:40:00.000Z');
  const fresh0 = b([HP], STAMP);
  ok('a fresh stamp and no rows of his: a real 0, not source stale', fresh0.ok === true && R.lmBoardCount(fresh0, 'AM', J) === 0);
  const jb = b([HP, pr('o1', 'AM'), pr('o2', 'LM'), pr('o3', 'LM,AM'), pr('o4', 'AM, LM')], STAMP);
  ok('counts by the tag, split on the comma, never equality', R.lmBoardCount(jb, 'AM', J) === 3 && R.lmBoardCount(jb, 'LM', J) === 3);
  ok('his LM-tagged row is not one of his AM deals', R.lmBoardMine(jb, 'AM', J).map(r => r.opp).join() === 'o1,o3,o4');
  const one = b([HP, pr('o1', 'AM', { Days: 0, Red: 'TRUE', 'Next Contact': '2026-11-05T05:00:00.000Z', 'Appt At': '2026-11-03T19:00:00.000Z' })], STAMP).rows[0];
  ok('a row reads by header', one.opp === 'o1' && one.lead === 'Lead o1' && one.stage === '5.2' && one.lm === A && one.am === J && one.dm === M && same(one.as, ['AM']));
  ok('days 0 stays 0, red parses, Next Contact lands on its day, an appointment keeps its instant and its day', one.days === 0 && one.red === true && one.nextContact === '2026-11-05' && one.apptAt === '2026-11-03T19:00:00.000Z' && one.apptDay === '2026-11-03');
  ok('no Value on a phone row', one.value === null);
  ['Opp ID', 'Pipeline', 'Stage', 'Days', 'Red', 'LM', 'AM'].forEach(n => ok(n + ' renamed on a fresh stamp: stale, never a clean board', (x => isStaleBoard(x) && x.why === 'header changed')(b([HP.map(h => h === n ? n + ' X' : h), pr('o1', 'AM')], STAMP))));
  ok('a case-only rename is a rename: the client reads the exact key', b([HP.map(h => h === 'Opp ID' ? 'Opp Id' : h), pr('o1', 'AM')], STAMP).why === 'header changed');
  ok('a phone row needs no Value column', b([HP, pr('o1', 'AM')], STAMP).ok);
}

console.log('DEAL BOARD: the owner\'s shape');
{
  const HO = [...HB, '', 'As Of'], STAMP = '2026-11-03T10:40:00.000Z';
  const or = (opp, lm, am, value, stamp, extra) => HO.map(h => { const o = Object.assign({ 'Opp ID': opp, Lead: 'Lead ' + opp, Pipeline: 'Dispositions', Stage: '6.1', Days: 9, Red: 'yes', LM: lm, AM: am, DM: M, Value: value, 'As Of': stamp }, extra); return o[h] === undefined ? '' : o[h]; });
  const b = (rows, now) => R.lmRoleTabs({ tabs: { 'Deal Board': rows } }, now || TEN).board;
  const full = b([HO, or('o1', A, J, 1234, STAMP), or('o2', J, M, '', ''), or('o3', M, J, 'n/a', '')]);
  ok('the stamp is read off N2', full.ok && full.asOf === STAMP && full.rows.length === 3);
  ok('Value is there, a blank is null and not 0, a non-number stays text', full.rows[0].value === 1234 && full.rows[1].value === null && full.rows[2].value === 'n/a');
  ok('no `_as` on the full tab: rows count by the column', R.lmBoardCount(full, 'AM', J) === 2 && R.lmBoardCount(full, 'LM', A) === 1 && full.rows[0].as === null);
  ok('the N2 stamp alone makes no phantom row: an empty board is empty', (x => x.ok === false && x.why === 'tab empty')(b([HO, or('', '', '', '', STAMP, { Lead: '', Pipeline: '', Stage: '', Days: '', Red: '', DM: '' })])));
  ok('a blank row among the deals is skipped', b([HO, or('o1', A, J, 1, STAMP), or('', '', '', '', '', { Lead: '', Pipeline: '', Stage: '', Days: '', Red: '', DM: '' })]).rows.length === 1);
  ok('rows with no As Of column', b([HB, HB.map((_, i) => i ? 'x' : 'o1')]).ok === false);
  ['Opp ID', 'Pipeline', 'Stage', 'Days', 'Red', 'LM', 'AM', 'Value'].forEach(n => ok(n + ' renamed on the owner\'s tab: stale, the rows withheld', (x => x.ok === false && x.why === 'header changed' && x.rows.length === 0)(b([HO.map(h => h === n ? n + ' X' : h), or('o1', A, J, 1, STAMP)]))));
  ok('a stale stamp withholds the owner\'s rows too', b([HO, or('o1', A, J, 1, '2026-11-01T10:40:00.000Z')]).rows.length === 0);
  ['TRUE', true, 'true', 'yes', 'Y', '1', 1, 'red', 'Red'].forEach(v => ok('Red ' + JSON.stringify(v) + ' is red', b([HO, or('o1', A, J, 1, STAMP, { Red: v })]).rows[0].red === true));
  ['', false, 'FALSE', 'no', '0', 0].forEach(v => ok('Red ' + JSON.stringify(v) + ' is not', b([HO, or('o1', A, J, 1, STAMP, { Red: v })]).rows[0].red === false));
}

console.log('NEVER A THROW');
{
  const tries = [() => R.lmRoleTabs(), () => R.lmRoleTabs(null, TEN), () => R.lmRoleTabs({ tabs: null }, TEN), () => R.lmRoleTabs({ tabs: { 'Role Scorecard': 'x', 'Deal Board': 7 } }, TEN),
    () => R.lmRoleTabs({ tabs: { 'Role Scorecard': [null], 'Deal Board': [null] } }, TEN), () => R.lmRoleTabs({ tabs: { 'Deal Board': [HB, null, ['o1']] }, dealBoardAsOf: 7 }, TEN),
    () => R.lmKpi(undefined, A, 'A1'), () => R.lmKpi(null), () => R.lmKpi({}, A, 'A1'), () => R.lmBoardMine(undefined, 'AM', J), () => R.lmBoardCount(undefined, 'AM', J), () => R.lmBoardCount({}, 'AM', J)];
  tries.forEach((f, i) => { let threw = null; try { f(); } catch (e) { threw = e; } ok('case ' + (i + 1), threw === null); });
  ok('no reader at all still prints the literal', R.lmBoardCount(undefined, 'AM', J) === STALE && R.lmKpi(undefined, A, 'A1').shown === STALE);
}

/* ═══ the real endpoints and the real scoper, into the reader ═══ */
console.log('END TO END: Code-LM.gs, Code-owner.gs and scopeToLM into the reader');
{
  const STAMP = '2026-11-03T10:40:00.000Z';
  const scoreRows = [HS,
    row(new Date(Date.UTC(2026, 10, 2, 5)), 'A1', 0.75, { Note: 'median 12 min' }),   // a real date cell: midnight on the sheet
    row(new Date(Date.UTC(2026, 10, 2, 5)), 'A2', 0),
    row(new Date(Date.UTC(2026, 10, 2, 5)), 'J6', 2, { Role: 'am' }, J),
    row(new Date(Date.UTC(2026, 10, 2, 5)), 'J10', 4, { Role: 'am', Note: 'AM credit since 9/30' }, J),
    row(new Date(Date.UTC(2026, 10, 2, 5)), 'M1', 6, { Role: 'owner' }, M)];
  const bd = (opp, lm, am, dm, value, stamp) => [opp, 'Lead ' + opp, 'Acquisitions', '5.2', 3, '', lm, am, dm, new Date(Date.UTC(2026, 10, 5, 5)), '', value, '', stamp || ''];
  const boardRows = [[...HB, '', 'As Of'], bd('o1', A, J, M, 700001, STAMP), bd('o2', J, M, M, 700002), bd('o3', M, J, M, 700003), bd('o4', J, J, M, 700004), bd('o5', A, A, M, 700005), bd('o6', M, A, M, 700006), bd('o7', M, M, J, 700007)];
  const AM_JORDAN = boardRows.slice(1).filter(r => r[7] === J).length;
  const base = () => ({
    Team: [['Name', 'Role', 'Active', 'Start Date'], [J, 'AM, LM', 'Yes', ''], [M, 'Owner, DM', 'Yes', ''], [A, 'LM', 'Yes', '']],
    Leads: [['Created Date', 'Lead Source', 'Contact Name', 'Phone', 'Email', 'Property Address', 'Assigned User', 'Contact ID'], ['10/1/2026', 'MLS', 'x', '', '', '', A, 'l1']],
    Appointments: [['Confirmed Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Gap (Days)']],
    Offers: [['Offer Made Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Gap (Days)']],
    Contracts: [['Sent Date', 'Signed Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Opportunity ID']],
    Closings: [['Closed Date', 'Revenue', 'Booker (LM)', 'AM', 'DM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID']],
    Calls: [['Date', 'User', 'Total Calls']], 'Speed to Lead': [['Lead Created At', 'First Call At', 'Speed (Min)', 'Lead Source', 'Contact Name', 'Phone', 'Assigned User', 'Contact ID']]
  });
  const fakeSheet = v => ({ getDataRange() { return { getValues: () => v.map(r => r.slice()) }; }, getLastRow() { return v.length; }, getRange(r, c, nr, nc) { return { getValues() { const o = []; for (let i = 0; i < nr; i++) o.push(v[r - 1 + i].slice(c - 1, c - 1 + nc)); return o; } }; } });
  function gs(file, raw) {
    const sheets = {}; Object.keys(raw).forEach(k => { sheets[k] = fakeSheet(raw[k]); });
    const ss = { getSheetByName: n => sheets[n] || null };
    const c = { SpreadsheetApp: { openById: () => ss, getActiveSpreadsheet: () => ss }, ContentService: { createTextOutput(s) { return { _s: s, setMimeType() { return this; } }; }, MimeType: { JSON: 'json' } }, console, Date, Math, JSON, Object, Array, String, Number, RegExp, parseInt, parseFloat, isNaN, isFinite };
    vm.createContext(c); vm.runInContext(fs.readFileSync(ROOT + '/apps-script/' + file, 'utf8'), c, { filename: file });
    return token => JSON.parse(c.doGet({ parameter: { token } })._s);
  }
  const src = fs.readFileSync(ROOT + '/index.html', 'utf8');
  const scopeToLM = new Function(src.slice(src.indexOf('function scopeToLM(RAW, person){'), src.indexOf('/* ═══════════ VIEWS')) + '\nreturn scopeToLM;')();
  const TOK = { [J]: 'SET-IN-DEPLOYED-EDITOR-JORDAN', [A]: 'SET-IN-DEPLOYED-EDITOR-ANDREW', owner: 'SET-IN-DEPLOYED-EDITOR-MICHAEL' };
  const withTabs = Object.assign(base(), { 'Role Scorecard': scoreRows, 'Deal Board': boardRows });
  const lm = gs('Code-LM.gs', withTabs), owner = gs('Code-owner.gs', withTabs)(TOK.owner);
  const phone = p => lm(TOK[p]), preview = p => scopeToLM(owner.tabs, p);   // the preview runs on the owner's JSON, as in the deck

  [['the phone', phone], ['the owner preview', preview]].forEach(([name, P]) => {
    const a = R.lmRoleTabs(P(A), TEN), j = R.lmRoleTabs(P(J), TEN);
    ok(name + ': Andrew\'s A1 and a real 0 on A2, off a date cell', R.lmKpi(a.score, A, 'A1').value === 0.75 && R.lmKpi(a.score, A, 'A1').note === 'median 12 min' && R.lmKpi(a.score, A, 'A2').shown === 0);
    ok(name + ': Andrew\'s board is his LM rows, o6 never arrives', R.lmBoardMine(a.board, 'LM', A).map(r => r.opp).join() === 'o1,o5' && a.board.rows.length === 2);
    ok(name + ': no Value on a row', a.board.rows.concat(j.board.rows).every(r => r.value === null));
    ok(name + ': Jordan\'s Deals count equals the board rows with AM = Jordan', R.lmBoardCount(j.board, 'AM', J) === AM_JORDAN && AM_JORDAN === 3);
    ok(name + ': Jordan\'s Note comes through verbatim', R.lmKpi(j.score, J, 'J10').note === 'AM credit since 9/30');
    ok(name + ': nobody reads Michael\'s KPIs', R.lmKpi(a.score, M, 'M1').stale && R.lmKpi(j.score, M, 'M1').stale);
    ok(name + ': Next Contact lands on its day from a date cell', R.lmBoardMine(j.board, 'AM', J)[0].nextContact === '2026-11-05');
  });
  const o = R.lmRoleTabs({ tabs: owner.tabs }, TEN);
  ok('the owner: every row, with Value, read off the same reader', o.board.ok && o.board.rows.length === 7 && o.board.rows[0].value === 700001);
  ok('the owner: every person\'s KPIs', R.lmKpi(o.score, M, 'M1').value === 6 && R.lmKpi(o.score, A, 'A1').value === 0.75 && R.lmKpi(o.score, J, 'J6').value === 2);
  ok('the owner counts Jordan\'s AM deals the same as his phone', R.lmBoardCount(o.board, 'AM', J) === R.lmBoardCount(R.lmRoleTabs(phone(J), TEN).board, 'AM', J));

  const live = base(), lmL = gs('Code-LM.gs', live), ownerL = gs('Code-owner.gs', live)(TOK.owner);
  const allStale = t => !t.score.ok && !t.board.ok && R.lmKpi(t.score, A, 'A1').shown === STALE && R.lmBoardCount(t.board, 'AM', J) === STALE;
  ok('today\'s live payload, neither tab: the phone says source stale', allStale(R.lmRoleTabs(lmL(TOK[A]), TEN)) && allStale(R.lmRoleTabs(lmL(TOK[J]), TEN)));
  ok('...the preview too', allStale(R.lmRoleTabs(scopeToLM(ownerL.tabs, J), TEN)));
  ok('...and the owner', allStale(R.lmRoleTabs({ tabs: ownerL.tabs }, TEN)));
  const oldScript = JSON.parse(JSON.stringify(lmL(TOK[A]))); delete oldScript.tabs['Role Scorecard']; delete oldScript.tabs['Deal Board']; delete oldScript.dealBoardAsOf;
  ok('a new client on the old script: source stale, not a throw', allStale(R.lmRoleTabs(oldScript, TEN)));
  const held = Object.assign(base(), { 'Role Scorecard': scoreRows, 'Deal Board': boardRows.map(r => r.map(c => c === STAMP ? '2026-11-01T10:40:00.000Z' : c)) });
  ok('a failed write the next night: yesterday\'s board with its stale stamp reads stale on the phone', R.lmBoardCount(R.lmRoleTabs(gs('Code-LM.gs', held)(TOK[J]), TEN).board, 'AM', J) === STALE);
  const renamed = (from, to) => Object.assign(base(), { 'Role Scorecard': scoreRows, 'Deal Board': boardRows.map((r, i) => i ? r : r.map(c => c === from ? to : c)) });
  [['LM', 'Lead Manager', A], ['LM', 'Lead Manager', J], ['AM', 'Acq Mgr', J], ['Opp ID', 'Opp Id', A], ['Opp ID', 'Opp Id', J]].forEach(([from, to, who]) => {
    const raw = renamed(from, to), p = gs('Code-LM.gs', raw)(TOK[who]), b = R.lmRoleTabs(p, TEN).board;
    ok('the header ' + from + ' renamed ' + to + ': ' + who.split(' ')[0] + '\'s phone says source stale off the real endpoint, and never 0 deals', b.ok === false && R.lmBoardCount(b, /J/.test(who[0]) ? 'AM' : 'LM', who) === STALE);
    ok('...the preview too', R.lmRoleTabs(scopeToLM(gs('Code-owner.gs', raw)(TOK.owner).tabs, who), TEN).board.ok === false);
  });
  const gone = Object.assign(base(), { 'Role Scorecard': scoreRows, 'Deal Board': [boardRows[0]] });
  ok('an empty board reads stale on a phone, which sees only its own rows', R.lmRoleTabs(gs('Code-LM.gs', gone)(TOK[J]), TEN).board.why === 'tab empty');
}

/* A date cell is a UTC instant by the time it reaches a phone, and Andrew's phone is not on Eastern. */
if (!process.env.ROLE_TABS_TZ) {
  console.log('THE SAME, ON A DEVICE IN ANOTHER ZONE');
  ['America/Chicago', 'America/Los_Angeles', 'Pacific/Honolulu', 'Europe/London', 'Asia/Tokyo'].forEach(tz => {
    const r = cp.spawnSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { TZ: tz, ROLE_TABS_TZ: '1' }), encoding: 'utf8' });
    if (r.status) console.log(r.stdout.split('\n').filter(l => /✗/.test(l)).join('\n'));
    ok(tz + ': every check above', r.status === 0);
  });
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
