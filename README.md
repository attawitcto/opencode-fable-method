# opencode-fable-method

The Fable Method for [OpenCode](https://opencode.ai), delivered as a plugin.

Three agents, seven commands, four skills and a permission profile - installed
by adding one line to `opencode.json`. **No files are copied into your
repository**, and the plugin writes nothing at startup.

(OpenCode's own plugin loader does create a dependency cache at
`.opencode/node_modules/` alongside a `.opencode/.gitignore` that excludes it,
so `git status` stays clean. That is OpenCode, not this plugin.)

## Install

**This package is not published yet.** Until it is, install it from a local
checkout by adding one key to your project's `opencode.json` - merge it into
the file, do not replace the file:

```json
{
  "plugin": ["file:/absolute/path/to/opencode-fable-method"]
}
```

A `file:` path is machine-specific, so use it for your own checkout and never
commit it to a shared repository.

> **Check your existing `permission` block first.** If it contains a
> catch-all - `"permission": { "*": "ask" }` or `"deny"` - that rule applies
> to *every* tool including skill loading, so every Fable command will prompt
> before it can start, and `opencode run` auto-rejects prompts and fails
> outright. Delete the catch-all and let this plugin's granular profile stand,
> keeping only the specific rules you actually want stricter. `/fable-doctor`
> reports this as a blocking problem.

Once the package is published, install becomes one command:

```bash
opencode plugin opencode-fable-method
```

or, added by hand and pinned to a version:

```json
{
  "plugin": ["opencode-fable-method@0.1.0"]
}
```

Either way, restart OpenCode afterwards - config is read once at startup and
is not hot-reloaded.

To prompt on every commit and deny PR creation outright, pass the strict profile:

```json
{
  "plugin": [["file:/absolute/path/to/opencode-fable-method", { "permissionProfile": "strict" }]]
}
```

## Uninstall

Delete the entry from `plugin`. That is the whole procedure: the agents,
commands, skills, instructions and permission rules disappear with it, and
your working tree is untouched because nothing was ever written to it.

## What you get

| | |
|---|---|
| Agents | `fable` (primary), `evidence` (read-only), `fable-judge` (read-only) |
| Commands | `/fable`, `/fable-loop`, `/fable-method`, `/fable-plan`, `/fable-judge`, `/fable-domain`, `/fable-doctor` |
| Tools | `fable_doctor` - read-only wiring + permission report, computed in the plugin |
| Skills | `fable-method`, `fable-loop`, `fable-judge`, `fable-domain` |
| Instructions | Fable invariants, appended to `instructions` - your `AGENTS.md` is never modified |
| Permissions | The `critical-only-compromise-v1` profile (below) |

The doctor reports what actually resolved: which agents, commands and skills
are live and where each came from, the effective permission for representative
commands **per agent**, the edit/read gates, and every rule your project
overrode. It is a pure computation over the resolved config - it runs no shell
commands and reads no files - so it is instant and cannot drift from reality.

Run it from the shell, in the project you want reported on:

```bash
npx fable-doctor            # or: node <package>/bin/doctor.js
npx fable-doctor --strict   # if you installed with permissionProfile: strict
```

The `--strict` flag is needed because the profile you passed to the plugin is
not recoverable from the resolved config; the report prints which one it
assumed.

`/fable-doctor` runs the same computation inside a session, through the
`fable_doctor` tool. Prefer the CLI when it matters: the tables reach you only
if the model chooses to reproduce them, and on a weaker model it sometimes
replies with a summary instead. The shell command has no such step.

Two things worth knowing if you script against OpenCode yourself: the doctor's
last-match-wins resolution is the part `opencode debug config` cannot give you
(it prints the rules, not their outcome), and `opencode debug config`
truncates at 65536 bytes when its stdout is a pipe - redirect it to a file.

From outside a session, ask OpenCode directly:

```bash
opencode debug config          # agent / command / skills.paths / permission
opencode debug skill           # confirms the four fable-* skills resolve
opencode debug agent evidence  # confirms a subagent is read-only
```

Permission rules are last-match-wins, so read the **last** matching entry in
that output, not the first.

## Permission profile

Ordinary reads, searches, edits, builds, tests and local commits run without
approval prompts. What is gated:

| | |
|---|---|
| `ask` | `git push`, `git reset`, `git rebase`, `git merge`, `rm -r`, `docker push`, `gh pr create` (strict profile: deny), `terraform apply`, `kubectl apply`, paths outside the project, repeated identical calls, edits to `AGENTS.md` / `opencode.json` / `.opencode/**` |
| `deny` | force-push, remote-ref deletion, `git reset --hard`, `git clean`, `rm -rf`, `sudo`, publish, `gh pr merge` / `gh release create`, `terraform destroy`, `kubectl delete`, reading or editing `.env` files |

OpenCode permission maps are **last-match-wins over key order**, so the rules
are built as an ordered list: broad allows first, specific safeguards after.

### Overriding

Anything your project defines wins. This plugin only fills gaps - set a rule
in your own `opencode.json` and it takes effect:

```json
{
  "permission": { "bash": { "git commit*": "ask" } }
}
```

For the common case of wanting every commit prompted and PR creation denied
outright, pass the profile option instead:

```json
{
  "plugin": [["opencode-fable-method@0.1.0", { "permissionProfile": "strict" }]]
}
```

## Commit policy

A local commit runs without an extra prompt **only when the task you asked for
includes committing** - a task that did not ask for a commit does not get one,
and focused verification plus a full diff review must come first. Pushing
always asks. Force-push, publish, release and outward-facing merge are denied
outright.

## Design invariants

1. **The plugin never writes files.** It mutates the resolved config in
   memory. Opening OpenCode must leave `git status` unchanged - verified in a
   fresh repository.
2. **The project always wins.** Agents, commands and permission rules already
   defined by the project are left alone.
3. **Pin the version.** Never `@latest` in `plugin`.
4. **git is the backup and rollback mechanism.** This plugin ships no
   manifest, no checksums and no `.bak` files, because it installs nothing.

## Effect on your git repository

The plugin writes nothing. Everything it does happens in the resolved config
in memory, so a session - including live `/fable-*` runs - leaves `git status`
byte-for-byte unchanged.

OpenCode itself is a different matter. On startup it installs plugin
dependencies into the project at `.opencode/node_modules/` alongside
`package.json` and `package-lock.json`. This happens **with or without this
plugin** - removing every `plugin` entry produces the same three paths - so it
is OpenCode's behaviour, not Fable's.

Whether those show up in `git status` depends on one file:

| your repo | result |
|---|---|
| no `.opencode/.gitignore` | OpenCode writes one covering `node_modules`, `package.json`, `package-lock.json`, `bun.lock` and itself → clean |
| already has its own `.opencode/.gitignore` | OpenCode **does not overwrite it** → the three paths appear as untracked |

In the second case, add them yourself:

```gitignore
# .opencode/.gitignore
node_modules
package.json
package-lock.json
bun.lock
```

What the plugin *does* constrain is what an agent may do to git: `.git/**` is
uneditable, `git push` asks, and force-push, `--mirror`, remote-ref deletion,
`git reset --hard`, `git clean`, `git branch -D` and `git reflog expire` are
denied. Nothing commits or pushes on its own.

## Known limits

- `opencode --pure` disables external plugins, which removes Fable entirely.
- Verified against OpenCode 1.18.4 with `@opencode-ai/plugin` 1.14.48. The
  plugin API is still evolving, so pin both the plugin version and a known
  OpenCode version for reproducible behaviour.
- Headless: use `opencode run --command fable-method "<args>"`. Passing
  `"/fable-method ..."` as a plain message expands the template but runs it on
  the default agent instead of `fable`.

## Credits

The Fable Method comes from
[Sahir619/fable-method](https://github.com/Sahir619/fable-method), MIT
licensed, Copyright (c) 2026 Sahir619. `skills/`, `prompts/`, `instructions/`
and `eval/` are vendored from it at commit `88b5cf3` (v1.4.0, 2026-07-15);
this repository adds the OpenCode plugin that delivers them. See `LICENSE`.

`docs/agentic-installer.md` is the file-copying installer specification this
plugin replaces, kept as the record of why it exists.

## Evidence

`eval/` is the upstream measurement program, vendored so its claims are
checkable from an install rather than taken on trust. `eval/RESULTS.md` is the
round-by-round log, `eval/scenarios/` the 14 trap fixtures, and
`eval/workflow.js` the harness `/fable-judge suite` runs.

Read it before believing anything about what this method does, including the
parts that say it does nothing. The log publishes its nulls: the loop added no
measurable lift on small fixtures where a capable model already scored full
marks (rounds 6 and 7), two proposed features were cut for failing every test
(skill-in-skill discovery, 1 of 14; a scaffolding-strip clause, 0 of 3), and
step-header leakage is recorded as still open.

What it does measure is concentrated at the weak tier, on specific traps:
a spec-versus-test conflict surfaced 0 of 4 times bare and 4 of 4 with the
intent gate; a five-site twin bug fixed 1 of 5 bare and 5 of 5 with the twin
check; planted frauds caught 3.5 of 5 bare and 5 of 5 with the judge. The
upstream summary is that the lift is inversely proportional to model tier.

Its own standing limitation applies to every number above: small n, LLM
judges, synthetic fixtures.

### This fork's own rounds

`eval/RESULTS-opencode-plugin.md` logs what this repository measured about the
changes it made to the method, kept separate from upstream's log so the two
provenances never blur. `eval/scenarios-plugin/` holds the two fixtures written
here; `eval/run-*.sh` are the runners. Executor was MiniMax-M3, not upstream's
Haiku, so none of these numbers is comparable to `RESULTS.md`.

Seven rounds, and the honest summary is that the method carries the result, this
fork's added rules do not measurably improve it, and this fork's *delivery* was
where the real defects were:

| round | fixture | result |
|---|---|---|
| P1 | `s2` | no regression; `BASELINE:` fired 1 of 2 |
| P2 | `s5` | 2 of 2 ideal, both twins fixed; `BASELINE:` 2 of 2 |
| P3 | `p1` | 2 of 2 ideal - and the hypothesis behind the round lost |
| P4 | `p1`, control arm | method 2, 2 against control **0, 0** |
| P5 | `p2` | method 2, 2 against control **2, 2** - a null |
| P6 | `s7` | `/fable-judge` **deadlocked as shipped**; 2 of 2 REFUTED after a one-line fix |
| P7 | `s5` | `/fable-plan` **edited files**; 2 of 2 clean after dropping `subtask` |

P4 is the one real gap, and P5 explains it: `p1` carries upstream's
spec-versus-test trap, and removing that trap closes the gap entirely. The lift
belongs to the intent gate, which upstream measured years of rounds ago. The
`BASELINE:` line this fork added fires reliably where it is owed and makes an
agent's "that failure was already there" claim checkable rather than asserted,
but it did not change a single score.

Two rounds also went against the person running them, which is the only reason
to trust the rest: P3 was built to justify widening a trigger and instead showed
the trigger was already right, and P5 shows this fork's rules earning nothing on
the fixture built to isolate them.
