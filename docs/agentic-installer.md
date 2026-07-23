# Agentic Fable Method Installer for OpenCode

Install, verify, uninstall, or roll back Fable Method for OpenCode as a project-local setup in the current Git repository.

Permission profile: `critical-only-compromise-v1`. Routine reading, inspection, editing, testing, building, and local commits should not require repeated approval. Approval or denial is reserved for self-modifying configuration, external paths, remote writes, destructive Git operations, privilege escalation, publishing, deployment, and comparable high-impact actions.

## Operating Modes

The user may request one of these modes:

* `inspect` - inspect the repository and propose changes; do not modify files
* `install` - install or safely merge the required files
* `verify` - verify an existing installation; do not modify files
* `uninstall` - remove only content installed by this workflow
* `rollback` - restore files from backups created by a selected installation run

If no mode is specified, begin with `inspect`.

## Interaction Protocol

Work one step at a time.

* Run or provide only the command needed for the current step.
* Wait for and inspect the result before proceeding.
* Do not explain several future steps in advance.
* Keep responses concise.
* Combine commands into a one-shot only when it is safe.
* Every one-shot must stop immediately on error.
* Do not create a commit or push as an incidental part of `inspect`, `install`, `verify`, `uninstall`, or `rollback`. A local commit may be created only when the user’s task explicitly includes committing and the verification and complete-diff gates have passed. Every push requires approval at execution time.
* Do not continue after an unexpected working-tree change.
* Stop and report when a safe merge cannot be determined.

For shell one-shots:

```bash
set -euo pipefail
```

Temporary directories must:

* be created during the same command
* use `mktemp -d`
* be removed by a scoped `trap`
* never point to a directory that existed before the command

Example:

```bash
set -euo pipefail

tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf -- "$tmpdir"
}
trap cleanup EXIT
```

Using `rm -rf` is allowed only for a temporary directory created by the same command.

## Hard Safety Rules

Never:

* overwrite an existing file before reading it
* replace `AGENTS.md` as a whole
* replace `opencode.json` as a whole
* overwrite `.opencode/agents/*`
* overwrite `.opencode/commands/*`
* overwrite `.opencode/skills/*`
* delete pre-existing files or directories
* use `rm -rf` on a pre-existing directory
* modify Claude project memory
* install anything into `~/.claude/skills/`
* import `.claude-plugin/`
* import `marketplace.json`
* create a local commit before focused verification passes and the complete diff has been reviewed
* push without explicit approval at execution time
* force-push, delete remote refs, publish, deploy, merge outward-facing changes, release, or create other outward-facing artifacts

Before modifying any existing file:

1. Read the complete relevant content.
2. Determine the smallest safe change.
3. Create a timestamped backup that does not overwrite an older backup.
4. Apply only the required change.
5. Validate the result.
6. Show the relevant diff.

Backup format:

```text
<file>.bak-YYYYMMDD-HHMMSS
```

## Source of Truth

Use the current Fable Method repository:

```text
https://github.com/Sahir619/fable-method
```

Use the current official OpenCode documentation when configuration syntax, permission behavior, command syntax, frontmatter, agent definitions, or skill discovery may have changed:

```text
https://opencode.ai/docs/permissions/
https://opencode.ai/docs/agents/
https://opencode.ai/docs/commands/
```

Do not rely on remembered OpenCode syntax when current documentation can be checked.

Prefer a tagged release or explicit commit when available. Record the resolved source commit in the installation manifest.

## Target State

The project must contain:

### Project files

```text
AGENTS.md
opencode.json
```

### Agents

```text
.opencode/agents/fable.md
.opencode/agents/fable-evidence.md
.opencode/agents/fable-judge.md
```

### Commands

```text
.opencode/commands/fable.md
.opencode/commands/fable-method.md
.opencode/commands/fable-loop.md
.opencode/commands/fable-plan.md
.opencode/commands/fable-judge.md
.opencode/commands/fable-domain.md
```

### Skills

```text
.opencode/skills/fable-method/
.opencode/skills/fable-loop/
.opencode/skills/fable-judge/
.opencode/skills/fable-domain/
```

