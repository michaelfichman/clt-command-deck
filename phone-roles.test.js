/* D2: the phone by role. lm.html booted on a stub DOM, in both payload shapes: today's live one with neither new tab, and a fake
 * workbook with Role Scorecard and Deal Board, scoped by the real scopeToLM (role-scoper-parity proves it twins Code-LM.gs).
 * The rule under test: Andrew's phone shows no offers, contracts or dollars anywhere; Jordan's shows the AM tiles and his Deals
 * count equals the board rows with AM = Jordan; a missing, empty or stale tab says 'source stale', never a blank, a 0 or a throw.
 * Then it runs itself again in other device time zones. Every lead, stamp and number is fake. The two tabs follow P4's layouts:
 * rates are ratio() fractions, and a KPI measuring nothing has a blank Value with Stale false. Run: node phone-roles.test.js */
const fs = require('fs'), vm = require('vm'), cp = require('child_process');
const J = 'Jordan Mathis', A = 'Andrew Estrada', MF = 'Michael Fichman', STALE = 'source stale';

/* Tue 11/3/2026, 10 AM Eastern, a safe hour past the nightly. */
const RealDate = Date, TEN = RealDate.UTC(2026, 10, 3, 15, 0, 0);
const pinned = at => { const clock = typeof at === 'object' ? at : { t: at }; return class PinnedDate extends RealDate { constructor(...a) { if (a.length === 0) super(clock.t); else super(...a); } static now() { return clock.t; } }; };
const YDAY = '2026-11-02', STAMP = '2026-11-03T10:40:00.000Z';

const AH = ['Confirmed Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Gap (Days)'];
const OH = ['Offer Made Date'].concat(AH.slice(1));
const KH = ['Sent Date', 'Signed Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Opportunity ID'];
const CH = ['Closed Date', 'Revenue', 'Booker (LM)', 'AM', 'DM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID'];
const SH = ['Lead Created At', 'First Call At', 'Speed (Min)', 'Lead Source', 'Contact Name', 'Phone', 'Assigned User', 'Contact ID', 'Lead Source 2', '', 'AVG', '', '', 'Speed Call (min)', 'Speed SMS (min)', 'Speed First Touch (min)'];
const HS = ['Date', 'Person', 'Role', 'KPI', 'Label', 'Value', 'N', 'Target', 'Target Status', 'Vs Last Week', 'Source', 'Stale', 'Note'];
const HB = ['Opp ID', 'Lead', 'Pipeline', 'Stage', 'Days', 'Red', 'LM', 'AM', 'DM', 'Next Contact', 'Appt At', 'Value', '', 'As Of'];
const sc = (person, role, kpi, value, x) => HS.map(h => { const o = Object.assign({ Date: YDAY, Person: person, Role: role, KPI: kpi, Label: '', Value: value, N: 5, Target: '', 'Target Status': 'target not set', 'Vs Last Week': '', Source: 'test source', Stale: false, Note: '' }, x); return o[h] === undefined ? '' : o[h]; });
const bd = (opp, lm, am, stage, days, red, next, appt, stamp) => [opp, 'Lead ' + opp, /^7|Dispo/.test(stage) ? 'Dispositions' : 'Acquisitions', stage, days, red, lm, am, MF, next, appt, 70000 + days, '', stamp || ''];

/* the live workbook: D1's shape, neither new tab */
function liveRaw() {
  const speed = (d, min) => [d, d, min, 'MLS', 'Lead', '', A, 's' + d + min, 'MLS', '', '', '', '', min, '', min];
  return {
    Team: [['Name', 'Role', 'Active', 'Start Date'], [J, 'AM, LM', 'Yes', '4/22/2026'], [MF, 'Owner, DM', 'Yes', ''], [A, 'LM', 'Yes', '8/11/2026']],
    Calls: [['Date', 'User', 'Total Calls', 'Inbound Calls', 'Outbound Calls', 'Total Talk Time (min)', 'Conversations'],
      ['8/12/2026', A, 10, 0, 10, 5, 1], ['10/27/2026', A, 40, 0, 40, 30, 5], ['11/2/2026', A, 50, 0, 50, 30, 6], ['11/2/2026', J, 5, 0, 5, 3, 1]],
    Leads: [['Created Date', 'Lead Source', 'Contact Name', 'Phone', 'Email', 'Property Address', 'Assigned User', 'Contact ID'], ['11/2/2026', 'MLS', 'Lead One', '', '', '', A, 'l1']],
    Appointments: [AH, ['10/26/2026', '', 'Confirmed', A, J, 'Seller One', 'P1', '', '', 'c1', ''], ['', '10/27/2026', 'Showed', A, J, 'Seller One', 'P1', '', '', 'c1', '']],
    Offers: [OH, ['10/28/2026', '', 'Made', A, J, 'Seller One', 'P1', '', '', 'c1', '']],
    Contracts: [KH, ['', '10/29/2026', '', 'Signed', A, J, 'Seller One', 'P1', '', '', 'c1', 'op-c1']],
    Closings: [CH, ['10/20/2026', 8111, A, J, MF, 'Seller Two', 'P2', '', '', 'c2']],
    'Speed to Lead': [SH, speed('11/2/2026', 25), speed('10/27/2026', 90)],
    'Goals & Assumptions': [['Average Wholesale Profit Per Deal ($)', 12345]],
    'LM Targets': [['Metric', 'Lens', 'Person', 'Target', 'Note']]
  };
}
/* the same, plus the two tabs. Andrew's text is salted with the words his phone must never show */
function fullRaw() {
  const raw = liveRaw();
  raw['Role Scorecard'] = [HS,
    sc(A, 'lm', 'A1', 0.85, { Target: 0.8, 'Target Status': 'on_track', 'Vs Last Week': 0.75, Note: 'median 12 min · 2 pending' }),
    sc(A, 'lm', 'A2', 0, { Target: 0, 'Target Status': 'on_track' }),
    sc(A, 'lm', 'A3', 2, { Target: 0, 'Target Status': 'behind', 'Vs Last Week': 5 }),
    sc(A, 'lm', 'A4', 1, { Target: 0, 'Target Status': 'weekend' }),
    sc(A, 'lm', 'A5', 3),
    sc(A, 'lm', 'A6', '', { 'Target Status': 'source stale', Stale: true, Note: 'needs a touch count' }),
    sc(A, 'lm', 'A7', 0.97, { Target: 1, 'Target Status': 'behind' }),
    sc(A, 'lm', 'A8', 7, { Note: '7 d 3, counts 2 phone offers', Source: 'kpi_feed + phone offers' }),
    sc(A, 'lm', 'A9', 1, { Target: 0, 'Target Status': 'behind' }),
    sc(A, 'lm', 'A10', 0.14, { Target: 0.15, 'Target Status': 'behind', Label: 'lead to contract $' }),
    sc(J, 'am', 'J1', 18.5, { Target: 24, 'Target Status': 'on_track', Note: 'walkthrough basis 3 of 4' }),
    sc(J, 'am', 'J3', 0.2, { Target: 0.25, 'Target Status': 'behind', Note: 'AM credit since 9/30 · team 24%' }),
    sc(J, 'am', 'J4', 0.03, { Target: 0.05, 'Target Status': 'on_track' }),
    sc(J, 'am', 'J5', 0.6, { Target: 1, 'Target Status': 'behind' }),   // a row that says behind must still not colour: NCD is parked
    sc(J, 'am', 'J6', 2, { Target: 0, 'Target Status': 'behind' }),
    sc(J, 'am', 'J9', 0, { Target: 0, 'Target Status': 'on_track' }),
    sc(J, 'am', 'J10', 4, { Note: 'AM credit since 9/30 · team 6' }),
    sc(J, 'am', 'JB1', 3, { Note: '2 due today' }),
    sc(J, 'am', 'JB2', 1)];
  raw['Deal Board'] = [HB,
    bd('o1', A, J, '5.2: Offer Sent', 9, 'TRUE', '11/5/2026', '11/3/2026 2:30 PM', STAMP),
    bd('o2', A, J, '6.1 Contract For Review', 3, '', '', ''),
    bd('o3', J, J, '5.1: Offer Details', 1, '', '11/4/2026', '2026-11-04T18:00:00.000Z'),
    bd('o4', MF, J, '4: Lead Appointment', 2, '', '', '11/10/2026 9:00 AM'),
    bd('o5', A, MF, '5.3: Offer Accepted', 4, '', '', '11/3/2026 4:00 PM'),
    bd('o6', MF, MF, '6: Under Contract Dispositions', 15, 'TRUE', '', '')];
  return raw;
}
const AM_JORDAN = 4, LM_ANDREW = 3;

