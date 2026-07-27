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
 * EDITOR'). This file will NOT authorize anyone as committed. There are TWO
 * live tokens (you + Ed, one each); they live ONLY in the deployed editor —
 * this is a PUBLIC repo and real tokens are never committed.
 *
 * REDEPLOY CHECKLIST (encodes the 2026-07-27 failure modes — follow in order):
 *  1. RE-INSERT the live token(s) from the deployed editor copy before
 *     pasting — this file will NOT work as committed (placeholder tokens).
 *  2. After pasting over the editor's Code.gs: SAVE (Cmd-S). An unsaved
 *     paste deploys nothing.
 *  3. Deploy -> Manage deployments -> pencil icon on the deployment whose
 *     /exec URL matches what the deck ACTUALLY calls -> Version: New version
 *     -> Deploy. Never "New deployment" — that mints a new URL and strands
 *     the client.
 *  4. VERIFY by probing the live /exec for a change the new code introduces —
 *     never trust the deploy motion alone. (2026-07-27: on the LM endpoint a
 *     paste sat unsaved and a version bump hit the wrong deployment ID; the
 *     probe caught both.)
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
  'LM Targets'
];

var TOKENS = ['SET-IN-DEPLOYED-EDITOR', 'SET-IN-DEPLOYED-EDITOR'];   // two live tokens (you + Ed); real values only in the deployed editor

function doGet(e) {
  var out = {};
  try {
    var token = (e && e.parameter && e.parameter.token) || '';
    if (TOKENS.indexOf(token) === -1) {
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
    out = { ok: true, fetchedAt: new Date().toISOString(), tabs: tabs };
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
