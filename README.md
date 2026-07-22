# opencode-fable-method

The Fable Method for [OpenCode](https://opencode.ai), delivered as a plugin.

Three agents, seven commands, four skills and a permission profile — installed
by adding one line to `opencode.json`. **No files are copied into your
repository**, and the plugin writes nothing at startup.

(OpenCode's own plugin loader does create a dependency cache at
`.opencode/node_modules/` alongside a `.opencode/.gitignore` that excludes it,
so `git status` stays clean. That is OpenCode, not this plugin.)

## Install

```bash
opencode plugin opencode-fable-method
```

or add it yourself, pinned:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-fable-method@0.1.0"]
}
```

Restart OpenCode — config is loaded once at startup and is not hot-reloaded.

## Uninstall

Delete the entry from `plugin`. That is the whole procedure: the agents,
commands, skills, instructions and permission rules disappear with it, and
your working tree is untouched because nothing was ever written to it.

## What you get

| | |
|---|---|
| Agents | `fable` (primary), `evidence` (read-only), `fable-judge` (read-only) |
| Commands | `/fable`, `/fable-loop`, `/fable-method`, `/fable-plan`, `/fable-judge`, `/fable-domain`, `/fable-doctor` |
| Skills | `fable-method`, `fable-loop`, `fable-judge`, `fable-domain` |
| Instructions | Fable invariants, appended to `instructions` — your `AGENTS.md` is never modified |
| Permissions | The `critical-only-compromise-v1` profile (below) |

Run `/fable-doctor` at any time for a read-only report of how Fable is
actually wired into the current project.

## Permission profile

Ordinary reads, searches, edits, builds, tests and local commits run without
approval prompts. What is gated:

| | |
|---|---|
| `ask` | `git push`, `git reset`, `git rebase`, `git merge`, `rm -r`, `docker push`, `terraform apply`, `kubectl apply`, paths outside the project, repeated identical calls, edits to `AGENTS.md` / `opencode.json` / `.opencode/**` |
| `deny` | force-push, remote-ref deletion, `git reset --hard`, `git clean`, `rm -rf`, `sudo`, publish, `gh pr create` / `gh pr merge` / `gh release create`, `terraform destroy`, `kubectl delete`, reading or editing `.env` files |

OpenCode permission maps are **last-match-wins over key order**, so the rules
are built as an ordered list: broad allows first, specific safeguards after.

### Overriding

Anything your project defines wins. This plugin only fills gaps — set a rule
in your own `opencode.json` and it takes effect:

```json
{
  "permission": { "bash": { "git commit*": "ask" } }
}
```

For the common case of wanting every commit prompted, pass the profile option
instead:

```json
{
  "plugin": [["opencode-fable-method@0.1.0", { "permissionProfile": "strict" }]]
}
```

## Commit policy

A local commit runs without an extra prompt **only when the task you asked for
includes committing** — a task that did not ask for a commit does not get one,
and focused verification plus a full diff review must come first. Pushing
always asks. Force-push, publish, release and outward-facing merge are denied
outright.

## Design invariants

1. **The plugin never writes files.** It mutates the resolved config in
   memory. Opening OpenCode must leave `git status` unchanged — verified in a
   fresh repository.
2. **The project always wins.** Agents, commands and permission rules already
   defined by the project are left alone.
3. **Pin the version.** Never `@latest` in `plugin`.
4. **git is the backup and rollback mechanism.** This plugin ships no
   manifest, no checksums and no `.bak` files, because it installs nothing.

## Known limits

- `opencode --pure` disables external plugins, which removes Fable entirely.
- Requires OpenCode `>=1.17 <2`. `/fable-doctor` flags a version outside that
  range.

## Credits

The Fable Method skills come from
[Sahir619/fable-method](https://github.com/Sahir619/fable-method).
`docs/agentic-installer.md` is the file-copying installer specification this
plugin replaces, kept as the record of why it exists.
