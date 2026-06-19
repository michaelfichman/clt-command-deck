/**
 * CLT Buyers — LM Scoreboard time-lens engine  (lm-engine.js)
 * ===========================================================
 * Pure, framework-free. Runs in the browser (dashboard) and in Node (tests).
 * Consumes the scoped payload from Code-LM.gs and computes every metric across
 * FOUR LENSES — today / week / month / quarter (+ ytd) — each as:
 *     { current, comparison, comparePct, trend[], bar, paceState }
 * where `comparison` is SAME-POINT-IN-PERIOD (WTD vs last-week-through-the-
 * same-weekday, MTD vs same-day-last-month, …), never an unfair full-period.
 *
 * Pace bar here is the TRAILING-AVERAGE bar (Part 3a). The fixed-target bar
 * (Part 3b) and streaks/PRs are layered on in Part 3 via the hooks marked TODO.
 *
 * Weeks are Monday–Sunday to match the in-sheet LM Dashboard.
 */
(function (root) {
  'use strict';

  /* ---------------- date helpers ---------------- */
  function parseDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    var s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) { var iso = new Date(s); return isNaN(iso.getTime()) ? null : iso; }
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
    if (m) {
      var mo = +m[1], da = +m[2], yr = +m[3], hh = m[4] ? +m[4] : 0, mi = m[5] ? +m[5] : 0, se = m[6] ? +m[6] : 0, ap = m[7];
      if (ap) { ap = ap.toUpperCase(); if (ap === 'PM' && hh < 12) hh += 12; if (ap === 'AM' && hh === 12) hh = 0; }
      return new Date(yr, mo - 1, da, hh, mi, se);
    }
    var d = new Date(s); return isNaN(d.getTime()) ? null : d;
  }
  function sod(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function eod(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function mondayOf(d) { var x = sod(d); return addDays(x, -(((x.getDay() + 6) % 7))); } // Mon=0
  function lastDay(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function within(d, w) { return d != null && d.getTime() >= w.start.getTime() && d.getTime() <= w.end.getTime(); }

  var LENSES = ['today', 'week', 'month', 'quarter', 'ytd'];

  // Current-period window [start, asOf], capped at end-of-asOf-day.
  function lensWindow(asOf, lens) {
    var end = eod(asOf), s;
    if (lens === 'today') s = sod(asOf);
    else if (lens === 'week') s = mondayOf(asOf);
    else if (lens === 'month') s = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
    else if (lens === 'quarter') s = new Date(asOf.getFullYear(), Math.floor(asOf.getMonth() / 3) * 3, 1);
    else s = new Date(asOf.getFullYear(), 0, 1); // ytd
    return { start: s, end: end };
  }

  // Shift the as-of point back k whole periods, preserving point-in-period.
  function shiftAsOf(asOf, lens, k) {
    if (lens === 'today') return addDays(asOf, -k);
    if (lens === 'week') return addDays(asOf, -7 * k);
    if (lens === 'month') { var y = asOf.getFullYear(), mo = asOf.getMonth() - k; var d = new Date(y, mo, 1); return new Date(d.getFullYear(), d.getMonth(), Math.min(asOf.getDate(), lastDay(d.getFullYear(), d.getMonth())), asOf.getHours(), asOf.getMinutes()); }
    if (lens === 'quarter') { var d2 = new Date(asOf.getFullYear(), asOf.getMonth() - 3 * k, 1); return new Date(d2.getFullYear(), d2.getMonth(), Math.min(asOf.getDate(), lastDay(d2.getFullYear(), d2.getMonth())), asOf.getHours(), asOf.getMinutes()); }
    return new Date(asOf.getFullYear() - k, asOf.getMonth(), asOf.getDate()); // ytd
  }
  function priorWindow(asOf, lens) { return lensWindow(shiftAsOf(asOf, lens, 1), lens); }

  /* ---------------- series aggregation ---------------- */
  // points: [{date:Date, value:Number}]
  function aggIn(points, w, mode) {
    var sum = 0, n = 0;
    for (var i = 0; i < points.length; i++) {
      if (within(points[i].date, w)) { sum += (+points[i].value || 0); n++; }
    }
    if (mode === 'avg') return n ? sum / n : null;
    if (mode === 'count') return n;
    return sum; // 'sum'
  }
  function dataSpan(points) {
    var lo = null, hi = null;
    for (var i = 0; i < points.length; i++) { var d = points[i].date; if (!d) continue; if (!lo || d < lo) lo = d; if (!hi || d > hi) hi = d; }
    return { lo: lo, hi: hi };
  }
  // Latest day (start-of-day) with data on or before asOf — used to anchor the
  // TODAY lens to the most recent COMPLETE day. The sheet's daily-aggregated
  // tabs (Calls) post yesterday's totals next morning, so "today" shows the
  // latest closed day; live-today is watched in GHL, not here.
  function latestDay(points, asOf) {
    var cap = sod(asOf).getTime(), best = null;
    for (var i = 0; i < points.length; i++) { var d = points[i].date; if (!d) continue; var dd = sod(d); if (dd.getTime() <= cap && (!best || dd > best)) best = dd; }
    return best;
  }
  // For the TODAY lens, resolve the effective as-of to the latest data day.
  function anchorFor(points, asOf, lens) {
    if (lens !== 'today') return { asOf: asOf, anchorDate: null, lagged: false };
    var ld = latestDay(points, asOf);
    if (!ld) return { asOf: asOf, anchorDate: null, lagged: false };
    return { asOf: eod(ld), anchorDate: ld, lagged: sod(ld).getTime() < sod(asOf).getTime() };
  }

  // Trailing-average bar: mean over last N comparable periods (same point-in-period),
  // skipping periods entirely outside the data span (so pre-start zeros don't drag it).
  function trailingBar(points, asOf, lens, mode, N) {
    var span = dataSpan(points); if (!span.lo) return null;
    var vals = [];
    for (var k = 1; k <= N; k++) {
      var w = lensWindow(shiftAsOf(asOf, lens, k), lens);
      if (w.end < span.lo || w.start > span.hi) continue; // period has no data coverage at all
      var v = aggIn(points, w, mode);
      vals.push(v == null ? 0 : v);
    }
    if (!vals.length) return null;
    var s = 0; for (var j = 0; j < vals.length; j++) s += vals[j];
    return s / vals.length;
  }

  function paceState(current, bar) {
    if (bar == null || !isFinite(bar) || bar === 0) return 'none';
    var r = current / bar;
    if (r >= 1.0) return 'ahead';   // green
    if (r >= 0.9) return 'on';      // amber
    return 'behind';                // red
  }

  // Trend sub-buckets across a lens (label + window each).
  function trendBuckets(asOf, lens) {
    var out = [], i;
    if (lens === 'week') { var mon = mondayOf(asOf); for (i = 0; i <= ((sod(asOf) - mon) / 864e5); i++) { var d = addDays(mon, i); out.push({ label: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'][i], start: sod(d), end: eod(d) }); } return out; }
    if (lens === 'today') { for (i = 13; i >= 0; i--) { var dd = addDays(asOf, -i); out.push({ label: (dd.getMonth() + 1) + '/' + dd.getDate(), start: sod(dd), end: eod(dd) }); } return out; }
    if (lens === 'month') { var w = mondayOf(new Date(asOf.getFullYear(), asOf.getMonth(), 1)); while (w <= sod(asOf)) { var we = addDays(w, 6); out.push({ label: (w.getMonth() + 1) + '/' + w.getDate(), start: w, end: eod(we < asOf ? we : asOf) }); w = addDays(w, 7); } return out; }
    if (lens === 'quarter') { var qs = new Date(asOf.getFullYear(), Math.floor(asOf.getMonth() / 3) * 3, 1); var wk = mondayOf(qs); while (wk <= sod(asOf)) { var wke = addDays(wk, 6); out.push({ label: (wk.getMonth() + 1) + '/' + wk.getDate(), start: wk, end: eod(wke < asOf ? wke : asOf) }); wk = addDays(wk, 7); } return out; }
    // ytd → monthly
    for (i = 0; i <= asOf.getMonth(); i++) { var ms = new Date(asOf.getFullYear(), i, 1); var me = new Date(asOf.getFullYear(), i + 1, 0); out.push({ label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i], start: ms, end: eod(me < asOf ? me : asOf) }); }
    return out;
  }

  /* ---------------- a flow/avg metric across one lens ---------------- */
  function metricLens(points, asOf, lens, mode, N) {
    mode = mode || 'sum'; N = N || 4;
    var a = anchorFor(points, asOf, lens), at = a.asOf, nb = (lens === 'today') ? 14 : N;
    var cur = aggIn(points, lensWindow(at, lens), mode);
    var cmp = aggIn(points, priorWindow(at, lens), mode);
    var bar = trailingBar(points, at, lens, mode, nb);
    var buckets = trendBuckets(at, lens).map(function (b) { return { label: b.label, value: aggIn(points, b, mode) }; });
    var pct = (cmp == null || cmp === 0) ? null : ((cur - cmp) / cmp);
    return { current: cur, comparison: cmp, comparePct: pct, bar: bar, paceState: paceState(cur, bar), trend: buckets, anchorDate: a.anchorDate, lagged: a.lagged };
  }

  // Ratio metric (num/den) across one lens — show rate, lead→appt, appt→contract.
  function ratioLens(numPts, denPts, asOf, lens, N) {
    N = N || 4;
    var an = anchorFor(denPts, asOf, lens), at = an.asOf;
    function ratio(w) { var d = aggIn(denPts, w, 'sum'); return d ? aggIn(numPts, w, 'sum') / d : null; }
    var cur = ratio(lensWindow(at, lens));
    var cmp = ratio(priorWindow(at, lens));
    var span = dataSpan(denPts), vals = [];
    if (span.lo) for (var k = 1; k <= N; k++) { var w = lensWindow(shiftAsOf(at, lens, k), lens); if (w.end < span.lo || w.start > span.hi) continue; var r = ratio(w); if (r != null) vals.push(r); }
    var bar = vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : null;
    var buckets = trendBuckets(at, lens).map(function (b) { return { label: b.label, value: ratio(b) }; });
    var pct = (cmp == null || cmp === 0) ? null : ((cur - cmp) / cmp);
    return { current: cur, comparison: cmp, comparePct: pct, bar: bar, paceState: paceState(cur, bar), trend: buckets, anchorDate: an.anchorDate, lagged: an.lagged };
  }

  /* ---------------- parse the scoped payload ---------------- */
  function colIndexer(header) {
    return function (name) {
      for (var i = 0; i < header.length; i++) { if (String(header[i]).toLowerCase().trim() === name.toLowerCase()) return i; }
      return -1;
    };
  }
  function rowsOf(tab) { return (tab && tab.length > 1) ? tab.slice(1) : []; }

  function parse(payload) {
    var T = payload.tabs || {};
    function tab(name) { return T[name] || [['']]; }

    // Calls
    var c = tab('Calls'), ci = colIndexer(c[0]);
    var calls = rowsOf(c).map(function (r) {
      return { date: parseDate(r[ci('Date')]), total: +r[ci('Total Calls')] || 0, inbound: +r[ci('Inbound Calls')] || 0, outbound: +r[ci('Outbound Calls')] || 0, talk: +r[ci('Total Talk Time (min)')] || 0 };
    }).filter(function (x) { return x.date; });

    // Leads
    var l = tab('Leads'), li = colIndexer(l[0]);
    var leads = rowsOf(l).map(function (r) { return { date: parseDate(r[li('Created Date')]), source: r[li('Lead Source')] }; }).filter(function (x) { return x.date; });

    // Appointments
    var a = tab('Appointments'), ai = colIndexer(a[0]);
    var appts = rowsOf(a).map(function (r) {
      return { conf: parseDate(r[ai('Confirmed Date')]), dispo: parseDate(r[ai('Disposition Date')]), outcome: String(r[ai('Outcome')] || '').trim(), contactId: r[ai('Contact ID')] };
    });

    // Offers
    var o = tab('Offers'), oi = colIndexer(o[0]);
    var offers = rowsOf(o).map(function (r) {
      return { made: parseDate(r[oi('Offer Made Date')]), dispo: parseDate(r[oi('Disposition Date')]), outcome: String(r[oi('Outcome')] || '').trim(), contactId: r[oi('Contact ID')], name: r[oi('Contact Name')] };
    });

    // Contracts
    var k = tab('Contracts'), ki = colIndexer(k[0]);
    var contracts = rowsOf(k).map(function (r) {
      return { signed: parseDate(r[ki('Signed Date')]), dispo: parseDate(r[ki('Disposition Date')]), outcome: String(r[ki('Outcome')] || '').trim(), contactId: r[ki('Contact ID')], name: r[ki('Contact Name')] };
    });

    return { calls: calls, leads: leads, appts: appts, offers: offers, contracts: contracts,
      fees: payload.fees || {}, goals: payload.goals || {}, splitRate: payload.splitRate || 0.10, person: payload.person };
  }

  /* ---------------- opportunity resolution (latest status wins) ---------------- */
  // rank used to break ties when two rows share a date (later stage wins)
  var STAGE_RANK = { sent: 0, made: 1, confirmed: 1, signed: 2, showed: 2, accepted: 3, declined: 3, closed: 4, cancelled: 4, 'no show': 3 };
  function resolveByContact(rows, dateKeys) {
    var by = {};
    rows.forEach(function (r) { var id = r.contactId; if (!id) return; (by[id] = by[id] || []).push(r); });
    var out = {};
    Object.keys(by).forEach(function (id) {
      var best = null;
      by[id].forEach(function (r) {
        var d = null; for (var i = 0; i < dateKeys.length; i++) { if (r[dateKeys[i]]) { d = r[dateKeys[i]]; break; } }
        var rank = STAGE_RANK[(r.outcome || '').toLowerCase()]; if (rank == null) rank = 1;
        var score = (d ? d.getTime() : 0) + rank / 100; // date dominates, rank breaks ties
        if (!best || score >= best.score) best = { row: r, score: score, date: d };
      });
      out[id] = best;
    });
    return out;
  }

  /* ---------------- comp buckets (stocks, as-of now) ---------------- */
  function comp(ds) {
    var split = ds.splitRate, avgFee = +ds.goals.avgWholesaleFee || 0;
    var resC = resolveByContact(ds.contracts, ['dispo', 'signed']);
    var earned = 0, earmarked = 0, earnedDeals = [], earmarkedDeals = [];
    Object.keys(resC).forEach(function (id) {
      var st = (resC[id].row.outcome || '').toLowerCase(), fee = +ds.fees[id] || 0, cut = fee * split, nm = resC[id].row.name;
      if (st === 'closed') { earned += cut; earnedDeals.push({ name: nm, fee: fee, cut: cut }); }
      else if (st === 'signed') { earmarked += cut; earmarkedDeals.push({ name: nm, fee: fee, cut: cut }); }
      // cancelled → 0
    });
    // Open offers: latest offer status is "Made", and the contact is not already a contract.
    var contractIds = {}; ds.contracts.forEach(function (r) { if (r.contactId) contractIds[r.contactId] = true; });
    var resO = resolveByContact(ds.offers, ['dispo', 'made']);
    var openOffers = [];
    Object.keys(resO).forEach(function (id) {
      if ((resO[id].row.outcome || '').toLowerCase() === 'made' && !contractIds[id]) openOffers.push({ name: resO[id].row.name, contactId: id });
    });
    var potential = openOffers.length * avgFee * split;
    return {
      split: split, avgFee: avgFee,
      earned: earned, earmarked: earmarked, potential: potential,
      totalOpportunity: earmarked + potential,
      earnedDeals: earnedDeals, earmarkedDeals: earmarkedDeals, openOffers: openOffers
    };
  }

  /* ---------------- top-level model ---------------- */
  function buildModel(payload, asOfInput) {
    var ds = parse(payload);
    var asOf = asOfInput ? parseDate(asOfInput) : new Date();

    var P = {
      calls: ds.calls.map(function (c) { return { date: c.date, value: c.total }; }),
      outbound: ds.calls.map(function (c) { return { date: c.date, value: c.outbound }; }),
      talk: ds.calls.map(function (c) { return { date: c.date, value: c.talk }; }),
      leads: ds.leads.map(function (l) { return { date: l.date, value: 1 }; }),
      booked: ds.appts.filter(function (a) { return a.outcome.toLowerCase() === 'confirmed'; }).map(function (a) { return { date: a.conf, value: 1 }; }),
      showed: ds.appts.filter(function (a) { return a.outcome.toLowerCase() === 'showed'; }).map(function (a) { return { date: a.dispo, value: 1 }; }),
      offersMade: ds.offers.filter(function (o) { return o.outcome.toLowerCase() === 'made' && o.made; }).map(function (o) { return { date: o.made, value: 1 }; }),
      signed: ds.contracts.filter(function (c) { return c.outcome.toLowerCase() === 'signed'; }).map(function (c) { return { date: c.signed, value: 1 }; }),
      speed: (function () { var s = (payload.tabs['Speed to Lead'] || [['']]); var si = colIndexer(s[0]); return rowsOf(s).map(function (r) { return { date: parseDate(r[si('Lead Created At')]), value: +String(r[si('Speed (Min)')]).replace(/,/g, '') || 0 }; }).filter(function (x) { return x.date; }); })()
    };

    var lenses = {};
    LENSES.forEach(function (lens) {
      lenses[lens] = {
        calls: metricLens(P.calls, asOf, lens, 'sum'),
        outbound: metricLens(P.outbound, asOf, lens, 'sum'),
        talkTime: metricLens(P.talk, asOf, lens, 'sum'),
        leads: metricLens(P.leads, asOf, lens, 'sum'),
        apptsBooked: metricLens(P.booked, asOf, lens, 'sum'),
        apptsShowed: metricLens(P.showed, asOf, lens, 'sum'),
        offersMade: metricLens(P.offersMade, asOf, lens, 'sum'),
        speed: metricLens(P.speed, asOf, lens, 'avg'),
        showRate: ratioLens(P.showed, P.booked, asOf, lens),     // showed ÷ booked
        leadToAppt: ratioLens(P.booked, P.leads, asOf, lens),    // booked ÷ leads
        apptToContract: ratioLens(P.signed, P.showed, asOf, lens) // signed ÷ SHOWED (matches in-sheet)
      };
    });

    return { person: ds.person, asOf: asOf, lenses: lenses, comp: comp(ds),
      series: P,                          // raw per-metric point series (Part 3 reads these)
      lmTargets: payload.lmTargets || [] };
  }

  var API = { buildModel: buildModel, parse: parse, metricLens: metricLens, ratioLens: ratioLens, lensWindow: lensWindow, priorWindow: priorWindow, shiftAsOf: shiftAsOf, trailingBar: trailingBar, parseDate: parseDate, comp: comp, LENSES: LENSES,
    aggIn: aggIn, dataSpan: dataSpan, sod: sod, eod: eod, addDays: addDays, mondayOf: mondayOf, lastDay: lastDay, anchorFor: anchorFor, latestDay: latestDay };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.LMEngine = API;
})(typeof self !== 'undefined' ? self : this);
