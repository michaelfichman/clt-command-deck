/**
 * ============================================================================
 * SOURCE OF TRUTH — clt-command-deck/apps-script/Code-LM.gs
 * ----------------------------------------------------------------------------
 * The Apps Script editor (standalone "CLT LM Endpoint" project) holds the
 * DEPLOYED copy; THIS repo file is the source of truth for logic/structure.
 * Update path: edit here -> run the REDEPLOY CHECKLIST below -> commit.
 *
 * !! TOKENS REDACTED: LM_TOKENS and ROUTINE_TOKEN below ship PLACEHOLDERS
 * ('SET-IN-DEPLOYED-EDITOR-…'). This file will NOT authorize anyone as
 * committed. The live tokens live ONLY in the deployed editor — this is a
 * PUBLIC repo and real tokens are never committed. The routine's token is
 * handed to cltbuyers-routines as `.secrets/deck_routine_token` (never here).
 *
 * REDEPLOY CHECKLIST (encodes the 2026-07-27 failure modes — follow in order):
 *  1. RE-INSERT the live token(s) from the deployed editor copy before
 *     pasting — this file will NOT work as committed (placeholder tokens).
 *     That is now THREE values: both LM_TOKENS keys AND ROUTINE_TOKEN (the
 *     call-coaching nightly's upsert_tasks token — a long random string,
 *     different from every LM token).
 *  2. After pasting over the editor's Code.gs: SAVE (Cmd-S). An unsaved
 *     paste deploys nothing.
 *  3. Deploy -> Manage deployments -> pencil icon on the deployment whose
 *     /exec URL matches what the app ACTUALLY calls -> Version: New version
 *     -> Deploy. Never "New deployment" — that mints a new URL and strands
 *     the client. doPost rides the SAME /exec URL as doGet.
 *  4. VERIFY by probing the live /exec for a change the new code introduces —
 *     never trust the deploy motion alone. (2026-07-27: a paste sat unsaved
 *     and a version bump hit the wrong deployment ID; the probe caught both.)
 *     For Tasks: a GET must carry `tasksAsOf`; a POST with a bad token must
 *     answer {"ok":false,"error":"unauthorized"}. For expire_rules (2026-10-21):
 *     the ROUTINE_TOKEN probe in apps-script/README.md §2 step 6 must answer
 *     with `expired_by_rule` and one `notes` line. For D1 (role scoping +
 *     kpi_feed): an LM GET must carry `teamRole` and `payPlanSet:false`, and
 *     `?action=kpi_feed` with ROUTINE_TOKEN must answer ok:true while either
 *     LM token answers unauthorized (README §2 step 6).
 *  5. The KPI Staging workbook must have tabs named exactly `Tasks` and
 *     `Review` with the header rows from apps-script/TASKS.md (row 1).
 *     Missing tab -> GET ships tabs.Tasks = null; POST answers
 *     'Tasks tab missing' / 'Review tab missing'. Never a throw.
 * ============================================================================
 *
 * CLT Buyers — LM Scoreboard data endpoint  (Code-LM.gs)
 * ======================================================
 * SEPARATE, role-restricted endpoint for the Lead Manager scoreboard.
 * It serves ONLY:
 *   • a person's OWN rows: Leads/Calls/Speed by their one attribution column,
 *     and Appointments/Offers/Contracts/Closings by the ROLE COLUMNS (D1, since
 *     the 10/15 reorg: Andrew owns new cards, Jordan is the AM on offers), each
 *     row tagged `_as` with the role it is theirs by, and
 *   • the fee of a deal only where they are its LM.
 *
 * It NEVER serves company revenue / gross profit / cost, the full pipeline,
 * or any other person's deals. Those tabs are not referenced here, and a fee
 * column on a row the person is not the LM of ships blank, so the r=lm network
 * response cannot contain company money — the boundary holds by construction,
 * not by client-side hiding.
 *
 * WHAT DOLLARS DO ship (by design, per Michael 2026-06-16):
 *   • the LM's own per-deal wholesale fee (their offers/contracts out), and
 *   • the business avg wholesale fee, used only as a projection basis.
 *   The dispo STAGE per deal also ships (non-dollar) so the client can mark a
 *   fee "earmarked" only once the deal reaches "Under Contract".
 *
 * PAY IS HIDDEN (D1, decision D-5): pay after the reorg is undecided, and the old
 * math paid Andrew on offers Jordan prices and Jordan $0 for AM work. Until it is
 * decided PAY_PLAN_SET stays false, the clients show "Pay plan not set", and the
 * LM-only fees above stay exactly as they were so nothing is lost for that day.
 *
 * The routine's second door: GET ?action=kpi_feed with ROUTINE_TOKEN, a role-column
 * read feed with an ALLOW-LIST of headers. Shape: apps-script/README.md §5.
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
/* !! THE PLACEHOLDERS MUST STAY DISTINCT. This is an OBJECT keyed by token: two
   keys with the same literal silently collapse to ONE entry and the last one wins,
   which would leave an LM unable to authenticate with no error anywhere. Each LM
   gets their own placeholder, and each must be replaced with a DIFFERENT real
   token in the deployed editor. Never hand two LMs the same token — the token IS
   the identity, so a shared one serves the wrong person's scoped data. */
var LM_TOKENS = {
  'SET-IN-DEPLOYED-EDITOR-JORDAN': 'Jordan Mathis',
  'SET-IN-DEPLOYED-EDITOR-ANDREW': 'Andrew Estrada'
};

/* The call-coaching nightly's token (cltbuyers-routines, `.secrets/deck_routine_token`).
   It may call ONLY `upsert_tasks` (POST) and `kpi_feed` (GET). It is NOT in LM_TOKENS,
   so it gets no scoreboard payload and can read nobody's scoreboard. Must differ from
   every LM token — the token IS the identity. REDACTED here; real value only in the
   deployed editor. */
var ROUTINE_TOKEN = 'SET-IN-DEPLOYED-EDITOR-ROUTINE';

/* POST identity for the shared Tasks block (below): an LM, or the routine. */
function tasksWho_(token) {
  if (!token) return null;
  if (Object.prototype.hasOwnProperty.call(LM_TOKENS, token)) return { role: 'lm', person: LM_TOKENS[token], approver: false };
  if (ROUTINE_TOKEN && token === ROUTINE_TOKEN) return { role: 'routine', person: ROUTINE_CREATED_BY, approver: false };
  return null;
}
function tasksSS_() { return SpreadsheetApp.openById(SHEET_ID); }

