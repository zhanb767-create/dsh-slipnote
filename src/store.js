import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { memoDataDir } from './dsh-home.js'
import {
  LIMITS,
  MemoError,
  defaultPrefs,
  newNoteId,
  newPlanId,
  newStageId,
  newStepId,
  normalizeLoadedNote,
  normalizeLoadedPlan,
  normalizeNewNote,
  normalizeNewPlan,
  normalizeNotePatch,
  normalizePlanPatch,
  normalizePrefs,
  progressOf,
  sortNotes,
  sortPlans,
} from './schema.js'
import {
  SerialWriter,
  backupFile,
  loadJsonFile,
  writeJsonAtomic,
} from './persist.js'

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function markdownDate(now) {
  return new Date(now).toISOString().slice(0, 10)
}

function markdownEscape(text) {
  return String(text ?? '').replace(/\r\n/g, '\n')
}

export class MemoStore {
  constructor({ dir = memoDataDir(), now = () => Date.now() } = {}) {
    this.dir = dir
    this.now = now
    this.notesFile = join(dir, 'notes.json')
    this.plansFile = join(dir, 'plans.json')
    this.prefsFile = join(dir, 'prefs.json')
    this.backupsDir = join(dir, 'backups')
    this.notes = []
    this.plans = []
    this.prefs = defaultPrefs()
    this.warnings = []
    this.readOnly = false
    this.loaded = false
    this.writer = new SerialWriter()
  }

  load() {
    if (this.loaded) return this
    this.loaded = true
    mkdirSync(this.dir, { recursive: true })
    this.notes = this.loadCollection('notes', normalizeLoadedNote, LIMITS.NOTES_MAX)
    this.plans = this.loadCollection('plans', normalizeLoadedPlan, LIMITS.PLANS_MAX)
    this.prefs = this.loadPrefs()
    return this
  }

  loadCollection(name, normalizeItem, limit) {
    const file = name === 'notes' ? this.notesFile : this.plansFile
    const result = loadJsonFile(file, this.backupsDir)
    if (result.missing) return []
    if (result.corrupt) {
      this.warnings.push(
        `${name}.json 无法解析，已${result.backup ? `备份到 ${result.backup}` : '跳过'}；当前使用空数据。`,
      )
      return []
    }
    const data = result.value
    if (!isPlainObject(data)) {
      this.warnings.push(`${name}.json 结构无效，已忽略。`)
      return []
    }
    if (typeof data.schemaVersion === 'number' && data.schemaVersion > 1) {
      this.readOnly = true
      this.warnings.push(
        `${name}.json 的 schemaVersion=${data.schemaVersion} 高于插件支持的 1；已进入只读模式。`,
      )
    }
    const rows = Array.isArray(data[name]) ? data[name] : Array.isArray(data) ? data : []
    if (!Array.isArray(rows)) {
      this.warnings.push(`${name}.json 缺少 ${name} 数组，已忽略。`)
      return []
    }
    const now = this.now()
    const normalized = rows
      .slice(0, limit)
      .map((row) => normalizeItem(row, now))
      .filter(Boolean)
    if (rows.length > limit) {
      this.warnings.push(`${name}.json 超过 ${limit} 条，已截断到 ${limit} 条。`)
    }
    return normalized
  }

  loadPrefs() {
    const result = loadJsonFile(this.prefsFile, this.backupsDir)
    if (result.missing) return defaultPrefs()
    if (result.corrupt) {
      this.warnings.push(
        `prefs.json 无法解析，已${result.backup ? `备份到 ${result.backup}` : '跳过'}；使用默认偏好。`,
      )
      return defaultPrefs()
    }
    if (!isPlainObject(result.value)) {
      this.warnings.push('prefs.json 结构无效，使用默认偏好。')
      return defaultPrefs()
    }
    if (
      typeof result.value.schemaVersion === 'number' &&
      result.value.schemaVersion > 1
    ) {
      this.readOnly = true
      this.warnings.push(
        `prefs.json 的 schemaVersion=${result.value.schemaVersion} 高于插件支持的 1；已进入只读模式。`,
      )
    }
    return normalizePrefs(result.value)
  }