The complete upstream contents of:

```text
fable-method/references/
```

must be preserved inside the project-local `fable-method` skill.

Do not import Claude-specific packaging:

```text
.claude-plugin/
marketplace.json
installers that write to ~/.claude/skills/
```

## Required Agent Roles

### `fable`

* Primary implementation agent
* May edit project files
* Delegates investigation when useful
* Uses the loaded Fable skill as the workflow source of truth
* Must not duplicate the complete Fable workflow in the agent prompt
* Must respect scope and evidence requirements
* Must run focused verification and review the complete diff before creating a local commit
* May create a local commit without an additional OpenCode approval prompt only when the user’s requested task includes committing and the commit gates have passed
* Ordinary `git push` requires approval at execution time
* Force-push, remote-ref deletion, publish, deploy, outward-facing merge, release, and destructive actions are denied

### `fable-evidence`

* Subagent
* Read-only
* `edit: deny`
* Investigates relevant project facts
* Does not modify files
* Reports:

```text
Relevant facts
Execution path
Conflicting evidence
Likely source of truth
Unknowns
Suggested next inspection
```

### `fable-judge`

* Subagent
* Read-only
* `edit: deny`
* Uses the `fable-judge` skill as its source of truth
* Reviews diffs, claims, tests, scope, and evidence
* Does not repair defects
* May run explicitly allowed verification commands
* Unknown commands require permission
* Push, publish, deploy, merge, release, and destructive commands are denied

## Required Commands

### `/fable`

* agent: `fable`
* loads `fable-loop`
* forwards `$ARGUMENTS`

### `/fable-loop`

* agent: `fable`
* loads `fable-loop`
* forwards `$ARGUMENTS`

### `/fable-method`

* agent: `fable`
* loads `fable-method`
* forwards `$ARGUMENTS`

### `/fable-plan`

* agent: `plan`
* `subtask: true`
* loads `fable-method`
* plan-only
* must not edit files
* must stop after producing an evidence-backed plan

### `/fable-judge`

* agent: `fable-judge`
* `subtask: true`
* loads `fable-judge`
* reviews current work
* must not edit files

### `/fable-domain`

* agent: `fable`
* loads `fable-domain`
* forwards `$ARGUMENTS`

Do not assume a skill `trigger:` field creates an OpenCode slash command.

## Phase 1: Repository Inspection

Before creating or modifying anything:

1. Confirm the current directory is the root of a Git repository.
2. Record `git status`.
3. Inventory `.opencode`, excluding `node_modules`.
4. Read `AGENTS.md` if present.
5. Read `opencode.json` if present.
6. Inspect existing target agents, commands, and skills.
7. Record whether the working tree already contains changes.
8. Do not attribute pre-existing changes to this installation.

Use an inventory command equivalent to:

```bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
test "$PWD" = "$root"

printf '%s\n' '=== GIT STATUS ==='
git status --short

printf '%s\n' '=== .OPENCODE FILES ==='
find .opencode \
  -path '*/node_modules' -prune -o \
  -type f -print 2>/dev/null | sort

printf '%s\n' '=== AGENTS.md ==='
if [ -f AGENTS.md ]; then
  cat AGENTS.md
else
  echo 'NOT FOUND'
fi

printf '%s\n' '=== opencode.json ==='
if [ -f opencode.json ]; then
  cat opencode.json
else
  echo 'NOT FOUND'
fi
```

Stop if the current directory is not the Git root.

## Phase 2: Installation Plan

Based on the inspection, classify every target as:

* `CREATE`
* `MERGE`
* `SKIP IDENTICAL`
* `CONFLICT`
* `VERIFY ONLY`

Do not modify files during this phase.

For every existing target file:

* read the file
* compare it with the required behavior
* preserve unrelated project rules
* identify exact changes
* flag semantic conflicts for user review

Stop before installation if:

* an existing file cannot be safely merged
* project rules conflict with required safety permissions
* OpenCode syntax cannot be verified
* the working tree changes unexpectedly during inspection

## Phase 3: Fetch Upstream Skills