var LM_DEFAULT_SPLIT = 0.10;   // The pre-reorg split. Behind PAY_PLAN_SET: it ships only once a plan is set.
var PAY_PLAN_SET = false;      // D-5: pay is deferred and hidden. Flip when Michael sets it (the clients read `payPlanSet`).

/* LM-safe, person-attributed tabs and the 0-based column holding the person's
   name. `cols` (optional) caps how many leading columns ship — used to drop a
   tab's side/summary block. The one dollar column here is Contracts' derived
   gross: row-filtering is not enough for it, so scopeTab_ blanks it on any row
   whose deal the person is not the LM of (MONEY_HEADER).

   COLUMNS ARE RESOLVED BY HEADER NAME, never by index. A `Current Owner` column
   was inserted into Leads at I; any index-based lookup to its right would have
   shifted by one and scoped the dashboard off the wrong column — silently, with
   no error. The numeric `attr`/`member` values remain ONLY as a last-resort
   fallback for a tab whose headers get renamed.

   `attrNames` is an ordered preference resolved per row to the first non-blank.
   Leads names only `Assigned User`: `Current Owner` was a one-time backfill, blank
   from row 333, and the deck's own LM preview (index.html scopeToLM) never read it.
   Scoping both the same way is what keeps the phone and the preview on one count.

   `amNames` marks a DEAL tab: a row is the person's when its Booker (LM) or its AM
   is the person, tagged in a trailing `_as` column. `memberNames` then only decides
   which OTHER rows ride along for the record lists — see scopeTab_. */
var PERSON_TABS = {
  'Leads':         { attrNames: ['Assigned User'], attr: 6 },
  'Appointments':  { attrNames: ['Booker (LM)'], amNames: ['AM'], memberNames: ['Contact ID'], attr: 3, member: 9 },
  'Offers':        { attrNames: ['Booker (LM)'], amNames: ['AM'], memberNames: ['Contact ID'], attr: 3, member: 9 },
  'Contracts':     { attrNames: ['Booker (LM)'], amNames: ['AM'], memberNames: ['Contact ID'], attr: 4, member: 10 },
  'Calls':         { attrNames: ['User'], attr: 1 },
  // NOTE: Speed to Lead has its OWN Assigned User column, so it is scoped at-creation
  // exactly like Leads. Reassigned leads stay on the previous owner's speed funnel.
  'Speed to Lead': { attrNames: ['Assigned User'], attr: 6, cols: 25 }
};

/* A header whose column carries deal money. Applied to the deal tabs and Closings:
   on a row the person is not the LM of, such a cell ships blank. */
var MONEY_HEADER = /revenue|fee|gross|profit|cost/i;

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

    // The routine's read feed, its own door: ROUTINE_TOKEN only. tasksWho_ answers an LM
    // first, so a token pasted into both slots is an LM here, never the routine.
    if (e && e.parameter && e.parameter.action === 'kpi_feed') {
      var caller = tasksWho_(token);
      if (!caller || caller.role !== 'routine') return json_({ ok: false, error: 'unauthorized' });
      return json_(kpiFeed_(SpreadsheetApp.openById(SHEET_ID)));
    }

    // hasOwnProperty: LM_TOKENS['constructor'] is a truthy inherited function, which would pass as a person.
    if (!Object.prototype.hasOwnProperty.call(LM_TOKENS, token)) return json_({ ok: false, error: 'unauthorized' });
    var person = LM_TOKENS[token];
    if (!person) return json_({ ok: false, error: 'unauthorized' });

    var ss = SpreadsheetApp.openById(SHEET_ID);

    // 1) person-scoped tabs: header row + ONLY this person's rows
    var tabs = {};
    Object.keys(PERSON_TABS).forEach(function (name) {
      tabs[name] = scopeTab_(ss, name, PERSON_TABS[name], person);
    });

    // 2) Team roster — LM and AM rows only (person selector + leaderboard-ready)
    tabs['Team'] = teamRoles_(ss);

    // 2b) Closings — this person's rows by Booker (LM) / AM / DM, money on LM rows only
    tabs['Closings'] = scopedClosings_(ss, tabs, person);

    // 3) scoped fees + dispo stage — ONLY the deals this person is the LM of (D-5: AM rows never add fees)
    var fs = scopedFees_(ss, tabs);

    // 3b) Tasks & Review — own team-visible tasks (live or touched in 14 days) + own flags.
    //     null when a tab is missing (never a throw). See apps-script/TASKS.md.
    var tt = tasksTabsGet_(ss, { role: 'lm', person: person, approver: false });
    tabs['Tasks'] = tt.Tasks;
    tabs['Review'] = tt.Review;

    // 4) curated goals + split + optional fixed LM-target slots
    return json_({
      ok: true,
      role: 'lm',                     // the ENDPOINT's role; the person's job is teamRole
      person: person,
      teamRole: teamRoleOf_(tabs['Team'], person),   // their Team-tab Role, as written: 'AM, LM', 'LM'
      fetchedAt: new Date().toISOString(),
      tasksAsOf: new Date().toISOString(),
      payPlanSet: PAY_PLAN_SET,
      splitRate: PAY_PLAN_SET ? LM_DEFAULT_SPLIT : null,
      tabs: tabs,
      fees: fs.fees,
      stages: fs.stages,              // dispo stage per deal → Earmarked only if "Under Contract"
      goals: curatedGoals_(ss),
      lmTargets: readLMTargets_(ss, person)   // the caller's rows + blank-Person rows
    });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* Single-attribution tabs (Leads/Calls/Speed): header + rows where the
   attribution column == person.
   Deal tabs (Appointments/Offers/Contracts): a row is the person's when its
   Booker (LM) or its AM is the person, and a trailing `_as` column says which:
   'LM', 'AM' or 'LM,AM'. Clients COUNT by that tag, never by contact.
   Contact membership stays ONLY for the record lists: every other row on a
   contact the person holds a role on still ships, with `_as` blank — a
   disposition logged by someone else (Michael logging a Declined / Closed /
   Cancelled on the deal). Without it a deal's terminal status would be invisible
   and a declined offer would wrongly read as "open." A blank `_as` row counts
   for nothing. Only the person's OWN opportunities are included, and fee columns
   ship only on a deal they are the LM of (D-5). */
/* Header-name → column index. Returns EVERY named column that exists, in the
   order named, so the caller can coalesce across them per row. */
