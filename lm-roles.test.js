/* D1 client test: counting by role tag, one population per ratio, pace direction, money by the LM
 * role, 'Pay plan not set' on the phone and the owner preview. Both payload shapes.
 * SYNTHETIC rows and fake dollars on the live headers (no private fixture). Run: node lm-roles.test.js
 * The end-to-end check on the real rows through Code-LM.gs lives in apps-script-roles.test.js. */
const fs = require('fs'), vm = require('vm');
const J = 'Jordan Mathis', A = 'Andrew Estrada', MF = 'Michael Fichman';
const ASOF = '10/29/2026 12:00:00';   // a Thursday: the week lens opens Mon 10/26

/* A fixed clock for the phone and preview, which build their model on "now". */
const RealDate = Date, FIXED = new RealDate(2026, 9, 29, 12, 0, 0).getTime();
class PinnedDate extends RealDate { constructor(...a) { if (a.length === 0) super(FIXED); else super(...a); } static now() { return FIXED; } }

const AH = ['Confirmed Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Gap (Days)'];
const OH = ['Offer Made Date'].concat(AH.slice(1));
const KH = ['Sent Date', 'Signed Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Opportunity ID', 'Gap Sent→Sign', 'Gap Sign→Close', 'Gap Sign→Cancellation', 'Gross Assignment Fee (derived)', 'Derived-gross note (documentation only — read by nothing)'];
const CH = ['Closed Date', 'Revenue', 'Booker (LM)', 'AM', 'DM', 'Contact Name', 'Property Address', 'Phone', 'Email', 'Contact ID', 'Gross Assignment Fee (derived)'];
const SH = ['Lead Created At', 'First Call At', 'Speed (Min)', 'Lead Source', 'Contact Name', 'Phone', 'Assigned User', 'Contact ID', 'Lead Source 2', '', 'AVG', '', '', 'Speed Call (min)', 'Speed SMS (min)', 'Speed First Touch (min)', 'First Touch Channel', 'Connected (Y/N)', 'Speed to Connect (min)', 'Connect Basis'];
const appt = (conf, dispo, out, lm, am, name, cid, as) => [conf, dispo, out, lm, am, name, 'PROP-' + cid, '', '', cid, '', as];
const offer = (made, dispo, out, lm, am, name, cid, as) => [made, dispo, out, lm, am, name, 'PROP-' + cid, '', '', cid, '', as];
const deal = (sent, signed, dispo, out, lm, am, name, cid, gross, as) => [sent, signed, dispo, out, lm, am, name, 'PROP-' + cid, '', '', cid, 'op-' + cid, '', '', '', gross, '', as];
const closing = (date, rev, lm, am, dm, name, cid, gross, as) => [date, rev, lm, am, dm, name, 'PROP-' + cid, '', '', cid, gross, as];
const speedRow = (d, min, conn) => [d, d, min, 'MLS', 'Lead', '', J, 's' + d, 'MLS', '', '', '', '', min, '', min, 'Call', conn, '', ''];

