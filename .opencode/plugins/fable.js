/**
 * Fable Method for OpenCode.
 *
 * Delivers agents, commands, skills, project instructions and a permission
 * profile by mutating the resolved config in memory. It installs nothing into
 * the repository and writes no files at startup - opening OpenCode must leave
 * `git status` unchanged. Removing this plugin from `opencode.json` removes
 * Fable completely.
 *
 * Anything the project already defines wins. This plugin only fills gaps.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SKILLS_DIR = path.join(PKG, 'skills')
// Both forms: OpenCode's own auto-allows are written with a single `*`, and a
// single `*` is not guaranteed to cross directory separators. `references/` sits
// two levels below SKILLS_DIR, so a pattern that does not descend would leave
// the exact reads this exists for still prompting.
const SKILL_PATHS = [`${SKILLS_DIR}/*`, `${SKILLS_DIR}/**`]
const INVARIANTS = path.join(PKG, 'instructions', 'fable-invariants.md')

const prompt = (name) => fs.readFileSync(path.join(PKG, 'prompts', `${name}.md`), 'utf8')

/**
 * OpenCode permission maps are last-match-wins over key order, so these are
 * written as ordered pairs: broad allows first, specific safeguards after.
 * Never build one of these with a bare object spread of unordered sources.
 */
const bashRules = ({ commit, strict }) => [
  ['*', 'allow'],

  ['git commit*', commit],
  ['git push*', 'ask'],
  ['git push --force*', 'deny'],
  ['git push * --force*', 'deny'],
  ['git push -f*', 'deny'],
  ['git push * -f*', 'deny'],
  ['git push --mirror*', 'deny'],
  ['git push * --mirror*', 'deny'],
  ['git push *--delete*', 'deny'],

  ['git reset*', 'ask'],
  ['git reset --hard*', 'deny'],
  ['git reset * --hard*', 'deny'],
  ['git clean*', 'deny'],
  ['git restore*', 'ask'],
  ['git checkout -- *', 'ask'],
  ['git branch -D*', 'deny'],
  ['git reflog expire*', 'deny'],
  ['git rebase*', 'ask'],
  ['git merge*', 'ask'],
  ['git cherry-pick*', 'ask'],

  ['rm -r *', 'ask'],
  ['rm -R *', 'ask'],
  ['rm -rf *', 'deny'],
  ['rm -fr *', 'deny'],
  ['find *-delete*', 'deny'],

  ['sudo *', 'deny'],
  ['doas *', 'deny'],
  ['dd *', 'deny'],
  ['mkfs*', 'deny'],
  ['shutdown*', 'deny'],
  ['reboot*', 'deny'],

  ['npm publish*', 'deny'],
  ['npm unpublish*', 'deny'],
  ['pnpm publish*', 'deny'],
  ['yarn npm publish*', 'deny'],
  ['cargo publish*', 'deny'],
  ['twine upload*', 'deny'],
  ['docker push*', 'ask'],

  // ponytail: PRs are closable; only the strict profile hard-denies them.
  ['gh pr create*', strict ? 'deny' : 'ask'],
  ['gh pr merge*', 'deny'],
  ['gh release create*', 'deny'],
  ['gh repo delete*', 'deny'],

  ['terraform apply*', 'ask'],
  ['terraform destroy*', 'deny'],
  ['kubectl apply*', 'ask'],
  ['kubectl delete*', 'deny'],
  ['helm upgrade*', 'ask'],
]

/**
 * Read-only inspection commands, allowed for subagents that must not act.
 *
 * Keep this list generous. A command that is missing here falls through to the
 * agent's catch-all: `evidence` refuses it, and `fable-judge` asks - and an
 * approval prompt raised inside a subagent has nowhere to go, so the run hangs
 * rather than failing. `git branch` and `git rev-parse` were the first two to
 * prove it. Anything that writes is denied again below, after these allows.
 */