function colsByName_(header, names) {
  var out = [];
  (names || []).forEach(function (n) {
    for (var i = 0; i < header.length; i++) {
      if (norm_(header[i]) === norm_(n)) { out.push(i); return; }
    }
  });
  return out;
}

function scopeTab_(ss, name, cfg, person) {
  var sh = ss.getSheetByName(name);
  if (!sh) return null;
  var values = sh.getDataRange().getValues();
  if (!values.length) return [];
  var width = cfg.cols || values[0].length;
  var want = norm_(person);
  var out = [cfg.amNames ? values[0].slice(0, width).concat(['_as']) : values[0].slice(0, width)];

  // Ownership columns, by header name; numeric `attr` only if no header matched.
  var attrIdx = colsByName_(values[0], cfg.attrNames);
  if (!attrIdx.length && cfg.attr != null) attrIdx = [cfg.attr];
  if (!attrIdx.length) return out;          // no ownership column -> visibly empty, not silently everyone

  // The owner is the FIRST NON-BLANK across the preference list, evaluated per row.
  function ownerOf(row) {
    for (var k = 0; k < attrIdx.length; k++) {
      var v = row[attrIdx[k]];
      if (v != null && String(v).trim() !== '') return norm_(v);
    }
    return '';
  }

  var memberIdx = -1;
  if (cfg.memberNames) {
    var m = colsByName_(values[0], cfg.memberNames);
    memberIdx = m.length ? m[0] : (cfg.member == null ? -1 : cfg.member);
  } else if (cfg.member != null) {
    memberIdx = cfg.member;
  }

  if (memberIdx < 0) {                      // single-attribution
    for (var i = 1; i < values.length; i++) {
      if (ownerOf(values[i]) === want) out.push(values[i].slice(0, width));
    }
    return out;
  }

  var amIdx = colsByName_(values[0], cfg.amNames);   // no AM header -> nobody tagged AM; Booker still scopes
  var ids = {}, lmIds = {}, tags = [];               // ids: any role (record lists); lmIds: LM (money)
  for (var a = 1; a < values.length; a++) {
    var isLM = ownerOf(values[a]) === want, isAM = amIdx.length > 0 && norm_(values[a][amIdx[0]]) === want;
    tags[a] = isLM && isAM ? 'LM,AM' : (isLM ? 'LM' : (isAM ? 'AM' : ''));
    var k = values[a][memberIdx];
    if (k && tags[a]) ids[k] = true;
    if (k && isLM) lmIds[k] = true;
  }
  var money = moneyCols_(values[0], width);
  for (var b = 1; b < values.length; b++) {
    var k2 = values[b][memberIdx];
    if (!tags[b] && !(k2 && ids[k2])) continue;
    var row = values[b].slice(0, width);
    if (!(k2 && lmIds[k2]) && tags[b].indexOf('LM') < 0) blank_(row, money);
    row.push(tags[b]);
    out.push(row);
  }
  return out;
}

/* Column indexes of `header` (first `width`) that carry deal money. */
function moneyCols_(header, width) {
  var out = [];
  for (var i = 0; i < width && i < header.length; i++) if (MONEY_HEADER.test(String(header[i]))) out.push(i);
  return out;
}
function blank_(row, cols) { cols.forEach(function (c) { row[c] = ''; }); }

/* Team rows whose Role names LM or AM (hides Owner/DM/Partner org rows). Whole words, so
   'Team Lead' is not an AM. Role is 'AM, LM' / 'LM' / 'Owner, DM' / 'Partner' on the live tab. */
function teamRoles_(ss) {
  var sh = ss.getSheetByName('Team');
  if (!sh) return null;
  var v = sh.getDataRange().getValues();
  if (!v.length) return [];
  var out = [v[0]], ri = colsByName_(v[0], ['Role']);
  if (!ri.length) return out;               // no Role column -> visibly empty, not silently everyone
  for (var i = 1; i < v.length; i++) {
    if (/\b(LM|AM)\b/.test(String(v[i][ri[0]] || '').toUpperCase())) out.push(v[i]);
  }
  return out;
}

/* The Role cell of `person` on the scoped Team tab, as written; '' when they have no LM or AM role. */
function teamRoleOf_(team, person) {
  if (!team || team.length < 2) return '';
  var ni = colsByName_(team[0], ['Name']), ri = colsByName_(team[0], ['Role']);
  if (!ni.length || !ri.length) return '';
  for (var i = 1; i < team.length; i++) if (norm_(team[i][ni[0]]) === norm_(person)) return String(team[i][ri[0]] || '').trim();
  return '';
}

/* Contact IDs of the deals this person is the LM of: their Contracts rows tagged LM. The ONE
   definition of "mine" for money (D-5) — an AM row never adds a fee, a stage or a closing. */
function lmContacts_(rows) {
  var mine = {};
  if (!rows || rows.length < 2) return mine;
  var idx = rows[0].indexOf('Contact ID'), as = rows[0].indexOf('_as');
  if (idx < 0 || as < 0) return mine;
  for (var i = 1; i < rows.length; i++) {
    var c = rows[i][idx];
    if (c && String(rows[i][as]).split(',').indexOf('LM') > -1) mine[c] = true;
  }
  return mine;
}

/* {contactId: fee} and {contactId: dispoStage} from the Pipeline X:Z stash,
   but ONLY for contact ids of the Contracts THIS person is the LM of (deals they
   own — earned/earmarked), never their AM rows. Offers are excluded on purpose: an LM can make an
   offer on a deal someone else contracts (e.g. Jordan offered a seller,
   Michael holds the contract), and offers carry no real fee — the Potential
   bucket uses the avg fee instead. The dispo stage drives Earmarked vs
   Projected: a fee is "earmarked" only once its dispo opp is "Under Contract". */
