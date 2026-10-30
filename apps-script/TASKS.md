# CLT Buyers — Tasks & Review (Phase 1 contract)

Agreed with Michael 2026-10-01; amended 2026-10-21 (P1T: stable `step_in` / `next_action` ids,
due-based expiry via `expire_rules`, a refresh carries kind and visibility, the AM owns every number).
One source of truth for the producer (cltbuyers-routines), the two Apps Script endpoints and the two
decks (clt-command-deck). Change this file first, then code.

## Roles (decided)

- **Michael** = owner AND the only approver. Sees everyone's tasks, his own private list, and the review queue.
- **Ed** = owner token, not an approver. Sees team tasks (visibility `team`), never Michael's private rows, never the review queue.
- **Jordan, Andrew** = LM tokens. Each sees ONLY rows whose `owner` is their exact Team-tab name, never `visibility=owner`
  rows, never another person's rows, never another person's flags. Enforced by the ENDPOINT, never by the client.
- **The routine** (call-coaching nightly) = a dedicated `ROUTINE_TOKEN` on the LM endpoint. It may only `upsert_tasks`
  and read `GET ?action=kpi_feed` (README §5), which carries its own rows' `task_id → status / done_at` and nothing else of this tab.
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
| E | kind | call-seller · text-seller · deliver-number · approve · decide · assign · enforce-lm-law · sit-in · check-in · escalation · walkthrough · follow-up · move-stage · fix-record · offer-owed · counter-owed · coaching · next-step · cadence · sign · dispo · self |
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

- `t:michael:step_in:<kind>:<key>` — NO date (since 2026-10-21). key = a lead id for the move — its opp_id or
  contact_id (the producer keys a lead the same way every night) — else hash8 = first 8 hex of sha1 of the `what`
  text. A move re-emitted on a later night refreshes the SAME row only while its key is a lead id: a hash8 key
  changes whenever the wording does, and the old row then ages out through `expire_rules`.
- `t:<date>:<op>:texts:<n>` — n = 1..3. Dated on purpose: "your three for today" expires the next night.
- `t:<op>:next_action:<contact_id|->:<hash8>` — NO date (since 2026-10-21); `-` when the call card has no
  contact; hash8 = first 8 hex of sha1 of the `next_action` text. The same next step, worded the same, on the same
  lead refreshes the same row; a reworded one is a new row and the old one ages out through `expire_rules`.
- `t:pulse:<opp_id>` — NO date: one row per lead while it sits at the front; expired by the producer when it leaves
- `t:tracker:<kind>:<opp_id>` — NO date, same persistence rule
- Rows written before 2026-10-21 carry the old dated `step_in` / `next_action` ids; nothing re-sends them, so they
  age out through `expire_rules` (below) with no special case.
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
| `upsert_tasks` | ROUTINE_TOKEN (LM endpoint); approver (owner endpoint) | date, tasks: [row objects keyed by header name], expire_sources?: ["texts","pulse","tracker"], expire_rules?: [{source, due_before}] | For each task: if task_id exists → refresh ask, why, due, priority, lead, ghl_url, owner, and — on a producer row — kind and visibility (see *refresh*, below; NOT status/done_*, and note only as said there), set updated_at (a row in status `expired` comes back `open`); else append with status `open`, created_at = now, created_by = `routine:call-coaching`. Then expiry, below. Returns `{appended, refreshed, reopened, expired, skipped, expired_by_rule, notes}`. |

Unknown action → `{ok:false,error:'unknown action'}`. Bad token → `{ok:false,error:'unauthorized'}`. An LM asking about
another person's row → `{ok:false,error:'forbidden'}` and NOTHING about that row in the response.

#### `upsert_tasks` refresh — owner, kind and visibility move together

A producer row (`created_by` = `routine:call-coaching`) that is sent again takes the batch's `kind` and
`visibility` along with its owner, because the producer re-routes a stable id: since 2026-10-21 the 10/1 seed rows
`t:tracker:deliver-number:<opp>` (Michael, `owner`) come back as the AM's (`team`), and a `t:pulse:<opp>` row moves
from Michael's private `assign` to the lead's LM once the lead is assigned. Without this a row would read owner =
Jordan with visibility `owner`, which no LM GET serves and the owner deck files under Michael's private column.