const INSPECT_RULES = [
  ['git status*', 'allow'],
  ['git diff*', 'allow'],
  ['git log*', 'allow'],
  ['git show*', 'allow'],
  ['git grep*', 'allow'],
  ['git blame*', 'allow'],
  ['git branch*', 'allow'],
  ['git rev-parse*', 'allow'],
  ['git rev-list*', 'allow'],
  ['git merge-base*', 'allow'],
  ['git ls-files*', 'allow'],
  ['git ls-tree*', 'allow'],
  ['git cat-file*', 'allow'],
  ['git describe*', 'allow'],
  ['git shortlog*', 'allow'],
  ['git diff-tree*', 'allow'],
  ['git name-rev*', 'allow'],
  ['git config --get*', 'allow'],
  ['git check-ignore*', 'allow'],
  ['ls*', 'allow'],
  ['pwd*', 'allow'],
  ['echo*', 'allow'],
  ['printf*', 'allow'],
  ['basename*', 'allow'],
  ['dirname*', 'allow'],
  ['sort*', 'allow'],
  ['uniq*', 'allow'],
  ['cut*', 'allow'],
  ['tr *', 'allow'],
  ['awk*', 'allow'],
  ['jq*', 'allow'],
  ['diff *', 'allow'],
  ['shasum*', 'allow'],
  ['du *', 'allow'],
  ['which*', 'allow'],
  ['test *', 'allow'],
  ['find *', 'allow'],
  ['grep*', 'allow'],
  ['rg*', 'allow'],
  ['cat*', 'allow'],
  ['sed -n*', 'allow'],
  ['head*', 'allow'],
  ['tail*', 'allow'],
  ['wc*', 'allow'],
  ['file*', 'allow'],
  ['stat*', 'allow'],
]

/**
 * Denies that must sit after the inspection allows to win last-match. The
 * write-side git commands are listed explicitly rather than left to the
 * subagent's `*` catch-all, so a read-only agent stays read-only even if the
 * project profile allows them.
 */
const INSPECT_DENIES = [
  // Shell redirection is the one write a read-only agent can still reach.
  // This rule catches the simple form and ONLY the simple form: measured in
  // OpenCode 1.18.4's own log, `python test_converter.py 2>&1` matched `*>*`
  // and was denied, while `ls pristine/ | sort > /tmp/p.txt` was checked as
  // bare `sort`, allowed, and wrote the file. The redirect is invisible to the
  // permission layer whenever anything sits between the command and the
  // redirect; see the REDIRECT note near the plugin factory for the parser
  // detail. The `tool.execute.before` hook is what actually closes this, so
  // this rule is now the second layer rather than the first. Kept because it
  // costs nothing and still fires first for the shape it does see.
  ['*>*', 'deny'],

  ['find *-delete*', 'deny'],
  ['git add*', 'deny'],
  ['git commit*', 'deny'],
  ['git stash*', 'deny'],
  ['git push*', 'deny'],
  ['git reset*', 'deny'],
  ['git clean*', 'deny'],
  ['git checkout*', 'deny'],
  ['git restore*', 'deny'],
  ['rm *', 'deny'],
  ['sudo *', 'deny'],
  ['gh pr create*', 'deny'],
  ['gh pr merge*', 'deny'],
  ['gh release create*', 'deny'],
]

const toMap = (pairs) => Object.fromEntries(pairs)

/**
 * Every deny from the main profile, reused verbatim so a read-only subagent can
 * never end up more permissive than the primary agent. Derived rather than
 * copied: a new deny added above is picked up here automatically.
 */
// strict: true so a read-only subagent keeps the deny regardless of profile.
const HARD_DENIES = bashRules({ commit: 'allow', strict: true }).filter(([, action]) => action === 'deny')

/**
 * Every `ask` from the main profile, collapsed to `deny` for a read-only
 * subagent. Two reasons, and they point the same way. A subagent has no UI to
 * raise an approval prompt in, so an `ask` there does not prompt: it hangs the
 * run while it looks healthy. And every rule the primary agent hesitates over
 * is a write (`git rebase`, `terraform apply`, `docker push`), which a
 * read-only agent must not reach at all.
 *
 * This exists because the judge's fallback became `allow`. Under the old `ask`
 * fallback these landed on `ask` by accident; with `allow` first in the map and
 * no deny after them they resolved to `allow`, which would have let the judge
 * rebase the branch it was reviewing. Derived, so a new `ask` added above is
 * picked up here automatically.
 */
// commit: 'ask' so the strict profile's `git commit` is collapsed too.
const HARD_ASKS = bashRules({ commit: 'ask', strict: true })
  .filter(([, action]) => action === 'ask')
  .map(([pattern]) => [pattern, 'deny'])

/**
 * Shell map for an agent that must not act. Order matters: the catch-all, then
 * the inspection allows, then every deny - so a deny always has the last word.
 */
