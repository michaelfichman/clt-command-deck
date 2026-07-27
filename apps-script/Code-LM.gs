/**
 * ============================================================================
 * SOURCE OF TRUTH — clt-command-deck/apps-script/Code-LM.gs
 * ----------------------------------------------------------------------------
 * The Apps Script editor (standalone "CLT LM Endpoint" project) holds the
 * DEPLOYED copy; THIS repo file is the source of truth for logic/structure.
 * Update path: edit here -> run the REDEPLOY CHECKLIST below -> commit.
 *
 * !! TOKEN REDACTED: LM_TOKENS below ships a PLACEHOLDER ('SET-IN-DEPLOYED-
 * EDITOR'). This file will NOT authorize anyone as committed. The live token
 * lives ONLY in the deployed editor — this is a PUBLIC repo and real tokens
 * are never committed.
 *
 * REDEPLOY CHECKLIST (encodes the 2026-07-27 failure modes — follow in order):
 *  1. RE-INSERT the live token(s) from the deployed editor copy before
 *     pasting — this file will NOT work as committed (placeholder token).
 *  2. After pasting over the editor's Code.gs: SAVE (Cmd-S). An unsaved
 *     paste deploys nothing.
 *  3. Deploy -> Manage deployments -> pencil icon on the deployment whose
 *     /exec URL matches what the app ACTUALLY calls -> Version: New version
 *     -> Deploy. Never "New deployment" — that mints a new URL and strands
 *     the client.
 *  4. VERIFY by probing the live /exec for a change the new code introduces —
 *     never trust the deploy motion alone. (2026-07-27: a paste sat unsaved
 *     and a version bump hit the wrong deployment ID; the probe caught both.)
 * ============================================================================
 *
 * CLT Buyers — LM Scoreboard data endpoint  (Code-LM.gs)
 * ======================================================
 * SEPARATE, role-restricted endpoint for the Lead Manager scoreboard.
 * It serves ONLY:
 *   • an LM's OWN attributed rows (their funnel + activity), and
 *   • that LM's personal comp dollars — their 10% split on THEIR deals.
 *
 * It NEVER serves company revenue / gross profit / cost, the full pipeline,
 * or any other person's deals. Those tabs and columns are not referenced
 * here, so the r=lm network response cannot contain company money — the
 * boundary holds by construction, not by client-side hiding.
 *
 * WHAT DOLLARS DO ship (by design, per Michael 2026-06-16):
 *   • the LM's own per-deal wholesale fee (their offers/contracts out), and
 *   • the business avg wholesale fee, used only as a projection basis.
 *   The client multiplies by the 10% split to show earned/earmarked/potential.
 *   The dispo STAGE per deal also ships (non-dollar) so the client can mark a
 *   fee "earmarked" only once the deal reaches "Under Contract".
 *
 * This is a STANDALONE Apps Script project — its own deployment, its own
 * /exec URL, its own token set — physically distinct from the owner Code.gs.
 * It reaches the workbook by ID (not getActiveSpreadsheet), so deploy it as a
 * brand-new standalone script, NOT container-bound to the sheet.
 *
 * DEPLOY (one time):
 *  1. script.google.com → New project (standalone). Name it "CLT LM Endpoint".
 *  2. Paste this over Code.gs. Put a long random token per LM in LM_TOKENS.
 *  3. Deploy → New deployment → Web app. Execute as: Me. Access: Anyone.
 *  4. Authorize when prompted (Spreadsheets scope — that's openById).
 *  5. Copy the /exec URL. Hand each LM that URL + THEIR OWN token only.
 *  Re-deploy after edits: Manage deployments → edit (pencil) → New version.
 */

var SHEET_ID = '1MT1lc3bsB2Wf-ELv_-HGqt400BDAQbK0o5TcBa-hC0w';

/* One token PER LM. token -> EXACT Team-tab Name. Hand each LM only their own
   token; an LM literally cannot request another LM's data (no person param).
   REDACTED for the public repo — the live token lives ONLY in the deployed
   editor. Re-insert it before pasting (see REDEPLOY CHECKLIST at top). */
var LM_TOKENS = {
  'SET-IN-DEPLOYED-EDITOR': 'Jordan Mathis'
};

var LM_DEFAULT_SPLIT = 0.10;   // LM earns 10% of each wholesale fee.

