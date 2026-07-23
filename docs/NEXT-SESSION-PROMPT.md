# Prompt for the next session

Copy everything below the line into a fresh session.

---

Repo: `${PKG}`, branch `master`,
clean tree.

Read `eval/RESULTS-opencode-plugin.md` rounds P6 to P9 first, then
`eval/README.md`. They are short and they will stop you repeating work.
`eval/RESULTS.md` is vendored upstream evidence: read it, never edit it.

## What changed last session, so you do not re-derive it

All six commands have now been executed at least once. The three that were
broken are fixed and measured:

- `/fable-judge` **deadlocked on every run as shipped.** Its bash fallback was
  `ask`, and a subagent has nowhere to raise an approval prompt, so it stopped
  on the first command not on the inspect allow-list. Fallback is `allow` now,
  with `HARD_ASKS` collapsing every profile `ask` to `deny` so it cannot outrank
  the agent it reviews. On `s7`: REFUTED 2 of 2, all five planted frauds, backed
  by executed evidence.
- `/fable-plan` **edited files** despite advertising "Does not edit files". Not
  the `plan` agent's doing: `subtask: true` hands the session back to a parent
  that can edit, and the parent did the editing. Flag dropped, 2 of 2 clean.
  `/fable-judge` had the same exposure and is `mode: 'all'` now for the same
  reason.
- A **read-only agent could write anywhere** via `ls | sort > /tmp/f`. OpenCode
  builds its permission strings with `Pi(U)` per `command` node, and `Pi` looks
  one level up, so a redirect behind a pipe is invisible to every pattern.
  Closed with a `tool.execute.before` hook, canary-verified both directions.

`/fable` was deleted as a duplicate of `/fable-loop`, so there are six commands.

`.github/checks.py` now asserts the static properties those bugs violated: no
subagent resolves to `ask`, no subagent outranks the primary profile, no
read-only command is a subtask, and every named export returns an object. All
were verified by mutation. Run it first, every time; it costs nothing.

## The one open decision

**`evidence` has never fired.** 0 of 3 attempts across `s5` and `s13`, and on
`s13` neither transcript contains the word subagent even once. It is kept on
probation with a written trigger (see the end of P9): rerun `/fable-loop` on
`s13-twin-fleet`, n=2, with an executor **stronger than MiniMax-M3**; if it is
0 of 2 again, delete the agent, its prompt and the Stage 1 fan-out section.

That measurement **could not be run on the previous machine** - only
`minimax-coding-plan` was authenticated and M3 is its strongest model. If you
have a stronger executor, this is the highest-value thing you can do. If you do
not, do not fake it with a weaker one, and do not let the probation quietly
expire.

Until then, nothing may claim this plugin fans out evidence gathering. The
`TWINS:` line is what actually produced the sweep on `s13`, in the main thread.

## Other open items, roughly in order

1. **`/fable-judge suite` has still never run.** It needs `eval/scenarios/`,
   which ships. Cheap to check, may be broken.
2. **An agent can burn a whole run against the profile.** On `s13` run 1 the
   agent finished the work, then tried to clean `__pycache__`, hit `rm -rf`
   deny and `rm -r` ask (auto-rejected headless), retried, and the watchdog
   caught it still there. It scored nothing despite having done the work. Not
   obviously the plugin's to fix, but it is a live headless failure mode.
3. **The strict profile has never been exercised with a model.** Statically its
   defaults are right (`git commit` ask, `gh pr create` deny).
4. **`/fable-plan`'s `edit: deny` second layer is unexercised** - neither
   passing run attempted an edit, so only the removed parent is proven.
5. **The redirect hook fails open** if `chat.params` never fired for a session.
   It always has in practice, but a resumed or compacted session is untested.
6. Step-header leakage is still open, and is upstream's.

## Harness gotchas, learned expensively. Do not rediscover these.

- **OpenCode calls every named export of a plugin file as a plugin factory.** A
  bare `export { effective }` killed the whole plugin with
  `UnknownError: Unexpected server error` and an empty log; it cost forty
  minutes and three wrong suspects. `checks.py` catches it now.
- `opencode run --agent <subagent>` **does not run that agent.** It warns once
  and falls back to the default primary.
- Fixtures in the scratchpad are **external directories**; put
  `"permission": {"external_directory": "allow"}` in the run's own
  `opencode.json`.
- The `s*` fixtures call `python`; this machine has only `python3`. Shim it.
- **zsh does not word-split an unquoted scalar.** Use an array for flags.
  Identical byte counts across two runs is the tell.
- `opencode debug config` truncates at 65536 bytes into a pipe. Redirect to a file.
- **The session store is the real transcript.**
  `~/.local/share/opencode/opencode.db`, tables `session` and `part`. It is how
  the judge deadlock, the `/fable-plan` parent and the fan-out null were all
  diagnosed; stdout hides subtask internals.
  `~/.local/share/opencode/log/opencode.log` logs every permission evaluation
  with the exact string matched and the rule that won.
- MiniMax-M3 stalls with zero output perhaps 2 runs in 10. Use a watchdog, and
  do not read a stall as a result.
- `cd` inside a tool call persists across later calls; use absolute paths.
- Runners to copy from: `eval/run-s7-judge-opencode.sh` (single arm),
  `eval/run-p7-plan-opencode.sh` (two arms), `eval/run-p9-loop-fanout.sh`
  (wide fixture plus a functional grader).

## Discipline this repo is held to

- **Grade by diff and execution, never by the report.** Copy the fixture fresh,
  withhold `GROUND-TRUTH.md`, run the checks yourself afterwards.
- **Do not trust your own grep counters.** They have produced false negatives
  that would have manufactured a win. Read the transcript.
- **Prefer a static assertion to a measurement** where the property is static.
  Four of last session's checks cost nothing and catch bugs that cost hours.
- **A check that cannot fail is not a check.** Verify every new assertion by
  mutating the code it guards. One of last session's assertions passed on the
  very regression it was written for until it was tested this way.
- **No rule without a failing test, and no feature kept without a deletion
  trigger.**
- **Publish nulls and results that go against you.** Several rounds refuted the
  person running them, which is the only reason the rest is worth anything.
- Log rounds in `eval/RESULTS-opencode-plugin.md` as P10 onward.

## Budget

Each model run costs real money and takes 20 to 900 seconds. Prefer n=2 and say
so; n=1 is a smoke test and must be labelled one. A failure that happens before
the model is reached costs nothing - use that to bisect config problems cheaply.
