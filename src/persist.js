import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'

/** Serialize async writes so two saves can never race on the same file. */
export class SerialWriter {
  constructor() {
    this.tail = Promise.resolve()
  }

  enqueue(task) {
    const run = this.tail.then(task, task)
    this.tail = run.catch(() => {})
    return run
  }
}

/**
 * Tolerant JSON read. A missing file is normal; a corrupt file is copied to
 * `backups/` before the caller replaces it with an empty collection.
 */
export function loadJsonFile(file, backupDir) {
  if (!existsSync(file)) return { missing: true, value: undefined }
  try {
    const text = readFileSync(file, 'utf8')
    return { value: JSON.parse(text) }
  } catch (error) {
    const backup = backupCorruptFile(file, backupDir)
    return { corrupt: true, error, backup, value: undefined }
  }
}

export function backupCorruptFile(file, backupDir) {
  if (!existsSync(file)) return undefined
  try {
    mkdirSync(backupDir, { recursive: true })
    const target = join(
      backupDir,
      `${basename(file)}.corrupt-${Date.now()}.json`,
    )
    copyFileSync(file, target)
    return target
  } catch {
    return undefined
  }
}

export function backupFile(file, backupDir, label = 'backup') {
  if (!existsSync(file)) return undefined
  try {
    mkdirSync(backupDir, { recursive: true })
    const target = join(backupDir, `${basename(file)}.${label}-${Date.now()}.json`)
    copyFileSync(file, target)
    return target
  } catch {
    return undefined
  }
}

/** Atomic replacement: fully write a sibling temp file, then rename over. */
export function writeJsonAtomic(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(tmp, file)
}
