const MOUNTED = Symbol.for('dsh-slipnote.mounted')

/**
 * npm installation and a `link:` installation can both be present during
 * development. Registering the same prefix route twice makes the host throw,
 * so the first successful mount wins for the lifetime of this process.
 */
export function mountOnce(fn) {
  const global = globalThis
  if (global[MOUNTED]) return undefined
  global[MOUNTED] = true
  try {
    return fn()
  } catch (error) {
    global[MOUNTED] = false
    throw error
  }
}

export function isMounted() {
  return Boolean(globalThis[MOUNTED])
}