const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
const scopeToLM = new Function(src.slice(src.indexOf('function scopeToLM(RAW, person){'), src.indexOf('/* ═══════════ VIEWS')) + '\nreturn scopeToLM;')();
const clone = x => JSON.parse(JSON.stringify(x));

/* lm.html on a stub DOM */
function phone(payload, opts) {
  const o = opts || {}, Pinned = pinned(o.at || TEN), els = {}, charts = [];
  const el = id => (els[id] = els[id] || { id, style: {}, innerHTML: '', textContent: '', className: '', value: '', hidden: false, classList: { add() {}, remove() {}, contains() { return false; } }, scrollIntoView() {}, querySelectorAll: () => ctx.fields });
  const ctx = { fails: 0, fetches: 0, scrolls: 0, fields: [], on: {} };
  Object.assign(ctx, {
    window: ctx, self: ctx, console, Date: Pinned, Math, JSON, isFinite, isNaN, parseInt, parseFloat, Number, String, Object, Array, RegExp, Promise, URLSearchParams, Error, Intl,
    setInterval: () => 0, clearInterval: () => {}, setTimeout, scrollTo: () => { ctx.scrolls++; }, addEventListener: (t, f) => { ctx.on[t] = f; }, getComputedStyle: () => ({ getPropertyValue: () => '#3FD0FF' }), Chart: function (e, conf) { charts.push(conf); return { destroy() {} }; },
    localStorage: { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; } },
    location: { hash: o.hash != null ? o.hash : '#e=https://script.google.com/macros/s/AKx/exec&t=tok&r=lm' }, history: { replaceState(a, b, h) { ctx.lastHash = h; } }, navigator: {},
    document: { getElementById: el, addEventListener: (t, f) => { ctx.on[t] = f; }, documentElement: { classList: { add() {}, remove() {} } }, createElement: () => el('_tmp'), body: { appendChild() {} } }
  });
  ctx.fetch = () => { ctx.fetches++; return ctx.fails ? Promise.reject(new Error('no network')) : Promise.resolve({ json: () => Promise.resolve(clone(ctx.serve || payload)) }); };
  if (o.failFirst) ctx.fails = 1;
  vm.createContext(ctx);
  ['lm-engine.js', 'lm-gamify.js', 'lm-view.js'].forEach(f => vm.runInContext(fs.readFileSync(__dirname + '/' + f, 'utf8'), ctx, { filename: f }));
  const html = fs.readFileSync(__dirname + '/lm.html', 'utf8');
  vm.runInContext(html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>')), ctx, { filename: 'lm.html#boot' });
  return { ctx, els, charts, person: payload.person, view: () => els.view.innerHTML, go(m, lens) { ctx.window.lmGo(this.person, lens || 'week', m || ''); return els.view.innerHTML; }, run: code => vm.runInContext(code, ctx) };
}
const boot = async (p, o) => { const P = phone(p, o); await new Promise(r => setTimeout(r, 30)); return P; };
const andrew = raw => scopeToLM(raw, A), jordan = raw => scopeToLM(raw, J);

let pass = 0, fail = 0;
const ok = (l, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + l); c ? pass++ : fail++; };
const count = (h, re) => (h.match(re) || []).length;
const tileBy = (h, label) => { const i = h.indexOf('lm-t-lbl">' + label + '<'); return i < 0 ? '' : h.slice(h.lastIndexOf('<button', i), h.indexOf('</button>', i)); };
const has = (h, x) => h.indexOf(x) > -1;
const LM_LABELS = ['First call on time', 'Untouched leads', 'Sellers waiting on us', 'Holding past 1 hour', 'Cadence behind', '15 touches in the first 72 hours', 'Walkthroughs set', 'Lead→walkthrough', 'Dials made vs required'];
const AM_LABELS = ['Stuck in 5.1', 'Hours, 5.1 to offer', 'Offers out', 'Offer→contract', 'Next Contact current', 'MAO accuracy', 'Walkthrough status not set'];
const inOrder = (h, ls) => ls.every((l, i) => i === 0 || (h.indexOf('lm-t-lbl">' + ls[i - 1] + '<') > -1 && h.indexOf('lm-t-lbl">' + ls[i - 1] + '<') < h.indexOf('lm-t-lbl">' + l + '<')));
/* every page a phone can reach, a saved link included */
const LENSES = ['today', 'week', 'month', 'quarter'];
const ROUTES = ['', 'deals', 'focus', 'tasks', 'book', 'calls', 'conversations', 'qualifying', 'connectRate', 'reached', 'talkTime', 'speed', 'leads', 'apptsBooked', 'apptsShowed', 'showRate', 'leadToAppt', 'offersMade', 'contractsSigned', 'apptToContract', 'connected', 'deepConv', 'earned', 'earmarked', 'projected', 'potential',
  'kpi-A1', 'kpi-A2', 'kpi-A3', 'kpi-A4', 'kpi-A5', 'kpi-A6', 'kpi-A7', 'kpi-A8', 'kpi-A9', 'kpi-A10', 'kpi-J1', 'kpi-J3', 'kpi-J4', 'kpi-J5', 'kpi-J6', 'kpi-J9', 'kpi-J10', 'kpi-JB1', 'kpi-JB2', 'kpi-M1', 'kpi-nope', 'nope', 'constructor', '__proto__'];

