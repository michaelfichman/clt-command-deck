/**
 * ============================================================================
 * SOURCE OF TRUTH — clt-command-deck/apps-script/Code-owner.gs
 * ----------------------------------------------------------------------------
 * The Apps Script editor (container-bound to the KPI Staging workbook:
 * Extensions -> Apps Script) holds the DEPLOYED copy; THIS repo file is the
 * source of truth for logic/structure. Update path: edit here -> run the
 * REDEPLOY CHECKLIST below -> commit.
 *
 * !! TOKENS REDACTED: TOKENS below ships PLACEHOLDERS ('SET-IN-DEPLOYED-
 * EDITOR-…'). This file will NOT authorize anyone as committed. There are TWO
 * live tokens (you + Ed, one each); they live ONLY in the deployed editor —
 * this is a PUBLIC repo and real tokens are never committed. TOKENS is now an
 * OBJECT token -> Team-tab name (the name is the identity: it decides who is
 * an APPROVER and whose private task rows are served). The old array shape is
 * still accepted, but every array entry is a non-approver named 'owner'.
 *
 * REDEPLOY CHECKLIST (encodes the 2026-07-27 failure modes — follow in order):
 *  1. RE-INSERT the live token(s) from the deployed editor copy before
 *     pasting — this file will NOT work as committed (placeholder tokens).
 *     Keep the OBJECT shape: Michael's token -> 'Michael Fichman', Ed's token
 *     -> 'Ed Peugh'. Two DIFFERENT real values — an object with duplicate keys
 *     silently collapses to one entry. APPROVERS stays ['Michael Fichman'].
 *  2. After pasting over the editor's Code.gs: SAVE (Cmd-S). An unsaved
 *     paste deploys nothing.
 *  3. Deploy -> Manage deployments -> pencil icon on the deployment whose
 *     /exec URL matches what the deck ACTUALLY calls -> Version: New version
 *     -> Deploy. Never "New deployment" — that mints a new URL and strands
 *     the client. doPost rides the SAME /exec URL as doGet.
 *  4. VERIFY by probing the live /exec for a change the new code introduces —
 *     never trust the deploy motion alone. (2026-07-27: on the LM endpoint a
 *     paste sat unsaved and a version bump hit the wrong deployment ID; the
 *     probe caught both.) For Tasks: a GET must carry role/person/approver
 *     and `tasksAsOf`; a POST with a bad token must answer
 *     {"ok":false,"error":"unauthorized"}.
 *  5. The KPI Staging workbook must have tabs named exactly `Tasks` and
 *     `Review` with the header rows from apps-script/TASKS.md (row 1).
 *     Missing tab -> GET ships tabs.Tasks = null; POST answers
 *     'Tasks tab missing' / 'Review tab missing'. Never a throw.
 * ============================================================================
 *
 * CLT Buyers — Command Deck data endpoint.
 * Serves RAW tab data as JSON so the dashboard computes every metric
 * from first principles client-side. Token-gated.
 *
 * DEPLOY (one time, ~2 minutes, DESKTOP browser):
 *  1. Open the KPI Staging workbook -> Extensions -> Apps Script.
 *  2. Paste this entire file over the default Code.gs. Change TOKEN below
 *     to a long random string.
 *  3. Deploy -> New deployment -> type: Web app.
 *       Execute as: Me.   Who has access: Anyone.
 *  4. Copy the Web app URL (ends in /exec). That URL + your token go into
 *     the dashboard's setup screen.
 *  Re-deploying after edits: Deploy -> Manage deployments -> edit -> New version.
 */

var TABS = [
  'Leads',
  'Appointments',
  'Offers',
  'Contracts',
  'Closings',
  'Calls',
  'Speed to Lead',
  'Marketing Spend',
  'OpEx',
  'Pipeline',
  'Team',
  'Goals & Assumptions' ,
  'LM Targets',
  // Lead-source → channel map, channel cost basis, and the date-effective PARTNER
  // RATE table. The deck reads all three from here; without this tab it falls back
  // to a built-in map and can apply no partner rate at all (it says so on screen
  // rather than guessing). REDEPLOY REQUIRED after adding this line.
  'Channel Map'
];