Clone Fable Method into a temporary directory.

Before copying:

* inspect the upstream directory structure
* verify that all four required skills exist
* verify that `fable-method/references/` exists
* record the resolved source commit
* inspect each `SKILL.md`

Copy only skills whose destination does not exist.

For an existing skill:

* do not overwrite it
* produce a recursive diff
* classify it as identical, compatible, or conflicting
* require an explicit merge decision when different

Safe pattern:

```bash
set -euo pipefail

tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf -- "$tmpdir"
}
trap cleanup EXIT

git clone --depth 1 \
  https://github.com/Sahir619/fable-method.git \
  "$tmpdir/fable-method"

git -C "$tmpdir/fable-method" rev-parse HEAD

for skill in fable-method fable-loop fable-judge fable-domain; do
  src="$tmpdir/fable-method/skills/$skill"
  dst=".opencode/skills/$skill"

  test -d "$src"
  test -f "$src/SKILL.md"

  if [ -e "$dst" ]; then
    echo "EXISTING: $dst"
    diff -ru -- "$dst" "$src" || true
  else
    mkdir -p .opencode/skills
    cp -R -- "$src" "$dst"
    echo "INSTALLED: $dst"
  fi
done
```

The actual copy step must run only after inspection confirms that it is safe.

## Phase 4: Skill Validation

For every installed skill:

1. Read `SKILL.md`.
2. Confirm `name:` exactly matches the directory name.
3. Inspect frontmatter for unsupported or Claude-specific fields.
4. Inspect all repository-relative paths.
5. Search for:

   * `~/.claude/skills`
   * `.claude-plugin`
   * `marketplace.json`
   * plugin-relative paths
   * missing upstream supporting files
6. Change only paths required for project-local OpenCode operation.
7. Do not alter Fable Method semantics unnecessarily.

If a Claude-specific `trigger:` exists:

* do not assume it creates a slash command
* propose removing it only if it is invalid or misleading in OpenCode
* back up the file before changing it
* make the smallest possible edit

Do not perform broad replacements across all skills.

## Phase 5: Project Configuration

Use the critical-only compromise profile below.

OpenCode permission objects are order-sensitive: when more than one pattern matches, the last matching rule wins. Put catch-all rules first and specific safeguards after them.

