/**
 * Fable Method for OpenCode.
 *
 * Delivers agents, commands, skills, project instructions and a permission
 * profile by mutating the resolved config in memory. It installs nothing into
 * the repository and writes no files at startup — opening OpenCode must leave
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
 * agent's catch-all: `evidence` refuses it, and `fable-judge` asks — and an
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
 * Shell map for an agent that must not act. Order matters: the catch-all, then
 * the inspection allows, then every deny — so a deny always has the last word.
 */
const readOnlyBash = (fallback) =>
  toMap([['*', fallback], ...INSPECT_RULES, ...INSPECT_DENIES, ...HARD_DENIES])

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
  },
  external_directory: 'ask',
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
      // `edit: deny` does not make the shell read-only, so bash is locked
      // down separately: deny everything, then allow inspection only.
      bash: readOnlyBash('deny'),
    },
  },
  'fable-judge': {
    description:
      'Read-only adversarial verification subagent for the Fable Method. Reviews finished work and delivers a verdict. Does not repair defects.',
    mode: 'subagent',
    prompt: prompt('fable-judge'),
    permission: {
      edit: 'deny',
      // Unknown commands ask rather than deny, so a project can approve its
      // own test/lint/build commands at execution time without this plugin
      // guessing which package-manager scripts are safe to run. The hard
      // denies still apply — `ask` must never become an approval path for
      // publishing or a destructive command.
      bash: readOnlyBash('ask'),
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
  fable: {
    description: 'Run the Fable Loop on a task (default entry point).',
    agent: 'fable',
    template: `${input}\n\n${skill('fable-loop')}\n\nRun the full loop on the task. Stage 1 produces the plan artifact. If the ask is plan-first shaped (ambiguous scope, irreversible or outward-facing actions, or the user asked for a plan), present the plan and STOP for approval before Stage 2.`,
  },
  'fable-loop': {
    description: 'Run the Fable Loop on a task.',
    agent: 'fable',
    template: `${input}\n\n${skill('fable-loop')}\n\nRun the full loop. Stage 1 produces the plan artifact. If the ask is plan-first shaped, present the plan and STOP for approval before Stage 2.`,
  },
  'fable-method': {
    description: 'Run the Fable Method on a task (method only, no orchestration).',
    agent: 'fable',
    template: `${input}\n\n${skill('fable-method')}\n\nApply the method's steps literally. Subcommands:\n- \`plan <task>\` — Steps 0-3 only, stop after the plan.\n- \`audit\` — grade finished work against the loop.\n- \`report\` — rewrite the answer you were about to send per Step 6.`,
  },
  'fable-plan': {
    description: 'Produce a Fable Method plan for the task. Plan-only. Does not edit files.',
    agent: 'plan',
    subtask: true,
    template: `${input}\n\n${skill('fable-method')}\n\nApply Steps 0-3 only: classify the ask, define done with a named verification, gather evidence, deliver the plan artifact. **STOP** after the plan. Do not edit files.`,
  },
  'fable-judge': {
    description: 'Adversarially verify finished work. Read-only. Does not repair defects.',
    agent: 'fable-judge',
    subtask: true,
    template: `${input}\n\n${skill('fable-judge')}\n\nReview the most recent completed work. Hunt the classic frauds (weakened checks, false completion, scope creep, unauthorized action, spec betrayal, debris, unchecked evidence). Deliver one of: \`VERIFIED\`, \`VERIFIED WITH CAVEATS\`, \`REFUTED\`.`,
  },
  'fable-domain': {
    description: 'Generate a trusted Fable domain adapter bundle for a sector.',
    agent: 'fable',
    template: `${input}\n\n${skill('fable-domain')}\n\nApply the skill's stages literally: discussion, research, generation, and trap+smoke. Do not generate an adapter for sectors that the red-lines exclude (medical/clinical, legal advice, specific financial buy/sell, mental health, safety-critical engineering). Do not generate an adapter for sectors whose nouns do not differ from the coding default — those are covered by the method itself.`,
  },
  'fable-doctor': {
    description: 'Report how Fable is wired into this project. Read-only.',
    agent: 'fable',
    template:
      'Call the `fable_doctor` tool. Your reply is its output reproduced in full — every heading and every table row, unchanged and unsummarised. The tables are the deliverable; a summary of them is not. After reproducing the report, and only then, add at most two sentences calling out anything under `## ⚠ Blocking`, any row reading **NO**, or any permission that contradicts the stated policy. Run no commands and read no files.',
  },
})

/**
 * Glob match for OpenCode permission patterns, which use `*` only.
 * Permission maps are last-match-wins over key order, so the scan keeps the
 * last hit rather than returning on the first — the single most common way to
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
  if (!config) return 'fable-doctor: the config hook has not run yet — restart OpenCode.'

  const agents = ['fable', 'evidence', 'fable-judge']
  const commands = ['fable', 'fable-loop', 'fable-method', 'fable-plan', 'fable-judge', 'fable-domain']
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
      `\`permission."*"\` is \`${catchAll}\`. It applies to every tool — reads, greps, skill loads — ` +
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
  out.push('\n## Project overrides\n')
  out.push(overrides.length ? overrides.join('\n') : 'None — every rule is the plugin default.')

  return out.join('\n')
}

export const FableMethod = async (_input, options = {}) => {
  const strict = options.permissionProfile === 'strict'
  const commit = strict ? 'ask' : 'allow'
  const state = { config: null, commit, strict, injected: { agents: [], commands: [] } }

  return {
    tool: {
      fable_doctor: {
        description:
          'Report how Fable is wired into this project: which agents, commands and skills resolved, the effective permission for representative commands per agent, and which rules the project overrode. Read-only, computed from the resolved config — runs no commands.',
        args: {},
        execute: async (_args, ctx) => {
          ctx?.metadata?.({ title: 'Fable wiring report' })
          return doctor(state)
        },
      },
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

      config.command ||= {}
      for (const [name, def] of Object.entries(COMMANDS())) {
        if (config.command[name]) continue
        config.command[name] = def
        state.injected.commands.push(name)
      }

      // Permissions: a project that set `permission` to a bare string has made
      // a deliberate blanket choice — leave it alone.
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
