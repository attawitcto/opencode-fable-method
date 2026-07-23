#!/usr/bin/env node
/**
 * Print the Fable wiring and permission report from the command line.
 *
 * The report is a pure computation over the resolved config - no commands are
 * run and no files are read to produce it - so routing it through a model only
 * adds cost and a chance of the model summarising the tables away. This prints
 * it directly.
 *
 *   node bin/doctor.js            # the default permission profile
 *   node bin/doctor.js --strict   # if you installed with permissionProfile: strict
 *
 * The report logic itself lives in the plugin and is imported, never copied:
 * two implementations of last-match-wins would eventually disagree, and a
 * wiring report that disagrees with the wiring is worse than none.
 */

import { execFileSync } from 'child_process'
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { doctor, AGENTS, COMMANDS } from '../.opencode/plugins/fable.js'

// The plugin's own `permissionProfile` option is not recoverable from the
// resolved config, so it is named here instead of guessed. The report prints
// which profile it assumed.
const strict = process.argv.includes('--strict')

// `opencode debug config` truncates at 65536 bytes when its stdout is a pipe,
// and this config is larger than that - capturing it straight from execFileSync
// yields JSON that ends mid-string. Writing to a real file gets all of it.
// Measured on OpenCode 1.18.4: 65536 bytes via pipe, 101227 via file.
const scratch = mkdtempSync(path.join(tmpdir(), 'fable-doctor-'))
const dump = path.join(scratch, 'config.json')

let config
try {
  const fd = openSync(dump, 'w')
  try {
    execFileSync('opencode', ['debug', 'config'], { stdio: ['ignore', fd, 'pipe'] })
  } finally {
    closeSync(fd)
  }
  config = JSON.parse(readFileSync(dump, 'utf8'))
} catch (err) {
  console.error(
    'fable-doctor: could not read the resolved config.\n' +
      'Run this from inside the project you want reported on, with `opencode` on PATH.\n' +
      `(${err.message.split('\n')[0]})`,
  )
  process.exit(1)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

// Whether a surface came from the plugin or the project: compared by
// description, because OpenCode adds its own fields to every agent it resolves,
// so a deep equality check against the plugin's definition never matches.
const from = (defs, resolved) =>
  Object.keys(defs).filter((n) => resolved?.[n]?.description === defs[n].description)

console.log(
  doctor({
    config,
    strict,
    commit: strict ? 'ask' : 'allow',
    injected: {
      agents: from(AGENTS(), config.agent),
      commands: from(COMMANDS(), config.command),
    },
  }),
)