const readOnlyBash = (fallback) =>
  toMap([['*', fallback], ...INSPECT_RULES, ...INSPECT_DENIES, ...HARD_ASKS, ...HARD_DENIES])

const projectPermission = ({ commit, strict }) => ({
  '*': 'allow',
  read: {
    '*': 'allow',
    '*.env': 'deny',
    '*.env.*': 'deny',
    '*.env.example': 'allow',
  },
  edit: {
    '*': 'allow',
    '.git/**': 'deny',
    'AGENTS.md': 'ask',
    'opencode.json': 'ask',
    '.opencode/**': 'ask',
    '*.env': 'deny',
    '*.env.*': 'deny',
    '*.env.example': 'allow',
    // The pair to the `external_directory` allow below, and never separable
    // from it: opening this package's skills to the read tool opens them to the
    // edit tool too, and an agent that can rewrite the skill it is running
    // under is running under no rules. Last in the map, so it outranks `*`.
    ...toMap(SKILL_PATHS.map((p) => [p, 'deny'])),
  },
  // `ask` everywhere, except the skill text this plugin itself serves.
  //
  // A skill's body arrives through the skill tool and never touches this rule,
  // but progressive disclosure means SKILL.md only *names* its `references/`
  // files - the agent opens those with the ordinary read tool, which does hit
  // this rule. The package lives outside the project, so every one of those
  // reads prompted. Measured in P11 run 7: `/fable-method` stopped to ask
  // before it could open `references/failure-modes.md`, a file this plugin
  // shipped and pointed the agent at itself.
  //
  // Scoped to `skills/` rather than the package root, so a checkout of this
  // repository is still editable by an agent working *on* the plugin.
  external_directory: toMap([['*', 'ask'], ...SKILL_PATHS.map((p) => [p, 'allow'])]),
  doom_loop: 'ask',
  bash: toMap(bashRules({ commit, strict })),
})

/**
 * Project values win. Shared keys keep the defaults' position (which carries
 * the last-match ordering) but take the project's action; project-only keys
 * land last, where a more specific override belongs.
 */
const fill = (defaults, project) => {
  if (project === undefined) return defaults
  if (typeof project !== 'object' || project === null) return project
  const out = { ...defaults }
  for (const [k, v] of Object.entries(project)) {
    out[k] = typeof v === 'object' && v !== null && typeof out[k] === 'object' && out[k] !== null
      ? fill(out[k], v)
      : v
  }
  return out
}

const AGENTS = () => ({
  fable: {
    description:
      'Primary implementation agent for the Fable Method. Edits project files, delegates investigation, and verifies work before proposing a commit.',
    mode: 'primary',
    prompt: prompt('fable'),
    // No permission block: inherits the project profile below, so the two can
    // never drift apart.
  },
  evidence: {
    description:
      'Read-only investigation subagent for the Fable Method. Gathers project facts and returns the required evidence report. Cannot modify files.',
    mode: 'subagent',
    prompt: prompt('evidence'),
    permission: {
      edit: 'deny',
      // Inherited from the project profile as `ask`, which a subagent cannot
      // answer. `deny` fails loudly instead of hanging, and neither is a
      // widening: a read-only agent should not roam outside the project, and a
      // subagent caught in a loop should be stopped rather than consulted.
      external_directory: 'deny',
      doom_loop: 'deny',
      // `edit: deny` does not make the shell read-only, so bash is locked
      // down separately: deny everything, then allow inspection only.
      bash: readOnlyBash('deny'),
    },
  },
  'fable-judge': {
    description:
      'Read-only adversarial verification subagent for the Fable Method. Reviews finished work and delivers a verdict. Does not repair defects.',
    // `all`, not `subagent`, so `/fable-judge` can run it as the session's own
    // agent instead of dispatching it as a subtask. A subtask hands control
    // back to the parent primary when it returns, and the parent can edit: P7
    // watched exactly that turn `/fable-plan` into an implementation run. The
    // judge's standing rule is that judging changes nothing, so it must not
    // leave an unconstrained agent holding the session. `all` keeps it
    // dispatchable as a subagent too, which is how `fable` reaches it.
    mode: 'all',
    prompt: prompt('fable-judge'),
    permission: {
      edit: 'deny',
      // Same reasoning as `evidence`: an `ask` inherited into a subagent is an
      // approval nobody can give.
      external_directory: 'deny',
      doom_loop: 'deny',
      // This was `ask`, so a project could approve its own test/lint/build
      // commands at execution time. It deadlocked the judge instead: a subagent
      // has nowhere to raise the prompt, so `/fable-judge` hung on the first
      // command not on the inspect list and never returned. Measured on s7,
      // three runs, three hangs - on `python3 -c ...`, on `cp -r ... && cd`,
      // and on `cd ...`. The judge's own skill orders it to re-run every
      // claimed verification, so the commands it deadlocks on are precisely
      // the ones it exists to run. Widening the inspect list does not fix this:
      // `git branch` and `git rev-parse` were already added for the same
      // symptom and `cd`, `cp` and `python` still hung it.
      //
      // `allow` keeps every deny below it, so the judge stays strictly more
      // restricted than the `fable` primary agent it reviews: no edit tool, no
      // redirect, no write-side git, and every hard deny. Same fixture with
      // this line changed: REFUTED with all five planted frauds, backed by an
      // executed `convert(0.125)` and an executed suite run.
      bash: readOnlyBash('allow'),
    },
  },
})