/* Jordan as the endpoint serves him. c1 is his LM deal; c2 is Andrew's lead he is the AM of. */
function jordan() {
  return {
    ok: true, role: 'lm', person: J, teamRole: 'AM, LM', payPlanSet: false, splitRate: null, fetchedAt: '2026-10-29T12:00:00.000Z',
    fees: { c5: 31111, c6: 21111 }, stages: { c5: 'Under Contract', c6: '' }, goals: { avgWholesaleFee: 20000 },
    lmTargets: [{ Metric: 'speed', Lens: '', Person: J, Target: 30 }],
    tabs: {
      Calls: [['Date', 'User', 'Total Calls', 'Inbound Calls', 'Outbound Calls', 'Total Talk Time (min)', 'Conversations'], ['10/27/2026', J, 40, 0, 40, 30, 5], ['10/20/2026', J, 50, 0, 50, 30, 5]],
      Leads: [['Created Date', 'Lead Source', 'Contact Name', 'Phone', 'Email', 'Property Address', 'Assigned User', 'Contact ID'],
        ['10/27/2026', 'MLS', 'Lead One', '', '', '', J, 'l1'], ['10/5/2026', 'MLS', 'Lead Two', '', '', '', J, 'l2']],
      Appointments: [AH.concat(['_as']),
        appt('10/26/2026', '', 'Confirmed', J, J, 'Seller One', 'c1', 'LM,AM'),
        appt('', '10/27/2026', 'Showed', J, J, 'Seller One', 'c1', 'LM,AM'),
        appt('10/26/2026', '', 'Confirmed', A, J, 'Seller Two', 'c2', 'AM'),
        appt('', '10/28/2026', 'Showed', A, J, 'Seller Two', 'c2', 'AM'),
        appt('', '10/28/2026', 'Cancelled', MF, MF, 'Seller One', 'c1', ''),
        appt('', '10/28/2026', 'Showed', MF, MF, 'Seller One', 'c1', '')],
      Offers: [OH.concat(['_as']),
        offer('10/26/2026', '', 'Made', A, J, 'Seller Two', 'c2', 'AM'),
        offer('10/27/2026', '', 'Made', J, MF, 'Seller Three', 'c3', 'LM'),
        offer('10/26/2026', '', 'Made', J, MF, 'Seller Four', 'c4', 'LM'),
        offer('', '10/28/2026', 'Declined', MF, MF, 'Seller Four', 'c4', '')],
      Contracts: [KH.concat(['_as']),
        deal('', '10/27/2026', '', 'Signed', A, J, 'Seller Two', 'c2', '', 'AM'),
        deal('', '10/20/2026', '', 'Signed', J, MF, 'Seller Five', 'c5', 31111, 'LM'),
        deal('', '10/5/2026', '', 'Signed', J, MF, 'Seller Six', 'c6', 21111, 'LM'),
        deal('', '', '10/9/2026', 'Cancelled', MF, MF, 'Seller Six', 'c6', 21111, '')],
      Closings: [CH.concat(['_as']),
        closing('10/15/2026', 8111, J, MF, MF, 'Seller Seven', 'c7', 10111, 'LM'),
        closing('10/16/2026', '', A, J, MF, 'Seller Eight', 'c8', '', 'AM'),
        closing('10/17/2026', '', MF, MF, J, 'Seller Nine', 'c9', '', 'DM')],
      'Speed to Lead': [SH, speedRow('10/27/2026', 20, 'Y'), speedRow('10/26/2026', 40, 'N')],
      Team: [['Name', 'Role', 'Active', 'Start Date'], [J, 'AM, LM', 'Yes', '4/22/2026'], [A, 'LM', 'Yes', '8/11/2026']]
    }
  };
}
/* The same payload from an endpoint before D1: no `_as`, no teamRole, no payPlanSet, splitRate 0.1. */
function oldShape(p) {
  const out = JSON.parse(JSON.stringify(p));
  delete out.teamRole; delete out.payPlanSet; out.splitRate = 0.1;
  ['Appointments', 'Offers', 'Contracts', 'Closings'].forEach(t => { out.tabs[t] = out.tabs[t].map(r => r.slice(0, -1)); });
  return out;
}

let pass = 0, fail = 0;
const ok = (l, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + l); c ? pass++ : fail++; };
const E = require('./lm-engine.js'), G = require('./lm-gamify.js');
const model = p => G.gamify(E.buildModel(p, ASOF));
const every = (m, key, pred) => E.LENSES.every(l => { const x = m.lenses[l][key]; return pred(x.current) && (x.bar == null || pred(x.bar)) && (x.comparison == null || pred(x.comparison)) && x.trend.every(b => pred(b.value)); });
const atMost1 = v => v == null || v <= 1;