- `visibility` is normalised exactly as on append (`owner` → `owner`, anything else → `team`); an absent or empty
  `visibility` / `kind` leaves the cell as it is.
- A row that goes `owner` → `team` has its `note` cleared: a private note Michael wrote never reaches an LM.
- A row a person created (`t:self:…`, `t:review:…`, `created_by` = a Team-tab name) keeps its kind and visibility.

#### `upsert_tasks` expiry — two kinds, one pass

Only rows in status `open` or `snoozed` whose task_id is NOT in this batch are ever expired (status `expired`,
updated_at = now). A row the producer sends is live by definition; done / skipped / already-expired rows are never
touched. Each row is expired at most once and counted once.

- **`expire_sources`** (unchanged): e.g. `["texts","pulse","tracker"]` — every such row of a listed source expires.
  For sources whose ids say "this is the current set" (a dated `texts` id, one `pulse` / `tracker` row per lead).
- **`expire_rules`** (2026-10-21): `[{"source":"step_in","due_before":"YYYY-MM-DD"}, {"source":"next_action","due_before":"YYYY-MM-DD"}]`
  — a row of that source expires only when ALSO `created_by` = `routine:call-coaching` (a producer row: a person's
  own task is never aged out) AND its `due`, read as a calendar day in the script time zone, is strictly before
  `due_before`. The producer sends `due_before` = its today − 7 for `step_in` and today − 3 for `next_action`, so a
  move that is not re-sent stays open for a week instead of vanishing the next night. A row whose `due` cannot be
  read is kept, and counted in `notes`.

Validation never throws and never fails the call: the tasks are still upserted and every good rule still applies. A
rule is IGNORED, with one line in `notes` (`"expire_rules[<i>] ignored: <why>"`), when it is not an object; its
`source` is missing or is not a producer source (`step_in` · `texts` · `next_action` · `pulse` · `tracker`; exact,
lowercase); that source is already in `expire_sources`; it repeats a source already ruled in this call (the first
valid rule wins); its `due_before` is not a real `YYYY-MM-DD` date; or `due_before` is after the endpoint's today (it
would expire live tasks). `expire_rules` that is present but not an array is ignored whole (one note). Absent or
`null` → no rules, no note.

Response fields:

| field | meaning |
|---|---|
| `appended` · `refreshed` · `reopened` · `skipped` | the upsert: new rows · existing rows refreshed · of those, rows brought back from `expired` · batch entries with no / a repeated task_id |
| `expired` | every row this call expired (expire_sources + expire_rules) |
| `expired_by_rule` | `{<source>: n}` — one key per rule ACCEPTED, `0` included; `{}` when no rule was accepted. The part of `expired` due to that rule. |
| `notes` | `[]`, or one string per ignored rule / per rule that kept rows with an unreadable `due`. |

A producer that sends `expire_rules` should check the response carries `expired_by_rule`: an endpoint deployed
before 2026-10-21 ignores `expire_rules` silently and answers without that field.

### Tokens (placeholders in the repo, real values only in the deployed editors — repo rule)

- Code-LM.gs: keep `LM_TOKENS` (token → Team-tab name). Add `var ROUTINE_TOKEN = 'SET-IN-DEPLOYED-EDITOR-ROUTINE';` —
  may call ONLY `upsert_tasks` and `GET ?action=kpi_feed`; it is not in LM_TOKENS and gets no scoreboard payload.
- Code-owner.gs: `TOKENS` becomes an object token → Team-tab name: `{'SET-IN-DEPLOYED-EDITOR-MICHAEL': 'Michael Fichman',
  'SET-IN-DEPLOYED-EDITOR-ED': 'Edward Peugh'}` and `var APPROVERS = ['Michael Fichman'];`. Keep accepting an array for
  safety if someone pastes the old shape (treat every entry as a non-approver named 'owner').
- The names are the Team-tab names, typed exactly. `Michael Fichman` is load-bearing: a typo silently drops approver
  (no private rows, no review queue, `upsert_tasks` forbidden on the owner endpoint) — a GET must answer
  `approver:true` for his token. Ed's (`Edward Peugh`, as the Team tab spells it; role Partner) only labels what he does.
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

