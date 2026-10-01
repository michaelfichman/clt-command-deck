# CLT Buyers — Tasks & Review (Phase 1 contract)

Agreed with Michael 2026-10-01. One source of truth for the producer (cltbuyers-routines), the
two Apps Script endpoints and the two decks (clt-command-deck). Change this file first, then code.

## Roles (decided)

- **Michael** = owner AND the only approver. Sees everyone's tasks, his own private list, and the review queue.
- **Ed** = owner token, not an approver. Sees team tasks (visibility `team`), never Michael's private rows, never the review queue.
- **Jordan, Andrew** = LM tokens. Each sees ONLY rows whose `owner` is their exact Team-tab name, never `visibility=owner`
  rows, never another person's rows, never another person's flags. Enforced by the ENDPOINT, never by the client.
- **The routine** (call-coaching nightly) = a dedicated `ROUTINE_TOKEN` on the LM endpoint. It may only `upsert_tasks`.
- Team-tab names are the identity strings everywhere: `Jordan Mathis`, `Andrew Estrada`, `Michael Fichman`.

## Storage — KPI Staging workbook `1MT1lc3bsB2Wf-ELv_-HGqt400BDAQbK0o5TcBa-hC0w`

Both endpoints already open this workbook. Two new tabs. Look columns up BY HEADER NAME, never by index.

### Tab `Tasks` (row 1 = header)