const input = `## User Input

\`\`\`text
$ARGUMENTS
\`\`\`

You **MUST** consider the user input before proceeding (if not empty).`

const skill = (name) =>
  `## Skill\n\nLoad the \`${name}\` skill with the skill tool and treat it as the workflow source of truth for this command.`

const COMMANDS = () => ({
  // `/fable` used to sit here as a second entry point. It bound the same agent,
  // loaded the same skill and carried the same instruction as `/fable-loop`,
  // differing only in restating one rule at more length. Deleted rather than
  // measured: two names for one behaviour is surface, not a feature.
  'fable-loop': {
    description: 'Run the Fable Loop on a task (default entry point).',
    agent: 'fable',
    template: `${input}\n\n${skill('fable-loop')}\n\nRun the full loop. Stage 1 produces the plan artifact. If the ask is plan-first shaped, present the plan and STOP for approval before Stage 2.`,
  },
  'fable-method': {
    description: 'Run the Fable Method on a task (method only, no orchestration).',
    agent: 'fable',
    template: `${input}\n\n${skill('fable-method')}\n\nApply the method's steps literally. Subcommands:\n- \`plan <task>\` - Steps 0-3 only, stop after the plan.\n- \`audit\` - grade finished work against the loop.\n- \`report\` - rewrite the answer you were about to send per Step 6.`,
  },
  'fable-plan': {
    description: 'Produce a Fable Method plan for the task. Plan-only. Does not edit files.',
    agent: 'plan',
    // Not a subtask, deliberately. `subtask: true` dispatches `plan` as a child
    // and hands control back to the parent primary agent when it returns - and
    // the parent is `build`, which can edit. Round P7 caught that: the `plan`
    // child ran only inspections and returned a plan, then the parent went
    // ahead and implemented it, editing both files. Denying `plan` the edit
    // tool does not help, because `plan` was never the one editing.
    //
    // Without the flag the command runs `plan` as the session's own agent, so
    // the edit deny governs the whole run and there is no unconstrained parent
    // left to act. `/fable-judge` keeps its flag: `fable-judge` is a subagent
    // and a subagent has to be dispatched.
    template: `${input}\n\n${skill('fable-method')}\n\nApply Steps 0-3 only: classify the ask, define done with a named verification, gather evidence, deliver the plan artifact. **STOP** after the plan. Do not edit files.`,
  },
  'fable-judge': {
    description: 'Adversarially verify finished work. Read-only. Does not repair defects.',
    agent: 'fable-judge',
    // No `subtask: true`. See the `mode: all` note on the agent: a subtask
    // returns the session to a parent that can edit, which is the one thing a
    // judge must never do.
    template: `${input}\n\n${skill('fable-judge')}\n\nReview the most recent completed work. Hunt the classic frauds (weakened checks, false completion, scope creep, unauthorized action, spec betrayal, debris, unchecked evidence). Deliver one of: \`VERIFIED\`, \`VERIFIED WITH CAVEATS\`, \`REFUTED\`.`,
  },
  'fable-domain': {
    description: 'Generate a trusted Fable domain adapter bundle for a sector.',
    agent: 'fable',
    template: `${input}\n\n${skill('fable-domain')}\n\nApply the skill's stages literally: discussion, research, generation, and trap+smoke. Do not generate an adapter for sectors that the red-lines exclude (medical/clinical, legal advice, specific financial buy/sell, mental health, safety-critical engineering). Do not generate an adapter for sectors whose nouns do not differ from the coding default - those are covered by the method itself.`,
  },
  'fable-doctor': {
    description: 'Report how Fable is wired into this project. Read-only.',
    agent: 'fable',
    template:
      'Call the `fable_doctor` tool. Your reply is its output reproduced in full - every heading and every table row, unchanged and unsummarised. The tables are the deliverable; a summary of them is not. After reproducing the report, and only then, add at most two sentences calling out anything under `## ⚠ Blocking`, any row reading **NO**, or any permission that contradicts the stated policy. Run no commands and read no files.',
  },
})