  assertWritable() {
    if (this.readOnly) {
      throw new MemoError(
        'SCHEMA_TOO_NEW',
        '数据版本高于当前插件，已进入只读模式；请升级 dsh-slipnote 后再写入。',
        409,
      )
    }
  }

  async saveNotes() {
    this.assertWritable()
    await this.writer.enqueue(() =>
      writeJsonAtomic(this.notesFile, { schemaVersion: 1, notes: this.notes }),
    )
  }

  async savePlans() {
    this.assertWritable()
    await this.writer.enqueue(() =>
      writeJsonAtomic(this.plansFile, { schemaVersion: 1, plans: this.plans }),
    )
  }

  async savePrefs() {
    this.assertWritable()
    await this.writer.enqueue(() => writeJsonAtomic(this.prefsFile, this.prefs))
  }

  storageInfo() {
    return {
      mode: 'disk',
      dir: this.dir,
      readOnly: this.readOnly,
      warnings: [...this.warnings],
      notesCount: this.notes.length,
      plansCount: this.plans.length,
    }
  }

  bootstrap() {
    this.load()
    return {
      notes: sortNotes(this.notes),
      plans: sortPlans(this.plans),
      prefs: { ...this.prefs },
      storage: this.storageInfo(),
    }
  }

  listNotes({ q = '', tag = '', includeArchived = false } = {}) {
    this.load()
    const query = String(q ?? '').trim().toLowerCase()
    const wantedTag = String(tag ?? '').trim().toLowerCase()
    let rows = this.notes
    if (!includeArchived) rows = rows.filter((note) => !note.archived)
    if (wantedTag) rows = rows.filter((note) => note.tags.includes(wantedTag))
    if (query) {
      rows = rows.filter(
        (note) =>
          note.title.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query) ||
          (note.sessionTitle ?? '').toLowerCase().includes(query) ||
          note.tags.some((item) => item.includes(query)) ||
          (note.images ?? []).some((image) => image.name.toLowerCase().includes(query)),
      )
    }
    return sortNotes(rows)
  }

  getNote(id) {
    this.load()
    return this.notes.find((note) => note.id === id)
  }

  async createNote(input) {
    this.load()
    this.assertWritable()
    if (this.notes.length >= LIMITS.NOTES_MAX) {
      throw new MemoError('LIMIT_REACHED', `最多保存 ${LIMITS.NOTES_MAX} 条备忘录。`, 409)
    }
    const note = normalizeNewNote(input, this.now())
    this.notes.push(note)
    try {
      await this.saveNotes()
    } catch (error) {
      this.notes = this.notes.filter((item) => item.id !== note.id)
      throw error
    }
    return note
  }

  async updateNote(id, patch) {
    this.load()
    this.assertWritable()
    const index = this.notes.findIndex((note) => note.id === id)
    if (index < 0) throw new MemoError('NOTE_NOT_FOUND', '备忘录不存在。', 404)
    const previous = this.notes[index]
    const next = normalizeNotePatch(previous, patch, this.now())
    this.notes[index] = next
    try {
      await this.saveNotes()
    } catch (error) {
      this.notes[index] = previous
      throw error
    }
    return next
  }

  async deleteNote(id) {
    this.load()
    this.assertWritable()
    const index = this.notes.findIndex((note) => note.id === id)
    if (index < 0) throw new MemoError('NOTE_NOT_FOUND', '备忘录不存在。', 404)
    const [removed] = this.notes.splice(index, 1)
    try {
      await this.saveNotes()
    } catch (error) {
      this.notes.splice(index, 0, removed)
      throw error
    }
    return removed
  }

  listPlans({ includeArchived = true } = {}) {
    this.load()
    const rows = includeArchived ? this.plans : this.plans.filter((plan) => !plan.archived)
    return sortPlans(rows)
  }

  getPlan(id) {
    this.load()
    return this.plans.find((plan) => plan.id === id)
  }

  async createPlan(input) {
    this.load()
    this.assertWritable()
    if (this.plans.length >= LIMITS.PLANS_MAX) {
      throw new MemoError('LIMIT_REACHED', `最多保存 ${LIMITS.PLANS_MAX} 份计划。`, 409)
    }
    const plan = normalizeNewPlan(input, this.now())
    this.plans.push(plan)
    try {
      await this.savePlans()
    } catch (error) {
      this.plans = this.plans.filter((item) => item.id !== plan.id)
      throw error
    }
    return plan
  }

  async updatePlan(id, patch) {
    this.load()
    this.assertWritable()
    const index = this.plans.findIndex((plan) => plan.id === id)
    if (index < 0) throw new MemoError('PLAN_NOT_FOUND', '计划不存在。', 404)
    const previous = this.plans[index]
    const next = normalizePlanPatch(previous, patch, this.now())
    this.plans[index] = next
    try {
      await this.savePlans()
    } catch (error) {
      this.plans[index] = previous
      throw error
    }
    return next
  }

  async deletePlan(id) {
    this.load()
    this.assertWritable()
    const index = this.plans.findIndex((plan) => plan.id === id)
    if (index < 0) throw new MemoError('PLAN_NOT_FOUND', '计划不存在。', 404)
    const [removed] = this.plans.splice(index, 1)
    try {
      await this.savePlans()
    } catch (error) {
      this.plans.splice(index, 0, removed)
      throw error
    }
    return removed
  }

  getPrefs() {
    this.load()
    return { ...this.prefs }
  }

  async updatePrefs(patch) {
    this.load()
    this.assertWritable()
    const previous = this.prefs
    const merged = { ...previous, ...(isPlainObject(patch) ? patch : {}) }
    const next = normalizePrefs(merged, { tolerant: false })
    this.prefs = next
    try {
      await this.savePrefs()
    } catch (error) {
      this.prefs = previous
      throw error
    }
    return next
  }

  exportJson() {
    this.load()
    return {
      schemaVersion: 1,
      exportedAt: new Date(this.now()).toISOString(),
      notes: sortNotes(this.notes),
      plans: sortPlans(this.plans),
      prefs: { ...this.prefs },
    }
  }

  exportMarkdown() {
    this.load()
    const lines = [`# DSH 备忘录导出（${markdownDate(this.now())}）`, '']
    const notes = sortNotes(this.notes)
    lines.push('## 备忘录', '')
    if (notes.length === 0) lines.push('（无）', '')
    for (const note of notes) {
      const tags = note.tags.length > 0 ? `（标签：${note.tags.join(', ')}）` : ''
      lines.push(`### ${note.title}${tags}`, '')
      const source = [
        `来源：${note.source}`,
        note.sessionTitle ? `会话：${note.sessionTitle}` : '',
        note.messageIndex ? `消息 #${note.messageIndex}` : '',
        note.messageRole ? `角色：${note.messageRole}` : '',
        `时间：${new Date(note.createdAt).toISOString()}`,
      ]
        .filter(Boolean)
        .join(' / ')
      lines.push(`- ${source}`)
      if (note.archived) lines.push('- 已归档')
      lines.push('', markdownEscape(note.content), '')
      for (const image of note.images ?? []) {
        const alt = String(image.name ?? '图片').replace(/[[\]]/g, ' ')
        lines.push(`![${alt}](${image.dataUrl})`, '')
      }
    }

    lines.push('## 计划书', '')
    const plans = sortPlans(this.plans)
    if (plans.length === 0) lines.push('（无）', '')
    for (const plan of plans) {
      const progress = progressOf(plan)
      lines.push(`### ${plan.title}（${progress.done}/${progress.total} 完成）`, '')
      if (plan.archived) lines.push('_已归档_', '')
      for (const stage of plan.stages) {
        lines.push(`#### ${stage.title}`, '')
        if (stage.steps.length === 0) lines.push('（无步骤）', '')
        for (const step of stage.steps) {
          const checked = step.status === 'done' ? 'x' : ' '
          const note = step.note ? ` — ${step.note.replace(/\r?\n/g, ' ')}` : ''
          lines.push(`- [${checked}] ${step.text}（${step.status}）${note}`)
        }
        lines.push('')
      }
    }
    return lines.join('\n').trimEnd() + '\n'
  }

  backupCurrent() {
    return {
      notes: backupFile(this.notesFile, this.backupsDir, 'before-import'),
      plans: backupFile(this.plansFile, this.backupsDir, 'before-import'),
      prefs: backupFile(this.prefsFile, this.backupsDir, 'before-import'),
    }
  }

  async importData(mode, data) {
    this.load()
    this.assertWritable()
    if (mode !== 'merge' && mode !== 'replace') {
      throw new MemoError('VALIDATION', 'mode 必须是 merge 或 replace。', 422)
    }
    if (!isPlainObject(data)) {
      throw new MemoError('VALIDATION', 'data 必须是导出对象。', 422)
    }
    if (typeof data.schemaVersion === 'number' && data.schemaVersion > 1) {
      throw new MemoError('SCHEMA_TOO_NEW', '导入数据的 schemaVersion 高于当前插件。', 409)
    }
    const rawNotes = Array.isArray(data.notes) ? data.notes : []
    const rawPlans = Array.isArray(data.plans) ? data.plans : []
    if (rawNotes.length > LIMITS.NOTES_MAX || rawPlans.length > LIMITS.PLANS_MAX) {
      throw new MemoError('LIMIT_REACHED', '导入数据超过条目上限。', 409)
    }
    const now = this.now()
    const previousNotes = this.notes
    const previousPlans = this.plans
    const previousPrefs = this.prefs

    if (mode === 'replace') this.backupCurrent()

    const importedNotes = rawNotes
      .map((raw) => normalizeLoadedNote(raw, now))
      .filter(Boolean)
      .map((note) => {
        if (mode === 'replace') return note
        return {
          ...note,
          id: newNoteId(),
          createdAt: note.createdAt || now,
          updatedAt: now,
        }
      })
    const importedPlans = rawPlans
      .map((raw) => normalizeLoadedPlan(raw, now))
      .filter(Boolean)
      .map((plan) => {
        if (mode === 'replace') return plan
        return {
          ...plan,
          id: newPlanId(),
          createdAt: plan.createdAt || now,
          updatedAt: now,
          stages: plan.stages.map((stage) => ({
            ...stage,
            id: newStageId(),
            steps: stage.steps.map((step) => ({ ...step, id: newStepId() })),
          })),
        }
      })

    if (mode === 'replace') {
      this.notes = importedNotes.slice(0, LIMITS.NOTES_MAX)
      this.plans = importedPlans.slice(0, LIMITS.PLANS_MAX)
      if (isPlainObject(data.prefs)) {
        this.prefs = normalizePrefs(data.prefs)
      }
    } else {
      this.notes = [...this.notes, ...importedNotes].slice(0, LIMITS.NOTES_MAX)
      this.plans = [...this.plans, ...importedPlans].slice(0, LIMITS.PLANS_MAX)
    }

    try {
      await this.saveNotes()
      await this.savePlans()
      if (mode === 'replace' && isPlainObject(data.prefs)) await this.savePrefs()
    } catch (error) {
      this.notes = previousNotes
      this.plans = previousPlans
      this.prefs = previousPrefs
      throw error
    }

    return {
      mode,
      notes: importedNotes.length,
      plans: importedPlans.length,
    }
  }

  progress(planId) {
    const plan = this.getPlan(planId)
    return plan ? progressOf(plan) : null
  }
}