/* LM-safe, person-attributed tabs and the 0-based column holding the person's
   name. `cols` (optional) caps how many leading columns ship — used to drop a
   tab's side/summary block. Every column of these tabs is non-dollar, so
   row-filtering to the LM leaks no company money. */
var PERSON_TABS = {
  'Leads':         { attr: 6 },                // G Assigned User (single-attribution)
  'Appointments':  { attr: 3, member: 9 },     // D Booker (LM); opportunity key = J Contact ID
  'Offers':        { attr: 3, member: 9 },     // D Booker (LM); opportunity key = J Contact ID
  'Contracts':     { attr: 4, member: 10 },    // E Booker (LM); opportunity key = K Contact ID
  'Calls':         { attr: 1 },                // B User (single-attribution)
  'Speed to Lead': { attr: 6, cols: 25 }       // G Assigned User; A–Y (N:Q speeds, V:Y connect funnel)
};

/* Curated Goals allow-list (default-DENY): ONLY these labels leave the
   endpoint. Matched on a normalized label so the arrow glyph / spacing can't
   break it. No revenue / gross-profit / cost row is referenced, so none can
   ship. avgWholesaleFee is an allowed projection basis. */
var GOALS_ALLOW = {
  'averagewholesaleprofitperdeal$': 'avgWholesaleFee',
  'leadappointment%':   'leadToAppt',
  'appointmentcontract%': 'apptToContract',
  'offercontract%':     'offerToContract',
  'contractclose%':     'contractToClose',
  'overallleadclose%':  'leadToClose',
  'leadappointment':    'velLeadToAppt',
  'appointmentoffer':   'velApptToOffer',
  'offercontract':      'velOfferToContract',
  'contractclose':      'velContractToClose',
  'totalcycletime':     'velTotalCycle'
};

function doGet(e) {
  try {
    var token = (e && e.parameter && e.parameter.token) || '';
    var person = LM_TOKENS[token];
    if (!person) return json_({ ok: false, error: 'unauthorized' });

    var ss = SpreadsheetApp.openById(SHEET_ID);

    // 1) person-scoped tabs: header row + ONLY this LM's rows
    var tabs = {};
    Object.keys(PERSON_TABS).forEach(function (name) {
      tabs[name] = scopeTab_(ss, name, PERSON_TABS[name], person);
    });

    // 2) Team roster — LM rows only (person selector + leaderboard-ready)
    tabs['Team'] = teamLMs_(ss);

    // 2b) Closings — ONLY this LM's own deals (live → drives Earned at real revenue)
    tabs['Closings'] = scopedClosings_(ss, tabs);

    // 3) scoped fees + dispo stage — ONLY this LM's own deals
    var fs = scopedFees_(ss, tabs);

    // 4) curated goals + split + optional fixed LM-target slots
    return json_({
      ok: true,
      role: 'lm',
      person: person,
      fetchedAt: new Date().toISOString(),
      splitRate: LM_DEFAULT_SPLIT,
      tabs: tabs,
      fees: fs.fees,
      stages: fs.stages,              // dispo stage per deal → Earmarked only if "Under Contract"
      goals: curatedGoals_(ss),
      lmTargets: readLMTargets_(ss)   // [] until the block is populated
    });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* Single-attribution tabs (Leads/Calls/Speed): header + rows where the
   attribution column == person.
   Deal tabs (Appointments/Offers/Contracts): scope by OPPORTUNITY MEMBERSHIP.
   Collect every Contact ID the LM is attributed to on any row, then include
   ALL rows for those opportunities — including disposition rows logged by the
   AM (e.g. Michael logging a Declined / Closed / Cancelled on the LM's deal).
   Without this, a deal's terminal status would be invisible to the LM and an
   AM-declined offer would wrongly read as "open." Only the LM's OWN
   opportunities are included, and these tabs carry no dollar columns. */
function scopeTab_(ss, name, cfg, person) {
  var sh = ss.getSheetByName(name);
  if (!sh) return null;
  var values = sh.getDataRange().getValues();
  if (!values.length) return [];
  var width = cfg.cols || values[0].length;
  var want = norm_(person);
  var out = [values[0].slice(0, width)];

  if (cfg.member == null) {                 // single-attribution
    for (var i = 1; i < values.length; i++) {
      if (norm_(values[i][cfg.attr]) === want) out.push(values[i].slice(0, width));
    }
    return out;
  }

  var ids = {};                             // opportunity membership
  for (var a = 1; a < values.length; a++) {
    if (norm_(values[a][cfg.attr]) === want) {
      var k = values[a][cfg.member]; if (k) ids[k] = true;
    }
  }
  for (var b = 1; b < values.length; b++) {
    var k2 = values[b][cfg.member];
    if (k2 && ids[k2]) out.push(values[b].slice(0, width));
  }
  return out;
}

/* Team rows whose Role contains 'LM' (hides AM/DM org rows) */
function teamLMs_(ss) {
  var sh = ss.getSheetByName('Team');
  if (!sh) return null;
  var v = sh.getDataRange().getValues();
  if (!v.length) return [];
  var out = [v[0]];
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][1] || '').toUpperCase().indexOf('LM') > -1) out.push(v[i]);
  }
  return out;
}

