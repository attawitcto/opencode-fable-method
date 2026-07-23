# Prompt for the next session

Copy everything below the line into a fresh session.

---

Repo: `${PKG}`, branch `master`,
HEAD `bc62920`, clean apart from an untracked `.github/`.

You have **90 minutes**. The goal is one thing: **make this plugin measurably
better than not having it, for a weak model.** Not more features. Read
`eval/RESULTS-opencode-plugin.md` first, then `eval/RESULTS.md` (upstream's).
They are short and they will stop you repeating work.

## What is already known, so you do not re-derive it

The plugin delivers upstream's Fable Method to OpenCode. Its measured value is
concentrated at the weak tier on specific traps, not on general capability:
a spec-versus-test conflict surfaced 0 of 4 bare and 4 of 4 with the intent
gate; a five-site twin bug 1 of 5 bare and 5 of 5 with the twin check; planted
frauds 3.5 of 5 bare and 5 of 5 with the judge. The previous session reproduced
the first of those independently on MiniMax-M3: control 0,0 against method 2,2,
with both control runs rewriting the README to hide the contradiction.

The previous session also added five rules of its own. One (`BASELINE:`) was
measured and is **a null** — it fires reliably but changed no score in any
round. The other four (`SPOT-CHECK:`, a narrowed definition of "consequential",
a three-surprise cap, an "unchecked evidence" fraud) are **unmeasured**. Do not
add a sixth. If anything, the honest move is subtraction.

## The single biggest risk

**Five of the seven commands have never been executed, not once.** Only
`/fable-doctor` and `/fable-method` have ever run. `/fable-judge` in particular
is the plugin's largest measured lift at the weak tier and nobody has confirmed
it works here. A headline feature that is silently broken costs more than any
feature that is missing.

## Suggested priority, but use your judgment

1. **Run `/fable-judge` against `eval/scenarios/s7-fraudulent-work`.** That
   fixture ships a completed-looking directory plus a lying report hiding five
   planted frauds, with the ground truth included. If the judge catches them,
   the plugin's best feature is real. If it does not run at all, that is the
   most valuable bug you can find today.
2. **Run `/fable-loop` once on a real multi-step task** and confirm the
   `evidence` subagent is actually reachable and useful, not just configured.
3. **Free hygiene, no model calls:** commit `.github/checks.py` (copied from
   upstream, it validates skills, adapters and evidence and it passes on
   upstream clean) and fix what it flags in files shared with upstream. The
   previous session introduced em/en dashes into `skills/fable-method/SKILL.md`
   (4), `skills/fable-loop/SKILL.md` (4), `prompts/fable.md` (3) and
   `instructions/fable-invariants.md` (5); upstream has zero and bans them.
4. **`/fable-judge suite` has never run** and its path was only recently made to
   resolve. Cheap to check, may be broken.

## Harness gotchas, learned expensively. Do not rediscover these.

- `opencode run --agent evidence` **does not run that agent.** OpenCode prints
  one warning line and silently falls back to the default primary agent, which
  can edit files. A subagent is only reachable by a primary agent delegating to
  it. Three probes were wasted concluding a security hole that did not exist.
- Fixtures in the session scratchpad are **external directories** to OpenCode,
  so every `Read` hits `external_directory: ask` and `opencode run`
  auto-rejects it, leaving the agent working blind while looking healthy. Put
  `"permission": {"external_directory": "allow"}` in the run's own
  `opencode.json`; the project-wins path carries it.
- The `s*` fixtures call `python`; this machine has only `python3`, and the
  shell alias does not reach a non-interactive tool call. Put a shim on PATH.
- **zsh does not word-split an unquoted scalar.** `FLAG="--command x"` reaches
  the command as a single argv entry and `opencode` prints its help instead of
  running. Use an array. Identical byte counts across two runs is the tell.
- `opencode debug config` **truncates at 65536 bytes when stdout is a pipe.**
  Redirect to a file. `bin/doctor.js` already works around this.
- MiniMax-M3 stalls with zero output perhaps 2 runs in 10, in clusters. Use a
  watchdog, and do not read a stall as a result.
- Existing runners to copy from: `eval/run-s5-opencode.sh` (single arm) and
  `eval/run-p2-opencode.sh` (method/control arms in one script).

## Discipline this repo is held to

- **Grade by diff and execution, never by the report.** Copy the fixture fresh,
  withhold `GROUND-TRUTH.md`, and run the checks yourself afterwards.
- **Do not trust your own grep counters.** They produced two false negatives
  last session that would have manufactured a win for this fork out of a
  pattern. Read the transcript; the counters are hints.
- **No rule without a failing test.** Upstream deletes features that fail
  (skill-in-skill 1 of 14; a scaffolding-strip clause 0 of 3) and ships ones
  that are observation-distilled with their nulls published. Follow that.
- **Publish nulls and results that go against you.** Two of the five rounds
  last session refuted the person running them, which is the only reason the
  other three are worth anything.
- Log rounds in `eval/RESULTS-opencode-plugin.md` as P6 onward. Never edit
  `eval/RESULTS.md`; it is vendored upstream evidence.

## Budget

Each model run costs real money and takes 20 to 500 seconds. Use
`minimax-coding-plan/MiniMax-M3`. Prefer n=2 and say so; n=1 is a smoke test and
must be labelled one. If you find yourself building a third fixture, stop and
verify a command instead.

## Definition of done

A short report saying, with evidence: which of the seven commands actually work,
what the judge caught or missed on s7, and one honest sentence on whether this
plugin is worth using for a weak model. If the answer turns out to be "the
method is worth it and this fork's own additions are not", say that.