(async function () {
  console.log("TODAY'S LIVE PAYLOAD: neither new tab");
  {
    const a = await boot(andrew(liveRaw())), j = await boot(jordan(liveRaw()));
    const ah = a.view(), jh = j.view();
    ok('Andrew: 9 scorecard tiles + Dials + Conversations', count(ah, /class="lm-tile /g) === 11 && inOrder(ah, LM_LABELS) && has(ah, '>Dials<') && has(ah, '>Conversations ≥75s<'));
    ok('Andrew: every scorecard tile says source stale, with its own label', count(ah, /lm-t-val stale">source stale</g) === 9 && LM_LABELS.every(l => has(tileBy(ah, l), STALE)));
    ok('Andrew: no number on a stale tile', LM_LABELS.every(l => { const t = tileBy(ah, l); return !/\d/.test(t.slice(t.indexOf('lm-t-val'))); }));
    ok('Andrew: the section says it too', has(ah, 'Scorecard') && has(ah, '<span class="tag">source stale</span>'));
    ok('Andrew: the Deals button says it', has(ah, 'Deals &amp; Pipeline — source stale →'));
    ok('Andrew: no Offers/Contracts tile, no $', !/Offers Made|>Contracts<|Appt→Contract/.test(ah) && !has(ah, '$'));
    ok('Jordan: the 7 AM tiles in order, all source stale', count(jh, /class="lm-tile /g) === 7 && inOrder(jh, AM_LABELS) && count(jh, /lm-t-val stale">source stale</g) === 7);
    ok('Jordan: the Deals button and the day strip say it', has(jh, 'Deals &amp; Pipeline — source stale →') && /Today &amp; tomorrow<\/div><div class="lm-rec none">source stale/.test(jh));
    ok('Jordan: My book is there', has(jh, 'My book'));
    const bk = j.go('book');
    ok('My book: both tiles say source stale', count(bk, /lm-t-val stale">source stale</g) === 2);
    const threw = [];
    [a, j].forEach(P => LENSES.forEach(l => ROUTES.forEach(m => { const h = P.go(m, l); if (has(h, 'RENDER ERROR') || /undefined|NaN|null/.test(h.replace(/onclick="[^"]*"/g, ''))) threw.push(P.person.split(' ')[0] + ':' + l + ':' + m); })));
    ok('every route on every lens: no render error, no undefined, NaN or null' + (threw.length ? ' ' + threw.slice(0, 6) : ''), threw.length === 0);
    const k = j.go('kpi-J10');
    ok('a stale detail says it in plain words, with no number', has(k, '>source stale<') && has(k, 'not published yet') && !has(k, 'tab missing') && !has(k, 'lm-bars'));
    ok('a stale tile too: the reader\'s code never reaches a person', has(tileBy(ah, 'First call on time'), 'not published yet') && !has(ah, 'tab missing'));
    const f = a.go('focus');
    ok('levers on a stale tab say source stale, not a number', count(f, /lm-scen-now">source stale</g) === 5);
  }

  console.log('OLD CLIENTS AND ODD TABS');
  {
    const old = clone(andrew(liveRaw())); delete old.tabs['Role Scorecard']; delete old.tabs['Deal Board']; delete old.dealBoardAsOf; delete old.teamRole; delete old.payPlanSet;
    const P = await boot(old);
    ok('a new client on the old script: LM view, source stale, no throw', count(P.view(), /lm-t-val stale">source stale</g) === 9 && !has(P.view(), 'RENDER ERROR'));
    const empty = fullRaw(); empty['Role Scorecard'] = [HS]; empty['Deal Board'] = [HB];
    const E = await boot(jordan(empty));
    ok('header-only tabs read source stale', count(E.view(), /lm-t-val stale">source stale</g) === 7 && has(E.view(), 'Deals &amp; Pipeline — source stale →'));
    const stale = fullRaw(); stale['Role Scorecard'] = stale['Role Scorecard'].map((r, i) => i ? [...r.slice(0, 0), '2026-10-31', ...r.slice(1)] : r);
    stale['Deal Board'] = stale['Deal Board'].map(r => r.map(c => c === STAMP ? '2026-11-01T10:40:00.000Z' : c));
    const S = await boot(jordan(stale)), SA = await boot(andrew(stale));
    ok('a stale Date: every tile says it, and the old numbers are nowhere', count(S.view(), /lm-t-val stale">source stale</g) === 7 && !has(S.view(), '18.5') && !has(S.view(), 'AM credit since'));
    ok('...the tag says when it last wrote', has(S.view(), 'source stale · last 10/31'));
    ok('...each tile and its detail say how old it is, not one word', has(tileBy(S.view(), 'Stuck in 5.1'), 'last run 10/31') && !/<span>stale<\/span>/.test(S.view()) && has(S.go('kpi-J6'), 'last run 10/31')); S.go('');
    ok('a stale board: no rows on either phone', !has(S.go('deals'), 'Lead o1') && !has(SA.go('deals'), 'Lead o1') && has(S.go('deals'), STALE) && has(SA.go('deals'), STALE));
    const r = await boot(jordan(fullRaw()), { at: RealDate.UTC(2026, 10, 3, 13, 59) });
    ok('before 9 AM the same numbers stand', !has(r.view(), 'lm-t-val stale'));
    const clock = { t: TEN }, open = await boot(jordan(fullRaw()), { at: clock });
    ok('a phone left open: fresh at 10 AM', !has(open.view(), 'lm-t-val stale'));
    clock.t = RealDate.UTC(2026, 10, 4, 15, 0); open.go('');
    ok('...and stale the next morning with no reload: the clock is read at render', count(open.view(), /lm-t-val stale/g) === 7 && !has(open.go('deals'), 'Lead o1'));
    const tomorrow = await boot(jordan(fullRaw()), { at: RealDate.UTC(2026, 10, 4, 15, 0) });
    ok('the next morning with no new run: stale', count(tomorrow.view(), /lm-t-val stale/g) === 7);
  }

  console.log('A SCORECARD TILE');
  {
    const a = await boot(andrew(fullRaw())), j = await boot(jordan(fullRaw())), ah = a.view(), jh = j.view();
    ok('Andrew: the set, in order', count(ah, /class="lm-tile /g) === 11 && inOrder(ah, LM_LABELS));
    ok('A1: the number, its target, last week, its median verbatim', /lm-t-val">85%</.test(tileBy(ah, 'First call on time')) && has(tileBy(ah, 'First call on time'), '🎯 <b>80%</b>') && has(tileBy(ah, 'First call on time'), 'last wk <b>75%</b>') && has(tileBy(ah, 'First call on time'), 'median 12 min · 2 pending'));
    ok('a real 0 is 0', /lm-t-val">0</.test(tileBy(ah, 'Untouched leads')));
    ok('on_track is green', has(tileBy(ah, 'First call on time'), 'lm-tile lm-ahead'));
    ok('behind is red', has(tileBy(ah, 'Sellers waiting on us'), 'lm-tile lm-behind') && has(tileBy(ah, 'Sellers waiting on us'), 'behind'));
    ok('weekend gets no colour (D-6)', has(tileBy(ah, 'Holding past 1 hour'), 'lm-tile lm-none') && has(tileBy(ah, 'Holding past 1 hour'), 'weekend'));
    ok('target not set is written out, no colour, no 0', has(tileBy(ah, 'Cadence behind'), 'target not set') && has(tileBy(ah, 'Cadence behind'), 'lm-tile lm-none') && !has(tileBy(ah, 'Cadence behind'), '🎯'));
    ok('a row the routine marked stale says so, and keeps its Note', has(tileBy(ah, '15 touches in the first 72 hours'), 'lm-t-val stale">source stale') && has(tileBy(ah, '15 touches in the first 72 hours'), 'lm-tile lm-stale') && has(tileBy(ah, '15 touches in the first 72 hours'), 'needs a touch count'));
    ok('Vs Last Week never colours', !/lm-up|lm-dn/.test(tileBy(ah, 'Sellers waiting on us')) && has(tileBy(ah, 'Sellers waiting on us'), 'last wk <b>5</b>'));
    ok('Jordan: the set, in order, no Dials, no lens bar, no streak, no pace', count(jh, /class="lm-tile /g) === 7 && inOrder(jh, AM_LABELS) && !has(jh, '>Dials<') && !has(jh, 'lm-seg') && !has(jh, 'lm-hero') && !has(jh, 'PACE THE DAY'));
    ok('J1 reads in hours', /lm-t-val">18.5 h</.test(tileBy(jh, 'Hours, 5.1 to offer')));
    ok('J3 and J10 carry the AM label from the Note, verbatim', has(tileBy(jh, 'Offer→contract'), 'AM credit since 9/30') && has(tileBy(jh, 'Offers out'), 'AM credit since 9/30'));
    ok('J5 is parked: target not set, no colour, no target rail, whatever its row says', has(tileBy(jh, 'Next Contact current'), 'target not set') && has(tileBy(jh, 'Next Contact current'), 'lm-tile lm-none') && !has(tileBy(jh, 'Next Contact current'), 'behind') && !has(tileBy(jh, 'Next Contact current'), '🎯'));
    ok('...its detail too', has(j.go('kpi-J5'), 'lm-bar dim"><span class="lm-bl">🎯 Target</span><span class="lm-bv">not set') && !has(j.view(), 'lm-big lm-behind')); j.go('');
    const raw = fullRaw(); raw['Role Scorecard'].push(sc(A, 'lm', 'A2', 9, { Date: '2026-11-01', Note: 'old note 9' }));
    raw['Role Scorecard'] = raw['Role Scorecard'].filter(r => !(r[3] === 'A2' && r[0] === YDAY));
    const b = await boot(andrew(raw));
    ok('a row behind the tab: source stale, and its old Note is withheld too', has(tileBy(b.view(), 'Untouched leads'), STALE) && !has(b.view(), 'old note 9') && !has(b.go('kpi-A2'), 'old note 9'));
    const blank = fullRaw(); blank['Role Scorecard'][1] = sc(A, 'lm', 'A1', '', { N: 0, Target: 0.8, 'Target Status': 'on_track', Note: '0 of 0 · 0 pending · last 7 days' });
    blank['Role Scorecard'][7] = sc(A, 'lm', 'A7', '', { N: 0, Note: 'no dials required that day' });
    const BL = await boot(andrew(blank)), bh = BL.view(), bt = tileBy(bh, 'First call on time'), bd7 = tileBy(bh, 'Dials made vs required');
    ok('P4\'s null with a target: a dash, its status word and Note, no colour, never 0 and never source stale', has(bt, 'lm-t-val">—<') && has(bt, 'lm-tile lm-none') && has(bt, 'on track') && has(bt, '🎯 <b>80%</b>') && has(bt, '0 of 0 · 0 pending') && !has(bt, STALE));
    ok('P4\'s null with no target: a dash, target not set, the Note says why', has(bd7, 'lm-t-val">—<') && has(bd7, 'lm-tile lm-none') && has(bd7, 'target not set') && has(bd7, 'no dials required that day') && !has(bd7, STALE));
    const bk7 = BL.go('kpi-A7');
    ok('...its detail the same, no red and no stale', has(bk7, 'lm-big lm-none') && has(bk7, '>—<') && has(bk7, 'no dials required that day') && !has(bk7, STALE));
    ok('...its lever: a dash, not source stale', has(BL.go('focus'), 'lm-scen-now">— · target 80%<'));
    const hollow = fullRaw(); hollow['Role Scorecard'][1] = sc(A, 'lm', 'A1', '', { 'Target Status': '' });
    ok('a blank Value with no status at all is source stale', has(tileBy((await boot(andrew(hollow))).view(), 'First call on time'), 'lm-t-val stale'));
    const lbl = fullRaw(); lbl['Role Scorecard'][1] = sc(A, 'lm', 'A1', 0.85, { Label: 'First call kept' });
    ok('the Label cell wins over the fallback', has((await boot(andrew(lbl))).view(), 'lm-t-lbl">First call kept<'));
    const txt = fullRaw(); txt['Role Scorecard'][1] = sc(A, 'lm', 'A1', '#N/A', { Target: 0.8, 'Target Status': 'on_track' });
    const tt = tileBy((await boot(andrew(txt))).view(), 'First call on time');
    ok('text in Value is source stale, never green under an on_track', has(tt, 'lm-t-val stale') && has(tt, 'lm-tile lm-stale') && !has(tt, '#N/A') && has(tt, 'the cell is not a number'));
    const real = fullRaw(); real['Role Scorecard'][6] = sc(A, 'lm', 'A6', 1, { N: 2, 'Vs Last Week': 0.5, Note: 'share of his leads' });
    real['Role Scorecard'][14] = sc(J, 'am', 'J5', 0.071, { N: 14, 'Vs Last Week': 0.143 });
    const RA = await boot(andrew(real)), RJ = await boot(jordan(real)), a6 = tileBy(RA.view(), '15 touches in the first 72 hours');
    ok('A6 at exactly 1 reads 100%, on the tile, its last week and the lever', has(a6, 'lm-t-val">100%<') && has(a6, 'last wk <b>50%</b>') && has(RA.go('focus'), '15 touches in the first 72 hours 100%'));
    ok('...and its detail', has(RA.go('kpi-A6'), '>100%<'));
    ok('J5 prints a percent: 0.071 is 7%, not 0.1', has(tileBy(RJ.view(), 'Next Contact current'), 'lm-t-val">7%<') && has(tileBy(RJ.view(), 'Next Contact current'), 'last wk <b>14%</b>') && has(RJ.go('kpi-J5'), '>7%<'));
    const zero = fullRaw(); zero['Role Scorecard'][6] = sc(A, 'lm', 'A6', 0, { N: 2 });
    ok('A6 at exactly 0 reads 0%', has(tileBy((await boot(andrew(zero))).view(), '15 touches in the first 72 hours'), 'lm-t-val">0%<'));
  }

  console.log("ANDREW'S PHONE: no offers, contracts or dollars, anywhere");
  {
    const BAR = /offer|contract|\$/i, A1 = await boot(andrew(fullRaw())), A2 = await boot(andrew(liveRaw())), bad = [];
    [A1, A2].forEach((P, i) => LENSES.forEach(l => ROUTES.forEach(m => { const h = P.go(m, l); if (BAR.test(h)) bad.push((i ? 'live:' : 'full:') + l + ':' + m + ':' + (h.match(/.{30}(offer|contract|\$).{20}/i) || [''])[0]); })));
    ok('every route, every lens, both shapes' + (bad.length ? ' ' + bad.slice(0, 4).join(' | ') : ''), bad.length === 0);
    const h = A1.view();
    ok('his routine text with those words is dropped, the tile stands', has(h, 'lm-t-lbl">Walkthroughs set<') && !has(h, 'phone offers') && has(tileBy(h, 'Lead→walkthrough'), '14%'));
    ok('a saved link to the three old pages shows no page', ['offersMade', 'contractsSigned', 'apptToContract'].every(k => { const d = A1.go(k); return has(d, 'NOT ON THIS PHONE') && has(d, 'lm-back') && !has(d, 'lmchart'); }));
    const before = A1.charts.length; A1.go('offersMade'); A1.go('apptToContract');
    ok('...and mounts no chart', A1.charts.length === before);
    const d = A1.go('deals');
    ok('the funnel stops at Showed', has(d, '>Leads<') && has(d, '>Appts Booked<') && has(d, '>Showed<') && count(d, /lm-frow/g) === 3);
    ok('his Deals count equals board rows with LM = Andrew', has(h, 'Deals &amp; Pipeline — ' + LM_ANDREW + ' deals →') && count(d, /class="lm-rec"/g) === LM_ANDREW);
    ok('one read-only list per AM, named from the column', has(d, 'With Jordan (2)') && has(d, 'With Michael (1)'));
    ok('stage number + days, sorted by days', has(d, 'stage 5.2 · 9 days') && has(d, 'stage 6.1 · 3 days') && has(d, 'stage 5.3 · 4 days') && d.indexOf('Lead o1') < d.indexOf('Lead o2'));
    ok('no link, no red: read-only', !/<a /.test(d.slice(d.indexOf('With Jordan'))) && !has(d, 'lm-rd red'));
    const none = fullRaw(); none['Deal Board'] = none['Deal Board'].map(x => x[6] === A ? x.map((v, i) => i === 6 ? MF : v) : x);
    const n = await boot(andrew(none));
    ok('a fresh board with none of his rows is a real 0, not source stale', has(n.view(), 'Deals &amp; Pipeline — 0 deals →') && has(n.go('deals'), 'Nothing with the AM right now.') && !has(n.go('deals'), STALE));
    const solo = fullRaw(); solo['Deal Board'] = solo['Deal Board'].map(x => x[0] === 'o1' ? x.map((v, i) => i === 7 ? A : v) : x[0] === 'o2' ? x.map((v, i) => i === 7 ? '' : v) : x);
    const u = await boot(andrew(solo));
    ok('his own row reads With you, a blank AM With the AM', has(u.go('deals'), 'With you (1)') && has(u.go('deals'), 'With the AM (1)'));
  }

  console.log("JORDAN'S PHONE: Deals, the day strip, My book");
  {
    const j = await boot(jordan(fullRaw())), h = j.view(), d = j.go('deals');
    ok('his Deals count equals board rows with AM = Jordan', has(h, 'Deals &amp; Pipeline — ' + AM_JORDAN + ' deals →') && has(d, 'Deals (' + AM_JORDAN + ')'));
    const list = d.slice(d.indexOf('>Deals ('), d.indexOf('Funnel'));
    ok('every one of them listed, no other', ['o1', 'o2', 'o3', 'o4'].every(x => has(list, 'Lead ' + x)) && !has(list, 'Lead o5') && !has(list, 'Lead o6'));
    ok('stage in words, days, Next Contact as plain text', has(list, '5.2: Offer Sent · next contact 11/5') && has(list, '9 days'));
    ok('red is the board\'s own cell, red rows first', count(list, /lm-rd red/g) === 1 && list.indexOf('Lead o1') < list.indexOf('Lead o4') && list.indexOf('lm-rd red') < list.indexOf('Lead o4'));
    ok('no colour on Next Contact (NCD is parked)', !/next contact[^<]*<\/[a-z]+><\/div><div class="lm-rmetric lm-rd red/.test(list.replace('next contact 11/5</div></div><div class="lm-rmetric lm-rd red', '')) && !/class="[^"]*(late|red)[^"]*"[^>]*>[^<]*next contact/.test(list));
    ok('the funnel is his: offers and contracts by the AM tag', has(d, '>Offers Made<') && has(d, '>Contracts<') && !has(d, '>Leads<'));
    ok('the old LM deal lists are gone', !has(d, 'Seller Two'));
    const strip = h.slice(h.indexOf('Today &amp; tomorrow'), h.indexOf('Scorecard'));
    ok('the strip: his rows today and tomorrow, soonest first, on the sheet\'s clock', has(strip, '(2)') && has(strip, 'Today 2:30 PM') && has(strip, 'Tomorrow 1:00 PM') && strip.indexOf('Lead o1') < strip.indexOf('Lead o3'));
    ok('...not next week, not another AM\'s', !has(strip, 'Lead o4') && !has(strip, 'Lead o5'));
    ok('the strip is on Deals too', has(d, 'Today 2:30 PM'));
    const quiet = fullRaw(); quiet['Deal Board'] = quiet['Deal Board'].map((r, i) => i ? r.map((v, c) => c === 10 ? '' : v) : r);
    ok('an empty strip says so, not stale', has((await boot(jordan(quiet))).view(), 'Nothing booked today or tomorrow.'));
    const bk = j.go('book');
    ok('My book: JB1, JB2, its own back label', has(bk, 'lm-t-val">3<') && has(bk, 'lm-t-lbl">Own book: due<') && has(bk, 'lm-t-lbl">1.5 leads behind<') && has(bk, 'lm-t-val">1<'));
    ok('a book tile returns to the book', has(j.go('kpi-JB1'), '‹ My book'));
    const a10 = j.go('kpi-J10');
    ok('J10 opens his Offers Made and Contracts pages', has(a10, "'offersMade'") && has(a10, "'contractsSigned'"));
    ok('those pages still render, with no comparison (D-10)', has(j.go('offersMade'), 'no comparison yet') && has(j.go('contractsSigned'), 'no comparison yet'));
    const raw = fullRaw(), t = jordan(raw);
    t.tabs.Tasks = [['task_id', 'owner', 'visibility', 'status', 'lead', 'ask', 'ghl_url', 'opp_id', 'priority'], ['t1', J, 'team', 'open', 'x', 'y', 'https://app.example.test/c/1', 'o2', 2], ['t2', J, 'team', 'open', 'x', 'y', 'javascript:alert(1)', 'o3', 2]];
    t.tabs.Review = [['flag_id']];
    const L = await boot(t), dl = L.go('deals');
    ok('a Tasks row on the same opportunity lends a plain link; no row, plain text', has(dl, 'href="https://app.example.test/c/1"') && count(dl, /<a /g) === 1);
    ok('...and only an https link', !has(dl, 'javascript:'));
  }

  console.log('DETAIL AND ROUTES');
  {
    const a = await boot(andrew(fullRaw())), j = await boot(jordan(fullRaw()));
    const d = a.go('kpi-A1');
    ok('A1 detail: value, target, last week, Note, coach', has(d, 'lm-big lm-ahead') && has(d, '>85%<') && has(d, '80%') && has(d, '75%') && has(d, 'median 12 min') && has(d, 'COACH'));
    ok('the Source cell is an engineering reference: it stays off a phone', !has(d, 'test source') && !has(d, 'Source:') && !has(j.go('kpi-J3'), 'Source:'));
    ok('A1 detail carries the clock speed, labelled, and links to it', has(d, 'first touch, calls + texts, clock minutes') && has(d, "'speed'"));
    const s = a.go('speed');
    ok('the speed page is labelled, and its split by lead type is gone', has(s, 'first touch, calls + texts, clock minutes') && !has(s, 'By lead type'));
    const speedSets = a.charts[a.charts.length - 1].data.datasets.map(x => x.label);
    ok('its chart is one line, not one per source', speedSets.indexOf('MLS') === -1 && speedSets[0] === 'Speed-to-Lead');
    ok('the engine keeps bySource: the nightly reads it', Array.isArray(a.run('LMEngine.buildModel(' + JSON.stringify(andrew(liveRaw())) + ').lenses.week.speed.bySource')));
    ok('home has no wall-clock speed', !has(a.go(''), 'Speed-to-Lead') && !has(a.view(), 'speed-to-lead'));
    ok('Andrew cannot open a J page by hash, Jordan an A page', !has(a.go('kpi-J3'), 'lm-big') && has(a.view(), 'lm-tiles') && !has(j.go('kpi-A1'), 'lm-big') && has(j.view(), 'lm-tiles'));
    ok('Andrew has no My book', has(a.go('book'), 'lm-tiles') && !has(a.view(), 'My book'));
    ok('A9 opens for Andrew though it is not a tile (his lever names it)', has(a.go('kpi-A9'), 'Lead Qualification and Comparables'));
    const c = a.charts.length; a.go('kpi-A1'); a.go('deals'); a.go('book'); a.go('nope');
    ok('no chart on a view route', a.charts.length === c);
    const hash = await boot(andrew(fullRaw()), { hash: '#e=https://script.google.com/macros/s/AKx/exec&t=tok&r=lm&m=kpi-A1&lens=week' });
    ok('a saved #m=kpi-A1 opens it on boot', has(hash.view(), 'lm-big'));
    const low = await boot(andrew(fullRaw()), { hash: '#e=https://script.google.com/macros/s/AKx/exec&t=tok&r=lm&m=kpi-a1' });
    ok('ids in either case', has(low.view(), 'lm-big'));
  }

  console.log('SHEET TEXT IS ESCAPED');
  {
    const X = '<img src=x onerror=alert(1)>', raw = fullRaw();
    raw['Role Scorecard'][12] = sc(J, 'am', 'J3', X, { Note: X, Label: X, Source: X });
    raw['Deal Board'][1] = bd('o1', A, J, X, X, 'TRUE', X, '11/3/2026 2:30 PM', STAMP); raw['Deal Board'][1][1] = X;
    const P = await boot(jordan(raw)), B = await boot(andrew(raw));
    const pages = [P.view(), P.go('deals'), P.go('kpi-J3'), P.go('focus'), B.go('deals')];
    ok('on every page that prints it', pages.every(h => !has(h, '<img')));
    const apos = fullRaw(); apos['Team'].push(["Sam O'Neil", 'LM', 'Yes', '']); apos['Role Scorecard'].push(sc("Sam O'Neil", 'lm', 'A1', 0.5));
    const S = await boot(scopeToLM(apos, "Sam O'Neil"));
    ok('a name with an apostrophe keeps its links', has(S.view(), "lmGo('Sam O\\'Neil'"));
  }

  console.log('COPY AND LEVERS');
  {
    const v = fs.readFileSync(__dirname + '/lm-view.js', 'utf8');
    ok('no stale copy left in the view', ['Solo ·', 'self-competition', 'sub-5', 'in 5 min', 'Steal one', 'dormant', "key:'close'", 'since 10/19', '~3/day', 'make offers to fill', 'By lead type', 'lmSpeedBySource', 'sourceTrend'].every(x => !has(v, x)));
    ok('the title changed everywhere it shows', !has(fs.readFileSync(__dirname + '/lm.html', 'utf8'), 'LM Scoreboard') && has(fs.readFileSync(__dirname + '/lm.html', 'utf8'), '<title>CLT · Scoreboard</title>') && JSON.parse(fs.readFileSync(__dirname + '/manifest-lm.json', 'utf8')).name === 'CLT · Scoreboard');
    const a = await boot(andrew(fullRaw())), j = await boot(jordan(fullRaw())), h = a.view();
    ok('home: Make More Money without a figure', has(h, 'Make More Money — your levers →') && !has(h, 'earning levers'));
    ok('home: the eyebrow', has(h, 'class="eyebrow">Scoreboard<'));
    ok('home: no Solo line', !has(h, 'Solo'));
    const f = a.go('focus'), g = j.go('focus');
    ok('A6 states the rule: touches, in the lever and the coach, and no 15 calls anywhere', has(f, '15 touches, calls and texts') && has(a.go('kpi-A6'), '15 touches, calls and texts') && !has(v, '15 calls'));
    ok('JB1 names what it counts: nothing about handled', !has(v, 'due vs handled') && !has(v, 'you handled') && has(j.go('kpi-JB1'), 'Own book: due'));
    ok('no format left that hides a percent', !has(v, "'share'"));
    a.go(''); j.go('');
    ok('LM levers: the five, in plan order', ['30 working minutes', 'untouched queue', 'Holding under 1 hour', 'cadence', 'LQ + Comps before 4'].every((x, i, l) => has(f, x) && (!i || f.indexOf(l[i - 1]) < f.indexOf(x))));
    ok('each carries its number from Role Scorecard', has(f, 'lm-scen-now">85% · target 80%<') && has(f, 'lm-scen-now">0 · target 0<'));
    ok('a stale one among two says so', has(f, 'Cadence behind 3 · target not set · source stale'));
    ok('AM levers: 5.1 to offer, clear 5.1, MAO, walkthrough status, offer→contract', ['1 business day', 'Clear 5.1', 'MAO within ±5%', 'Walkthrough status same day', 'Offer→contract'].every(x => has(g, x)));
    ok('no dollars on either, and it says why', !has(f, '$') && !has(g, '$') && has(f, 'Pay plan not set') && has(g, 'Pay plan not set'));
    const evalIn = (P, pay, code) => P.run('(function(p){var M=lmRoleAttach(LMGamify.gamify(LMEngine.buildModel(p)),p);' + code + '})')(clone(pay));
    const keys = evalIn(a, Object.assign(andrew(fullRaw()), { payPlanSet: true, splitRate: 0.1 }), 'return lmLevers(lmFocus(M),M).map(function(l){return l.key;}).join();');
    ok('the pay queue dropped close, onedeal, dormant (' + keys + ')', !/close|onedeal|dormant/.test(keys) && keys.split(',').length >= 8);
    const goal = a.run("lmLevers({sr:0.95,l2a:0.2,tL2A:0.15,a2c:0.5,tA2C:0.5,apptsWk:2,dialsDay:40,leadsWk:5,perBooked:100,perShow:200,perDeal:400,perDial:1},{asOf:new Date(2026,10,3)}).filter(function(l){return l.key==='showrate';})[0]");
    ok('showT is capped: a 95% show rate never aims past 100%', has(goal.goal, '100%') && !has(goal.goal, '105%'));
    ok('the speed lever is 30 working minutes', has(a.run("lmLevers({sr:0.5,l2a:0.2,tL2A:0.15,a2c:0.5,tA2C:0.5,apptsWk:2,dialsDay:40,leadsWk:5,perBooked:100,perShow:200,perDeal:400,perDial:1},{asOf:new Date(2026,10,3)}).filter(function(l){return l.key==='speed';})[0].title"), '30 working minutes'));
    const wk = (raw, who) => evalIn(a, scopeToLM(raw, who), 'return {w:(M.asOf-M.startDate)/6048e5,calls:lmFocus(M).dialsDay};');
    ok('his start date comes from Team: 8/11 to 11/3 is 12 weeks', Math.round(wk(fullRaw(), A).w) === 12);
    ok('...and his rates divide by it: 100 dials over 12 weeks of 5 days, not 28 weeks', Math.abs(wk(fullRaw(), A).calls - 100 / 60) < 0.05);
    const iso = fullRaw(); iso.Team[3][3] = '2026-08-11T04:00:00.000Z';
    ok('...from a date cell too, on any device', Math.round(wk(iso, A).w) === 12);
    const noStart = fullRaw(); noStart.Team[3][3] = '';
    ok('no Start Date: his first activity (8/12)', Math.round(wk(noStart, A).w) === 12);
    const nothing = liveRaw(); nothing.Team[3][3] = ''; nothing.Calls = [nothing.Calls[0]];
    ok('nothing at all: no throw, one week floor', isFinite(evalIn(a, scopeToLM(nothing, A), 'return lmFocus(M).apptsWk;')));
    const y = Object.assign(jordan(fullRaw()), { payPlanSet: true, splitRate: 0.1 });
    const pay = await boot(y), pf = pay.go('focus', 'month');
    ok('the back button returns to the lens you came from, pay on', has(pf, ",'month','')") && !has(pf, "'ytd'"));
    ok('...and pay off', has(a.go('focus', 'quarter'), ",'quarter','')") && !has(a.view(), "'ytd'"));
    const old = await boot(andrew(fullRaw()), { hash: '#e=https://script.google.com/macros/s/AKx/exec&t=tok&r=lm&lens=ytd' });
    ok('a saved lens=ytd reads as week, and the lens bar lights up', has(old.view(), 'class="on" onclick="lmGo(\'Andrew Estrada\',\'week\',\'\')"') && has(old.ctx.lastHash, 'lens=week'));
    const junk = await boot(andrew(fullRaw()), { hash: '#e=https://script.google.com/macros/s/AKx/exec&t=tok&r=lm&lens=nope' });
    ok('a junk lens too', !has(junk.view(), 'RENDER ERROR') && has(junk.ctx.lastHash, 'lens=week'));
    const line = a.run("lmStreakHL({lenses:{week:{calls:{game:{streak:{current:1}}},speed:{game:{streak:{current:9}}}}}},'week')");
    ok('the streak line never names speed, even when speed has the best streak', !/speed/i.test(line) && has(line, 'dials pace'));
  }

  console.log('A SALTED TASK ON ANDREW\'S PHONE');
  {
    const TH = ['task_id', 'date', 'owner', 'visibility', 'status', 'kind', 'lead', 'ask', 'why', 'priority', 'due'];
    const t = (id, owner, ask, why) => [id, YDAY, owner, 'team', 'open', 'follow-up', 'Lead ' + id, ask, why, 2, ''];
    /* attached after scoping, as Code-LM.gs does: the scoper never carries Tasks */
    const withTasks = (p, rows) => { p.tabs.Tasks = [TH, ...rows]; p.tabs.Review = [['flag_id']]; return p; };
    const rows = o => [t('t1', o, 'Tell the seller the $200k stands', 'Seller said $185,000. Firm at $1.2M, and $ 95,500.50 before that'), t('t2', o, 'Pull comps at $/sqft for the block', 'Text him about the $9k gap'), t('t3', o, 'Her listing agent\'s contract ends Friday', 'She said so on the call')];
    const P = await boot(withTasks(andrew(fullRaw()), rows(A))), h = P.go('tasks');
    ok('no dollar figure prints', !/\$\s?\d/.test(h));
    ok('each one is masked in place, so the sentence still reads', has(h, 'Tell the seller the [figure] stands') && has(h, 'Seller said [figure]. Firm at [figure], and [figure] before that') && has(h, 'about the [figure] gap'));
    ok('the flag form repeats the ask with the figure masked', has(h, "label:'Tell the seller the [figure] stands'") && !has(h, "label:'Tell the seller the $200k"));
    ok('a rate is his work, not a figure: $/sqft stands', has(h, 'Pull comps at $/sqft'));
    ok('the task survives whole: plain English stands, three rows, none dropped', has(h, 'contract ends Friday') && (h.match(/class="lm-task-ask"/g) || []).length === 3);
    const bad = []; LENSES.forEach(l => ROUTES.filter(m => m !== 'tasks').forEach(m => { const x = P.go(m, l); if (/offer|contract|\$/i.test(x)) bad.push(l + ':' + m); }));
    ok('every other route stays bare with those tasks attached' + (bad.length ? ' ' + bad.slice(0, 4) : ''), bad.length === 0);
    const J2 = await boot(withTasks(jordan(fullRaw()), rows(J)));
    ok('an AM reads his own task whole', has(J2.go('tasks'), 'Tell the seller the $200k stands'));
  }

  console.log('SHEET TEXT THAT LOOKS LIKE A PROTOTYPE KEY');
  {
    for (const bad of ['constructor', '__proto__', 'Constructor']) {
      const raw = fullRaw(); raw['Deal Board'] = raw['Deal Board'].map(x => x[0] === 'o1' ? x.map((v, i) => i === 7 ? bad : v) : x);
      const P = await boot(andrew(raw)), d = P.go('deals');
      ok('an AM cell reading ' + bad + ': his Deals page renders, and groups it', !has(d, 'RENDER ERROR') && has(d, 'With ' + bad + ' (1)'));
    }
    for (const bad of ['constructor', '__proto__', 'toString']) {
      const raw = fullRaw(); raw['Deal Board'] = raw['Deal Board'].map(x => x[0] === 'o3' ? x.map((v, i) => i === 0 ? bad : v) : x);
      const p = jordan(raw); p.tabs.Tasks = [['task_id', 'owner', 'visibility', 'status', 'lead', 'ask', 'ghl_url', 'opp_id', 'priority'], ['t1', J, 'team', 'open', 'x', 'y', 'https://app.example.test/c/1', 'o2', 2]]; p.tabs.Review = [['flag_id']];
      const d = (await boot(p)).go('deals');
      ok('an Opp ID reading ' + bad + ': plain text, no function in an href', !has(d, '[native code]') && !has(d, '[object') && (d.match(/<a /g) || []).length === 1);
    }
  }

  console.log('A RENAMED BOARD COLUMN, ON THE PHONE');
  {
    const ren = (from, to) => { const raw = fullRaw(); raw['Deal Board'][0] = raw['Deal Board'][0].map(c => c === from ? to : c); return raw; };
    const staleDeals = async (raw, who) => { const P = await boot(who(raw)); return [has(P.view(), 'Deals &amp; Pipeline — source stale →'), has(P.go('deals'), STALE), !has(P.go('deals'), '0 deals'), !has(P.go('deals'), 'Nothing with the AM')].every(Boolean); };
    ok('LM renamed: Andrew says source stale, not 0 deals', await staleDeals(ren('LM', 'Lead Manager'), andrew));
    ok('AM renamed: Jordan says source stale, not 0 deals', await staleDeals(ren('AM', 'Acq Mgr'), jordan));
    ok('Opp ID, by case alone: both say it', await staleDeals(ren('Opp ID', 'Opp Id'), andrew) && await staleDeals(ren('Opp ID', 'Opp Id'), jordan));
    ok('Red renamed: Jordan is told, his reds are not silently cleared', await staleDeals(ren('Red', 'Late'), jordan));
    const hs = fullRaw(); hs['Role Scorecard'][0] = hs['Role Scorecard'][0].map(c => c === 'Target Status' ? 'Status' : c);
    const P = await boot(andrew(hs));
    ok('Target Status renamed: every tile says so, none reads target not set', has(tileBy(P.view(), 'First call on time'), STALE) && has(tileBy(P.view(), 'First call on time'), 'a column was renamed'));
  }

  console.log('AN AM WITH NO BOARD');
  {
    const mine = () => { const raw = liveRaw(); raw.Contracts.push(['', '10/20/2026', '', 'Signed', J, MF, 'Seller Mine', 'P9', '', '', 'c9', 'op-c9']); return raw; };
    const j = await boot(jordan(mine())), d = j.go('deals');
    ok('his page keeps the deal names, labelled as his LM deals off the tabs', has(d, 'Your LM deals') && has(d, 'from the Contracts and Offers tabs, not the board') && has(d, 'Seller Mine'));
    ok('...with the board still saying source stale, and no dollar', has(d, STALE) && !has(d, '$'));
    const a = await boot(andrew(mine()));
    ok('an LM never gets those lists', !has(a.go('deals'), 'Your LM deals'));
    const raw = mine(); Object.assign(raw, { 'Deal Board': fullRaw()['Deal Board'] });
    ok('a current board takes the page back', !has((await boot(jordan(raw))).go('deals'), 'Your LM deals'));
  }

  console.log('A LENS TAP STAYS PUT');
  {
    const a = await boot(andrew(fullRaw())); a.go(''); a.ctx.scrolls = 0;
    a.ctx.window.lmGo(A, 'month', '');
    ok('the home lens bar sits far down the page: a lens tap does not jump to the top', a.ctx.scrolls === 0 && has(a.ctx.lastHash, 'lens=month'));
    a.ctx.window.lmGo(A, 'month', 'kpi-A1');
    ok('a new page does', a.ctx.scrolls === 1);
    a.ctx.window.lmGo(A, 'month', '');
    ok('and so does the way back', a.ctx.scrolls === 2);
  }

  console.log('BACK FROM THE BACKGROUND');
  {
    const SIX_PM = RealDate.UTC(2026, 10, 3, 23, 2, 11), NEXT_TEN = RealDate.UTC(2026, 10, 4, 15, 0), clock = { t: SIX_PM };
    const raw = fullRaw(), P = await boot(andrew(raw), { at: clock }), wake = async () => { P.ctx.on.visibilitychange(); await new Promise(r => setTimeout(r, 30)); };
    ok('it listens: visibilitychange and pageshow', typeof P.ctx.on.visibilitychange === 'function' && typeof P.ctx.on.pageshow === 'function');
    ok('at boot, one fetch', P.ctx.fetches === 1);
    clock.t = SIX_PM + 60e3; await wake();
    ok('back within a minute: no fetch, nothing redrawn under an open form', P.ctx.fetches === 1);
    P.ctx.document.hidden = true; clock.t = NEXT_TEN; await wake();
    ok('a hide event fetches nothing', P.ctx.fetches === 1);
    P.ctx.document.hidden = false;
    const fresh = fullRaw(); fresh['Role Scorecard'] = fresh['Role Scorecard'].map((r, i) => i ? ['2026-11-03', ...r.slice(1)] : r); fresh['Deal Board'] = fresh['Deal Board'].map(r => r.map(c => c === STAMP ? '2026-11-04T10:40:00.000Z' : c));
    P.ctx.serve = andrew(fresh); await wake();
    ok('back the next morning: it fetches and shows today\'s numbers', P.ctx.fetches === 2 && !has(P.view(), 'lm-t-val stale">source stale</div><div class="lm-t-foot"><span>last run') && has(tileBy(P.view(), 'First call on time'), '85%'));
    ok('...the dot is live again', P.els.dot.className === 'dot ok' && has(P.els.fresh.textContent, 'live ·'));
    const Q = await boot(andrew(raw), { at: (clock.t = SIX_PM, clock) }), wq = async () => { Q.ctx.on.visibilitychange(); await new Promise(r => setTimeout(r, 30)); };
    clock.t = NEXT_TEN; Q.ctx.fails = 1; await wq();
    ok('no network: the tiles still read the clock, no old number passed off as today\'s', has(tileBy(Q.view(), 'First call on time'), STALE) && !has(tileBy(Q.view(), 'First call on time'), '85%'));
    ok('...the dot is red and dates its last good fetch', Q.els.dot.className === 'dot err' && /last \d{1,2}\/\d{1,2} /.test(Q.els.fresh.textContent));   // the device's own day, so no fixed date
    const D = await boot(andrew(raw), { at: (clock.t = SIX_PM, clock) }); const was = D.view();
    D.ctx.fields = [{ value: 'half a note', defaultValue: '' }]; clock.t = NEXT_TEN; D.ctx.on.visibilitychange(); await new Promise(r => setTimeout(r, 30));
    ok('a half-typed note holds it: no render, no fetch, and the dot says so', D.view() === was && D.ctx.fetches === 1 && /paused · last \d{1,2}\/\d{1,2} /.test(D.els.fresh.textContent));
    D.ctx.fields = [{ value: '', defaultValue: '' }]; D.ctx.fails = 0; D.ctx.on.visibilitychange(); await new Promise(r => setTimeout(r, 30));
    ok('...and an empty form does not', D.ctx.fetches === 2);
    const E = await boot(andrew(raw), { at: (clock.t = SIX_PM, clock) });
    clock.t = NEXT_TEN; E.ctx.on.pageshow({ persisted: false }); await new Promise(r => setTimeout(r, 30));
    ok('a plain pageshow is the first load, not a resume', E.ctx.fetches === 1);
    E.ctx.on.pageshow({ persisted: true }); await new Promise(r => setTimeout(r, 30));
    ok('a restore from the back-forward cache is', E.ctx.fetches === 2);
  }

  console.log('THE PHONE AT 375 PX');
  {
    const css = fs.readFileSync(__dirname + '/lm-view.css', 'utf8');
    ok('.lm-head wraps: a long word and the lens bar cannot sit side by side at 375', /\.lm-head\{[^}]*flex-wrap:wrap/.test(css));
    ok('the hero stacks on a phone, and the pace column drops its rule and its indent', /@media\(max-width:560px\)\{\.lm-hero\{grid-template-columns:1fr\}\.lm-hl-pace\{text-align:left;border-left:0;padding-left:0\}\}/.test(css));
    ok('...after the base rule, or the base rule wins', css.indexOf('.lm-hl-pace{text-align:right') < css.indexOf('.lm-hl-pace{text-align:left'));
  }

  console.log('LOAD FAILURE');
  {
    const P = await boot(andrew(liveRaw()), { failFirst: true });
    ok('a first load that fails shows setup, with url and token refilled', P.els.setup.style.display === '' && P.els.app.style.display === 'none' && P.els.inUrl.value === 'https://script.google.com/macros/s/AKx/exec' && P.els.inTok.value === 'tok' && has(P.els.setupErr.textContent, 'no network'));
    const G = await boot(andrew(fullRaw())), before = G.view();
    G.ctx.fails = 1; G.ctx.LMApp.refresh(); await new Promise(r => setTimeout(r, 30));
    ok('a failed refresh keeps the good screen, with a red dot', G.els.app.style.display !== 'none' && G.els.setup.style.display === 'none' && G.els.dot.className === 'dot err' && G.view() === before);
    G.ctx.fails = 0; G.ctx.LMApp.refresh(); await new Promise(r => setTimeout(r, 30));
    ok('...and the next good one clears it', G.els.dot.className === 'dot ok');
    const N = await boot(andrew(liveRaw()), { hash: '#e=https://script.google.com/macros/s/AKx/exec' });
    ok('a link with no token shows setup, the url filled, the token box empty', N.els.setup.style.display === '' && N.els.inUrl.value === 'https://script.google.com/macros/s/AKx/exec' && !(N.els.inTok && N.els.inTok.value));
  }

  console.log('OWNER PREVIEW: the same screens');
  {
    const lmHtml = fs.readFileSync(__dirname + '/lm-view.js', 'utf8');
    const preview = (raw, Pinned, route) => new Function('RAW', 'LMEngine', 'LMGamify', 'route', 'Date',
      "const VIEWS={},charts={},window={LMEngine:LMEngine,LMGamify:LMGamify};function go(){}const $=()=>({});const css=()=>'#3FD0FF';function mk(){}\n" + lmHtml + '\n' +
      src.slice(src.indexOf('function scopeToLM(RAW, person){'), src.indexOf('/* ═══════════ VIEWS')) + '\n' + src.slice(src.indexOf('/* ═══════════ LM SCOREBOARD VIEW'), src.indexOf('function mk(id,conf)')) +
      '\nreturn {VIEWS};')(raw, require('./lm-engine.js'), require('./lm-gamify.js'), route, Pinned);
    const tiles = h => (h.match(/lm-t-(lbl|val)[^>]*>[^<]*/g) || []).join('|');
    global.Date = pinned(TEN);   // the required engine reads this realm's clock; the phone's reads its own
    for (const [name, raw] of [['live shape', liveRaw()], ['both tabs', fullRaw()]]) {
      const route = { v: 'lm', c: '' }, D = preview(raw, pinned(TEN), route);
      for (const who of [A, J]) {
        route.c = who + '~week~';
        const h = D.VIEWS.lm().html, P = await boot(scopeToLM(raw, who));
        ok(name + ', ' + who.split(' ')[0] + ': the same tiles as the phone', tiles(h) !== '' && tiles(h) === tiles(P.view()));
        route.c = who + '~week~deals';
        ok(name + ', ' + who.split(' ')[0] + ': the same Deals page', D.VIEWS.lm().html.replace(/\s+/g, ' ') === P.go('deals').replace(/\s+/g, ' '));
      }
      route.c = A + '~week~offersMade';
      ok(name + ': Michael sees what Andrew sees', has(D.VIEWS.lm().html, 'NOT ON THIS PHONE'));
    }
    global.Date = RealDate;
  }

  /* the day strip and every date above turn on the sheet's clock, and neither phone is on Eastern */
  if (!process.env.PHONE_ROLES_TZ) {
    console.log('THE SAME, ON A DEVICE IN ANOTHER ZONE');
    ['America/Los_Angeles', 'Pacific/Honolulu', 'Asia/Tokyo'].forEach(tz => {
      const r = cp.spawnSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { TZ: tz, PHONE_ROLES_TZ: '1' }), encoding: 'utf8' });
      if (r.status) console.log(r.stdout.split('\n').filter(l => /✗|!/.test(l)).join('\n'));
      ok(tz + ': every check above', r.status === 0);
    });
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('   ! harness threw: ' + (e && e.stack || e)); process.exit(1); });
