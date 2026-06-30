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
  // TODAY lens: live metrics read the ACTUAL current day (through this moment).
  // Only `lagged` metrics (calls/talk-time — posted once daily by the routine)
  // fall back to the latest posted day, flagged so the UI can label it honestly.
  function anchorFor(points, asOf, lens, lagged) {
    if (lens !== 'today') return { asOf: asOf, anchorDate: null, lagged: false };
    if (!lagged) return { asOf: asOf, anchorDate: sod(asOf), lagged: false }; // live: today, real-time
    var ld = latestDay(points, asOf);
    if (!ld) return { asOf: asOf, anchorDate: sod(asOf), lagged: false };
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

  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Label one trend period by the lens granularity (uniform x-axis per lens).
  function periodLabel(s, lens) {
    if (lens === 'month') return MON[s.getMonth()];
    if (lens === 'quarter') return 'Q' + (Math.floor(s.getMonth() / 3) + 1) + " '" + String(s.getFullYear()).slice(2);
    return (s.getMonth() + 1) + '/' + s.getDate(); // week → week-of M/D ; (today handled below)
  }
  // Trend buckets: each lens plots PERIODS OF ITS OWN GRANULARITY — day lens =
  // individual days, week = each week, month = each month, quarter = each quarter.
  function trendBuckets(asOf, lens) {
    var out = [], i;
    if (lens === 'today') { for (i = 13; i >= 0; i--) { var dd = addDays(asOf, -i); out.push({ label: (dd.getMonth() + 1) + '/' + dd.getDate(), start: sod(dd), end: eod(dd) }); } return out; }
    if (lens === 'ytd') { for (i = 0; i <= asOf.getMonth(); i++) { var ms = new Date(asOf.getFullYear(), i, 1); var me = new Date(asOf.getFullYear(), i + 1, 0); out.push({ label: MON[i], start: ms, end: eod(me < asOf ? me : asOf) }); } return out; }
    // week / month / quarter → the last N WHOLE periods of that granularity, oldest→newest
    var N = (lens === 'week') ? 9 : (lens === 'month') ? 6 : 5;
    for (var k = N - 1; k >= 0; k--) {
      var w = lensWindow(shiftAsOf(asOf, lens, k), lens);
      out.push({ label: periodLabel(w.start, lens), start: w.start, end: (k === 0 ? eod(asOf) : w.end) });
    }
    return out;
  }

  /* ---------------- a flow/avg metric across one lens ---------------- */
  function metricLens(points, asOf, lens, mode, N, lagged) {
    mode = mode || 'sum'; N = N || 4;
    var a = anchorFor(points, asOf, lens, lagged), at = a.asOf, nb = (lens === 'today') ? 14 : N;
    var cur = aggIn(points, lensWindow(at, lens), mode);
    var cmp = aggIn(points, priorWindow(at, lens), mode);
    var bar = trailingBar(points, at, lens, mode, nb);
    var sp = dataSpan(points);
    var buckets = trendBuckets(at, lens).filter(function (b) { return !sp.lo || b.end >= sp.lo; }).map(function (b) { return { label: b.label, value: aggIn(points, b, mode) }; });
    var pct = (cmp == null || cmp === 0) ? null : ((cur - cmp) / cmp);
    return { current: cur, comparison: cmp, comparePct: pct, bar: bar, paceState: paceState(cur, bar), trend: buckets, anchorDate: a.anchorDate, lagged: a.lagged };
  }

  // Ratio metric (num/den) across one lens — show rate, lead→appt, appt→contract.
  function ratioLens(numPts, denPts, asOf, lens, N, lagged) {
    N = N || 4;
    var an = anchorFor(denPts, asOf, lens, lagged), at = an.asOf;
    function ratio(w) { var d = aggIn(denPts, w, 'sum'); return d ? aggIn(numPts, w, 'sum') / d : null; }
    var cur = ratio(lensWindow(at, lens));
    var cmp = ratio(priorWindow(at, lens));
    var span = dataSpan(denPts), vals = [];
    if (span.lo) for (var k = 1; k <= N; k++) { var w = lensWindow(shiftAsOf(at, lens, k), lens); if (w.end < span.lo || w.start > span.hi) continue; var r = ratio(w); if (r != null) vals.push(r); }
    var bar = vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : null;
    var buckets = trendBuckets(at, lens).filter(function (b) { return !span.lo || b.end >= span.lo; }).map(function (b) { return { label: b.label, value: ratio(b) }; });
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
      return { date: parseDate(r[ci('Date')]), total: +r[ci('Total Calls')] || 0, inbound: +r[ci('Inbound Calls')] || 0, outbound: +r[ci('Outbound Calls')] || 0, talk: +r[ci('Total Talk Time (min)')] || 0,
        connected: +r[ci('Connected')] || 0, conv: +r[ci('Conversations')] || 0, deep: +r[ci('Deep Conversations')] || 0, qual: +r[ci('Qualifying Conversations')] || 0 };
    }).filter(function (x) { return x.date; });

    // Leads
    var l = tab('Leads'), li = colIndexer(l[0]);
    var leads = rowsOf(l).map(function (r) { return { date: parseDate(r[li('Created Date')]), source: r[li('Lead Source')], name: r[li('Contact Name')], property: r[li('Property Address')] }; }).filter(function (x) { return x.date; });

    // Appointments
    var a = tab('Appointments'), ai = colIndexer(a[0]);
    var appts = rowsOf(a).map(function (r) {
      return { conf: parseDate(r[ai('Confirmed Date')]), dispo: parseDate(r[ai('Disposition Date')]), outcome: String(r[ai('Outcome')] || '').trim(), contactId: r[ai('Contact ID')], name: r[ai('Contact Name')], property: r[ai('Property Address')] };
    });

    // Offers
    var o = tab('Offers'), oi = colIndexer(o[0]);
    var offers = rowsOf(o).map(function (r) {
      return { made: parseDate(r[oi('Offer Made Date')]), dispo: parseDate(r[oi('Disposition Date')]), outcome: String(r[oi('Outcome')] || '').trim(), contactId: r[oi('Contact ID')], name: r[oi('Contact Name')], property: r[oi('Property Address')] };
    });

    // Contracts
    var k = tab('Contracts'), ki = colIndexer(k[0]);
    var contracts = rowsOf(k).map(function (r) {
      return { signed: parseDate(r[ki('Signed Date')]), dispo: parseDate(r[ki('Disposition Date')]), outcome: String(r[ki('Outcome')] || '').trim(), contactId: r[ki('Contact ID')], name: r[ki('Contact Name')], property: r[ki('Property Address')] };
    });

    // Closings (live) — drives EARNED at actual revenue
    var cl = tab('Closings'), cli = colIndexer(cl[0]);
    var closings = rowsOf(cl).map(function (r) {
      return { date: parseDate(r[cli('Closed')]), revenue: +String(r[cli('Revenue')] == null ? '' : r[cli('Revenue')]).replace(/[^0-9.\-]/g, '') || 0, contactId: String(r[cli('Contact ID')] || ''), name: String(r[cli('Contact Name')] || '') };
    }).filter(function (c) { return c.contactId || c.revenue; });

    return { calls: calls, leads: leads, appts: appts, offers: offers, contracts: contracts, closings: closings,
      fees: payload.fees || {}, stages: payload.stages || {}, goals: payload.goals || {}, splitRate: payload.splitRate || 0.10, person: payload.person };
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
  // A deal's fee is only "earmarked" (binding) once its DISPO opp reaches the
  // "Under Contract" stage — a buyer is locked. Before that it's projected.
  function underContract(s) { return !!(s && /under\s*contract/i.test(String(s))); }
  function comp(ds) {
    var split = ds.splitRate, avgFee = +ds.goals.avgWholesaleFee || 0, stages = ds.stages || {};
    var resC = resolveByContact(ds.contracts, ['dispo', 'signed']);
    var earned = 0, earmarked = 0, projected = 0, earnedDeals = [], earmarkedDeals = [], projectedDeals = [];
    // EARNED — actual closed revenue from the LIVE Closings tab (×split). Live on row-add.
    (ds.closings || []).forEach(function (c) {
      var rev = +c.revenue || 0; if (!rev && !c.contactId) return;
      var ec = rev * split; earned += ec;
      earnedDeals.push({ name: c.name || c.contactId, fee: rev, cut: ec, stage: 'closed' });
    });
    var closedIds = {}; (ds.closings || []).forEach(function (c) { if (c.contactId) closedIds[c.contactId] = true; });
    Object.keys(resC).forEach(function (id) {
      var st = (resC[id].row.outcome || '').toLowerCase(), nm = resC[id].row.name, stg = stages[id] || '', realFee = +ds.fees[id] || 0;
      if (st === 'closed' || closedIds[id]) return;      // EARNED is sourced from the Closings tab
      if (st === 'signed') {
        // EARMARKED — signed AND dispo "Under Contract": the one bucket that needs the nightly stash (stage + real fee).
        if (underContract(stg)) { var mc = realFee * split; earmarked += mc; earmarkedDeals.push({ name: nm, fee: realFee, cut: mc, stage: stg }); }
        // PROJECTED — signed, not yet locked: LIVE from the Contracts tab. Use the real fee if the routine has stashed it, else the avg fee so a just-added deal prices immediately.
        else { var pf = realFee || avgFee, pc = pf * split; projected += pc; projectedDeals.push({ name: nm, fee: pf, cut: pc, stage: stg || 'pre-contract', est: !realFee }); }
      }
      // cancelled → 0
    });
    // Open offers: latest offer status is "Made", and the contact is not already a contract.
    var contractIds = {}; ds.contracts.forEach(function (r) { if (r.contactId) contractIds[r.contactId] = true; });
    var resO = resolveByContact(ds.offers, ['dispo', 'made']);
    var openOffers = [];
    Object.keys(resO).forEach(function (id) {
      if ((resO[id].row.outcome || '').toLowerCase() === 'made' && !contractIds[id]) openOffers.push({ name: resO[id].row.name, property: resO[id].row.property, contactId: id, est: avgFee * split });
    });
    var potential = openOffers.length * avgFee * split;
    return {
      split: split, avgFee: avgFee,
      earned: earned, earmarked: earmarked, projected: projected, potential: potential,
      totalOpportunity: earmarked + projected + potential,
      earnedDeals: earnedDeals, earmarkedDeals: earmarkedDeals, projectedDeals: projectedDeals, openOffers: openOffers
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
      conversations: ds.calls.map(function (c) { return { date: c.date, value: c.conv }; }),
      connected: ds.calls.map(function (c) { return { date: c.date, value: c.connected }; }),
      deepConv: ds.calls.map(function (c) { return { date: c.date, value: c.deep }; }),
      qualifying: ds.calls.map(function (c) { return { date: c.date, value: c.qual }; }),
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
        calls: metricLens(P.calls, asOf, lens, 'sum', 4, true),       // lagged: posted once daily
        outbound: metricLens(P.outbound, asOf, lens, 'sum', 4, true), // lagged
        talkTime: metricLens(P.talk, asOf, lens, 'sum', 4, true),     // lagged
        conversations: metricLens(P.conversations, asOf, lens, 'sum', 4, true), // lagged: ≥75s real talks
        connected: metricLens(P.connected, asOf, lens, 'sum', 4, true),         // lagged: duration>0
        deepConv: metricLens(P.deepConv, asOf, lens, 'sum', 4, true),           // lagged: ≥180s
        qualifying: metricLens(P.qualifying, asOf, lens, 'sum', 4, true),       // lagged: ≥600s truly-qualifying
        connectRate: ratioLens(P.conversations, P.calls, asOf, lens, 4, true),  // conversations ÷ dials (lagged)
        leads: metricLens(P.leads, asOf, lens, 'sum'),
        apptsBooked: metricLens(P.booked, asOf, lens, 'sum'),
        apptsShowed: metricLens(P.showed, asOf, lens, 'sum'),
        offersMade: metricLens(P.offersMade, asOf, lens, 'sum'),
        contractsSigned: metricLens(P.signed, asOf, lens, 'sum'),
        speed: metricLens(P.speed, asOf, lens, 'avg'),
        showRate: ratioLens(P.showed, P.booked, asOf, lens),     // showed ÷ booked
        leadToAppt: ratioLens(P.booked, P.leads, asOf, lens),    // booked ÷ leads
        apptToContract: ratioLens(P.signed, P.showed, asOf, lens) // signed ÷ SHOWED (matches in-sheet)
      };
    });

    var speedRecs = (function () { var s = (payload.tabs['Speed to Lead'] || [['']]); var si = colIndexer(s[0]); return rowsOf(s).map(function (r) { return { date: parseDate(r[si('Lead Created At')]), name: r[si('Contact Name')], source: r[si('Lead Source')], speed: +String(r[si('Speed (Min)')]).replace(/,/g, '') || 0 }; }).filter(function (x) { return x.date; }); })();

    return { person: ds.person, asOf: asOf, lenses: lenses, comp: comp(ds),
      series: P,                          // raw per-metric point series (Part 3 reads these)
      records: { leads: ds.leads, appts: ds.appts, offers: ds.offers, contracts: ds.contracts, speed: speedRecs },
      lmTargets: payload.lmTargets || [] };
  }

  var API = { buildModel: buildModel, parse: parse, metricLens: metricLens, ratioLens: ratioLens, lensWindow: lensWindow, priorWindow: priorWindow, shiftAsOf: shiftAsOf, trailingBar: trailingBar, parseDate: parseDate, comp: comp, LENSES: LENSES,
    aggIn: aggIn, dataSpan: dataSpan, sod: sod, eod: eod, addDays: addDays, mondayOf: mondayOf, lastDay: lastDay, anchorFor: anchorFor, latestDay: latestDay };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.LMEngine = API;
})(typeof self !== 'undefined' ? self : this);