/* {contactId: fee} and {contactId: dispoStage} from the Pipeline X:Z stash,
   but ONLY for contact ids that appear in THIS LM's own CONTRACTS (deals they
   own — earned/earmarked). Offers are excluded on purpose: an LM can make an
   offer on a deal someone else contracts (e.g. Jordan offered Joseph Patterson,
   Michael holds the contract), and offers carry no real fee — the Potential
   bucket uses the avg fee instead. The dispo stage drives Earmarked vs
   Projected: a fee is "earmarked" only once its dispo opp is "Under Contract". */
function scopedFees_(ss, tabs) {
  var mine = {};
  ['Contracts'].forEach(function (t) {
    var rows = tabs[t]; if (!rows || rows.length < 2) return;
    var idx = rows[0].indexOf('Contact ID'); if (idx < 0) return;
    for (var i = 1; i < rows.length; i++) { var c = rows[i][idx]; if (c) mine[c] = true; }
  });
  var fees = {}, stages = {};
  var sh = ss.getSheetByName('Pipeline');
  if (!sh) return { fees: fees, stages: stages };
  var last = sh.getLastRow();
  if (last < 2) return { fees: fees, stages: stages };
  var stash = sh.getRange(2, 24, last - 1, 3).getValues();  // X=24 dispo stage, Y=25 Contact ID, Z=26 fee
  for (var i = 0; i < stash.length; i++) {
    var stg = stash[i][0], cid = stash[i][1], fee = stash[i][2];
    if (cid && mine[cid]) {
      fees[cid] = (typeof fee === 'number' ? fee : Number(fee) || 0);
      stages[cid] = stg || '';
    }
  }
  return { fees: fees, stages: stages };
}

/* Closings for ONLY this LM's own deal contacts (matched to their Contracts).
   Drives Earned at actual revenue — live, no nightly dependency. */
function scopedClosings_(ss, tabs) {
  var mine = {}, rows = tabs['Contracts'];
  if (rows && rows.length > 1) { var idx = rows[0].indexOf('Contact ID'); if (idx > -1) for (var i = 1; i < rows.length; i++) { var c = rows[i][idx]; if (c) mine[c] = true; } }
  var sh = ss.getSheetByName('Closings');
  if (!sh) return null;
  var v = sh.getDataRange().getValues();
  if (!v.length) return [];
  var ci = v[0].indexOf('Contact ID'), out = [v[0]];
  if (ci > -1) for (var j = 1; j < v.length; j++) { var k = v[j][ci]; if (k && mine[k]) out.push(v[j]); }
  return out;
}

/* allow-listed Goals only -> {key: value} */
function curatedGoals_(ss) {
  var sh = ss.getSheetByName('Goals & Assumptions');
  var goals = {};
  if (!sh) return goals;
  var v = sh.getDataRange().getValues();
  for (var i = 0; i < v.length; i++) {
    var k = GOALS_ALLOW[normLabel_(v[i][0])];
    if (k) goals[k] = v[i][1];
  }
  return goals;
}

/* Optional fixed-target block. Reads an 'LM Targets' tab if present
   (cols: Metric | Lens | Person | Target ...) into a list of objects. Empty
   until populated — the slot is wired now so Part 3 reads it with no change. */
function readLMTargets_(ss) {
  var sh = ss.getSheetByName('LM Targets');
  if (!sh) return [];
  var v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  var head = v[0], out = [];
  for (var i = 1; i < v.length; i++) {
    var o = {}; for (var j = 0; j < head.length; j++) o[String(head[j])] = v[i][j];
    out.push(o);
  }
  return out;
}

function norm_(x) { return String(x == null ? '' : x).trim().toLowerCase(); }
function normLabel_(x) { return String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9%$]/g, ''); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