/* ═══ counting ═══ */
console.log('COUNTING — by the role tag, never the contact');
{
  const M = model(jordan()), W = M.lenses.week;
  ok('booked counts LM rows only: the AM row on Andrew\'s lead is not his', W.apptsBooked.current === 1);
  ok('showed counts LM rows only: neither the AM row nor Michael\'s record row', W.apptsShowed.current === 1);
  ok('AM view: Team role AM → dealRole AM', M.dealRole === 'AM' && M.teamRole === 'AM, LM');
  ok('AM view: offersMade counts AM rows, not his LM-era rows', W.offersMade.current === 1);
  ok('AM view: contracts count AM rows, not his LM-era rows', W.contractsSigned.current === 1 && M.lenses.month.contractsSigned.current === 1);
  ok('a comma tag counts for both roles, spaces and case forgiven', E.hasRole({ as: ['LM', 'AM'] }, 'AM') && E.hasRole({ as: ['LM', 'AM'] }, 'LM') && !E.hasRole({ as: [] }, 'LM'));
  const p = jordan(); p.tabs.Appointments[1][11] = ' lm , AM ';
  ok('`_as` is split on the comma, never compared whole', model(p).lenses.week.apptsBooked.current === 1);
  const lmOnly = jordan(); lmOnly.teamRole = 'LM';
  const L = model(lmOnly);
  ok('LM view: offers and contracts count the LM rows', L.dealRole === 'LM' && L.lenses.week.offersMade.current === 2 && L.lenses.week.contractsSigned.current === 0 && L.lenses.month.contractsSigned.current === 2);
  ok('a blank `_as` row counts for nobody in any view', L.lenses.week.apptsShowed.current === 1);
}
console.log('BOTH PAYLOAD SHAPES');
{
  const o = oldShape(jordan()), M = model(o), W = M.lenses.week;
  ok('no `_as` column: every row is the LM\'s, as it always was', W.apptsBooked.current === 2 && W.apptsShowed.current === 3 && W.offersMade.current === 3 && W.contractsSigned.current === 1);
  ok('no `_as`: LM view even if the Team role says AM', (() => { const p = oldShape(jordan()); p.teamRole = 'AM, LM'; const m = model(p); return m.dealRole === 'LM' && m.lenses.week.offersMade.current === 3; })());
  ok('no flag: pay stays hidden', M.payPlanSet === false);
  const n = model(jordan());
  ok('the shapes differ only where the tags say so: calls and leads match', W.calls.current === n.lenses.week.calls.current && W.leads.current === n.lenses.week.leads.current);
  const bare = jordan(); delete bare.tabs.Closings; delete bare.teamRole; delete bare.payPlanSet;
  ok('a tab missing altogether never throws', !!model(bare).comp);
}

/* ═══ ratios ═══ */
console.log('RATIOS — one population, never over 100%');
{
  const M = model(jordan()), W = M.lenses.week;
  ok('show rate: LM showed ÷ LM booked', W.showRate.current === 1);
  ok('appt→contract: both sides by the deal role (1 AM signed ÷ 2 AM showed)', W.apptToContract.current === 0.5);
  const lmOnly = jordan(); lmOnly.teamRole = 'LM';
  ok('...and by the LM role in the LM view (0 of 1)', model(lmOnly).lenses.week.apptToContract.current === 0);
  const p = jordan(); p.tabs.Appointments.push(appt('', '10/27/2026', 'Showed', J, MF, 'Seller Ten', 'c10', 'LM'), appt('', '10/27/2026', 'Showed', J, MF, 'Seller Eleven', 'c11', 'LM'));
  const C = model(p);
  ok('3 showed on 1 booked reads 100% and says it is capped', C.lenses.week.showRate.current === 1 && C.lenses.week.showRate.capped === true);
  ok('an uncapped ratio does not claim it', C.lenses.week.apptToContract.capped === false);
  ok('the bar, the comparison and every trend bucket are capped too', ['showRate', 'leadToAppt', 'apptToContract', 'reached', 'connectRate', 'attemptConnect'].every(k => every(C, k, atMost1)));
  ok('the old shape is capped as well', every(model(oldShape(p)), 'showRate', atMost1));
  const s = W.apptToContract.trend[W.apptToContract.trend.length - 1];
  ok('a ratio bucket carries its own counts for the chart', s.num === 1 && s.den === 2);
  const o = model(oldShape(jordan())).lenses.month;
  ok('on an old payload those counts equal the count tiles\' trend', JSON.stringify(o.showRate.trend.map(b => b.num)) === JSON.stringify(o.apptsShowed.trend.map(b => b.value)) && JSON.stringify(o.leadToAppt.trend.map(b => b.den)) === JSON.stringify(o.leads.trend.map(b => b.value)));

  const q = jordan();   // audit DECK-10: 2 leads on the Leads tab, 26 on the Speed tab, 8 reached → it read 400%
  q.tabs['Speed to Lead'] = [SH];
  for (let i = 0; i < 26; i++) q.tabs['Speed to Lead'].push(speedRow('10/' + (i % 2 ? 27 : 26) + '/2026', 20, i < 8 ? 'Y' : 'N'));
  q.tabs['Speed to Lead'].push(speedRow('10/28/2026', '', ''));   // a new lead nobody has touched: on the base, off the top
  const R = model(q).lenses.week.reached;
  ok('reached: Speed reaches ÷ Speed rows (8 of 27), not ÷ the 1 Leads-tab lead', Math.abs(R.current - 8 / 27) < 1e-9 && R.capped === false);
  ok('reach panel: speedLeads is the base; newLeads stays the Leads tab for the nightly', R.reach.speedLeads === 27 && R.reach.newLeads === 1 && R.reach.touched === 26 && R.reach.connected === 8);
}