The required project-level configuration is:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": ["AGENTS.md"],
  "permission": {
    "*": "allow",
    "read": {
      "*": "allow",
      "*.env": "deny",
      "*.env.*": "deny",
      "*.env.example": "allow"
    },
    "edit": {
      "*": "allow",
      ".git/**": "deny",
      "AGENTS.md": "ask",
      "opencode.json": "ask",
      ".opencode/**": "ask",
      "*.env": "deny",
      "*.env.*": "deny",
      "*.env.example": "allow"
    },
    "external_directory": "ask",
    "doom_loop": "ask",
    "bash": {
      "*": "allow",

      "git commit*": "allow",
      "git push*": "ask",
      "git push --force*": "deny",
      "git push * --force*": "deny",
      "git push -f*": "deny",
      "git push * -f*": "deny",
      "git push --mirror*": "deny",
      "git push * --mirror*": "deny",
      "git push *--delete*": "deny",

      "git reset*": "ask",
      "git reset --hard*": "deny",
      "git reset * --hard*": "deny",
      "git clean*": "deny",
      "git restore*": "ask",
      "git checkout -- *": "ask",
      "git branch -D*": "deny",
      "git reflog expire*": "deny",
      "git rebase*": "ask",
      "git merge*": "ask",
      "git cherry-pick*": "ask",

      "rm -r *": "ask",
      "rm -R *": "ask",
      "rm -rf *": "deny",
      "rm -fr *": "deny",
      "find *-delete*": "deny",

      "sudo *": "deny",
      "doas *": "deny",
      "dd *": "deny",
      "mkfs*": "deny",
      "shutdown*": "deny",
      "reboot*": "deny",

      "npm publish*": "deny",
      "npm unpublish*": "deny",
      "pnpm publish*": "deny",
      "yarn npm publish*": "deny",
      "cargo publish*": "deny",
      "twine upload*": "deny",
      "docker push*": "ask",

      "gh pr create*": "deny",
      "gh pr merge*": "deny",
      "gh release create*": "deny",
      "gh repo delete*": "deny",

      "terraform apply*": "ask",
      "terraform destroy*": "deny",
      "kubectl apply*": "ask",
      "kubectl delete*": "deny",
      "helm upgrade*": "ask"
    }
  }
}
```

Profile intent:

* ordinary reads, searches, builds, tests, package installation, file edits, and local commits are allowed without repeated approval
* `.env`-style secrets remain unreadable and uneditable, except `.env.example`
* editing Git internals is denied
* editing the project’s instructions or OpenCode configuration requires approval because those files can change the safety boundary
* paths outside the project and repeated identical tool calls require approval
* ordinary pushes require approval; force-push and remote-ref deletion are denied
* destructive local Git operations, recursive deletion, privilege escalation, publishing, release, and destructive deployment operations are denied or require approval as listed

When `opencode.json` already exists:

* parse it as JSON
* preserve every unrelated key and value
* merge only the required paths
* create a backup before writing
* write atomically
* validate after writing
* preserve unrelated stricter rules, but do not silently retain a broad `permission."*": "ask"` or `permission.bash."*": "ask"`; either would defeat this profile and recreate approval spam
* ensure `permission."*"` is `allow`
* ensure `permission.bash."*"` is `allow`
* ensure `git commit*` is `allow`
* ensure `git push*` is `ask`
* ensure the force-push, hard-reset, clean, recursive-delete, privilege-escalation, publish, release, and destructive deployment rules remain after the broad allow rules
* preserve the last-match ordering shown above

Do not use `sed` or regex as the primary JSON merge mechanism.

Use Python or another real JSON parser.

Validate with:

```bash
python3 -m json.tool opencode.json >/dev/null
```

Branch protection is defense in depth for the origin; it does not protect local uncommitted work, local branches, unprotected remote refs, credentials, or users and apps with bypass rights. Record the assumed protected branches and whether bypass rights were verified in the manifest.

Bash pattern permissions are a command gate, not a complete operating-system sandbox. Scripts and interpreters can hide side effects from simple command patterns. Run OpenCode without `sudo`, production credentials, or broad cloud credentials when possible, and prefer a development container or VM for higher-risk repositories.

## Phase 6: `AGENTS.md`

Do not replace an existing `AGENTS.md`.

Read existing project facts and policies first.

Add a concise Fable section only when no equivalent section exists.

Use stable markers:

```markdown
<!-- fable-method:begin -->
...
<!-- fable-method:end -->
```

The block should contain only:

* concise project facts relevant to Fable
* Fable invariants
* role boundaries
* verification expectations
* commit and push policy

Do not duplicate the complete skill workflow.

Do not add the block more than once.

Resolve commit-policy conflicts so that the effective policy is:

* local commits are allowed without an additional permission prompt only when the user’s task includes committing
* focused verification must pass first
* the complete diff must be reviewed first
* ordinary push requires explicit authorization at execution time
* force-push, remote-ref deletion, publishing, deployment, outward-facing merge, and release are denied by permissions

Back up `AGENTS.md` before modifying it.

## Phase 7: Agent Files

Create missing agent files from validated templates.

When a target file exists:

* read it
* compare permissions and semantics
* preserve unrelated rules
* merge only the required fields
* back up before modifying
* never replace the complete file automatically

Agent-specific permission configuration can override project-level permissions. Do not verify only `opencode.json`.

### Required `fable.md` behavior

The agent definition must:

* identify `fable` as the primary implementation agent
* keep only role, delegation, scope discipline, and permissions
* state that the loaded Fable skill is the source of truth
* allow normal project editing without approval spam
* preserve the project’s self-protection rules for `.git/**`, `AGENTS.md`, `opencode.json`, `.opencode/**`, and `.env` files
* allow ordinary inspection, tests, builds, and local commits
* require approval for an ordinary push
* deny force-push, remote-ref deletion, hard reset, clean, recursive deletion, privilege escalation, publishing, release, and destructive deployment actions
* run focused verification and inspect the complete diff before committing
* create a local commit only when the user’s task includes committing

Do not set a broad agent-level `edit: allow` or `bash: allow` if that would replace the project’s granular safeguards. Either omit a permission key so it inherits the project configuration, or reproduce the complete corresponding granular map.

Required effective values in both project and `fable` agent permissions:

```text
permission.*: allow
permission.bash.*: allow
"git commit*": allow
"git push*": ask
force-push patterns: deny
"git reset --hard*": deny
"git clean*": deny
"rm -rf *": deny
publish/release/destructive deployment patterns: deny
```

The agent-level values and ordering must agree with the project-level profile.

### Required `fable-evidence.md` behavior

Must include:

```text
mode: subagent
edit: deny
```

It must be read-only and use the required evidence report format.

Because `edit: deny` does not make arbitrary shell commands read-only, configure `bash` separately:

* put `"*": deny` first
* allow common inspection commands such as `git status`, `git diff`, `git log`, `git show`, `git grep`, `ls`, `find`, `grep`, `rg`, `cat`, `sed -n`, `head`, `tail`, `wc`, `file`, and `stat`
* put `find *-delete*`, destructive Git, recursive deletion, push, publish, deploy, merge, and release denies after the inspection allows
* do not allow arbitrary interpreters or shell scripts

### Required `fable-judge.md` behavior

Must include:

```text
mode: subagent
edit: deny
```

It must:

* load or defer to the `fable-judge` skill
* inspect work without repairing it
* allow common read-only inspection commands without prompting
* allow only project-appropriate verification commands such as focused tests, linters, type checks, and builds
* ask for unknown commands
* deny force-push, remote writes, destructive Git, recursive deletion, privilege escalation, publishing, deployment, outward-facing merge, and release

Every allowed verification command must be reviewed for side effects. Prefer commands documented by the current project rather than generic package-manager commands.

## Phase 8: Command Files

Create all six command files.

When a command file exists:

* read it
* inspect its agent and skill wiring
* preserve unrelated valid behavior
* do not overwrite it
* back up before a required modification

Every command must explicitly load the intended skill.

Do not rely on skill frontmatter triggers.

## Phase 9: Installation Manifest

Create a project-local manifest:

```text
.opencode/fable-install-manifest.json
```

The manifest must support safe verification and uninstall.

Record:

* manifest schema version
* installer instruction version
* installation timestamp
* source repository
* resolved source commit
* installation mode
* baseline Git status
* files created
* files modified
* files skipped
* files that existed before installation
* backup paths
* pre-change checksums
* post-change checksums
* inserted `AGENTS.md` marker identifiers
* JSON paths added or changed
* original JSON values when replaced
* unresolved conflicts
* retained Claude-specific references
* retained repository-relative references
* verification results
* permission profile identifier
* assumed protected origin branches
* whether branch-protection and bypass rights were verified or merely assumed

Do not include secrets or unrelated file contents in the manifest.

If a manifest already exists:

* read it
* do not overwrite it
* create a new run entry or a uniquely named manifest
* preserve previous installation history

## Phase 10: Permission Verification

Verify both project-level and agent-level permissions and their rule ordering.

Run:

```bash
grep -n '"\*"\|"git commit\*"\|"git push\*"\|"git reset --hard\*"\|"git clean\*"\|"rm -rf \*"' \
  opencode.json .opencode/agents/fable.md
```

Required effective values in both locations:

```text
permission.*: allow
permission.bash.*: allow
git commit*: allow
git push*: ask
force-push patterns: deny
git reset --hard*: deny
git clean*: deny
rm -rf *: deny
```

The broad allow rules must occur before the specific ask and deny rules.

Also run a structured project check and an agent-frontmatter check equivalent to:

```bash
python3 - <<'PY'
import json
import re
from pathlib import Path

project = json.loads(Path("opencode.json").read_text())
permission = project["permission"]
bash = permission["bash"]
read = permission["read"]
edit = permission["edit"]

assert permission["*"] == "allow", permission["*"]
assert permission["external_directory"] == "ask"
assert permission["doom_loop"] == "ask"

assert read["*"] == "allow"
assert read["*.env"] == "deny"
assert read["*.env.*"] == "deny"
assert read["*.env.example"] == "allow"

assert edit["*"] == "allow"
assert edit[".git/**"] == "deny"
assert edit["AGENTS.md"] == "ask"
assert edit["opencode.json"] == "ask"
assert edit[".opencode/**"] == "ask"

assert bash["*"] == "allow", bash["*"]
assert bash["git commit*"] == "allow", bash["git commit*"]
assert bash["git push*"] == "ask", bash["git push*"]
assert bash["git push --force*"] == "deny"
assert bash["git reset --hard*"] == "deny"
assert bash["git clean*"] == "deny"
assert bash["rm -rf *"] == "deny"
assert bash["sudo *"] == "deny"
assert bash["npm publish*"] == "deny"
assert bash["gh release create*"] == "deny"
assert bash["terraform destroy*"] == "deny"
assert bash["kubectl delete*"] == "deny"

keys = list(bash)
assert keys.index("*") < keys.index("git commit*")
assert keys.index("git push*") < keys.index("git push --force*")
assert keys.index("git reset*") < keys.index("git reset --hard*")
assert keys.index("rm -r *") < keys.index("rm -rf *")

agent = Path(".opencode/agents/fable.md").read_text()
required = {
    r'^\s*"\*":\s*allow\s*$': 'agent bash catch-all allow',
    r'^\s*"git commit\*":\s*allow\s*$': 'agent commit allow',
    r'^\s*"git push\*":\s*ask\s*$': 'agent push ask',
    r'^\s*"git push --force\*":\s*deny\s*$': 'agent force-push deny',
    r'^\s*"git reset --hard\*":\s*deny\s*$': 'agent hard-reset deny',
    r'^\s*"git clean\*":\s*deny\s*$': 'agent clean deny',
    r'^\s*"rm -rf \*":\s*deny\s*$': 'agent recursive-delete deny',
}
for pattern, label in required.items():
    assert re.search(pattern, agent, re.MULTILINE), label

print("permission verification: PASS")
PY
```

If `fable.md` intentionally inherits a permission key instead of repeating it, adapt the agent check to prove inheritance from the effective OpenCode configuration. Do not accept a broad agent override that weakens or discards the granular project safeguards.

## Phase 11: Read-Only Command Tests

Before every test:

```bash
git status --short
```

Save the status as the baseline for that test.

After every test:

```bash
git status --short
```

Compare the result exactly.

If the working tree changes:

* stop
* report the changed paths
* do not assume the tested agent caused the change when other processes may be active
* do not continue until the cause is understood

Run these tests one at a time.

### Fable Method

```text
/fable-method Inspect go.mod and report the Go version. Do not modify files.
```

Expected:

* `fable-method` skill loads
* no files change

### Fable Loop

```text
/fable-loop Inspect go.mod and report the Go version. Do not modify files.
```

Expected:

* `fable-loop` skill loads
* no files change

### Fable Plan

```text
/fable-plan Produce a plan for inspecting the targets in Makefile. Do not modify files.
```

Expected:

* `fable-method` loads
* execution stops after the plan
* no files change

### Fable Judge

```text
/fable-judge Verify whether the Go version claim matches go.mod. Do not modify files.
```

Expected:

* `fable-judge` skill loads
* the judge does not edit files

### Fable Domain Loading

```text
/fable-domain Verify that this command can load the skill. Do not create an adapter.
```

Expected:

* `fable-domain` skill loads
* no adapter is created
* no files change

Passing this test verifies only command and skill loading.

It does not verify complete domain bundle generation.

## Phase 12: Optional Full `fable-domain` Test

Do not run this test inside the real project tree.

Create a temporary fixture that contains only the minimum required project structure.

The temporary test must:

* use a directory created by the same command
* use `trap` for cleanup
* never write into the actual project
* never delete a pre-existing directory
* record all generated files before cleanup

Verify that the generated bundle includes:

* workflow
* flowchart
* domain adapter
* trap fixture
* smoke evaluation
* no references to missing supporting files
* no invalid repository-relative paths

Inspect whether the skill depends on upstream files such as:

```text
eval/
README files
CHANGELOG
trap fixtures
smoke-eval runners
other repository-relative assets
```

Do not mark full domain generation as verified unless the complete fixture test passes.

When only loading has been tested, report exactly:

```text
fable-domain command and skill loading are verified; full bundle generation remains unverified.
```

## Phase 13: Final Verification

Run all applicable checks.

### Validate JSON

```bash
python3 -m json.tool opencode.json >/dev/null
```

### List installed files

```bash
find .opencode/agents .opencode/commands .opencode/skills \
  -path '*/node_modules' -prune -o \
  -type f -print | sort
