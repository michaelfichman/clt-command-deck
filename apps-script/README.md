# Apps Script endpoints — deploying Tasks & Review (Phase 1)

The contract is [`TASKS.md`](TASKS.md) (verbatim copy of the agreed spec — change it
first, then code). The two files here are the **source of truth**; the deployed copies
live in two Apps Script editors. Real tokens are never in this repo: every token literal
is a `SET-IN-DEPLOYED-EDITOR-…` placeholder, and the placeholders must stay distinct.

| file | editor | /exec called by |
|---|---|---|
| `Code-LM.gs` | standalone project "CLT LM Endpoint" | `lm.html` (Jordan, Andrew) and the call-coaching routine (`upsert_tasks`, `kpi_feed`) |
| `Code-owner.gs` | container-bound: KPI Staging workbook → Extensions → Apps Script | `index.html` (Michael, Ed) |

## 1. Create the two tabs (once)

In the KPI Staging workbook (`1MT1lc3bsB2Wf-ELv_-HGqt400BDAQbK0o5TcBa-hC0w`) add two tabs
named exactly `Tasks` and `Review`. Row 1 is the header, in this order (columns are looked
up by name, so order is not load-bearing, but keep it):

```
Tasks:  task_id  date  owner  visibility  kind  lead  contact_id  opp_id  ask  why  source  due  priority  status  done_at  done_by  note  snoozed_until  created_at  created_by  updated_at  ghl_url
Review: flag_id  created_at  from  item_type  item_key  item_owner  memo_date  reason  note  evidence  status  decision_note  decided_at  decided_by  applied_as  applied_at
```

Until the tabs exist, GET ships `tabs.Tasks = null` (the decks say "not connected") and
POST answers `{ok:false,error:'Tasks tab missing'}` — nothing throws.

## 2. Redeploy each editor (both, same motion)

### Release order, when a release changes the Pages files AND the scripts (D1 did, D2 does)

The clients go first. The engine reads a payload with no `_as` column as all-LM, so a new
client on the old script is correct; an old client on the new script is not (it ignores `_as`
and counts every AM row as its own). The 5 AM nightly runs the engine files from Michael's
checkout, so that checkout moves before the scripts do. In this order, all before 4:30 AM:

1. Merge after the 5 AM run.
2. Confirm the Pages files are byte-identical to main: fetch each changed file from
   `michaelfichman.github.io/clt-command-deck/` and compare it with `git show main:<file>`.
   Pages lags a merge by a minute or two, and a stale file looks like a passing check.
