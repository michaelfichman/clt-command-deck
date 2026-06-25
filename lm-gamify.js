/**
 * CLT Buyers — LM Scoreboard gamification layer  (lm-gamify.js)
 * ============================================================
 * Layers on top of lm-engine.js (does not modify it). Adds, per metric/lens:
 *   • streak       — consecutive periods above the bar (current + best)
 *   • pr           — personal record (best full-period value + date) & to-tie
 *   • paceToBeat   — what/period needed to beat last period (or a fixed target)
 *   • bars         — dual bar: trailing average (now) + fixed target (lmTargets)
 *   • paceState    — green/amber/red vs each bar
 * Plus leaderboard(entries, lens, metric) — solo today, head-to-head the moment
 * a 2nd LM exists, no rebuild.
 *
 * "Above the bar" is judged SAME-POINT-IN-PERIOD: a period's value-to-its-point
 * vs the trailing average of prior periods at the same point — consistent with
 * the engine's comparison logic, so an in-progress period is judged fairly.
 */
(function (root) {
  'use strict';
  var E = (typeof module !== 'undefined' && module.exports) ? require('./lm-engine.js') : root.LMEngine;

  // which engine series + aggregation backs each lens metric key
  var REG = {
    calls: { s: 'calls', mode: 'sum' }, outbound: { s: 'outbound', mode: 'sum' },
    talkTime: { s: 'talk', mode: 'sum' }, leads: { s: 'leads', mode: 'sum' },
    apptsBooked: { s: 'booked', mode: 'sum' }, apptsShowed: { s: 'showed', mode: 'sum' },
    offersMade: { s: 'offersMade', mode: 'sum' }, speed: { s: 'speed', mode: 'avg' },
    conversations: { s: 'conversations', mode: 'sum' }, qualifying: { s: 'qualifying', mode: 'sum' },
    connected: { s: 'connected', mode: 'sum' }, deepConv: { s: 'deepConv', mode: 'sum' },
    contractsSigned: { s: 'signed', mode: 'sum' }
  };
  var HIGHER_IS_BETTER = { speed: false }; // speed-to-lead: lower is better

  function fullWindow(shifted, lens) {
    var w = E.lensWindow(shifted, lens), s = w.start, end;
    if (lens === 'today') end = E.eod(shifted);
    else if (lens === 'week') end = E.eod(E.addDays(s, 6));
    else if (lens === 'month') end = E.eod(new Date(s.getFullYear(), s.getMonth() + 1, 0));
    else if (lens === 'quarter') end = E.eod(new Date(s.getFullYear(), s.getMonth() + 3, 0));
    else end = E.eod(new Date(s.getFullYear(), 11, 31));
    return { start: s, end: end };
  }
  function periodEndDate(asOf, lens) { return fullWindow(asOf, lens).end; }
  function daysLeftInPeriod(asOf, lens) {
    if (lens === 'today') return 0;
    return Math.max(0, Math.round((E.sod(periodEndDate(asOf, lens)).getTime() - E.sod(asOf).getTime()) / 864e5));
  }
  function lbl(d) { return (d.getMonth() + 1) + '/' + d.getDate(); }
  function better(metricKey, a, b) { return (HIGHER_IS_BETTER[metricKey] === false) ? a < b : a > b; }

  // to-date value of the period k steps back (same point-in-period)
  function valToDate(points, anchor, lens, k, mode) { return E.aggIn(points, E.lensWindow(E.shiftAsOf(anchor, lens, k), lens), mode); }

  function streak(points, asOf, lens, mode, metricKey, N) {
    N = N || 4;
    var anchor = E.anchorFor(points, asOf, lens).asOf, span = E.dataSpan(points);
    if (!span.lo) return { current: 0, best: 0 };
    var vals = [];
    for (var k = 0; k < 400; k++) { var w = E.lensWindow(E.shiftAsOf(anchor, lens, k), lens); if (w.end < span.lo) break; vals.push(valToDate(points, anchor, lens, k, mode)); }
    function barAt(k) { var s = 0, c = 0; for (var j = k + 1; j <= k + N && j < vals.length; j++) { s += vals[j]; c++; } return c ? s / c : null; }
    var above = vals.map(function (v, k) { var b = barAt(k); return b != null && better(metricKey, v, b); });
    var current = 0; for (var i = 0; i < above.length; i++) { if (above[i]) current++; else break; }
    var best = 0, run = 0; for (var x = above.length - 1; x >= 0; x--) { if (above[x]) { run++; if (run > best) best = run; } else run = 0; }
    return { current: current, best: best };
  }

  function pr(points, asOf, lens, mode, metricKey) {
    var anchor = E.anchorFor(points, asOf, lens).asOf, span = E.dataSpan(points);
    if (!span.lo) return null;
    var best = null;
    for (var k = 1; k < 800; k++) {
      var shifted = E.shiftAsOf(anchor, lens, k), fw = fullWindow(shifted, lens);
      if (fw.end < span.lo) break;
      if (fw.start > span.hi) continue;
      var v = E.aggIn(points, fw, mode);
      if (mode === 'avg' && v == null) continue;
      if (best == null || better(metricKey, v, best.value)) best = { value: v, date: fw.end, label: lbl(fw.end) };
    }
    var cur = E.aggIn(points, E.lensWindow(anchor, lens), mode);
    var toTie = (best == null || cur == null) ? null : (HIGHER_IS_BETTER[metricKey] === false ? null : Math.max(0, best.value - cur));
    return { best: best, current: cur, toTie: toTie, isRecord: best != null && cur != null && better(metricKey, cur, best.value) };
  }

  function paceToBeat(points, asOf, lens, mode, metricKey, fixedTarget) {
    var anchor = E.anchorFor(points, asOf, lens).asOf;
    var cur = E.aggIn(points, E.lensWindow(anchor, lens), mode);
    var lastFull = E.aggIn(points, fullWindow(E.shiftAsOf(anchor, lens, 1), lens), mode);
    var target = (fixedTarget != null) ? fixedTarget : lastFull;        // beat fixed target if set, else last period
    var basis = (fixedTarget != null) ? 'target' : 'last period';
    var daysLeft = daysLeftInPeriod(anchor, lens);
    var remaining = (target == null || cur == null) ? null : Math.max(0, target - cur);
    return {
      current: cur, target: target, basis: basis, daysLeft: daysLeft,
      remaining: remaining,
      perDayNeeded: (remaining == null || daysLeft <= 0) ? null : remaining / daysLeft,
      alreadyBeat: (target != null && cur != null) ? cur > target : null
    };
  }

  // working-days per lens — a `daily` count target fans out to every timeframe
  var DAYS_IN = { today: 1, week: 5, month: 21.7, quarter: 65, ytd: 130 };
  // Resolve a metric's target for a lens. Priority:
  //   1. exact (metric, lens) row  — explicit per-lens override
  //   2. `daily` base × working-days-in-lens — counts auto-fill all timeframes
  //   3. blank-lens row (flat) — ratios/averages (same value every lens)
  function fixedTarget(lmTargets, metricKey, lens, person) {
    if (!lmTargets || !lmTargets.length) return null;
    var mk = metricKey.toLowerCase(), ll = lens.toLowerCase(), pl = String(person || '').toLowerCase();
    var exact = null, daily = null, flat = null;
    for (var i = 0; i < lmTargets.length; i++) {
      var t = lmTargets[i];
      if (String(t.Metric || '').toLowerCase() !== mk) continue;
      if (t.Person && String(t.Person).toLowerCase() !== pl) continue;
      var v = +t.Target; if (!isFinite(v) || t.Target === '' || t.Target == null) continue;
      var ln = String(t.Lens || '').toLowerCase();
      if (ln === ll) exact = v;
      else if (ln === 'daily') daily = v;
      else if (ln === '') flat = v;
    }
    if (exact != null) return exact;
    if (daily != null) return daily * (DAYS_IN[ll] || 1);
    if (flat != null) return flat;
    return null;
  }
  function paceState(metricKey, cur, bar) {
    if (bar == null || !isFinite(bar) || bar === 0 || cur == null) return 'none';
    var r = (HIGHER_IS_BETTER[metricKey] === false) ? bar / cur : cur / bar;
    return r >= 1.0 ? 'ahead' : (r >= 0.9 ? 'on' : 'behind');
  }

  // Enrich a built model in place: attaches `.game` to each gamified lens metric.
  function gamify(model) {
    var asOf = model.asOf, person = model.person, targets = model.lmTargets || [];
    E.LENSES.forEach(function (lens) {
      var L = model.lenses[lens] || {};
      // EVERY lens metric (incl. ratios + the call-quality tiers) gets a target bar.
      // streak/PR/pace need a single backing point series (REG); ratios have none → null those, keep the target.
      Object.keys(L).forEach(function (mk) {
        var lm = L[mk];
        if (!lm || typeof lm.current === 'undefined') return;
        var reg = REG[mk], pts = reg ? (model.series[reg.s] || []) : null, mode = reg ? reg.mode : 'sum';
        var ft = fixedTarget(targets, mk, lens, person);
        lm.game = {
          streak: pts ? streak(pts, asOf, lens, mode, mk) : null,
          pr: pts ? pr(pts, asOf, lens, mode, mk) : null,
          paceToBeat: pts ? paceToBeat(pts, asOf, lens, mode, mk, ft) : null,
          bars: { trailing: lm.bar, target: ft },
          paceVsTrailing: paceState(mk, lm.current, lm.bar),
          paceVsTarget: ft == null ? 'none' : paceState(mk, lm.current, ft)
        };
      });
    });
    return model;
  }

  // Leaderboard — entries: [{person, model}]. Solo → single rank-1 entry.
  function leaderboard(entries, lens, metricKey) {
    var higher = HIGHER_IS_BETTER[metricKey] !== false;
    var arr = entries.map(function (e) { return { person: e.person, value: (e.model.lenses[lens][metricKey] || {}).current }; });
    arr.sort(function (a, b) { return higher ? (b.value - a.value) : (a.value - b.value); });
    arr.forEach(function (x, i) { x.rank = i + 1; x.percentile = arr.length > 1 ? Math.round((arr.length - 1 - i) / (arr.length - 1) * 100) : 100; });
    return { solo: arr.length < 2, lens: lens, metric: metricKey, ranks: arr };
  }

  var API = { gamify: gamify, leaderboard: leaderboard, streak: streak, pr: pr, paceToBeat: paceToBeat, fixedTarget: fixedTarget, REG: REG };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.LMGamify = API;
})(typeof self !== 'undefined' ? self : this);
