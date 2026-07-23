"""Repo consistency checks, run by CI and locally: python .github/checks.py"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
failures = []


def fail(msg):
    failures.append(msg)
    print(f"FAIL  {msg}")


def ok(msg):
    print(f"ok    {msg}")


# 1. The package manifest parses and carries what the plugin loader needs.
# Upstream checks .claude-plugin/{plugin,marketplace}.json here; this fork is an
# OpenCode plugin loaded from package.json, so the same intent lands there.
rel = "package.json"
try:
    with io.open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        data = json.load(f)
    missing = [k for k in ["name", "description", "version", "main", "files"] if k not in data]
    entry = os.path.join(ROOT, str(data.get("main", "")))
    if missing:
        fail(f"{rel}: missing fields {missing}")
    elif not os.path.isfile(entry):
        fail(f"{rel}: main points at a missing file ({data['main']})")
    else:
        ok(f"{rel} valid ({data['version']})")
except Exception as e:
    fail(f"{rel}: {e}")


# 3. All four skills exist with frontmatter name + description
for skill in ["fable-method", "fable-loop", "fable-judge", "fable-domain"]:
    path = os.path.join(ROOT, "skills", skill, "SKILL.md")
    try:
        with io.open(path, encoding="utf-8") as f:
            head = f.read(2000)
        if not head.startswith("---") or f"name: {skill}" not in head or "description:" not in head:
            fail(f"skills/{skill}/SKILL.md: frontmatter missing name/description")
        else:
            ok(f"skills/{skill}/SKILL.md frontmatter valid")
    except Exception as e:
        fail(f"skills/{skill}/SKILL.md: {e}")

# 4. Domain adapters all carry a binding minimum evidence set and a fraud table
domains_dir = os.path.join(ROOT, "skills", "fable-method", "references", "domains")
for name in sorted(os.listdir(domains_dir)):
    with io.open(os.path.join(domains_dir, name), encoding="utf-8") as f:
        body = f.read()
    if "Minimum evidence set" not in body or "Fraud table" not in body:
        fail(f"domains/{name}: missing minimum evidence set or fraud table")
    else:
        ok(f"domains/{name} complete")

# 5. Evidence files parse as JSON
results_dir = os.path.join(ROOT, "eval", "results")
for name in sorted(os.listdir(results_dir)):
    try:
        with io.open(os.path.join(results_dir, name), encoding="utf-8") as f:
            json.load(f)
        ok(f"eval/results/{name} parses")
    except Exception as e:
        fail(f"eval/results/{name}: {e}")

# 6. No em or en dashes anywhere (repo style rule)
dash = re.compile(chr(0x2014) + "|" + chr(0x2013))
count = 0
for root, dirs, files in os.walk(ROOT):
    # node_modules is vendored third-party text and .superpowers is session
    # scratch; neither is ours to hold to a house style rule.
    dirs[:] = [d for d in dirs if d not in (".git", "node_modules", ".superpowers")]
    for f in files:
        if not f.endswith((".md", ".js", ".json", ".py", ".sh", ".ps1", ".yml", ".csv")):
            continue
        p = os.path.join(root, f)
        try:
            with io.open(p, encoding="utf-8") as fh:
                if dash.search(fh.read()):
                    fail(f"em/en dash in {os.path.relpath(p, ROOT)}")
                    count += 1
        except Exception:
            pass
if count == 0:
    ok("no em/en dashes anywhere")

# 7. Every scenario directory is non-empty
scen_dir = os.path.join(ROOT, "eval", "scenarios")
for name in sorted(os.listdir(scen_dir)):
    entries = os.listdir(os.path.join(scen_dir, name))
    if not entries:
        fail(f"eval/scenarios/{name} is empty")
    else:
        ok(f"eval/scenarios/{name} ({len(entries)} entries)")

# 8. No subagent resolves to `ask` on any rule.
#
# A subagent has no UI to raise an approval prompt in, so an `ask` there does
# not prompt: the run stops while looking healthy. Round P6 lost three
# /fable-judge runs to exactly that, each ending with a bash tool stuck in
# `running` on the first command not on the inspect allow-list. This is a
# static property of the config, so it is checked here rather than measured.
#
# Resolution is imported from the plugin instead of re-modelled: a check that
# resolves permissions differently from the thing it checks is not a check.
probe = r"""
import { AGENTS, permissionInternals } from './.opencode/plugins/fable.js'
const { projectPermission, effective } = permissionInternals()
const bad = []
const loose = []
for (const profile of [{ commit: 'allow', strict: false }, { commit: 'ask', strict: true }]) {
  const proj = projectPermission(profile)
  for (const [name, agent] of Object.entries(AGENTS())) {
    if (agent.mode !== 'subagent') continue
    for (const [key, pv] of Object.entries(proj)) {
      const av = agent.permission?.[key]
      if (typeof pv === 'string' || typeof av === 'string') {
        if ((typeof av === 'string' ? av : pv) === 'ask') bad.push(`${name}.${key}`)
        continue
      }
      const patterns = new Set([...Object.keys(pv), ...Object.keys(av || {})])
      for (const p of patterns) {
        // Substitute `*` so the probe string matches the rule that produced it.
        const probe = p.replace(/\*/g, 'x')
        const got = effective(probe, pv, av)
        if (got === 'ask') bad.push(`${name}.${key}: ${p}`)
        // The other half. Collapsing a subagent's `ask` to `allow` removes the
        // hang and quietly hands a read-only agent a write command, so a rule
        // the primary agent will not run unprompted must not become `allow`
        // here. `*` is the catch-all itself and is the fallback under test.
        else if (got === 'allow' && p !== '*' && (pv[p] === 'ask' || pv[p] === 'deny')) {
          loose.push(`${name}.${key}: \`${p}\` is ${pv[p]} for the primary agent but allow here`)
        }
      }
    }
  }
}
process.stdout.write([...new Set(bad.map(b => 'ASK ' + b)), ...new Set(loose.map(l => 'LOOSE ' + l))].join('\n'))
"""
try:
    import subprocess
    out = subprocess.run(
        ["node", "--input-type=module", "-e", probe],
        cwd=ROOT, capture_output=True, text=True, timeout=60,
    )
    if out.returncode != 0:
        fail(f"subagent ask probe: {out.stderr.strip().splitlines()[-1] if out.stderr.strip() else 'node failed'}")
    elif out.stdout.strip():
        for line in out.stdout.strip().splitlines():
            kind, rest = line.split(" ", 1)
            if kind == "ASK":
                fail(f"subagent resolves to `ask`, which nothing can answer: {rest}")
            else:
                fail(f"subagent is more permissive than the agent it reviews: {rest}")
    else:
        ok("no subagent resolves to `ask`, and none outranks the primary profile")
except Exception as e:
    fail(f"subagent ask probe: {e}")

# 9. Every named export returns an object.
#
# OpenCode calls EVERY named export of a plugin file as a plugin factory. A
# helper exported for a test therefore runs at startup, and one that returns
# anything the loader cannot treat as a hooks object kills the plugin at
# dispatch with `UnknownError: Unexpected server error` and an empty log. A bare
# `export { effective }` cost 40 minutes of bisection to find exactly that way.
export_probe = r"""
import * as mod from './.opencode/plugins/fable.js'
const bad = []
for (const [name, value] of Object.entries(mod)) {
  if (name === 'default' || typeof value !== 'function') continue
  let out
  try { out = value() } catch { continue }   // needs real args; not a bare helper
  if (out && typeof out.then === 'function') continue   // the plugin factory itself
  if (typeof out !== 'object' || out === null) bad.push(`${name} returns ${typeof out}`)
}
process.stdout.write(bad.join('\n'))
"""
try:
    out = subprocess.run(
        ["node", "--input-type=module", "-e", export_probe],
        cwd=ROOT, capture_output=True, text=True, timeout=60,
    )
    if out.returncode != 0:
        fail(f"export shape probe: {out.stderr.strip().splitlines()[-1] if out.stderr.strip() else 'node failed'}")
    elif out.stdout.strip():
        for line in out.stdout.strip().splitlines():
            fail(f"named export is called by OpenCode at startup and must return an object: {line}")
    else:
        ok("every named export returns an object")
except Exception as e:
    fail(f"export shape probe: {e}")

print()
if failures:
    print(f"{len(failures)} check(s) failed")
    sys.exit(1)
print("all checks passed")