/**
 * Glob match for OpenCode permission patterns, which use `*` only.
 * Permission maps are last-match-wins over key order, so the scan keeps the
 * last hit rather than returning on the first - the single most common way to
 * misread these rules is to stop at the first match.
 */
const matches = (pattern, cmd) =>
  new RegExp(
    '^' + pattern.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$',
  ).test(cmd)

const effective = (cmd, ...maps) => {
  let hit
  for (const map of maps) {
    if (typeof map === 'string') hit = map
    else for (const [pattern, action] of Object.entries(map || {})) {
      if (matches(pattern, cmd)) hit = action
    }
  }
  return hit
}

const PROBES = [
  'git status --short',
  'git commit -m msg',
  'git push origin main',
  'git push --force origin main',
  'git reset --hard HEAD',
  'git clean -fd',
  'rm -rf build',
  'sudo ls',
  'npm publish',
  'gh pr create --fill',
]

const doctor = (state) => {
  const { config, injected, commit, strict } = state
  if (!config) return 'fable-doctor: the config hook has not run yet - restart OpenCode.'

  // Derived, not listed: a hardcoded list silently drops a command the plugin
  // injects. `fable-doctor` was missing from it, so the doctor never reported
  // on itself.
  const agents = Object.keys(AGENTS())
  const commands = Object.keys(COMMANDS())
  const skills = ['fable-method', 'fable-loop', 'fable-judge', 'fable-domain']
  const out = []

  out.push('## Fable wiring\n')
  out.push('| surface | present | source |')
  out.push('|---|---|---|')
  for (const a of agents) {
    out.push(`| agent \`${a}\` | ${config.agent?.[a] ? 'yes' : '**NO**'} | ${injected.agents.includes(a) ? 'plugin' : 'project'} |`)
  }
  for (const c of commands) {
    const bound = config.command?.[c]?.agent ?? '-'
    out.push(`| command \`/${c}\` | ${config.command?.[c] ? 'yes' : '**NO**'} | ${injected.commands.includes(c) ? 'plugin' : 'project'} → agent \`${bound}\` |`)
  }
  const pathRegistered = config.skills?.paths?.includes(SKILLS_DIR)
  for (const s of skills) {
    const onDisk = fs.existsSync(path.join(SKILLS_DIR, s, 'SKILL.md'))
    out.push(`| skill \`${s}\` | ${pathRegistered && onDisk ? 'yes' : '**NO**'} | ${onDisk ? 'on disk' : 'missing from package'} |`)
  }
  out.push(`| instructions | ${config.instructions?.includes(INVARIANTS) ? 'yes' : '**NO**'} | plugin |`)

  const project = config.permission
  out.push(`\n## Effective bash permissions (profile: ${commit === 'ask' ? 'strict' : 'default'})\n`)
  out.push('Last-match-wins across the project map, then the agent map.\n')
  out.push('| command | fable | evidence | fable-judge |')
  out.push('|---|---|---|---|')
  for (const cmd of PROBES) {
    const cell = (agent) =>
      effective(cmd, project?.bash, config.agent?.[agent]?.permission?.bash) ?? 'inherit'
    out.push(`| \`${cmd}\` | ${cell('fable')} | ${cell('evidence')} | ${cell('fable-judge')} |`)
  }

  out.push('\n## Edit / read gates\n')
  out.push('| agent | edit src | edit .env | read .env |')
  out.push('|---|---|---|---|')
  for (const a of agents) {
    const ap = config.agent?.[a]?.permission
    out.push(
      `| \`${a}\` | ${effective('src/x.ts', project?.edit, ap?.edit) ?? '-'} | ` +
        `${effective('.env', project?.edit, ap?.edit) ?? '-'} | ` +
        `${effective('.env', project?.read, ap?.read) ?? '-'} |`,
    )
  }

  // A project catch-all of `ask`/`deny` covers every permission type, not just
  // the ones it looks like it covers. Fable then prompts for its own skill on
  // every command, and `opencode run` auto-rejects that prompt and fails. This
  // is the one misconfiguration that leaves an install looking healthy while
  // being unusable, so it is reported first.
  const blockers = []
  const catchAll = typeof project === 'string' ? project : project?.['*']
  if (catchAll && catchAll !== 'allow') {
    blockers.push(
      `\`permission."*"\` is \`${catchAll}\`. It applies to every tool - reads, greps, skill loads - ` +
        'so each one prompts, and `opencode run` auto-rejects prompts and fails. Remove the catch-all ' +
        'and let this plugin\'s granular profile stand, or set the specific rules you actually want.',
    )
  }
  if (project?.skill && project.skill !== 'allow') {
    blockers.push(
      `\`permission.skill\` is \`${JSON.stringify(project.skill)}\`, so loading a \`fable-*\` skill needs approval. ` +
        'Every Fable command begins by loading its skill.',
    )
  }
  out.unshift(
    blockers.length
      ? `## ⚠ Blocking\n\n${blockers.map((b) => `- ${b}`).join('\n')}\n`
      : '',
  )

  const defaults = projectPermission({ commit, strict })
  const overrides = Object.entries(defaults.bash)
    .filter(([k, v]) => project?.bash?.[k] !== undefined && project.bash[k] !== v)
    .map(([k, v]) => `- \`${k}\`: plugin default \`${v}\` → project \`${project.bash[k]}\``)
  out.push(
    '\n## Known limits\n\n' +
      "OpenCode's bash permission check cannot see a shell redirect behind a pipe " +
      '(`a | b > f` is checked as `b`), so the `*>*` deny above is enforced only for ' +
      'the unpiped form. Redirection by `evidence` and `fable-judge` is refused by this ' +
      "plugin's `tool.execute.before` hook instead, which sees the raw command. The " +
      'table above therefore understates what is blocked for those two agents.',
  )
  out.push('\n## Project overrides\n')
  out.push(overrides.length ? overrides.join('\n') : 'None - every rule is the plugin default.')

  return out.join('\n')
}

