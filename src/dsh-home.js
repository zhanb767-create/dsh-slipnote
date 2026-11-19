import { homedir } from 'node:os'
import { join } from 'node:path'

function expandHome(value) {
  if (value === '~') return homedir()
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return join(homedir(), value.slice(2))
  }
  return value
}

/** Resolve DSH_HOME: explicit environment value, then ~/.dsh. */
export function dshHome() {
  const raw = process.env.DSH_HOME
  if (typeof raw === 'string' && raw.trim() !== '') return expandHome(raw.trim())
  return join(homedir(), '.dsh')
}

/** The one directory owned by this plugin. */
export function memoDataDir() {
  return join(dshHome(), 'dsh-memo')
}