```

### Verify skill names

```bash
set -euo pipefail

for f in .opencode/skills/*/SKILL.md; do
  dir="$(basename "$(dirname "$f")")"
  name="$(sed -n 's/^name:[[:space:]]*//p' "$f" | head -n1)"
  printf '%-20s %s\n' "$dir" "$name"
  test "$dir" = "$name"
done
```

Use a proper YAML parser instead if the current skill format requires it.

### Verify command-to-skill wiring

```bash
grep -RIn 'Load the `fable-' .opencode/commands
```

Adapt the search expression to the actual validated command syntax.

### Verify project permissions

```bash
grep -n '"\*"\|"git commit\*"\|"git push\*"\|"git reset --hard\*"\|"git clean\*"\|"rm -rf \*"' opencode.json
```

Expected effective values:

```text
permission.*: allow
permission.bash.*: allow
"git commit*": "allow"
"git push*": "ask"
force-push patterns: "deny"
"git reset --hard*": "deny"
"git clean*": "deny"
"rm -rf *": "deny"
```

### Verify agent modes and edit permissions

```bash
grep -RIn '^mode:\|^[[:space:]]*edit:' .opencode/agents
```

### Verify agent override permissions

```bash
grep -n '"\*"\|"git commit\*"\|"git push\*"\|"git reset --hard\*"\|"git clean\*"\|"rm -rf \*"' \
  opencode.json .opencode/agents/fable.md