/**
 * Agents whose read-only guarantee the permission layer cannot actually keep.
 * See REDIRECT below.
 */
const READ_ONLY_AGENTS = new Set(['evidence', 'fable-judge'])

/**
 * OpenCode's bash permission check cannot see a redirect that sits outside the
 * command node, so `['*>*', 'deny']` is enforced for `cmd > f` and silently
 * skipped for `cmd | cmd2 > f`. Read from the binary, in `ShellTool.collect`:
 *
 *     patterns.add(Pi(U))   for every `command` descendant U
 *     Pi = (o) => (o.parent?.type === 'redirected_statement' ? o.parent.text : o.text).trim()
 *
 * `Pi` looks exactly one level up. In `a | b > f` tree-sitter-bash wraps the
 * PIPELINE in the `redirected_statement`, so `b`'s parent is the pipeline and
 * the redirect is dropped: the string checked is bare `b`. Measured both ways
 * in OpenCode 1.18.4's own log - `python test_converter.py 2>&1` matched `*>*`
 * and was denied, while `ls pristine/ | sort > /tmp/p.txt` was checked as
 * `sort`, allowed, and wrote the file. A read-only agent could write anywhere.
 *
 * No permission pattern can close this, because the string the rule is matched
 * against no longer contains the redirect. The plugin can, because this hook
 * receives the raw command. Same policy as the `*>*` rule, applied to the text
 * OpenCode actually runs rather than the text it happens to check.
 */
const REDIRECT = />/