/* One token per person: token -> EXACT Team-tab name. Replace BOTH keys with real,
   DIFFERENT values in the deployed editor; delete Ed's entry if he does not hold
   one. The name is the identity — it decides who is an APPROVER (sees the review
   queue + Michael's private task rows) and who is not.
   !! THE PLACEHOLDERS MUST STAY DISTINCT: an object with two identical keys
   silently collapses to ONE entry and the last one wins. NEVER add an empty-string
   key — doGet falls back to token='' when none is supplied, and an '' key would
   make that fallback a valid token, authorizing anyone with the URL to the full
   company P&L. (ownerWho_ also refuses an empty token outright.) */
var TOKENS = {
  'SET-IN-DEPLOYED-EDITOR-MICHAEL': 'Michael Fichman',
  'SET-IN-DEPLOYED-EDITOR-ED': 'Ed Peugh'
};
/* Who may decide flags and see visibility=owner task rows. Team-tab names. */
var APPROVERS = ['Michael Fichman'];

/* Token -> {role:'owner', person, approver} or null. Accepts the OLD array shape
   defensively (someone pastes the pre-Tasks TOKENS): every entry authenticates as
   a non-approver named 'owner', so nothing private leaks through a stale paste. */
function ownerWho_(token) {
  if (!token) return null;
  var person = null;
  if (Array.isArray(TOKENS)) {
    if (TOKENS.indexOf(token) > -1) person = 'owner';
  } else if (Object.prototype.hasOwnProperty.call(TOKENS, token)) {
    person = TOKENS[token];
  }
  if (!person) return null;
  return { role: 'owner', person: person, approver: APPROVERS.indexOf(person) > -1 };
}
/* the shared Tasks block (below) asks these two of each endpoint */
function tasksWho_(token) { return ownerWho_(token); }
function tasksSS_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function doGet(e) {
  var out = {};
  try {
    var token = (e && e.parameter && e.parameter.token) || '';
    var who = ownerWho_(token);
    if (!who) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tabs = {};
    TABS.forEach(function (name) {
      var sh = ss.getSheetByName(name);
      if (!sh) { tabs[name] = null; return; }
      var rng = sh.getDataRange();
      tabs[name] = rng ? rng.getValues() : [];
    });
    // Tasks & Review — an approver gets every row; a non-approver never gets a
    // visibility=owner task row and gets Review = null. See apps-script/TASKS.md.
    var tt = tasksTabsGet_(ss, who);
    tabs['Tasks'] = tt.Tasks;
    tabs['Review'] = tt.Review;
    out = { ok: true, role: 'owner', person: who.person, approver: who.approver,
      fetchedAt: new Date().toISOString(), tasksAsOf: new Date().toISOString(), tabs: tabs };
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return json_(out);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
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
      var patch = { updated_at: iso };
      ['ask', 'why', 'due', 'priority', 'lead', 'ghl_url', 'owner'].forEach(function (k) { if (t[k] != null) patch[k] = t[k]; });
      // The one status the producer may touch: a row IT expired comes back to life when it is sent again.
      if (tStr_(tObj_(T.header, T.rows[i]).status) === 'expired') { patch.status = 'open'; reopened++; }
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
  var expireSrc = Array.isArray(body.expire_sources) ? body.expire_sources.map(tStr_) : [], expired = 0;
  if (expireSrc.length) {
    for (var r = 0; r < T.rows.length; r++) {
      var o = tObj_(T.header, T.rows[r]), st = tStr_(o.status);
      if (expireSrc.indexOf(tStr_(o.source)) > -1 && (st === 'open' || st === 'snoozed') && !seen[tStr_(o.task_id)]) {
        tPatch_(T, r, { status: 'expired', updated_at: iso }); expired++;
      }
    }
  }
  return { ok: true, appended: appended, refreshed: refreshed, reopened: reopened, expired: expired, skipped: skipped };
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
