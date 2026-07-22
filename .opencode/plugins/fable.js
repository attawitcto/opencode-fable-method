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
const bashRules = ({ commit }) => [
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

  ['gh pr create*', 'deny'],
  ['gh pr merge*', 'deny'],
  ['gh release create*', 'deny'],
  ['gh repo delete*', 'deny'],

  ['terraform apply*', 'ask'],
  ['terraform destroy*', 'deny'],
  ['kubectl apply*', 'ask'],
  ['kubectl delete*', 'deny'],
  ['helm upgrade*', 'ask'],
]

/** Read-only inspection commands, allowed for subagents that must not act. */
const INSPECT_RULES = [
  ['git status*', 'allow'],
  ['git diff*', 'allow'],
  ['git log*', 'allow'],
  ['git show*', 'allow'],
  ['git grep*', 'allow'],
  ['git blame*', 'allow'],
  ['ls*', 'allow'],
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

const projectPermission = ({ commit }) => ({
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
  bash: toMap(bashRules({ commit })),
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
      bash: toMap([['*', 'deny'], ...INSPECT_RULES, ...INSPECT_DENIES]),
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
      // guessing which package-manager scripts are safe to run.
      bash: toMap([['*', 'ask'], ...INSPECT_RULES, ...INSPECT_DENIES]),
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
    template: `${input}\n\n${skill('fable-judge')}\n\nReview the most recent completed work. Hunt the classic frauds (weakened checks, false completion, scope creep, unauthorized action, spec betrayal, debris). Deliver one of: \`VERIFIED\`, \`VERIFIED WITH CAVEATS\`, \`REFUTED\`.`,
  },
  'fable-domain': {
    description: 'Generate a trusted Fable domain adapter bundle for a sector.',
    agent: 'fable',
    template: `${input}\n\n${skill('fable-domain')}\n\nApply the skill's stages literally: discussion, research, generation, and trap+smoke. Do not generate an adapter for sectors that the red-lines exclude (medical/clinical, legal advice, specific financial buy/sell, mental health, safety-critical engineering). Do not generate an adapter for sectors whose nouns do not differ from the coding default — those are covered by the method itself.`,
  },
  'fable-doctor': {
    description: 'Report how Fable is wired into this project. Read-only.',
    agent: 'fable',
    template: `Report the current Fable wiring for this project. Read only — change nothing.

1. Run \`opencode debug config\` and report which of the agents \`fable\`, \`evidence\`, \`fable-judge\` and the commands \`fable\`, \`fable-loop\`, \`fable-method\`, \`fable-plan\`, \`fable-judge\`, \`fable-domain\` are present.
2. Run \`opencode debug skill\` and report whether the four \`fable-*\` skills are discoverable.
3. From the resolved config, report the effective values of \`permission.*\`, \`permission.bash.*\`, \`git commit*\`, \`git push*\`, \`git push --force*\`, \`git reset --hard*\`, \`git clean*\`, \`rm -rf *\`.
4. Report any value where this project's \`opencode.json\` overrides the plugin default, and say whether the override is stricter or looser.
5. Run \`opencode --version\` and flag it if it is outside \`>=1.17 <2\`.
6. Run \`git status --short\` and confirm the working tree is unchanged.

Report findings only. Do not edit or repair anything.`,
  },
})

export const FableMethod = async (_input, options = {}) => {
  const commit = options.permissionProfile === 'strict' ? 'ask' : 'allow'

  return {
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
        if (!config.agent[name]) config.agent[name] = def
      }

      config.command ||= {}
      for (const [name, def] of Object.entries(COMMANDS())) {
        if (!config.command[name]) config.command[name] = def
      }

      // Permissions: a project that set `permission` to a bare string has made
      // a deliberate blanket choice — leave it alone.
      if (typeof config.permission === 'string') return
      config.permission = fill(projectPermission({ commit }), config.permission)
    },
  }
}

export default FableMethod