/* ═══ pace ═══ */
console.log('PACE — direction-aware');
{
  ok('registry: speed, J1, J6, J7, J8 (any case); not calls; not inherited keys', ['speed', 'J1', 'j6', 'J7', 'j8'].every(E.lowerIsBetter) && !E.lowerIsBetter('calls') && !E.lowerIsBetter('J4') && !E.lowerIsBetter('constructor'));
  ok('lower: under the bar is ahead', E.paceState(10, 20, true) === 'ahead');
  ok('lower: within 10% over is on', E.paceState(21, 20, true) === 'on');
  ok('lower: well over is behind', E.paceState(30, 20, true) === 'behind');
  ok('lower: zero is ahead', E.paceState(0, 20, true) === 'ahead');
  ok('higher is unchanged', E.paceState(20, 20) === 'ahead' && E.paceState(19, 20) === 'on' && E.paceState(10, 20) === 'behind');
  ok('no current value is no read, either way', E.paceState(null, 20, true) === 'none' && E.paceState(null, 20) === 'none');
  const P = [{ date: new Date(2026, 9, 27), value: 10 }, { date: new Date(2026, 9, 20), value: 40 }, { date: new Date(2026, 9, 13), value: 40 }];
  const AT = E.parseDate(ASOF);
  const fast = E.metricLens(P, AT, 'week', 'avg', 2, false, null, 'speed'), slow = E.metricLens(P, AT, 'week', 'avg', 2, false, null);
  ok('metricLens: a fast week on the speed key reads ahead (it read behind)', fast.current === 10 && fast.paceState === 'ahead' && slow.paceState === 'behind');
  const F = E.metricLens(P, AT, 'week', 'avg', 2, false, null, 'J1');
  ok('...and so does a J key', F.paceState === 'ahead');
  const under = G.paceToBeat(P, AT, 'week', 'avg', 'speed', 30), over = G.paceToBeat(P, AT, 'week', 'avg', 'speed', 5);
  ok('paceToBeat lower: under the target has beaten it, nothing left', under.alreadyBeat === true && under.remaining === 0 && under.lower === true);
  ok('paceToBeat lower: over it, remaining is what to cut', over.alreadyBeat === false && over.remaining === 5);
  ok('paceToBeat lower: an average has no per-day amount', over.perDayNeeded === null);
  const up = G.paceToBeat(P, AT, 'week', 'sum', 'calls', 20);
  ok('paceToBeat higher is unchanged', up.alreadyBeat === false && up.remaining === 10 && up.perDayNeeded === 10 / up.daysLeft);
  const s = jordan(); s.tabs['Speed to Lead'] = [SH, speedRow('10/27/2026', 10, 'Y'), speedRow('10/20/2026', 40, 'Y'), speedRow('10/13/2026', 40, 'Y'), speedRow('10/6/2026', 40, 'Y'), speedRow('9/29/2026', 40, 'Y')];
  const sw = model(s).lenses.week.speed;
  ok('the speed tile: a fast week reads ahead, and agrees with gamify', sw.current === 10 && sw.bar === 40 && sw.paceState === 'ahead' && sw.game.paceVsTrailing === 'ahead');

  /* An 'avg' period with no rows has no reading. Counted as 0 it pulled the bar under a steady LM and read them red. */
  const d = (m, day, v) => ({ date: new Date(2026, m, day), value: v });
  const gap = [d(9, 27, 60), d(9, 20, 60), d(9, 6, 60)];   // the week of 10/12 has no rows
  const wk = E.metricLens(gap, AT, 'week', 'avg', 3, false, null, 'speed');
  ok('a steady 60 min with one empty week: bar 60, ahead (it read 45, behind)', wk.bar === 60 && wk.paceState === 'ahead' && E.trailingBar(gap, AT, 'week', 'avg', 3) === 60);
  const days = []; for (let i = 0; i < 14; i++) { const x = new Date(2026, 9, 29 - i); if (x.getDay() % 6) days.push({ date: x, value: 30 }); }
  const td = E.metricLens(days, AT, 'today', 'avg', 4, false, null, 'speed');
  ok('a steady 30 min on weekdays: the weekends do not pull the bar down (it read 21.4, behind)', td.bar === 30 && td.paceState === 'ahead');
  ok('no reading in the whole window: no bar, no colour', (x => x.bar === null && x.paceState === 'none')(E.metricLens([d(9, 27, 60)], AT, 'week', 'avg', 3, false, null, 'speed')));
  ok('a sum period with nothing in it is still a real 0', E.trailingBar([d(9, 20, 8), d(9, 6, 4)], AT, 'week', 'sum', 3) === 4);
  const flat = [d(9, 20, 40), d(9, 13, 40), d(9, 6, 40), d(8, 29, 40)];
  ok('streak: an empty period beats nothing (a null read as 0 under every speed bar)', G.streak(flat, AT, 'week', 'avg', 'speed').current === 0);
  ok('streak: an empty period does not break one either', G.streak([d(9, 20, 10), d(9, 6, 40), d(8, 29, 40), d(8, 22, 40)], AT, 'week', 'avg', 'speed').current === 1);
}