Roles since 2026-10-21 (P1T): Andrew Estrada = Lead Manager (stages 1–3); Jordan Mathis = Acquisitions Manager — the
**AM** below, call-coaching config `am_operator` — prices and delivers every number, owns offers (5.x) and stays on
the seller through 6.2; Michael Fichman = owner (signs at 6.1, dispositions). (P2 will route each row to its own
`am_key` instead of the one configured AM.)

| source | owner | visibility | kind | task_id |
|---|---|---|---|---|
| `team.json → comparison.step_in` items | Michael Fichman | owner | item.kind (default `decide`) | `t:michael:step_in:<kind>:<lead id\|hash8>` |
| … a legacy step_in of kind `deliver-number` | the AM | team | deliver-number | same scheme |
| each memo's `texts` | that operator | team | coaching | `t:<date>:<op>:texts:<n>` |
| each scored call's `next_action` | that operator | team | next-step | `t:<op>:next_action:<contact_id\|->:<hash8>` |
| pulse rows with flags | the lead's LM; unassigned → Michael (kind `assign`, visibility owner) | team | cadence / call-seller / decide / move-stage | `t:pulse:<opp_id>` (one row per lead; the ask lists every flag) |
| tracker: offers with no number on file; a late 5.1 card whose number is on file but was never given | the AM | team | deliver-number | `t:tracker:deliver-number:<opp_id>` |
| tracker: offer late (> offer_days) | the AM | team | follow-up | `t:tracker:<kind>:<opp_id>` |
| tracker: contract late at 6.1 | Michael Fichman | owner | sign | `t:tracker:<kind>:<opp_id>` |
| tracker: contract late at 6.2 | the AM | team | call-seller | `t:tracker:<kind>:<opp_id>` |
| tracker: contract at 6.3 | — no task — | | | |
| tracker: contract late in a stage the producer does not know | Michael Fichman | owner | check-in | `t:tracker:<kind>:<opp_id>` |
| tracker: a 5.5 card more than 15 min in stage at run time ("contract did not draft: fix the missing fields") | the AM | team | fix-record | `t:tracker:<kind>:<opp_id>` |
| tracker: dispo late | Michael Fichman | owner | follow-up | `t:tracker:<kind>:<opp_id>` |

Rules: an LM without `deal_numbers` gets every ask/why passed through the memo's withholding backstop (`[number withheld]`);
the AM (role `am`) and Michael's private rows keep every number. `due` = the run's "today" for texts/next_action/step_in
(`by` parsed when it is a date), now for pulse priority-1 items and the 5.5 fix-record. The producer POSTs `upsert_tasks` with
`expire_sources: ["texts","pulse","tracker"]` — less `pulse` / `tracker` when that step produced no file this run (absence
only means "gone" when the list was read; `texts` always) — and
`expire_rules: [{"source":"step_in","due_before":<today − 7>}, {"source":"next_action","due_before":<today − 3>}]`
(see *`upsert_tasks` expiry*). The first such post expires the 2026-10-01 seed rows whose due is past the cutoff
(`texts` by source, `step_in` / `next_action` by cutoff) with no special case: 25 of the 28 on the live tab. Andrew's three
seed next steps due 2026-10-29, 2026-11-03 and 2026-12-28 stay open until three days past that due (correct by the rule:
a dated callback lives until then) — skip them from the owner deck if they are stale. The routine's re-routed rows keep
their ids, so the refresh above is what hands the seed `deliver-number` rows to the AM.
Secrets: `.secrets/lm_exec_url` (exists) + `.secrets/deck_routine_token` (new). Exit 0 ok · 2 config · 3 secret missing ·
4 endpoint unreachable or `ok:false`. `--out` writes the batch for tests; `--post` sends it.

## Email flag links (render_memo.py)

Each LM-facing item gets a small "flag" link to
`https://michaelfichman.github.io/clt-command-deck/lm.html#flag=<item_key>&type=<item_type>&owner=<Team name>&date=<memo_date>`
(URL-encoded). Items: each of the three texts, each call card, each deal read, each pulse row, each tracker row.
Owner memo: no links (he is the approver).