function scopedFees_(ss, tabs) {
  var mine = lmContacts_(tabs['Contracts']);
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

/* Closings by the role columns C/D/E (Booker (LM), AM, DM), tagged `_as` 'LM' / 'AM' / 'DM' or a
   comma join in that order. The LM tag also covers a deal matched to their LM Contracts (the Booker
   membership that always drove Earned at actual revenue — live, no nightly dependency).
   D-5: Revenue and the fee ship ONLY on an LM row. An AM- or DM-only row carries its date and roles
   with its money blanked, so it cannot add a dollar to anything even if a client ignored `_as`. */
function scopedClosings_(ss, tabs, person) {
  var mine = lmContacts_(tabs['Contracts']);
  var sh = ss.getSheetByName('Closings');
  if (!sh) return null;
  var v = sh.getDataRange().getValues();
  if (!v.length) return [];
  var want = norm_(person), width = v[0].length, money = moneyCols_(v[0], width);
  var ci = colsByName_(v[0], ['Contact ID']), lm = colsByName_(v[0], ['Booker (LM)']);
  var am = colsByName_(v[0], ['AM']), dm = colsByName_(v[0], ['DM']);
  function has(row, cols) { return cols.length > 0 && norm_(row[cols[0]]) === want; }
  var out = [v[0].concat(['_as'])];
  for (var j = 1; j < v.length; j++) {
    var isLM = has(v[j], lm) || (ci.length > 0 && !!v[j][ci[0]] && mine[v[j][ci[0]]] === true);
    var tag = (isLM ? ['LM'] : []).concat(has(v[j], am) ? ['AM'] : [], has(v[j], dm) ? ['DM'] : []).join(',');
    if (!tag) continue;
    var row = v[j].slice();
    if (!isLM) blank_(row, money);
    row.push(tag);
    out.push(row);
  }
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

/* The 'LM Targets' tab (Metric | Lens | Person | Target | Note) as a list of objects, every
   person's rows. NOT for a client — a client gets readLMTargets_ — and kpi_feed narrows it. */
function lmTargetRows_(ss) {
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

/* Only the caller's target rows plus blank-Person rows (a target for everyone): one LM's
   targets are nobody else's business. No Person column -> [], never everyone's. */
function readLMTargets_(ss, person) {
  return lmTargetRows_(ss).filter(function (t) {
    if (!Object.prototype.hasOwnProperty.call(t, 'Person')) return false;
    var p = norm_(t.Person);
    return p === '' || p === norm_(person);
  });
}

/* ── ROUTINE READ FEED ── GET ?action=kpi_feed&token=<ROUTINE_TOKEN>, shape in README §5.
   An ALLOW-LIST of exact headers, in the order they ship: a column nobody listed cannot leave,
   however it is renamed or wherever it is inserted. NO name, phone, email or address column may
   ever join these lists. Closings' fee is its derived gross; its net Revenue stays out. Only
   Contracts has an Opportunity ID. */
var KPI_FEED_TABS = {
  'Appointments': ['Confirmed Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact ID'],
  'Offers':       ['Offer Made Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact ID'],
  'Contracts':    ['Sent Date', 'Signed Date', 'Disposition Date', 'Outcome', 'Booker (LM)', 'AM', 'Contact ID', 'Opportunity ID'],
  'Closings':     ['Closed Date', 'Booker (LM)', 'AM', 'DM', 'Contact ID', 'Gross Assignment Fee (derived)']
};
var KPI_FEED_TARGETS = ['Metric', 'Lens', 'Person', 'Target'];   // no Note: free text no routine needs

/* One tab through the allow-list: {rows: header + rows | null, lastWrite, missing}. A tab has no
   write stamp of its own, so lastWrite = the latest date in its date columns, script-zone
   'YYYY-MM-DD'. A future-dated cell is not a write and must not hide a stale tab. `missing` names
   allow-listed headers the tab no longer has, so a rename reads as a gap, never as blanks. */
function feedTab_(ss, name, allow, nowMs) {
  var sh = ss.getSheetByName(name);
  if (!sh) return { rows: null, lastWrite: null, missing: [] };
  var v = sh.getDataRange().getValues();
  var head = v.length ? v[0] : [], keep = [], missing = [], dates = [];
  allow.forEach(function (h) {
    var c = colsByName_(head, [h]);
    if (!c.length) { missing.push(h); return; }
    if (/ date$/i.test(h)) dates.push(c[0]);
    keep.push({ h: h, c: c[0] });
  });
  var out = [keep.map(function (k) { return k.h; })], last = NaN;
  for (var i = 1; i < v.length; i++) {
    var row = keep.map(function (k) { return tOut_(v[i][k.c] == null ? '' : v[i][k.c]); });
    if (row.every(function (c) { return c === ''; })) continue;
    out.push(row);
    dates.forEach(function (c) {
      var ms = tMs_(v[i][c]);
      if (!isNaN(ms) && ms <= nowMs && (isNaN(last) || ms > last)) last = ms;
    });
  }
  return { rows: out, lastWrite: isNaN(last) ? null : tDay_(new Date(last)), missing: missing };
}

/* task_id -> {status, done_at} for the routine's OWN rows (created_by). Ids carry opp/contact ids and
   hashes, never a name; lead / ask / why stay on the tab. null when the tab is missing. */
function feedTasks_(ss) {
  var sh = ss.getSheetByName(TASKS_TAB);
  if (!sh) return null;
  var v = sh.getDataRange().getValues(), out = {};
  if (!tHasHeader_(v)) return out;
  var h = v[0], iI = tCol_(h, 'task_id'), iS = tCol_(h, 'status'), iD = tCol_(h, 'done_at'), iC = tCol_(h, 'created_by');
  if (iI < 0 || iS < 0 || iC < 0) return out;
  for (var i = 1; i < v.length; i++) {
    var id = tStr_(v[i][iI]);
    if (id && tStr_(v[i][iC]) === ROUTINE_CREATED_BY) out[id] = { status: tStr_(v[i][iS]), done_at: iD < 0 ? '' : tOut_(v[i][iD]) };
  }
  return out;
}

function kpiFeed_(ss) {
  var now = Date.now(), tabs = {}, lastWrite = {}, missing = {};
  Object.keys(KPI_FEED_TABS).forEach(function (name) {
    var t = feedTab_(ss, name, KPI_FEED_TABS[name], now);
    tabs[name] = t.rows;
    lastWrite[name] = t.lastWrite;
    if (t.missing.length) missing[name] = t.missing;
  });
  var targets = lmTargetRows_(ss).filter(function (t) { return tStr_(t.Metric) !== ''; }).map(function (t) {
    var o = {};
    KPI_FEED_TARGETS.forEach(function (k) { o[k] = t[k] == null ? '' : t[k]; });
    return o;
  });
  return { ok: true, role: 'routine', fetchedAt: new Date(now).toISOString(), tabs: tabs, lastWrite: lastWrite,
    missing: missing, lmTargets: targets, goals: curatedGoals_(ss), tasks: feedTasks_(ss) };
}

function norm_(x) { return String(x == null ? '' : x).trim().toLowerCase(); }
function normLabel_(x) { return String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9%$]/g, ''); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ════════════════════════════════════════════════════════════════════════════
 * TASKS & REVIEW (Phase 1) — the contract is apps-script/TASKS.md.
 * ----------------------------------------------------------------------------
 * This block is BYTE-IDENTICAL in Code-LM.gs and Code-owner.gs (two separate
 * Apps Script projects; duplicated on purpose — apps-script-tasks.test.js
 * asserts the two copies match). Change TASKS.md first, then BOTH files.
 *
 * Shape: the helpers take (header + rows) and return rows / patches, so node
 * can run this source in a vm with a stubbed SpreadsheetApp / LockService /
 * ContentService. Columns are resolved BY HEADER NAME, never by index.
 * Identity strings (owner, from, item_owner) compare EXACTLY (trimmed,
 * case-sensitive) — the Team-tab name is the identity everywhere.
 *
 * Each endpoint supplies its own identity resolver (tasksWho_) and its own
 * workbook handle (tasksSS_) ABOVE this block; everything below is shared.
 * ════════════════════════════════════════════════════════════════════════════ */

var TASKS_TAB = 'Tasks', REVIEW_TAB = 'Review';
var TASKS_HEADER = ['task_id', 'date', 'owner', 'visibility', 'kind', 'lead', 'contact_id', 'opp_id', 'ask', 'why',
  'source', 'due', 'priority', 'status', 'done_at', 'done_by', 'note', 'snoozed_until', 'created_at', 'created_by',
  'updated_at', 'ghl_url'];
var REVIEW_HEADER = ['flag_id', 'created_at', 'from', 'item_type', 'item_key', 'item_owner', 'memo_date', 'reason',
  'note', 'evidence', 'status', 'decision_note', 'decided_at', 'decided_by', 'applied_as', 'applied_at'];
var TASK_ACTIONS = { set_status: 1, add_task: 1, assign: 1, flag: 1, decide: 1, upsert_tasks: 1 };
var TASK_SET_STATUSES = { open: 1, done: 1, snoozed: 1, skipped: 1 };   // 'expired' is the producer's alone
var TASK_RECENT_DAYS = 14;                                                 // LM GET: closed rows ship this long
var ROUTINE_CREATED_BY = 'routine:call-coaching';
var GHL_CONTACT_URL = 'https://app.legacy-fusion.com/v2/location/8ZyuO8zm2zuGEdBfB70M/contacts/detail/';
var TASK_PRODUCER_SOURCES = { step_in: 1, texts: 1, next_action: 1, pulse: 1, tracker: 1 };   // what the routine writes; an expire_rule may name only these
var FLAG_ITEM_TYPES = { task: 1, text: 1, call: 1, deal: 1, pulse: 1, tracker: 1 };
var FLAG_REASONS = { 'not-mine': 1, 'already-done': 1, 'wrong-ask': 1, 'wrong-lead': 1, 'wrong-fact': 1,
  'wrong-category': 1, 'score-disagree': 1, 'voicemail-not-conversation': 1, 'number-input-wrong': 1,
  'rule-wrong': 1, 'other': 1 };

/* ── small pure utilities ── */
function tStr_(v) { return String(v == null ? '' : v).trim(); }
function tNorm_(v) { return tStr_(v).toLowerCase(); }
function tSame_(a, b) { return tStr_(a) === tStr_(b); }
/* epoch ms from a cell: Date, ISO/date string, or a Sheets serial. NaN when unreadable. */
function tMs_(v) {
  if (v == null || v === '') return NaN;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v > 1e11 ? v : Math.round((v - 25569) * 864e5);
  return Date.parse(String(v));
}
/* Sheets hands Date objects back for date-looking cells; ship ISO strings so every client sees one shape. */
function tOut_(v) { return (v instanceof Date) ? v.toISOString() : v; }
function tDay_(d) {
  if (typeof Utilities !== 'undefined' && typeof Session !== 'undefined') {
    try { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); } catch (e) {}
  }
  var z = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
}
/* a cell's calendar day 'YYYY-MM-DD' (script time zone), '' when unreadable. A bare 'YYYY-MM-DD' string is taken
   as written — never re-parsed through UTC midnight, which lands on the previous day west of Greenwich. */
function tDayOf_(v) {
  if (typeof v === 'string') { var s = v.trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; if (!s) return ''; }
  var ms = tMs_(v);
  return isNaN(ms) ? '' : tDay_(new Date(ms));
}
/* true only for a real calendar date written exactly 'YYYY-MM-DD' (2026-02-30 is not one) */
function tIsDay_(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
function tRand4_() { return ('0000' + Math.floor(Math.random() * 65536).toString(16)).slice(-4); }
function tPri_(v, dflt) { var n = parseInt(v, 10); return (n >= 1 && n <= 3) ? n : dflt; }
function tGhlUrl_(contactId) { var c = tStr_(contactId); return c ? GHL_CONTACT_URL + c : ''; }
function tCol_(header, name) {
  for (var i = 0; i < header.length; i++) if (tNorm_(header[i]) === tNorm_(name)) return i;
  return -1;
}
function tObj_(header, row) {
  var o = {};
  for (var i = 0; i < header.length; i++) { var k = tStr_(header[i]); if (k) o[k] = tOut_(row[i] == null ? '' : row[i]); }
  return o;
}
/* a full-width row from an object keyed by header name (unknown keys ignored, missing keys blank) */
function tRow_(header, obj) {
  var r = [];
  for (var i = 0; i < header.length; i++) { var k = tStr_(header[i]); r.push(Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null ? obj[k] : ''); }
  return r;
}
function tFit_(row, width) { var r = row.slice(0, width); while (r.length < width) r.push(''); return r; }
function tRowsOut_(header, rows) { return [header.slice()].concat(rows.map(function (r) { return r.map(tOut_); })); }
function tHasHeader_(values) { return !!(values && values.length && values[0] && values[0].some(function (c) { return tStr_(c) !== ''; })); }

/* ── GET scoping (pure: values → header + rows) ── */
/* LM: own rows, team-visible, and either still live or touched in the last 14 days. */
function tasksForLM_(values, person, nowMs) {
  if (!tHasHeader_(values)) return [];
  var h = values[0], iO = tCol_(h, 'owner'), iV = tCol_(h, 'visibility'), iS = tCol_(h, 'status'), iU = tCol_(h, 'updated_at');
  if (iO < 0 || iV < 0 || iS < 0) return [h.slice()];        // no ownership columns -> visibly empty, never everyone
  var cut = nowMs - TASK_RECENT_DAYS * 864e5, out = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (!tSame_(r[iO], person) || tStr_(r[iV]) !== 'team') continue;
    var st = tStr_(r[iS]), up = iU < 0 ? NaN : tMs_(r[iU]);
    if (st === 'open' || st === 'snoozed' || (!isNaN(up) && up >= cut)) out.push(r);
  }
  return tRowsOut_(h, out);
}
function reviewForLM_(values, person) {
  if (!tHasHeader_(values)) return [];
  var h = values[0], iF = tCol_(h, 'from');
  if (iF < 0) return [h.slice()];
  var out = [];
  for (var i = 1; i < values.length; i++) if (tSame_(values[i][iF], person)) out.push(values[i]);
  return tRowsOut_(h, out);
}
/* Owner: an approver sees everything; a non-approver never sees visibility=owner rows. */
function tasksForOwner_(values, approver) {
  if (!tHasHeader_(values)) return [];
  var h = values[0], iV = tCol_(h, 'visibility'), out = [];
  for (var i = 1; i < values.length; i++) {
    if (!approver && (iV < 0 || tStr_(values[i][iV]) === 'owner')) continue;   // no visibility column -> hide all from a non-approver
    out.push(values[i]);
  }
  return tRowsOut_(h, out);
}
function reviewForOwner_(values, approver) {
  if (!approver) return null;
  if (!tHasHeader_(values)) return [];
  return tRowsOut_(values[0], values.slice(1));
}
/* both endpoints: {Tasks, Review} for the payload — null when a tab is missing, never a throw */
function tasksTabsGet_(ss, who) {
  var now = Date.now(), out = { Tasks: null, Review: null };
  var ts = ss.getSheetByName(TASKS_TAB);
  if (ts) { var tv = ts.getDataRange().getValues(); out.Tasks = who.role === 'lm' ? tasksForLM_(tv, who.person, now) : tasksForOwner_(tv, !!who.approver); }
  var rs = ss.getSheetByName(REVIEW_TAB);
  if (rs) { var rv = rs.getDataRange().getValues(); out.Review = who.role === 'lm' ? reviewForLM_(rv, who.person) : reviewForOwner_(rv, !!who.approver); }
  return out;
}

/* ── an in-memory table over a sheet: mutate rows / queue appends, then flush once ── */
function tTable_(sh) {
  if (!sh) return null;
  var values = sh.getDataRange().getValues();
  if (!tHasHeader_(values)) return null;
  return { sh: sh, header: values[0], rows: values.slice(1), dirty: {}, appends: [] };
}
function tFind_(T, col, value) {
  var c = tCol_(T.header, col), v = tStr_(value);
  if (c < 0 || !v) return -1;
  for (var i = 0; i < T.rows.length; i++) if (tStr_(T.rows[i][c]) === v) return i;
  return -1;
}
function tPatch_(T, i, patch) {
  Object.keys(patch).forEach(function (k) { var c = tCol_(T.header, k); if (c > -1) T.rows[i][c] = patch[k]; });
  T.dirty[i] = true;
}
function tFlush_(T) {
  if (!T || !T.sh) return;
  var width = T.header.length, idx = Object.keys(T.dirty).map(Number);
  if (idx.length) {                                   // one contiguous write covering every dirty row
    var lo = Math.min.apply(null, idx), hi = Math.max.apply(null, idx);
    var block = []; for (var i = lo; i <= hi; i++) block.push(tFit_(T.rows[i], width));
    T.sh.getRange(lo + 2, 1, block.length, width).setValues(block);
  }
  if (T.appends.length) {
    var first = T.rows.length + 2, need = first + T.appends.length - 1, have = T.sh.getMaxRows();
    if (have < need) T.sh.insertRowsAfter(have, need - have);
    T.sh.getRange(first, 1, T.appends.length, width).setValues(T.appends.map(function (r) { return tFit_(r, width); }));
  }
}

/* ── permission: may this identity touch this task row? ── */
function tCanTouch_(who, row) {
  if (who.role === 'lm') return tSame_(row.owner, who.person) && tStr_(row.visibility) === 'team';
  if (who.role === 'owner') return !!who.approver || tStr_(row.visibility) !== 'owner';
  return false;
}

/* ── actions (each: who, body, T(asks), R(eview), now) -> response object ── */
function tSetStatus_(who, body, T, R, now) {
  var status = tStr_(body.status), iso = now.toISOString();
  if (!TASK_SET_STATUSES[status]) return { ok: false, error: 'bad status' };
  var i = tFind_(T, 'task_id', body.task_id);
  if (i < 0) return { ok: false, error: 'not found' };
  var row = tObj_(T.header, T.rows[i]);
  if (!tCanTouch_(who, row)) return { ok: false, error: 'forbidden' };
  var patch = { status: status, updated_at: iso };
  if (status === 'done') { patch.done_at = iso; patch.done_by = who.person; }
  if (status === 'snoozed') patch.snoozed_until = tStr_(body.snoozed_until);
  if (status === 'open') { patch.snoozed_until = ''; patch.done_at = ''; patch.done_by = ''; }   // a reopen reads clean
  if (typeof body.note === 'string') patch.note = body.note;
  tPatch_(T, i, patch);
  return { ok: true, task_id: row.task_id, status: status, updated_at: iso };
}
function tAddTask_(who, body, T, R, now) {
  var ask = tStr_(body.ask), iso = now.toISOString(), day = tDay_(now);
  if (!ask) return { ok: false, error: 'ask required' };
  var lm = who.role === 'lm', contact = tStr_(body.contact_id);
  var obj = {
    task_id: 't:self:' + now.getTime() + ':' + tRand4_(), date: day,
    owner: lm ? who.person : tStr_(body.owner),
    visibility: (!lm && who.approver && tStr_(body.visibility) === 'owner') ? 'owner' : 'team',
    kind: tStr_(body.kind) || 'self', lead: tStr_(body.lead), contact_id: contact, opp_id: tStr_(body.opp_id),
    ask: ask, why: tStr_(body.why), source: lm ? 'self' : 'owner',
    due: tStr_(body.due) || day, priority: tPri_(body.priority, 2), status: 'open',
    created_at: iso, created_by: who.person, updated_at: iso, ghl_url: tGhlUrl_(contact)
  };
  T.appends.push(tRow_(T.header, obj));
  return { ok: true, task_id: obj.task_id };
}
function tAssign_(who, body, T, R, now) {
  var i = tFind_(T, 'task_id', body.task_id);
  if (i < 0) return { ok: false, error: 'not found' };
  var row = tObj_(T.header, T.rows[i]);
  if (!tCanTouch_(who, row)) return { ok: false, error: 'forbidden' };
  var owner = tStr_(body.owner), iso = now.toISOString();
  tPatch_(T, i, { owner: owner, updated_at: iso });
  return { ok: true, task_id: row.task_id, owner: owner, updated_at: iso };
}
function tFlag_(who, body, T, R, now) {
  var itemType = tStr_(body.item_type), itemKey = tStr_(body.item_key), itemOwner = tStr_(body.item_owner);
  var reason = tStr_(body.reason), note = tStr_(body.note);
  if (!FLAG_ITEM_TYPES[itemType]) return { ok: false, error: 'bad item_type' };
  if (!itemKey) return { ok: false, error: 'item_key required' };
  if (!FLAG_REASONS[reason]) return { ok: false, error: 'bad reason' };
  if (!note) return { ok: false, error: 'note required' };
  if (who.role === 'lm') {
    if (!tSame_(itemOwner, who.person)) return { ok: false, error: 'forbidden' };
    if (itemType === 'task') {
      var i = tFind_(T, 'task_id', itemKey.replace(/^task:/, ''));
      if (i < 0 || !tSame_(tObj_(T.header, T.rows[i]).owner, who.person)) return { ok: false, error: 'forbidden' };
    }
  }
  var id = 'f:' + now.getTime() + ':' + tRand4_();
  R.appends.push(tRow_(R.header, {
    flag_id: id, created_at: now.toISOString(), from: who.person, item_type: itemType, item_key: itemKey,
    item_owner: itemOwner, memo_date: tStr_(body.memo_date), reason: reason, note: note,
    evidence: tStr_(body.evidence), status: 'pending'
  }));
  return { ok: true, flag_id: id };
}
function tDecide_(who, body, T, R, now) {
  var decision = tStr_(body.decision), noteD = tStr_(body.decision_note), applied = tStr_(body.applied_as), iso = now.toISOString();
  if (decision !== 'accepted' && decision !== 'declined') return { ok: false, error: 'bad decision' };
  if (!noteD) return { ok: false, error: 'decision_note required' };
  var i = tFind_(R, 'flag_id', body.flag_id);
  if (i < 0) return { ok: false, error: 'not found' };
  var flag = tObj_(R.header, R.rows[i]);
  var patch = { status: decision, decision_note: noteD, decided_at: iso, decided_by: who.person };
  var res = { ok: true, flag_id: flag.flag_id, status: decision };
  if (applied === 'fix-task' || applied.indexOf('fix-task:') === 0) {
    var tid = 't:review:' + flag.flag_id;
    if (tFind_(T, 'task_id', tid) < 0) {                               // idempotent: a re-decide never doubles the task
      var src = {};
      if (flag.item_type === 'task') { var j = tFind_(T, 'task_id', flag.item_key.replace(/^task:/, '')); if (j > -1) src = tObj_(T.header, T.rows[j]); }
      var opp = tStr_(src.opp_id) || ((flag.item_type === 'pulse' || flag.item_type === 'tracker') ? flag.item_key.replace(/^(pulse|tracker):/, '') : '');
      T.appends.push(tRow_(T.header, {
        task_id: tid, date: tDay_(now), owner: flag.item_owner, visibility: 'team', kind: 'fix-record',
        lead: tStr_(src.lead), contact_id: tStr_(src.contact_id), opp_id: opp, ask: noteD,
        why: 'Flag ' + flag.flag_id + ' (' + flag.reason + ') accepted by ' + who.person, source: 'review',
        due: tDay_(now), priority: 2, status: 'open', created_at: iso, created_by: who.person, updated_at: iso,
        ghl_url: tStr_(src.ghl_url) || tGhlUrl_(src.contact_id)
      }));
    }
    patch.applied_as = 'fix-task:' + tid; patch.status = 'applied'; patch.applied_at = iso;
    res.status = 'applied'; res.task_id = tid;
  } else if (applied) {
    patch.applied_as = applied;
  }
  tPatch_(R, i, patch);
  return res;
}
/* body.expire_rules -> { rules: {source: 'YYYY-MM-DD'}, notes: [why each bad rule was ignored] }. Never throws:
   a bad rule is dropped with a note and the good ones still apply (TASKS.md, "upsert_tasks expiry"). */
function tExpireRules_(raw, expireSrc, today) {
  var rules = {}, notes = [], own = Object.prototype.hasOwnProperty;
  if (raw == null) return { rules: rules, notes: notes };
  if (!Array.isArray(raw)) { notes.push('expire_rules ignored: not an array'); return { rules: rules, notes: notes }; }
  raw.forEach(function (r, n) {
    var why = '';
    var src = (r && typeof r === 'object' && typeof r.source === 'string') ? r.source.trim() : '';
    var cut = (r && typeof r === 'object' && typeof r.due_before === 'string') ? r.due_before.trim() : '';
    if (!r || typeof r !== 'object' || Array.isArray(r)) why = 'not an object';
    else if (!src) why = 'source required';
    else if (!own.call(TASK_PRODUCER_SOURCES, src)) why = 'unknown source "' + src.slice(0, 40) + '"';
    else if (expireSrc.indexOf(src) > -1) why = src + ' is already in expire_sources';
    else if (own.call(rules, src)) why = 'duplicate source ' + src;
    else if (!tIsDay_(cut)) why = 'due_before must be a YYYY-MM-DD date';
    else if (cut > today) why = 'due_before ' + cut + ' is after today (' + today + ')';
    if (why) notes.push('expire_rules[' + n + '] ignored: ' + why);
    else rules[src] = cut;
  });
  return { rules: rules, notes: notes };
}
function tUpsert_(who, body, T, R, now) {
  var tasks = body.tasks, iso = now.toISOString();
  if (!Array.isArray(tasks)) return { ok: false, error: 'tasks required' };
  var batchDate = tStr_(body.date), seen = {}, appended = 0, refreshed = 0, reopened = 0, skipped = 0;
  tasks.forEach(function (t) {
    var id = (t && typeof t === 'object') ? tStr_(t.task_id) : '';
    if (!id || seen[id]) { skipped++; return; }
    seen[id] = true;
    var i = tFind_(T, 'task_id', id);
    if (i > -1) {
      var cur = tObj_(T.header, T.rows[i]), patch = { updated_at: iso };
      ['ask', 'why', 'due', 'priority', 'lead', 'ghl_url', 'owner'].forEach(function (k) { if (t[k] != null) patch[k] = t[k]; });
      // A PRODUCER row re-routed under its stable id takes the batch's kind and visibility along with the owner
      // (TASKS.md, "upsert_tasks refresh"): a seed deliver-number row going Michael/owner -> AM/team must reach the
      // AM's GET. A person's own row keeps both. owner -> team clears the note: a private note never reaches an LM.
      if (tStr_(cur.created_by) === ROUTINE_CREATED_BY) {
        if (tStr_(t.kind)) patch.kind = tStr_(t.kind);
        if (tStr_(t.visibility)) {
          patch.visibility = tStr_(t.visibility) === 'owner' ? 'owner' : 'team';
          if (patch.visibility === 'team' && tStr_(cur.visibility) === 'owner') patch.note = '';
        }
      }
      // The one status the producer may touch: a row IT expired comes back to life when it is sent again.
      if (tStr_(cur.status) === 'expired') { patch.status = 'open'; reopened++; }
      tPatch_(T, i, patch); refreshed++;
    } else {
      var obj = {};
      TASKS_HEADER.forEach(function (k) { if (t[k] != null) obj[k] = t[k]; });
      obj.task_id = id; obj.date = tStr_(t.date) || batchDate;
      obj.visibility = tStr_(t.visibility) === 'owner' ? 'owner' : 'team';
      obj.priority = tPri_(t.priority, 2);
      obj.status = 'open'; obj.done_at = ''; obj.done_by = ''; obj.note = ''; obj.snoozed_until = '';
      obj.created_at = iso; obj.created_by = ROUTINE_CREATED_BY; obj.updated_at = iso;
      if (!tStr_(obj.ghl_url)) obj.ghl_url = tGhlUrl_(obj.contact_id);
      T.appends.push(tRow_(T.header, obj)); appended++;
    }
  });
  // Expiry, one pass. Only a live (open/snoozed) row NOT in this batch is ever expired, and at most once.
  //  expire_sources: every such row of the source ("this batch is the current set": dated texts, one pulse/tracker row per lead).
  //  expire_rules:   only a PRODUCER row of the source whose due day is before the rule's cutoff (undated step_in /
  //                  next_action ids: a move not re-sent tonight stays live until it is old, never just because it was missed).
  var expireSrc = Array.isArray(body.expire_sources) ? body.expire_sources.map(tStr_) : [], expired = 0;
  var er = tExpireRules_(body.expire_rules, expireSrc, tDay_(now)), ruleSrc = Object.keys(er.rules), byRule = {}, undated = {};
  ruleSrc.forEach(function (s) { byRule[s] = 0; undated[s] = 0; });
  if (expireSrc.length || ruleSrc.length) {
    for (var r = 0; r < T.rows.length; r++) {
      var o = tObj_(T.header, T.rows[r]), st = tStr_(o.status), src = tStr_(o.source);
      if ((st !== 'open' && st !== 'snoozed') || seen[tStr_(o.task_id)]) continue;
      if (expireSrc.indexOf(src) > -1) { tPatch_(T, r, { status: 'expired', updated_at: iso }); expired++; continue; }
      if (ruleSrc.indexOf(src) < 0 || tStr_(o.created_by) !== ROUTINE_CREATED_BY) continue;
      var due = tDayOf_(o.due);
      if (!due) { undated[src]++; continue; }                            // unreadable due -> kept, and said so below
      if (due < er.rules[src]) { tPatch_(T, r, { status: 'expired', updated_at: iso }); expired++; byRule[src]++; }
    }
  }
  ruleSrc.forEach(function (s) { if (undated[s]) er.notes.push(s + ': kept ' + undated[s] + ' live producer row(s) whose due is unreadable'); });
  return { ok: true, appended: appended, refreshed: refreshed, reopened: reopened, expired: expired, skipped: skipped,
    expired_by_rule: byRule, notes: er.notes };
}
var TASK_ACTION_FN = { set_status: tSetStatus_, add_task: tAddTask_, assign: tAssign_, flag: tFlag_, decide: tDecide_, upsert_tasks: tUpsert_ };

/* ── the POST pipeline: role gate -> tabs -> action -> flush. `who` = {role, person, approver}. ── */
function tasksPost_(ss, who, action, body, now) {
  if (!TASK_ACTIONS[action]) return { ok: false, error: 'unknown action' };
  var forbidden = { ok: false, error: 'forbidden' };
  if (who.role === 'routine' && action !== 'upsert_tasks') return forbidden;                 // the routine token does ONE thing
  if (action === 'assign' && who.role !== 'owner') return forbidden;
  if (action === 'decide' && !who.approver) return forbidden;
  if (action === 'upsert_tasks' && !(who.role === 'routine' || (who.role === 'owner' && who.approver))) return forbidden;
  var T = tTable_(ss.getSheetByName(TASKS_TAB));
  if (!T) return { ok: false, error: 'Tasks tab missing' };
  var R = null;
  if (action === 'flag' || action === 'decide') {
    R = tTable_(ss.getSheetByName(REVIEW_TAB));
    if (!R) return { ok: false, error: 'Review tab missing' };
  }
  var res = TASK_ACTION_FN[action](who, body, T, R, now);
  if (res.ok) { tFlush_(T); if (R) tFlush_(R); }
  return res;
}

/* Web-app POST entry. Body = JSON string (sent as text/plain so the browser skips the CORS preflight). */
function doPost(e) {
  var lock = null;
  try {
    var body = null;
    try { body = JSON.parse((e && e.postData && e.postData.contents) || ''); } catch (perr) { body = null; }
    if (!body || typeof body !== 'object') return json_({ ok: false, error: 'bad json' });
    var who = tasksWho_(tStr_(body.token));
    if (!who) return json_({ ok: false, error: 'unauthorized' });
    var action = tStr_(body.action);
    if (!TASK_ACTIONS[action]) return json_({ ok: false, error: 'unknown action' });
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    return json_(tasksPost_(tasksSS_(), who, action, body, new Date()));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (e2) {} }
  }
}