```

### Inspect Claude-specific references

```bash
grep -RInE '~/.claude/skills|\.claude-plugin|marketplace\.json' \
  .opencode/skills .opencode/agents .opencode/commands || true
```

Review each match individually.

Do not perform a global replacement.

### Inspect repository-relative references

Search for paths that may depend on files outside the copied skills.

For every match:

* verify that the target exists
* classify it as valid, intentionally retained, or unresolved
* list unresolved references in the report

### Inspect Git changes

```bash
git status --short
git diff -- AGENTS.md opencode.json .opencode
```

Show the complete relevant diff to the user.

Do not create an installation commit unless the user explicitly requested it. When requested, create it only after all applicable verification passes and the user has been shown the complete relevant diff. Never push without a separate approval prompt.

## Permission Profile Residual Risks

The compromise profile intentionally favors autonomy over exhaustive prompting. Final reporting must state that:

* branch protection applies only to covered remote refs and only to identities without effective bypass
* local uncommitted work can still be damaged by commands not recognized by the pattern list
* an allowed interpreter or project script can perform side effects that are not obvious from its outer command
* credentials available to the OpenCode process remain usable by allowed commands
* the safest compensating controls are least-privilege credentials, no passwordless privilege escalation, protected default and release branches, restricted bypass rights, and an isolated development environment

## Success Criteria

Core installation succeeds only when:

* all four skills exist
* the complete `fable-method/references/` directory exists
* all six commands exist
* all three agents exist
* OpenCode loads the expected skills during command tests
* `fable-evidence` cannot edit files
* `fable-judge` cannot edit files
* project-level catch-all and bash catch-all are `allow`
* project-level `git commit*` is `allow`
* project-level `git push*` is `ask`
* project-level critical destructive and outward-facing patterns are `deny`
* agent-level catch-all and bash catch-all are `allow` without discarding granular safeguards
* agent-level `git commit*` is `allow`
* agent-level `git push*` is `ask`
* agent-level critical destructive and outward-facing patterns are `deny`
* `opencode.json` is valid
* no existing data was deleted
* no existing data was overwritten without a backup
* the final Git diff is shown for review

Do not claim that the full installation is completely verified when only the `fable-domain` load test has passed.

## Required Final Status

Report each item separately:

```text
Fable Method: VERIFIED | UNVERIFIED
Fable Loop: VERIFIED | UNVERIFIED
Fable Plan: VERIFIED | UNVERIFIED
Fable Judge: VERIFIED | UNVERIFIED
Fable Domain loading: VERIFIED | UNVERIFIED
Fable Domain full generation: VERIFIED | UNVERIFIED | NOT TESTED
Project permission profile: VERIFIED | UNVERIFIED
Agent permission override: VERIFIED | UNVERIFIED
Origin branch protection: VERIFIED | ASSUMED | UNVERIFIED
Existing data preservation: VERIFIED | UNVERIFIED
```

Also report:

```text
Installed
Modified
Preserved existing data
Backups created
Skipped existing files
Conflicts
Commands tested
Verification results
Remaining Claude-specific references
Remaining repository-relative references
Residual risks
Assumed protected branches and bypass status
Source commit
Manifest path
```

Never use wording equivalent to “fully installed and completely verified” unless full `fable-domain` generation has also passed.

## Uninstall Mode

Uninstall must be manifest-driven and conservative.

Before changing anything:

1. Read the installation manifest.
2. Confirm that every target belongs to the selected installation run.
3. Compare current checksums with post-install checksums.
4. Record current Git status.
5. Create new backups of every file that will be modified.
6. Produce an uninstall plan.
7. Stop on any ambiguity.

### Files created by the installer

A created file may be removed only when:

* the manifest identifies it as installer-created
* its current checksum matches the recorded post-install checksum
* it contains no unrecorded user changes
* no other installation run claims ownership

If the checksum differs:

* do not delete it
* report it as user-modified
* require manual review

A directory may be removed only when:

* the installer created the directory
* every remaining item inside it is owned by the same installation run
* no untracked or user-created content remains

Do not use `rm -rf` for uninstalling project directories.

Remove eligible files individually, then remove empty directories with `rmdir`.

### Modified files

For `AGENTS.md`:

* remove only the exact marked Fable block
* leave all other content unchanged
* stop if markers are missing, duplicated, malformed, or edited ambiguously

For `opencode.json`:

* parse JSON
* revert only paths recorded in the manifest
* restore original values when recorded
* remove a key only when the installer added it and no later installation depends on it
* preserve unrelated configuration
* validate JSON after writing

For existing agents or commands that were merged:

* revert only changes proven by the manifest
* use the pre-install backup when a safe field-level revert is impossible
* do not restore a whole backup over later user changes without explicit approval

### Uninstall Verification

After uninstall:

* validate `opencode.json` if it remains
* verify that unrelated `.opencode` content remains
* verify that user-modified files were preserved
* show `git status --short`
* show the complete uninstall diff
* report files intentionally left because they changed after installation

Do not commit or push as part of uninstall unless the user explicitly requests the Git action after reviewing the complete uninstall diff. Every push still requires approval at execution time.

## Rollback Mode

Rollback restores a specific installation run to its pre-install state.

Require:

* a selected manifest run
* all referenced backups
* checksum comparison
* explicit confirmation before replacing any currently modified file

Never overwrite post-install user changes automatically.

When a file differs from the installation’s recorded post-change checksum:

* preserve the current file
* create another backup
* report the conflict
* require manual resolution

Rollback must not affect files unrelated to the selected run.

## Error Reporting

On failure, report:

```text
Phase
Command or operation
Observed result
Expected result
Files changed before failure
Backups created
Safe recovery action
Unresolved risk
```

Do not hide partial changes.

Do not continue after a failed validation unless the next action is an explicit safe rollback or diagnostic inspection.