/* ═══ money ═══ */
console.log('MONEY — follows the LM role');
{
  const c = model(jordan()).comp, names = a => a.map(x => x.name).join();
  ok('an AM contract adds no bucket', names(c.earmarkedDeals.concat(c.projectedDeals)).indexOf('Seller Two') === -1);
  ok('his LM deal stays: Under Contract, earmarked', names(c.earmarkedDeals) === 'Seller Five');
  ok('Michael\'s Cancelled keeps the deal cancelled (the record row stays in)', names(c.projectedDeals).indexOf('Seller Six') === -1);
  ok('AM and DM closings add no earned row, not even at $0', names(c.earnedDeals) === 'Seller Seven' && c.earnedDeals.length === 1);
  ok('open offers: LM offers only, Michael\'s Declined respected', c.openOffers.map(o => o.name).join() === 'Seller Three');
  const o = model(oldShape(jordan())).comp;
  ok('old shape: every contact is his, as before', names(o.projectedDeals).indexOf('Seller Two') > -1 && names(o.earnedDeals).split(',').length === 3);
  const p = jordan(); p.tabs.Closings.push(closing('10/18/2026', '', A, J, MF, 'Seller Twelve', 'c12', '', 'AM'));
  p.tabs.Contracts.push(deal('', '10/1/2026', '', 'Signed', J, MF, 'Seller Twelve', 'c12', 5111, 'LM'));
  ok('a closing he is not LM on still takes the deal out of projected', model(p).comp.projectedDeals.every(d => d.name !== 'Seller Twelve'));
}