3. `git pull` in `~/Documents/GitHub/clt-command-deck` (Michael, or the nightly's Step 0).
4. Redeploy BOTH editors per the steps below: same deployment, New version, all tokens
   re-inserted.
5. Run step 6 below, including the `kpi_feed` probes.
6. The `/exec` URL check: the URL you just probed is the one in
   `routines/call-coaching/.secrets/lm_exec_url` and in the phones' links. "New deployment"
   mints a different URL and strands them.
7. From `routines/call-coaching` in the routines repo's main checkout, run
   `node bin/deck_stats.js --person "Jordan Mathis" --as-of <yesterday> --token-file .secrets/lm_exec_token_jordan --url-file .secrets/lm_exec_url`,
   then the same for `"Andrew Estrada"` with `.secrets/lm_exec_token_andrew`. Both must exit 0.

A phone that has not launched since the release can show an old client on the new script
until its next launch. That is display only, and it clears itself.

**D2 (Role Scorecard + Deal Board).** The same order, with the same reason to put the clients
first: a new client on the old script finds neither tab and shows `source stale`, while an old
client on the new script ignores the new keys. The engine files do not change in D2, so step 7 is
a check, not a risk. The order between this release and P4 does not matter either: both tabs are
null until P4 creates them, and nothing throws. Until they land, every scorecard tile, the Deals
count and Jordan's day strip read `source stale` on both phones, and on the owner deck the two
strips (one line each), the A1 tile and the data-health cells do the same while PIPELINE says
`Deal Board not published yet` and runs on the Pipeline tab: all of that is correct, not a failed
deploy. Jordan's Deals page keeps his LM deals under their own label until the board is current. The phone's title is now `CLT · Scoreboard`; an installed icon keeps its old label until it
is re-added. Run the D2 probes in step 6 with both LM tokens and Michael's owner token.

### The steps

Follow the REDEPLOY CHECKLIST at the top of each `.gs` file. In short:

1. Open the editor, copy the editor's **current** token values somewhere safe.
2. Paste the repo file over the editor's `Code.gs`.
3. **Re-insert the tokens** (the paste just overwrote them with placeholders):
   - `Code-LM.gs`: both `LM_TOKENS` keys (Jordan, Andrew) **and** `ROUTINE_TOKEN` — a new
     long random string, different from every LM token (see §3).
   - `Code-owner.gs`: `TOKENS` is now an object `token → Team-tab name`:
     `{'<Michael's token>': 'Michael Fichman', '<Ed's token>': 'Edward Peugh'}` — the
     Team-tab spellings. Two different values. `APPROVERS` stays `['Michael Fichman']`, and
     `Michael Fichman` must be typed exactly: a typo silently drops approver (no review
     queue, no private rows, `upsert_tasks` forbidden). (The old array shape still
     authenticates, but as a non-approver named `owner` — no review queue, no private rows.)
4. Save (Cmd-S). An unsaved paste deploys nothing.
5. Deploy → **Manage deployments** → pencil on the deployment whose `/exec` URL the app
   actually calls → Version: **New version** → Deploy. Never "New deployment" (new URL).
   `doPost` rides the same `/exec` URL as `doGet`; the web app stays "Execute as: Me",
   "Anyone".
6. Verify the live `/exec` (never trust the deploy motion):
   - GET `…/exec?token=<yours>` → the JSON now carries `tasksAsOf` (owner: also
     `role`, `person`, `approver` — Michael's token must answer `person: "Michael Fichman"`,
     `approver: true`).
   - POST (any client; body is a JSON string, `Content-Type: text/plain`) with a bad
     token → `{"ok":false,"error":"unauthorized"}`; with an unknown action and a good
     token → `{"ok":false,"error":"unknown action"}`.
   - `expire_rules` is live (2026-10-21): POST to the **LM** `/exec` with `ROUTINE_TOKEN`
     (the owner `/exec`: Michael's token)
     `{"token":"…","action":"upsert_tasks","date":"<today>","tasks":[],"expire_rules":[{"source":"probe","due_before":"x"}]}`
     → `ok:true` with `"expired_by_rule":{}` and one `notes` line
     (`expire_rules[0] ignored: unknown source "probe"`). It writes nothing (empty batch, no
     `expire_sources`). An answer **without** `expired_by_rule` means the old version is
     still serving — the nightly's `step_in` / `next_action` rows would then never expire.
   - D1 scoping is live: an LM GET carries `teamRole` (Jordan `AM, LM`, Andrew `LM`) and
     `payPlanSet: false`, and `tabs.Offers[0]` ends in `_as`.
   - `kpi_feed` is live: GET the **LM** `/exec` with `?action=kpi_feed&token=<ROUTINE_TOKEN>` →
     `ok:true` with `role:"routine"`, the four `tabs`, a `lastWrite` date per tab and an empty
     `missing` (a name in `missing` means a header moved: see §5). The same GET with either LM
     token, and on the **owner** `/exec` with Michael's token → `{"ok":false,"error":"unauthorized"}`.
   - Every placeholder is gone: GET the **LM** `/exec` with
     `?action=kpi_feed&token=SET-IN-DEPLOYED-EDITOR-ROUTINE` and again with `?token=SET-IN-DEPLOYED-EDITOR-JORDAN`,
     then `…-ANDREW` → all three answer `{"ok":false,"error":"unauthorized"}`. Those strings are public: one
     left in the editor opens that door to anyone holding the `/exec` URL.
   - D2, LM GET, with each LM token: the JSON has the keys `tabs["Role Scorecard"]`, `tabs["Deal Board"]`
     and `dealBoardAsOf`. Before P4 creates the tabs all three are `null`, and `null` is a pass: an
     **absent** key means the old version is still serving. Once the tabs exist:
     `tabs["Deal Board"][0]` is 12 cells ending in `_as`, with no `Value`; Andrew's rows are all tagged
     `LM`, and every one carries `Stage` as a bare number (`5.2`), so no row of his has `offer` or
     `contract` in it; Jordan's are tagged `AM`, `LM` or `LM,AM`, and only his `LM` rows are bare;
     `dealBoardAsOf` is the stamp in N2; and `tabs["Role Scorecard"]` holds only the caller's rows, none
     with a `KPI` starting `M`.
   - D2, owner GET, with Michael's token: the keys `tabs["Role Scorecard"]`, `tabs["Deal Board"]` and
     `syncStatus` are present. `syncStatus.day` is the last day daily-sync ran, normally today after
     about 9 AM, and never a day after today. Once the tabs exist, `tabs["Deal Board"][0]` carries `Value`
     and `As Of`.
   - D2, the owner deck, with Michael's token: open every tab and both people under TEAM. The data-health
     strip on DECK (above the tiles while anything is red, at the foot once all is green) shows Sync Status and
     Tasks with a date, the ticker shows `1ST CALL` and no `S2L`,
     and CAPITAL's partner panel says `LM split: pay plan not set`. After P4's first run, PIPELINE lists the
     Dispositions stages and the `not published yet` note is gone.

## 3. Hand the routine its token

The call-coaching nightly (cltbuyers-routines, `routines/call-coaching/bin/tasks_sync.py`)
posts `upsert_tasks` to the **LM** `/exec` with `ROUTINE_TOKEN`. Its one other use is the
read feed `GET ?action=kpi_feed` (§5). It may do nothing else — it is not in `LM_TOKENS`, so
it gets no scoreboard payload. The owner token never goes on disk for the routine.

1. Generate a long random string (e.g. `openssl rand -hex 24`).
2. Paste it as `ROUTINE_TOKEN` in the deployed **LM** editor, save, new version (§2).
3. Write it, one line, to the routines repo's MAIN checkout only:
   `~/Documents/GitHub/cltbuyers-routines/routines/call-coaching/.secrets/deck_routine_token`
   (next to the existing `lm_exec_url`), then `chmod 600` it. `.secrets/` is gitignored there —
   never in this repo, never in a worktree, never in a commit.
4. Expect the first nightly post after the redeploy to expire the 2026-10-01 seed rows whose
   due is past the cutoff (`texts` via `expire_sources`; `step_in` / `next_action` via
   `expire_rules`): 25 of the 28 on the live tab. Andrew's three seed next steps due 10/29,
   11/03 and 12/28 stay open until three days past that due — correct by the rule; skip them
   from the owner deck if they are stale. That is the design, not data loss — see TASKS.md,
   *`upsert_tasks` expiry*. From then on a `step_in` stays live 7 days and a `next_action`
   3 days past due unless the nightly re-sends it. The same post re-routes the seed
   `t:tracker:deliver-number:<opp>` rows (Michael, private) to the AM with visibility `team`
   (TASKS.md, *`upsert_tasks` refresh*): Jordan's deck must show them that morning.

## 4. Ship the clients

`lm.html`, `index.html`, `lm-view.js`, `lm-view.css` are served by GitHub Pages. Asset
tags are at `?v=47` and both service workers (`sw-lm.js`, `sw.js`) use a `v47` cache name,
so phones and the deck pick the release up on the next launch. Bump all of those together
on every release that changes a client file (the cache sweep deletes any cache whose name
differs). Skip this section when no client file changed — e.g. the 2026-10-21 `expire_rules`
release touched only `apps-script/`.

## 5. What the LM endpoint serves by role, and `kpi_feed`

### The LM GET (`?token=<LM token>`)

Since D1 a deal row is the person's by its role columns, not by contact. The new and changed keys:

| key | value |
|---|---|
| `teamRole` | The person's Team-tab Role as written (`AM, LM`, `LM`); `''` if they have neither role. `role` stays `'lm'`: that is the endpoint, not the job. |
| `payPlanSet` | `false` until pay is decided (D-5). The clients show "Pay plan not set" unless this is `true`, so a script that predates it hides pay too. |
| `splitRate` | `null` while `payPlanSet` is false (the engine still defaults it, nothing shows it). |
| `tabs.Appointments`, `.Offers`, `.Contracts` | The header gains a trailing `_as` column. Each row carries `LM`, `AM` or `LM,AM`, or blank for a **record row**: someone else's row on a contact the person holds a role on (Michael's Declined on their deal). A record row is for the record lists and is never counted. |
| `tabs.Closings` | Scoped by `Booker (LM)` / `AM` / `DM`, plus the LM's own Contracts matched by contact. `_as` is `LM`, `AM`, `DM` or a comma join in that order. |
| `tabs.Team` | Rows whose Role names LM or AM (was LM only). |
| `tabs.Leads` | `Assigned User` only. `Current Owner` no longer scopes anything. |
| `fees`, `stages` | Only the deals the person is the LM of (Contracts rows tagged `LM`). |
| `lmTargets` | The caller's rows plus blank-Person rows. |
| `tabs["Role Scorecard"]` | D2. The person's rows by `Person`, every column. `null` when the tab is missing. Michael's `M` rows reach no phone. |
| `tabs["Deal Board"]` | D2. The rows that are the person's by **Team role**: the `LM` column if Team makes them an LM, the `AM` column if it makes them an AM, tagged in a trailing `_as` (`LM`, `AM`, `LM,AM`). Twelve cells: the first 11 columns, shipped by name in `DEAL_BOARD_SHIP` order, plus `_as`. `Value` and the as-of block never ship, and neither does a column added later. On a row tagged `LM` alone, `Stage` ships as its leading number, or blank if it has none: the words past it name offers and contracts. `null` when the tab is missing, Team gives the person neither role, or the `LM` or `AM` column of a role they hold was renamed. |
| `dealBoardAsOf` | D2. The stamp in N2, as ISO. `null` when the tab, the stamp or every deal is gone: a phone sees only its own rows, so this is what tells an empty board from having no deals. |

Read `_as` by splitting on the comma, never by equality. A header with no `_as` column is the old
shape: treat every row as `LM`. Money ships only on a deal the person is the LM of: on any other
row of Contracts or Closings, each column whose header matches `MONEY_HEADER` is blank.

**What Andrew's phone holds, and what is left for Michael to decide.** No screen on role LM shows an
offer, a contract or a dollar figure, and Deal Board carries none on the wire. Two things are held
back from that on purpose, and each needs a decision before it changes:

- *His own GET still holds dollars and offer counts, outside Deal Board:* `fees`, the Contracts gross
  and the Closings `Revenue` on his LM rows, `goals.avgWholesaleFee`, the Offers and Contracts tabs,
  and A8's `Note` and `Source`, which count phone offers. The engine and the nightly read them, and
  `deck_stats.js` reads `M.comp` off the same token. To take them off, move that nightly read to its
  own door first, then gate them on the role, here and in `scopeToLM`.
- *His task text.* `tasks_sync` keeps a seller's own figures on an LM's task on purpose, and the
  phone masks any `$` figure in `ask` and `why` as `[figure]`. The words `offer` and `contract` stay,
  because real rows use them in plain English and a dropped sentence loses the task. The raw text
  still ships in `tabs.Tasks`, and a typed `note` is not masked, because its box saves back to the
  sheet. Taking the figures out for good is a change in `tasks_sync.py`.

### The owner GET (`?token=<owner token>`), D2

| key | value |
|---|---|
| `tabs["Role Scorecard"]` | The whole tab, `null` when missing. |
| `tabs["Deal Board"]` | The whole tab, `null` when missing: `Value` and the `As Of` block at N1:N2 included. |
| `syncStatus` | The newest day of the Sync Status tab that is not after today, below. `null` when the tab or a readable `daily-sync` row is missing. |

```jsonc
"syncStatus": {
  "day": "2026-11-01",                            // the newest day with a daily-sync row, future rows skipped
  "lastRun": "2026-11-01T08:43:44.675940-05:00",  // its newest run_ts, as written
  "ok": ["calls", "pipeline", "speed"],           // steps any run passed that day
  "failed": [],                                   // steps a run failed and none passed: no data today
  "covered": ["speed"]                            // failed in one run, passed in another
}
```

It is not the tab's last row. A cloud run writes one row per step and a local-fallback run one row
for all three, so the last row says nothing about the other steps, and the rows are not strictly in
time order. `covered` keeps a step that fails every morning in view behind its fallback. Step names
are as written: a `failed_steps` cell can be free text, so escape them.

### Reading the two tabs (D2)

Both clients read them through one reader in `lm-view.js`, `lmRoleTabs()`, then `lmKpi()` and
`lmBoardCount()` / `lmBoardMine()`. A tab reads `source stale`, and its rows are withheld, when it is
missing, empty, stale, or missing a column the reader needs (`why` is `header changed`): `Date`,
`Person`, `KPI`, `Value`, `Target Status`, `Stale` on Role Scorecard; `Opp ID`, `Pipeline`, `Stage`,
`Days`, `Red`, `LM`, `AM`, plus `Value` on the owner's copy, on Deal Board. Exact names, because the
readers look cells up by exact name: `Opp Id` is a rename.

- **Role Scorecard** is stale when its newest `Date` is older than yesterday, or older than two days
  back before 9 AM Eastern, while the nightly may still be running. On top of that, one KPI is stale
  when it has no row, `Stale` set, `Target Status` of `source stale`, a row older than the tab's
  newest `Date`, a `Value` that is not a finite number, or a blank `Value` with no status P4 writes.
  A blank `Value` on a row with `Stale` false and a real `Target Status` is not stale: P4 writes that
  when a KPI measures nothing tonight (nobody owed a dial). It prints `—` with its status word and
  `Note`, no colour, and never a 0. A real 0 stays 0, and a stale row's `Note` still shows.
- **Deal Board** uses the same 9 AM line on its as-of stamp, one day later, because the routine stamps
  the morning it ran. **N2 must therefore be a run-time timestamp, not the memo date.**
- Sheet dates are read on the sheet's clock, not the device's. A date cell reaches JSON as a UTC
  instant, which lands on the day before on a phone west of Eastern.

### What the owner deck adds on top (D2)

- **Data health.** `syncStatus.day` and the nightly's Tasks write use the Deal Board line: today's from
  9 AM Eastern. `tasksAsOf` is the moment of the GET, so it cannot go stale and is shown only as `read <time>`.
  The Tasks cell judges the newest `updated_at` on an open routine row instead, because a person's
  `set_status` bumps `updated_at` too. A `syncStatus.day` after today reads `source stale`, as a backstop to
  the endpoint skipping such rows. While any cell is red the strip sits above the tiles, and otherwise at the foot.
- **Scorecards.** A tab that is not current prints one line per person. Otherwise J3 and J10 carry their
  `Note` on the cell (D-10), on a row that is not stale.
- **PIPELINE.** `Red` is the board's own cell, so the tracker's 7 / 5 / 14 lines stay in `config.yaml`.
  Two values have no cell on the board and are repeated in `index.html` as `DISPO_UC_STAGE` and `UC_STALE_DAYS`:
  change them with `dispo_uc_stage` and `uc_stale_days`. A blank or $0 value is `unvalued`, never added in.
  A missing or header-only tab says `Deal Board not published yet`; a stale one says `source stale` with its date and
  withholds the rows. The Pipeline tab stays on the page, under its own label, because the home tiles, the capital
  bar and PACE read it. Its list and days are live formulas, but its fee comes from the stash only daily-sync writes, so
  that note names the last run, in red when Sync Status is. `Value` comes right after `Deal` so a phone shows it with no swipe.
- **FUNNEL.** The lanes count contacts, by `Booker (LM)` and by `AM`, because the three tabs are event logs. A rate is
  joined on `Contact ID`, so a phone offer does not push walkthrough→offer past 100%. Walkthroughs set are
  Confirmed rows only: A8 and A10 add phone offers and use a window, so they will not match the lane. A lane missing
  a column it reads by name says `source stale` and names the column, because it would otherwise print a row of 0s. A
  header-only tab stays a real 0.

### `GET ?action=kpi_feed&token=<ROUTINE_TOKEN>` (LM `/exec` only)

For the routine's scorecard (P4). `ROUTINE_TOKEN` only: any LM or owner token answers
`{"ok":false,"error":"unauthorized"}`, and the owner `/exec` refuses `action=kpi_feed` for every
token. Headers are an **allow-list** (`KPI_FEED_TABS`), so no name, phone, email or address column
can ship, whatever happens to the tab.

```jsonc
{
  "ok": true,
  "role": "routine",
  "fetchedAt": "2026-10-30T16:00:00.000Z",
  "tabs": {                  // each tab: header row + rows, columns in exactly this order; null if the tab is missing
    "Appointments": [["Confirmed Date", "Disposition Date", "Outcome", "Booker (LM)", "AM", "Contact ID"], ...],
    "Offers":       [["Offer Made Date", "Disposition Date", "Outcome", "Booker (LM)", "AM", "Contact ID"], ...],
    "Contracts":    [["Sent Date", "Signed Date", "Disposition Date", "Outcome", "Booker (LM)", "AM", "Contact ID", "Opportunity ID"], ...],
    "Closings":     [["Closed Date", "Booker (LM)", "AM", "DM", "Contact ID", "Gross Assignment Fee (derived)"], ...]
  },
  "lastWrite": { "Appointments": "2026-10-29", "Offers": "2026-10-28", "Contracts": "2026-10-19", "Closings": "2026-08-27" },
  "missing": {},             // tab -> allow-listed headers it no longer has; {} when all are present
  "lmTargets": [{ "Metric": "connected", "Lens": "daily", "Person": "Andrew Estrada", "Target": 43 }],   // every person's rows
  "goals": { "avgWholesaleFee": 20000, "leadToAppt": 0.15 },   // the GOALS_ALLOW keys, same as the LM GET
  "tasks": { "t:pulse:<opp_id>": { "status": "open", "done_at": "" } }   // routine-made rows only; null if the tab is missing
}
```

- `lastWrite`: the sheet keeps no per-tab write stamp, so this is the latest date in the tab's date
  columns, ignoring future-dated cells, as `YYYY-MM-DD` in the script's time zone. `null` when no date
  is readable or the tab is missing.
- Date cells ship the way the sheet holds them: a real date as an ISO UTC string, a text date as its
  text (`10/29/2026 1:03 PM`). Parse both.
- `Closings`' fee is the derived gross. A non-numeric value there is the sheet's "no partner rate on
  file" alarm: carry it as an error, never coerce it. Net `Revenue` is not served.
- Only Contracts has an `Opportunity ID`; Appointments and Offers join on `Contact ID`.
- A name in `missing` means someone renamed a column. Fail loud on it: the column is absent from the
  rows, and the fix is the rename or `KPI_FEED_TABS`.

## Tests (node, no network)

```
for f in *.test.js; do node "$f" || exit 1; done
```

`apps-script-tasks.test.js` and `apps-script-roles.test.js` run the real `.gs` sources against a
stubbed SpreadsheetApp (the second covers role scoping, pay, targets and `kpi_feed`);
`lm-tasks.test.js` and `deck-tasks.test.js` render the two decks on synthetic payloads;
`lm-roles.test.js` covers the clients' side of D1 (counting by `_as`, one population per ratio,
pace direction, 'Pay plan not set' on the phone and the owner preview) on both payload shapes;
`role-scoper-parity.test.js` runs the real `Code-LM.gs` and the real `scopeToLM` side by side, so the
owner preview and the phone cannot drift (`scoper-parity.test.js` is an older local file, not in git);
`role-tabs.test.js` runs the D2 reader on its own and behind both endpoints and the scoper, then again
under other device time zones;
`phone-roles.test.js` boots `lm.html` for both roles on today's live shape and on a fake workbook with both
tabs, walks every route on every lens (Andrew's phone: no offer, contract or `$` anywhere, and on a salted Tasks
tab no dollar figure, the task's own words being the one exception, §5), checks a resume from the background, and
repeats in other zones;
`owner-render.test.js` boots `index.html` whole on the owner payload in the same two shapes, plus stale, empty and
pre-D2 ones: home, ticker, data health, PIPELINE, FUNNEL, Activity, Team, TASKS lanes, CAPITAL and the Channel Map
reset, then repeats in other zones.
(`lm-smoke.test.js` needs the private `../lm-fixture.js`; `deck-lm-render.test.js`
is pinned to the real clock against a June-2026 fixture.)