| col | header | meaning |
|---|---|---|
| A | task_id | stable key (below). Idempotent upsert key. |
| B | date | YYYY-MM-DD the task is for (the coaching run's "today") |
| C | owner | Team-tab name, or empty for unassigned (owner view only) |
| D | visibility | `team` or `owner` (private to Michael) |
| E | kind | call-seller · text-seller · deliver-number · approve · decide · assign · enforce-lm-law · sit-in · check-in · escalation · walkthrough · follow-up · move-stage · fix-record · offer-owed · counter-owed · coaching · next-step · cadence · self |
| F | lead | seller name ("" when none) |
| G | contact_id | GHL contact id or "" |
| H | opp_id | GHL opportunity id or "" |
| I | ask | the task, one or two sentences. LM-voiced for an LM, Michael's verbs for Michael |
| J | why | one line of context |
| K | source | `step_in` · `texts` · `next_action` · `pulse` · `tracker` · `self` · `owner` · `review` |
| L | due | YYYY-MM-DD, or ISO datetime for "now" items |
| M | priority | 1 = now · 2 = today · 3 = this week |
| N | status | open · done · snoozed · skipped · expired |
| O | done_at | ISO |
| P | done_by | Team-tab name |
| Q | note | latest free-text note |
| R | snoozed_until | ISO |
| S | created_at | ISO |
| T | created_by | `routine:call-coaching` or a Team-tab name |
| U | updated_at | ISO |
| V | ghl_url | `https://app.legacy-fusion.com/v2/location/8ZyuO8zm2zuGEdBfB70M/contacts/detail/<contact_id>` or "" |

**task_id scheme** (no spaces; lowercase operator key = `jordan` / `andrew` / `michael`):

- `t:<date>:michael:step_in:<kind>:<hash8>` — hash8 = first 8 hex of sha1 of the `what` text
- `t:<date>:<op>:texts:<n>` — n = 1..3
- `t:<date>:<op>:next_action:<n>` — n = call card index
- `t:pulse:<opp_id>` — NO date: one row per lead while it sits at the front; expired by the producer when it leaves
- `t:tracker:<kind>:<opp_id>` — NO date, same persistence rule
- `t:self:<epoch>:<rand4>` — added from a deck by a person
- `t:review:<flag_id>` — a fix-it task created when a flag is accepted

### Tab `Review` (row 1 = header)

| col | header | meaning |
|---|---|---|
| A | flag_id | `f:<epoch_ms>:<rand4>` |
| B | created_at | ISO |
| C | from | Team-tab name of the flagger |
| D | item_type | task · text · call · deal · pulse · tracker |
| E | item_key | `task:<task_id>` · `text:<date>:<op>:<n>` · `call:<date>:<op>:<n>` · `deal:<date>:<op>:<n>` · `pulse:<opp_id>` · `tracker:<opp_id>` |
| F | item_owner | Team-tab name the item belongs to |
| G | memo_date | YYYY-MM-DD of the report the item came from ("" for pulse/tracker) |
| H | reason | not-mine · already-done · wrong-ask · wrong-lead · wrong-fact · wrong-category · score-disagree · voicemail-not-conversation · number-input-wrong · rule-wrong · other |
| I | note | the flagger's words |
| J | evidence | "mm:ss" of a call, a URL, or "" |
| K | status | pending · accepted · declined · applied |
| L | decision_note | Michael's one line, shown back to the flagger |
| M | decided_at | ISO |
| N | decided_by | always `Michael Fichman` |
| O | applied_as | `fix-task:<task_id>` · `rescore` · `pr:<url>` · `reassigned` · `closed` · `none` |
| P | applied_at | ISO |

## Endpoints

Both Apps Script files gain the same helper code (they are intentionally separate projects). All writes
inside `LockService.getScriptLock()` (wait 10 s). Every response is JSON `{ok:true,...}` or `{ok:false,error}`.

### GET (unchanged signature: `?token=…`)

- **LM endpoint** adds to the payload:
  - `tabs.Tasks` = header + rows where `owner == person` AND `visibility == 'team'` AND (status is `open`/`snoozed`, OR `updated_at` within the last 14 days).
  - `tabs.Review` = header + rows where `from == person`.
  - `tasksAsOf` = ISO now.
- **Owner endpoint** adds:
  - `role: 'owner'`, `person` (Team-tab name for the token), `approver: true|false`.
  - `tabs.Tasks` = all rows for an approver; for a non-approver, all rows except `visibility == 'owner'`.
  - `tabs.Review` = all rows for an approver; `null` for a non-approver.

### POST (body = JSON string, request `Content-Type: text/plain;charset=utf-8` so the browser sends no preflight)

`{ "token": "...", "action": "...", ...fields }` → Apps Script `doPost(e)`; parse `e.postData.contents`.

| action | who | fields | rule |
|---|---|---|---|
| `set_status` | LM, owner | task_id, status, note?, snoozed_until? | LM: only a task whose `owner == person` and `visibility == 'team'`. status ∈ open/done/snoozed/skipped. done → set done_at, done_by. Always set updated_at. |
| `add_task` | LM, owner | ask, lead?, contact_id?, opp_id?, kind?, due?, priority?, owner?, visibility? | LM: owner forced to person, visibility `team`, source `self`, kind default `self`. Owner: owner any Team name or "", visibility `owner` only for an approver, source `owner`. task_id `t:self:<epoch>:<rand4>`. |
| `assign` | owner only | task_id, owner | reassign; sets updated_at |
| `flag` | LM, owner | item_type, item_key, item_owner, memo_date?, reason, note, evidence? | LM: `from = person`, and `item_owner` must equal person; for item_type `task` the task's owner must also equal person. Appends a Review row, status `pending`. Returns flag_id. |
| `decide` | approver only | flag_id, decision (`accepted`/`declined`), decision_note, applied_as? | Sets status, decision_note, decided_at, decided_by. If applied_as starts with `fix-task:` the server ALSO appends a task: owner = the flag's item_owner, kind `fix-record`, source `review`, ask = decision_note, task_id `t:review:<flag_id>`, and status becomes `applied`. |
| `upsert_tasks` | ROUTINE_TOKEN (LM endpoint); approver (owner endpoint) | date, tasks: [row objects keyed by header name], expire_sources: ["pulse","tracker"] | For each task: if task_id exists → refresh ask, why, due, priority, lead, ghl_url, owner (NOT status/note/done_*), set updated_at; else append with status `open`, created_at = now, created_by = `routine:call-coaching`. Then for each source in expire_sources: rows with that source, status `open` or `snoozed`, task_id NOT in this batch → status `expired`, updated_at. Returns `{appended, refreshed, expired}`. |

Unknown action → `{ok:false,error:'unknown action'}`. Bad token → `{ok:false,error:'unauthorized'}`. An LM asking about
another person's row → `{ok:false,error:'forbidden'}` and NOTHING about that row in the response.

### Tokens (placeholders in the repo, real values only in the deployed editors — repo rule)

- Code-LM.gs: keep `LM_TOKENS` (token → Team-tab name). Add `var ROUTINE_TOKEN = 'SET-IN-DEPLOYED-EDITOR-ROUTINE';` —
  may call ONLY `upsert_tasks`; it is not in LM_TOKENS and gets no GET payload.
- Code-owner.gs: `TOKENS` becomes an object token → Team-tab name: `{'SET-IN-DEPLOYED-EDITOR-MICHAEL': 'Michael Fichman',
  'SET-IN-DEPLOYED-EDITOR-ED': 'Ed Peugh'}` and `var APPROVERS = ['Michael Fichman'];`. Keep accepting an array for
  safety if someone pastes the old shape (treat every entry as a non-approver named 'owner').
- Placeholders must stay DISTINCT (an object with duplicate keys silently collapses). Never commit a real token.

## Client behaviour

### LM app (`lm.html` + `lm-view.js`)

- Home gains a button above "Make More Money": `✓ Today — <open> open, <overdue> overdue →` (route metric `tasks`).
- `lmTasksView(M, person)`: sections **Overdue** (due before today, red), **Now** (priority 1 or due within the hour),
  **Today**, **Later** (snoozed / priority 3), **Done today** (collapsed). Each row: kind chip · lead (link to ghl_url) ·
  ask · why (small) · buttons: ✓ done · ⏰ later (2 h / tomorrow 8:30 AM) · ✎ note · ⚑ flag. `+ Add a task for yourself`.
  A **My flags** block lists the person's flags with status and Michael's decision_note.
- ⚑ opens a small form: reason (the pick list), note, evidence → `flag`. The flag form is ALSO reachable for items that are
  not tasks (a coaching line, a call card, a deal read, a pulse row, a tracker row) via the hash deep link
  `#flag=<item_key>&type=<item_type>&owner=<Team name>&date=<memo_date>` — the email carries these links. On load, if
  the hash has `flag`, open the Tasks view with the form prefilled; the token still comes from localStorage.
- Writes go through `LMApp.post(action, fields)` in the host shell: `fetch(cfg.url, {method:'POST', body: JSON.stringify({token: cfg.tok, action, ...fields}), headers:{'Content-Type':'text/plain;charset=utf-8'}, redirect:'follow'})` → on `ok` re-run `load()`. Optimistic UI is fine; errors show inline.
- The item's dollar figures are NOT the client's concern: the producer already withholds them for an LM who is not on the AM track.
- Bump `?v=` on the three script tags and the `sw-lm.js` cache name (v44 → v45) so phones pick up the change.

### Owner deck (`index.html`)

- Nav gains `✓ TASKS`. View `tasks`: a column per person — **Michael (private)** first (approver only), then Jordan,
  Andrew, Unassigned — open items with ✓ done · ⏭ skip · ⇄ reassign (select) · ✎ note; done/skipped today collapsed.
  `+ Add task` with owner select and a "private" toggle (approver only).
- **Review queue** (approver only) at the top when anything is pending: each flag shows from, item_type, item_key,
  reason, note, evidence, and (for task items) the task's ask; buttons **Accept** / **Decline** with a required
  decision_note and an applied_as select (fix-task · rescore · pr · reassigned · closed · none). For `fix-task` the server
  creates the fix-it task. Decided flags (last 20) below, with a filter.
- Writes through a `post(action, fields)` helper identical to the LM one.

## Producer (cltbuyers-routines, `routines/call-coaching/bin/tasks_sync.py`) — Michael's five sources

| source | owner | visibility | kind | task_id |
|---|---|---|---|---|
| `team.json → comparison.step_in` items | Michael Fichman | owner | item.kind (default `decide`) | `t:<date>:michael:step_in:<kind>:<hash8>` |
| each memo's `texts` | that LM | team | coaching | `t:<date>:<op>:texts:<n>` |
| each scored call's `next_action` | that LM | team | next-step | `t:<date>:<op>:next_action:<n>` |
| pulse rows with flags | the lead's LM; unassigned → Michael (kind `assign`, visibility owner) | team | cadence / call-seller / decide / move-stage | `t:pulse:<opp_id>` (one row per lead; the ask lists every flag) |
| tracker: offers with no number on file | Michael Fichman | owner | deliver-number | `t:tracker:deliver-number:<opp_id>` |
| tracker: offer late (> offer_days) | its acquisitions owner | team | follow-up | `t:tracker:follow-up:<opp_id>` |
| tracker: contract or dispo late | Michael Fichman | owner | follow-up | `t:tracker:follow-up:<opp_id>` |

Rules: an LM without `deal_numbers` gets every ask/why passed through the memo's withholding backstop (`[number withheld]`);
Michael's private rows keep every number. `due` = the run's "today" for texts/next_action/step_in (`by` parsed when it is a
date), now for pulse priority-1 items. The producer POSTs `upsert_tasks` with `expire_sources: ["pulse","tracker"]`.
Secrets: `.secrets/lm_exec_url` (exists) + `.secrets/deck_routine_token` (new). Exit 0 ok · 2 config · 3 secret missing ·
4 endpoint unreachable or `ok:false`. `--out` writes the batch for tests; `--post` sends it.

## Email flag links (render_memo.py)

Each LM-facing item gets a small "flag" link to
`https://michaelfichman.github.io/clt-command-deck/lm.html#flag=<item_key>&type=<item_type>&owner=<Team name>&date=<memo_date>`
(URL-encoded). Items: each of the three texts, each call card, each deal read, each pulse row, each tracker row.
Owner memo: no links (he is the approver).
