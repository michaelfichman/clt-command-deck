# Apps Script endpoints — deploying Tasks & Review (Phase 1)

The contract is [`TASKS.md`](TASKS.md) (verbatim copy of the agreed spec — change it
first, then code). The two files here are the **source of truth**; the deployed copies
live in two Apps Script editors. Real tokens are never in this repo: every token literal
is a `SET-IN-DEPLOYED-EDITOR-…` placeholder, and the placeholders must stay distinct.

| file | editor | /exec called by |
|---|---|---|
| `Code-LM.gs` | standalone project "CLT LM Endpoint" | `lm.html` (Jordan, Andrew) and the call-coaching routine (`upsert_tasks`) |
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

## 3. Hand the routine its token

The call-coaching nightly (cltbuyers-routines, `routines/call-coaching/bin/tasks_sync.py`)
posts `upsert_tasks` to the **LM** `/exec` with `ROUTINE_TOKEN`. That token may do nothing
else — it is not in `LM_TOKENS`, so it gets no GET payload.

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
tags are at `?v=45` and both service workers (`sw-lm.js`, `sw.js`) use a `v45` cache name,
so phones and the deck pick the release up on the next launch. Bump all of those together
on every release that changes a client file (the cache sweep deletes any cache whose name
differs). Skip this section when no client file changed — e.g. the 2026-10-21 `expire_rules`
release touched only `apps-script/`.

## Tests (node, no network)

```
for f in *.test.js; do node "$f" || exit 1; done
```

`apps-script-tasks.test.js` runs the real `.gs` sources against a stubbed SpreadsheetApp;
`lm-tasks.test.js` and `deck-tasks.test.js` render the two decks on synthetic payloads.
(`lm-smoke.test.js` needs the private `../lm-fixture.js`; `deck-lm-render.test.js`
is pinned to the real clock against a June-2026 fixture.)