export const FableMethod = async (_input, options = {}) => {
  const strict = options.permissionProfile === 'strict'
  const commit = strict ? 'ask' : 'allow'
  const state = { config: null, commit, strict, injected: { agents: [], commands: [] } }

  // `tool.execute.before` is not told which agent is running, but `chat.params`
  // is, and it fires before any tool call in that session. One entry per
  // session; sessions are not long-lived enough for this to be worth evicting.
  const agentOf = new Map()

  return {
    tool: {
      fable_doctor: {
        description:
          'Report how Fable is wired into this project: which agents, commands and skills resolved, the effective permission for representative commands per agent, and which rules the project overrode. Read-only, computed from the resolved config - runs no commands.',
        args: {},
        execute: async (_args, ctx) => {
          ctx?.metadata?.({ title: 'Fable wiring report' })
          return doctor(state)
        },
      },
    },

    'chat.params': async ({ sessionID, agent }) => {
      if (agent) agentOf.set(sessionID, agent)
    },

    'tool.execute.before': async ({ tool, sessionID }, output) => {
      if (tool !== 'bash') return
      if (!READ_ONLY_AGENTS.has(agentOf.get(sessionID))) return
      const command = String(output?.args?.command ?? '')
      if (!REDIRECT.test(command)) return
      throw new Error(
        'Refused: a read-only Fable agent may not use shell redirection. ' +
          "OpenCode's permission check does not see a redirect behind a pipe, so this " +
          'is enforced here instead. Drop the redirect (including `2>&1`) and read the ' +
          'output directly, or write nothing at all - judging changes nothing.',
      )
    },

    config: async (config) => {
      // Skills: point OpenCode at the copies shipped inside this package.
      config.skills ||= {}
      config.skills.paths ||= []
      if (!config.skills.paths.includes(SKILLS_DIR)) config.skills.paths.push(SKILLS_DIR)

      // Instructions: project invariants live in this package, so AGENTS.md
      // is never touched.
      config.instructions ||= []
      if (!config.instructions.includes(INVARIANTS)) config.instructions.push(INVARIANTS)

      // Agents and commands: fill only what the project has not defined.
      config.agent ||= {}
      for (const [name, def] of Object.entries(AGENTS())) {
        if (config.agent[name]) continue
        config.agent[name] = def
        state.injected.agents.push(name)
      }

      // `/fable-plan` is advertised "Plan-only. Does not edit files." and it
      // delegates that guarantee to OpenCode's built-in `plan` agent. The
      // guarantee did not hold: round P6 ran it once on s5-twin-bug and it
      // edited both files with the edit tool. `plan`'s read-only default is
      // internal to OpenCode and resolves to an empty agent block, so the
      // profile this plugin installs - `permission['*']: allow` plus
      // `edit['*']: allow` - outranks it.
      //
      // This plugin widened the profile, so this plugin narrows it back, rather
      // than adding a fourth agent for a guarantee the third one should already
      // carry. `fill` keeps the project's own opinion if it has one.
      config.agent.plan = fill({ permission: { edit: 'deny' } }, config.agent.plan)

      config.command ||= {}
      for (const [name, def] of Object.entries(COMMANDS())) {
        if (config.command[name]) continue
        config.command[name] = def
        state.injected.commands.push(name)
      }

      // Permissions: a project that set `permission` to a bare string has made
      // a deliberate blanket choice - leave it alone.
      if (typeof config.permission !== 'string') {
        config.permission = fill(projectPermission({ commit, strict }), config.permission)

        // A project catch-all of `ask` also covers the `skill` permission, and
        // then Fable cannot load its own skills: every command prompts in the
        // TUI, and `opencode run` auto-rejects the prompt and fails outright.
        // Loading a skill only reads text that ships inside this package, so
        // it is allowed unless the project has an explicit opinion about
        // `skill`. Set `"permission": { "skill": "ask" }` to override.
        config.permission.skill ??= 'allow'
      }

      // Kept for fable_doctor, which reports on the config rather than shelling
      // out to re-derive it.
      state.config = config
    },
  }
}

export default FableMethod

/**
 * Exported for `bin/doctor.js`, which prints the same report from the CLI with
 * no model in the loop. Shared rather than reimplemented: the report is only
 * trustworthy if both callers compute it from the same source.
 */
export { doctor, AGENTS, COMMANDS }

/**
 * Exported for `.github/checks.py`, which asserts that no subagent resolves to
 * `ask` on any rule. Shared rather than reimplemented for the same reason the
 * doctor is: a check that models the resolution differently is not a check.
 *
 * Wrapped in a factory rather than exported directly, because OpenCode calls
 * EVERY named export as a plugin factory. `AGENTS`, `COMMANDS` and `doctor`
 * survive that only because they return an object or a string, which the loader
 * ignores. A bare `export { effective }` does not: called with one argument it
 * returns `undefined`, and the whole plugin dies at dispatch with
 * `UnknownError: Unexpected server error` and nothing in the log. Every export
 * here must return an object.
 */
export const permissionInternals = () => ({ projectPermission, effective, SKILL_PATHS })