/* ── the phone: lm.html booted on a stub DOM ── */
function phone(pay) {
  const els = {}, charts = [];
  const el = id => (els[id] = els[id] || { id, style: {}, innerHTML: '', textContent: '', className: '', value: '', hidden: false, classList: { add() {}, remove() {}, contains() { return false; } }, scrollIntoView() {} });
  const ctx = {};
  Object.assign(ctx, {
    window: ctx, self: ctx, console, Date: PinnedDate, Math, JSON, isFinite, isNaN, parseInt, parseFloat, Number, String, Object, Array, RegExp, Promise, URLSearchParams, Error,
    setInterval: () => 0, clearInterval: () => {}, setTimeout, scrollTo: () => {}, getComputedStyle: () => ({ getPropertyValue: () => '#3FD0FF' }), Chart: function (el, conf) { charts.push(conf); return { destroy() {} }; },
    localStorage: { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; } },
    location: { hash: '#e=https://script.google.com/macros/s/AKx/exec&t=tok&r=lm' }, history: { replaceState() {} }, navigator: {},
    document: { getElementById: el, addEventListener: () => {}, documentElement: { classList: { add() {}, remove() {} } }, createElement: () => el('_tmp'), body: { appendChild() {} } }
  });
  ctx.fetch = () => Promise.resolve({ json: () => Promise.resolve(JSON.parse(JSON.stringify(pay))) });
  vm.createContext(ctx);
  ['lm-engine.js', 'lm-gamify.js', 'lm-view.js'].forEach(f => vm.runInContext(fs.readFileSync(__dirname + '/' + f, 'utf8'), ctx, { filename: f }));
  const html = fs.readFileSync(__dirname + '/lm.html', 'utf8');
  vm.runInContext(html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>')), ctx, { filename: 'lm.html#boot' });
  return { ctx, charts, view: () => els.view.innerHTML, go: (m, lens) => { ctx.window.lmGo(J, lens || 'week', m || ''); return els.view.innerHTML; } };
}
const NOPAY = 'Pay plan not set';
const money = h => /\$/.test(h);   // any dollar sign at all: a pay view must carry none
const KEYS = ['calls', 'conversations', 'qualifying', 'connectRate', 'reached', 'talkTime', 'speed', 'leads', 'apptsBooked', 'apptsShowed', 'offersMade', 'contractsSigned', 'showRate', 'leadToAppt', 'apptToContract'];
const BUCKETS = ['earned', 'earmarked', 'projected', 'potential'];
function sweep(label, P) {
  const home = P.view();
  ok(label + ': home says it, no pay cards', home.indexOf(NOPAY) > -1 && home.indexOf('lm-cstat') === -1 && !money(home));
  ok(label + ': the Make More Money button is gone', home.indexOf('Make More Money') === -1);
  ok(label + ': Deals & Pipeline stays, without the in-play figure', home.indexOf('Deals &amp; Pipeline →') > -1 && home.indexOf('in play') === -1);
  const d = P.go('deals');
  ok(label + ': deals: funnel and deal names, no dollars', d.indexOf(NOPAY) > -1 && d.indexOf('Funnel') > -1 && d.indexOf('Seller Five') > -1 && d.indexOf('Seller Three') > -1 && !money(d));
  ok(label + ': each bucket says it, no dollars, no deals', BUCKETS.every(b => { const h = P.go(b); return h.indexOf(NOPAY) > -1 && !money(h) && h.indexOf('lm-ladder') === -1; }));
  const f = P.go('focus');
  ok(label + ': a saved focus link says it, no levers, no dollars', f.indexOf(NOPAY) > -1 && !money(f) && f.indexOf('earning queue') === -1);
  ok(label + ': no tile detail carries a dollar (the coach lines dropped them)', KEYS.every(k => !money(P.go(k))) && KEYS.every(k => P.go(k).indexOf('RENDER ERROR') === -1));
}
(async function () {
  console.log('PHONE (lm.html) — pay hidden');
  const N = phone(jordan()); await new Promise(r => setTimeout(r, 40));
  sweep('new payload', N);
  const O = phone(oldShape(jordan())); await new Promise(r => setTimeout(r, 40));
  sweep('old payload', O);

  console.log('PHONE — the switch still works');
  const on = jordan(); on.payPlanSet = true; on.splitRate = 0.1;
  const Y = phone(on); await new Promise(r => setTimeout(r, 40));
  const h = Y.view();
  ok('payPlanSet true: the cards, the button and the figures are back', h.indexOf('lm-cstat') > -1 && h.indexOf('Make More Money') > -1 && h.indexOf('in play') > -1 && money(h) && h.indexOf(NOPAY) === -1);
  ok('...with the $ cut on his LM deal, and no AM deal', Y.go('earmarked').indexOf('$3,111') > -1 && Y.go('projected').indexOf('Seller Two') === -1);
  const truthy = jordan(); truthy.payPlanSet = 'true'; truthy.splitRate = 0.1;
  const T = phone(truthy); await new Promise(r => setTimeout(r, 40));
  ok('only a literal true opens it', T.view().indexOf(NOPAY) > -1);

  console.log('RECORDS — a list matches its tile');
  N.go('apptsBooked');
  const rec = k => (N.go(k).match(/RECORDS · this week \((\d+)\)/) || [])[1];
  ok('Appts Booked lists 1, not the AM row', rec('apptsBooked') === '1' && N.go('apptsBooked').indexOf('Seller Two') === -1);
  ok('Offers Made lists his AM row, not his LM rows', rec('offersMade') === '1' && N.go('offersMade').indexOf('Seller Two') > -1 && N.go('offersMade').indexOf('Seller Three') === -1);
  ok('Contracts lists his AM row', rec('contractsSigned') === '1');
  ok('Show Rate lists LM dispositions only (Michael\'s Showed is not his)', rec('showRate') === '1');
  ok('the old payload lists every row, as before', (() => { const k = O.go('apptsBooked'); return /RECORDS · this week \(2\)/.test(k); })());

  console.log('CHART — the counts behind the %');
  N.go('apptToContract');
  const c = N.charts[N.charts.length - 1].data.datasets, last = a => a[a.length - 1];
  ok('appt→contract plots its own population: 2 AM showed, 1 AM signed (not his 1 LM showed)', c[0].label === 'Showed' && last(c[0].data) === 2 && c[1].label === 'Contracts' && last(c[1].data) === 1);

  console.log('READOUT + SPEED');
  const cap = jordan(); cap.tabs.Appointments.push(appt('', '10/27/2026', 'Showed', J, MF, 'Seller Ten', 'c10', 'LM'));
  const C = phone(cap); await new Promise(r => setTimeout(r, 40));
  ok('a capped rate says so in the readout', C.go('showRate').indexOf('Capped at 100%: Showed ran ahead of Booked') > -1);
  const fast = jordan(), row = speedRow;
  fast.tabs['Speed to Lead'] = [SH, row('10/27/2026', 10, 'Y'), row('10/20/2026', 40, 'Y'), row('10/13/2026', 40, 'Y'), row('10/6/2026', 40, 'Y'), row('9/29/2026', 40, 'Y')];
  const FP = phone(fast); await new Promise(r => setTimeout(r, 40));
  const sp = FP.go('speed');
  ok('a fast week reads Faster, on the green class, never Above or Below', sp.indexOf('Faster than your trailing pace') > -1 && sp.indexOf('lm-big lm-ahead') > -1 && sp.indexOf('Above your trailing') === -1 && sp.indexOf('Below your trailing') === -1);
  ok('pace-to-beat on speed: the target and where he stands, never n/day', sp.indexOf('Pace to beat target') > -1 && sp.indexOf('under it') > -1 && sp.indexOf('/day') === -1);
  const rq = jordan(); rq.tabs['Speed to Lead'] = [SH];
  for (let i = 0; i < 26; i++) rq.tabs['Speed to Lead'].push(speedRow('10/' + (i % 2 ? 27 : 26) + '/2026', 20, i < 8 ? 'Y' : 'N'));
  rq.tabs['Speed to Lead'].push(speedRow('10/28/2026', '', ''));
  const RP = phone(rq); await new Promise(r => setTimeout(r, 40));
  const r = RP.go('reached');
  ok('reach panel: one base for every percentage (27 Speed rows, not the Leads tab\'s 1)', r.indexOf('of 27 speed-tracked leads') > -1 && r.indexOf('touched <b>26</b> (96%)') > -1 && r.indexOf('reached <b>8</b> (30%)') > -1);
  const rh = RP.view();
  ok('the tile names the same base', rh.indexOf('Reached (of tracked leads)') > -1 && rh.indexOf('of new leads') === -1);

  console.log('NO DATA — no value this period is no read, never a 100% drop');
  const nd = jordan();
  nd.tabs['Speed to Lead'] = [SH, row('10/20/2026', 40, 'Y'), row('10/13/2026', 40, 'Y')];
  nd.tabs.Appointments = [AH.concat(['_as']), appt('10/19/2026', '', 'Confirmed', J, J, 'Seller One', 'c1', 'LM,AM'), appt('', '10/20/2026', 'Showed', J, J, 'Seller One', 'c1', 'LM,AM')];
  const ND = phone(nd); await new Promise(r => setTimeout(r, 40));
  const tile = (h, label) => { const a = h.indexOf('<span class="lm-t-lbl">' + label); return h.slice(a, h.indexOf('</button>', a)); };
  const nh = ND.view();
  ok('Show Rate tile: no data, not ▼ 100%', tile(nh, 'Show Rate').indexOf('no data') > -1 && tile(nh, 'Show Rate').indexOf('▼') === -1);
  ok('Speed tile: no data, not ▼ 100%', tile(nh, 'Speed-to-Lead').indexOf('no data') > -1 && tile(nh, 'Speed-to-Lead').indexOf('▼') === -1);
  const ds = ND.go('showRate'), dp = ND.go('speed');
  ok('Show Rate detail + readout: no "slipping"', ds.indexOf('no data') > -1 && ds.indexOf('slipping') === -1 && ds.indexOf('100% down') === -1);
  ok('Speed detail + readout: no "right way"', dp.indexOf('no data') > -1 && dp.indexOf('right way') === -1 && dp.indexOf('100% down') === -1);
  ok('a real zero on a count tile still reads as the drop it is', tile(nh, 'Appts Booked').indexOf('▼ 100%') > -1);

  console.log('AM TILES — new credit reads as a count, never a record (D-10)');
  const AMV = phone(jordan()); await new Promise(r => setTimeout(r, 40));
  const tileOf = (h, label) => { const i = h.indexOf('lm-t-lbl">' + label + '<'); return h.slice(h.lastIndexOf('<button', i), h.indexOf('</button>', i)); };
  const home2 = AMV.view();
  ['Offers Made', 'Contracts', 'Appt→Contract'].forEach(l => {
    const t = tileOf(home2, l);
    ok(l + ': AM view has no badge, no pace colour, no % change, no rails', t.indexOf('lm-none') > -1 && t.indexOf('lm-badge') === -1 && t.indexOf('▲') === -1 && t.indexOf('▼') === -1 && t.indexOf('lm-t-bars') === -1 && t.indexOf('no comparison yet') > -1);
  });
  ok('the count itself still shows', /lm-t-val">\d/.test(tileOf(home2, 'Offers Made')));
  ['offersMade', 'contractsSigned', 'apptToContract'].forEach(k => {
    const d = AMV.go(k);
    ok(k + ': detail has no record card, no % line, no trailing-pace line', d.indexOf('Personal record') === -1 && d.indexOf('lm-gcards') === -1 && d.indexOf('vs last') === -1 && d.indexOf('trailing pace') === -1 && d.indexOf('no comparison yet') > -1);
  });
  ok('a tile that is his LM work still compares', tileOf(AMV.view(), 'Appts Booked').indexOf('no comparison yet') === -1);
  const lmOnly = jordan(); lmOnly.teamRole = 'LM';
  const LMV = phone(lmOnly); await new Promise(r => setTimeout(r, 40));
  ok('the LM view is unchanged: Offers Made still compares', tileOf(LMV.view(), 'Offers Made').indexOf('no comparison yet') === -1 && tileOf(LMV.view(), 'Offers Made').indexOf('vs ') > -1);
  const OLD = phone(oldShape(jordan())); await new Promise(r => setTimeout(r, 40));
  ok('an old payload has no AM view, so it still compares', tileOf(OLD.view(), 'Offers Made').indexOf('no comparison yet') === -1);

  console.log('OWNER PREVIEW (index.html scopeToLM + VIEWS.lm)');
  const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
  const raw = jordan().tabs;
  const strip = t => t.map(r => r.slice(0, -1));
  const pad = o => { const r = new Array(26).fill(''); Object.keys(o).forEach(k => { r[+k] = o[k]; }); return r; };
  const preview = new Function('RAW', 'LMEngine', 'LMGamify', 'route', 'Date',
    "const VIEWS={},charts={},window={LMEngine:LMEngine,LMGamify:LMGamify};function go(){}const $=()=>({});const css=()=>'#3FD0FF';function mk(){}\n" +
    fs.readFileSync(__dirname + '/lm-view.js', 'utf8') + '\n' +
    src.slice(src.indexOf('function scopeToLM(RAW, person){'), src.indexOf('/* ═══════════ VIEWS')) + '\n' +
    src.slice(src.indexOf('/* ═══════════ LM SCOREBOARD VIEW'), src.indexOf('function mk(id,conf)')) +
    '\nreturn {VIEWS,scopeToLM,lmTeam};');
  const RAW = { Calls: raw.Calls, Leads: raw.Leads, 'Speed to Lead': raw['Speed to Lead'], Team: [['Name', 'Role', 'Active', 'Start Date'], [J, 'AM, LM', 'Yes', ''], [MF, 'Owner, DM', 'Yes', ''], [A, 'LM', 'Yes', ''], ['Edward Peugh', 'Partner', 'Yes', ''], ['Sample Realm', 'Realm Lead', 'Yes', '']],
    Appointments: strip(raw.Appointments), Offers: strip(raw.Offers), Contracts: strip(raw.Contracts), Closings: strip(raw.Closings),
    Pipeline: [pad({ 23: 'Stage', 24: 'id', 25: 'Fee' }), pad({ 23: 'Under Contract', 24: 'c5', 25: 31111 }), pad({ 24: 'c6', 25: 21111 })],
    'Goals & Assumptions': [['Average Wholesale Profit Per Deal ($)', 20000]], 'LM Targets': [['Metric', 'Lens', 'Person', 'Target', 'Note']] };
  const route = { v: 'lm', c: '' }, D = preview(RAW, E, G, route, PinnedDate);
  ok('picker: LM or AM as a whole word, nobody else', D.lmTeam().join() === J + ',' + A);
  const scoped = D.scopeToLM(RAW, J);
  ok('scoper ships the same switch as the endpoint', scoped.payPlanSet === false && scoped.splitRate === null && scoped.teamRole === 'AM, LM');
  const P = { view: () => { route.c = J + '~week~'; return D.VIEWS.lm().html; }, go: (m, lens) => { route.c = J + '~' + (lens || 'week') + '~' + (m || ''); return D.VIEWS.lm().html; } };
  sweep('preview', P);
  const ph = phone(jordan()); await new Promise(r => setTimeout(r, 40));
  const tiles = h => (h.match(/lm-t-val">[^<]*/g) || []).join('|');
  ok('preview and phone render the same tiles for the same rows', tiles(P.view()) === tiles(ph.view()));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('   ! harness threw: ' + (e && e.stack || e)); process.exit(1); });
