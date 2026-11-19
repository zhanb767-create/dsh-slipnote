import { randomUUID } from 'node:crypto'

export const LIMITS = Object.freeze({
  NOTES_MAX: 5000,
  NOTE_TITLE_MAX: 200,
  NOTE_CONTENT_MAX: 200_000,
  NOTE_TAGS_MAX: 20,
  NOTE_TAG_MAX: 32,
  NOTE_IMAGES_MAX: 6,
  NOTE_IMAGE_CHARS_MAX: 3_000_000,
  NOTE_IMAGES_TOTAL_CHARS_MAX: 12_000_000,
  NOTE_IMAGE_NAME_MAX: 120,
  PLANS_MAX: 200,
  STAGES_MAX: 50,
  STEPS_MAX: 200,
  STEP_TEXT_MAX: 1000,
  STEP_NOTE_MAX: 5000,
})

const SOURCES = new Set(['manual', 'selection', 'composer', 'snapshot'])
const STATUSES = new Set(['todo', 'doing', 'done', 'hold'])
const ROLES = new Set(['user', 'assistant'])
const THEMES = new Set(['auto', 'light', 'dark'])
const TABS = new Set(['notes', 'plans'])

const NOTE_ID = /^n_[A-Za-z0-9-]{8,64}$/
const PLAN_ID = /^p_[A-Za-z0-9-]{8,64}$/
const STAGE_ID = /^st_[A-Za-z0-9-]{8,64}$/
const STEP_ID = /^sp_[A-Za-z0-9-]{8,64}$/
const IMAGE_ID = /^img_[A-Za-z0-9-]{8,64}$/
const IMAGE_DATA_URL = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/

export class MemoError extends Error {
  constructor(code, message, status = 422, details) {
    super(message)
    this.name = 'MemoError'
    this.code = code
    this.status = status
    if (details !== undefined) this.details = details
  }
}

function fail(field, message, code = 'VALIDATION', status = 422) {
  throw new MemoError(code, message, status, { field })
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readString(value, field, max, { allowEmpty = true } = {}) {
  if (typeof value !== 'string') fail(field, `${field} must be a string`)
  if (value.length > max) fail(field, `${field} exceeds ${max} characters`)
  if (!allowEmpty && value.trim() === '') fail(field, `${field} must not be empty`)
  return value
}

function readNullableString(value, field, max) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') fail(field, `${field} must be a string or null`)
  const trimmed = value.trim()
  if (trimmed.length > max) fail(field, `${field} exceeds ${max} characters`)
  return trimmed === '' ? null : trimmed
}

function readNullableInt(value, field, min) {
  if (value === null || value === undefined) return null
  if (!Number.isInteger(value) || value < min) {
    fail(field, `${field} must be an integer >= ${min} or null`)
  }
  return value
}

function readBool(value, field, fallback) {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') fail(field, `${field} must be a boolean`)
  return value
}

function readEnum(value, field, allowed, fallback) {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !allowed.has(value)) {
    fail(field, `${field} must be one of ${[...allowed].join(', ')}`)
  }
  return value
}

function cleanTitleLine(line) {
  if (line.trim().startsWith('```')) return ''
  let cleaned = line.trim().replace(/^\[(.*?)\]\([^)]*\)$/, '$1')
  while (cleaned.length > 0 && '>#*_`~+-'.includes(cleaned[0])) cleaned = cleaned.slice(1).trim()
  cleaned = cleaned.replace(/[*_`~]/g, '')
  cleaned = cleaned.replace(/^(以下是|下面是|这是)(?:关于)?[，,。:：]? */, '')
  cleaned = cleaned.replace(/^(好的|好|可以|没问题|收到|当然|ok|sure)[，,。.!！:：]\s*/i, '')
  return cleaned.trim()
}

function deriveTitle(content, fallback = '未命名备忘录', hasImages = false) {
  const lines = String(content ?? '')
    .replace(/\r\n?/g, String.fromCharCode(10))
    .split(String.fromCharCode(10))
    .map(cleanTitleLine)
    .filter(Boolean)
  const generic = /^(好的|好|可以|没问题|已完成|完成了|以下是|这是|当然|ok|sure)[，,。.!！:：\s]*$/i
  const first = lines.find((line) => !generic.test(line)) ?? lines[0]
  if (!first) return hasImages ? '图片备忘录' : fallback
  if (first.length <= 40) return first
  const windowText = first.slice(0, 40)
  const punctuation = '。！？；，.!?,'
  let end = -1
  for (const mark of punctuation) {
    const at = windowText.lastIndexOf(mark)
    if (at > end) end = at
  }
  if (end < 12) end = 40
  return `${first.slice(0, end).trimEnd()}…`
}

export function normalizeImages(value, { tolerant = false } = {}) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    if (tolerant) return []
    fail('images', 'images must be an array')
  }
  if (value.length > LIMITS.NOTE_IMAGES_MAX) {
    if (tolerant) value = value.slice(0, LIMITS.NOTE_IMAGES_MAX)
    else fail('images', `at most ${LIMITS.NOTE_IMAGES_MAX} images are allowed`)
  }
  const images = []
  let totalChars = 0
  for (const raw of value) {
    if (!isPlainObject(raw)) {
      if (tolerant) continue
      fail('images', 'each image must be an object')
    }
    const dataUrl = typeof raw.dataUrl === 'string' ? raw.dataUrl.trim() : ''
    const match = IMAGE_DATA_URL.exec(dataUrl)
    if (!match) {
      if (tolerant) continue
      fail('images.dataUrl', 'image dataUrl must be a PNG, JPEG, WebP, or GIF data URL')
    }
    if (dataUrl.length > LIMITS.NOTE_IMAGE_CHARS_MAX) {
      if (tolerant) continue
      fail('images.dataUrl', `each image exceeds ${LIMITS.NOTE_IMAGE_CHARS_MAX} characters`)
    }
    totalChars += dataUrl.length
    if (totalChars > LIMITS.NOTE_IMAGES_TOTAL_CHARS_MAX) {
      if (tolerant) break
      fail('images', `total image data exceeds ${LIMITS.NOTE_IMAGES_TOTAL_CHARS_MAX} characters`)
    }
    const name = (
      typeof raw.name === 'string' && raw.name.trim() !== ''
        ? raw.name.trim()
        : '图片'
    ).slice(0, LIMITS.NOTE_IMAGE_NAME_MAX)
    const width = Number.isInteger(raw.width) && raw.width >= 0 ? raw.width : 0
    const height = Number.isInteger(raw.height) && raw.height >= 0 ? raw.height : 0
    images.push({
      id: normalizeId(raw.id, IMAGE_ID, () => `img_${randomUUID().replaceAll('-', '')}`),
      name,
      mime: match[1] === 'image/jpg' ? 'image/jpeg' : match[1],
      dataUrl,
      width,
      height,
      size: Math.max(0, Math.round((match[2].replace(/\s+/g, '').length * 3) / 4)),
    })
  }
  return images
}

export function normalizeTags(value, { tolerant = false } = {}) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    if (tolerant) return []
    fail('tags', 'tags must be an array')
  }
  const seen = new Set()
  for (const raw of value) {
    if (typeof raw !== 'string') {
      if (tolerant) continue
      fail('tags', 'each tag must be a string')
    }
    const tag = raw.trim().replace(/^#+/, '').toLowerCase()
    if (tag === '') continue
    if (tag.length > LIMITS.NOTE_TAG_MAX) {
      if (tolerant) continue
      fail('tags', `each tag must be at most ${LIMITS.NOTE_TAG_MAX} characters`)
    }
    seen.add(tag)
  }
  const tags = [...seen]
  if (tags.length > LIMITS.NOTE_TAGS_MAX) {
    if (tolerant) return tags.slice(0, LIMITS.NOTE_TAGS_MAX)
    fail('tags', `at most ${LIMITS.NOTE_TAGS_MAX} tags are allowed`)
  }
  return tags
}

export function newNoteId() {
  return `n_${randomUUID().replaceAll('-', '')}`
}

export function newPlanId() {
  return `p_${randomUUID().replaceAll('-', '')}`
}

export function newStageId() {
  return `st_${randomUUID().replaceAll('-', '')}`
}

export function newStepId() {
  return `sp_${randomUUID().replaceAll('-', '')}`
}

function normalizeId(value, matcher, make) {
  return typeof value === 'string' && matcher.test(value) ? value : make()
}

function normalizeStep(raw, now, index, { tolerant = false } = {}) {
  if (!isPlainObject(raw)) {
    if (tolerant) return null
    fail('steps', 'each step must be an object')
  }
  let text
  if (typeof raw.text !== 'string') {
    if (tolerant) text = '未命名步骤'
    else fail('steps.text', 'step text must be a string')
  } else {
    text = raw.text.trim()
    if (text === '') {
      if (tolerant) text = '未命名步骤'
      else fail('steps.text', 'step text must not be empty')
    }
    if (text.length > LIMITS.STEP_TEXT_MAX) {
      if (tolerant) text = text.slice(0, LIMITS.STEP_TEXT_MAX)
      else fail('steps.text', `step text exceeds ${LIMITS.STEP_TEXT_MAX} characters`)
    }
  }
  const status = (() => {
    if (raw.status === undefined) return 'todo'
    if (typeof raw.status === 'string' && STATUSES.has(raw.status)) return raw.status
    if (tolerant) return 'todo'
    fail('steps.status', 'step status must be todo, doing, done, or hold')
  })()
  let note = ''
  if (raw.note !== undefined) {
    if (typeof raw.note !== 'string') {
      if (!tolerant) fail('steps.note', 'step note must be a string')
    } else {
      note = raw.note
      if (note.length > LIMITS.STEP_NOTE_MAX) {
        if (tolerant) note = note.slice(0, LIMITS.STEP_NOTE_MAX)
        else fail('steps.note', `step note exceeds ${LIMITS.STEP_NOTE_MAX} characters`)
      }
    }
  }
  const order = Number.isInteger(raw.order) && raw.order >= 0 ? raw.order : index
  let doneAt = null
  try {
    doneAt = readNullableInt(raw.doneAt, 'steps.doneAt', 0)
  } catch (error) {
    if (!tolerant) throw error
  }
  if (status === 'done') {
    if (doneAt === null) doneAt = now
  } else {
    doneAt = null
  }
  return {
    id: normalizeId(raw.id, STEP_ID, newStepId),
    text,
    status,
    note,
    order,
    doneAt,
  }
}

function normalizeSteps(rawSteps, now, { tolerant = false } = {}) {
  if (rawSteps === undefined || rawSteps === null) return []
  if (!Array.isArray(rawSteps)) {
    if (tolerant) return []
    fail('steps', 'steps must be an array')
  }
  if (rawSteps.length > LIMITS.STEPS_MAX) {
    if (!tolerant) fail('steps', `at most ${LIMITS.STEPS_MAX} steps are allowed`)
    rawSteps = rawSteps.slice(0, LIMITS.STEPS_MAX)
  }
  const steps = rawSteps
    .map((step, index) => normalizeStep(step, now, index, { tolerant }))
    .filter(Boolean)
  steps.sort((a, b) => a.order - b.order)
  steps.forEach((step, index) => {
    step.order = index
  })
  return steps
}

function normalizeStage(raw, now, index, { tolerant = false } = {}) {
  if (!isPlainObject(raw)) {
    if (tolerant) return null
    fail('stages', 'each stage must be an object')
  }
  let title
  if (typeof raw.title !== 'string') {
    if (tolerant) title = '未命名阶段'
    else fail('stages.title', 'stage title must be a string')
  } else {
    title = raw.title.trim()
    if (title.length > LIMITS.NOTE_TITLE_MAX) {
      if (tolerant) title = title.slice(0, LIMITS.NOTE_TITLE_MAX)
      else fail('stages.title', `stage title exceeds ${LIMITS.NOTE_TITLE_MAX} characters`)
    }
    if (title === '') title = '未命名阶段'
  }
  return {
    id: normalizeId(raw.id, STAGE_ID, newStageId),
    title,
    order: Number.isInteger(raw.order) && raw.order >= 0 ? raw.order : index,
    steps: normalizeSteps(raw.steps, now, { tolerant }),
  }
}

function normalizeStages(rawStages, now, { tolerant = false } = {}) {
  if (rawStages === undefined || rawStages === null) return []
  if (!Array.isArray(rawStages)) {
    if (tolerant) return []
    fail('stages', 'stages must be an array')
  }
  if (rawStages.length > LIMITS.STAGES_MAX) {
    if (!tolerant) fail('stages', `at most ${LIMITS.STAGES_MAX} stages are allowed`)
    rawStages = rawStages.slice(0, LIMITS.STAGES_MAX)
  }
  const stages = rawStages
    .map((stage, index) => normalizeStage(stage, now, index, { tolerant }))
    .filter(Boolean)
  stages.sort((a, b) => a.order - b.order)
  stages.forEach((stage, index) => {
    stage.order = index
  })
  return stages
}

export function normalizeNewNote(input, now) {
  if (!isPlainObject(input)) fail('body', 'request body must be an object')
  const content =
    input.content === undefined
      ? ''
      : readString(input.content, 'content', LIMITS.NOTE_CONTENT_MAX)
  const images = normalizeImages(input.images)
  const titleRaw =
    input.title === undefined
      ? ''
      : readString(input.title, 'title', LIMITS.NOTE_TITLE_MAX)
  const title = titleRaw.trim() || deriveTitle(content, '未命名备忘录', images.length > 0)
  return {
    id: newNoteId(),
    title,
    content,
    images,
    tags: normalizeTags(input.tags),
    source: readEnum(input.source, 'source', SOURCES, 'manual'),
    sessionId: readNullableString(input.sessionId, 'sessionId', 128),
    sessionTitle: readNullableString(input.sessionTitle, 'sessionTitle', 200),
    messageIndex: readNullableInt(input.messageIndex, 'messageIndex', 1),
    messageSeq: readNullableInt(input.messageSeq, 'messageSeq', 0),
    messageRole:
      input.messageRole === undefined || input.messageRole === null
        ? null
        : readEnum(input.messageRole, 'messageRole', ROLES, null),
    messageTime: readNullableInt(input.messageTime, 'messageTime', 0),
    pinned: readBool(input.pinned, 'pinned', false),
    archived: readBool(input.archived, 'archived', false),
    createdAt: now,
    updatedAt: now,
  }
}

export function normalizeNotePatch(existing, patch, now) {
  if (!isPlainObject(patch)) fail('body', 'request body must be an object')
  const next = { ...existing }
  if (Object.hasOwn(patch, 'title')) {
    next.title = readString(patch.title, 'title', LIMITS.NOTE_TITLE_MAX).trim()
  }
  if (Object.hasOwn(patch, 'content')) {
    next.content = readString(patch.content, 'content', LIMITS.NOTE_CONTENT_MAX)
  }
  if (Object.hasOwn(patch, 'images')) next.images = normalizeImages(patch.images)
  if (Object.hasOwn(patch, 'tags')) next.tags = normalizeTags(patch.tags)
  if (Object.hasOwn(patch, 'source')) {
    next.source = readEnum(patch.source, 'source', SOURCES, existing.source)
  }
  if (Object.hasOwn(patch, 'sessionId')) {
    next.sessionId = readNullableString(patch.sessionId, 'sessionId', 128)
  }
  if (Object.hasOwn(patch, 'sessionTitle')) {
    next.sessionTitle = readNullableString(patch.sessionTitle, 'sessionTitle', 200)
  }
  if (Object.hasOwn(patch, 'messageIndex')) {
    next.messageIndex = readNullableInt(patch.messageIndex, 'messageIndex', 1)
  }
  if (Object.hasOwn(patch, 'messageSeq')) {
    next.messageSeq = readNullableInt(patch.messageSeq, 'messageSeq', 0)
  }
  if (Object.hasOwn(patch, 'messageRole')) {
    next.messageRole =
      patch.messageRole === null
        ? null
        : readEnum(patch.messageRole, 'messageRole', ROLES, null)
  }
  if (Object.hasOwn(patch, 'messageTime')) {
    next.messageTime = readNullableInt(patch.messageTime, 'messageTime', 0)
  }
  if (Object.hasOwn(patch, 'pinned')) next.pinned = readBool(patch.pinned, 'pinned', existing.pinned)
  if (Object.hasOwn(patch, 'archived')) {
    next.archived = readBool(patch.archived, 'archived', existing.archived)
  }
  if (next.title.trim() === '') {
    next.title = deriveTitle(next.content, '未命名备忘录', (next.images ?? []).length > 0)
  }
  next.updatedAt = now
  return next
}

export function normalizeLoadedNote(raw, now) {
  if (!isPlainObject(raw)) return null
  const content =
    typeof raw.content === 'string' ? raw.content.slice(0, LIMITS.NOTE_CONTENT_MAX) : ''
  const images = normalizeImages(raw.images, { tolerant: true })
  let title = typeof raw.title === 'string' ? raw.title.slice(0, LIMITS.NOTE_TITLE_MAX) : ''
  if (title.trim() === '') title = deriveTitle(content, '未命名备忘录', images.length > 0)
  return {
    id: normalizeId(raw.id, NOTE_ID, newNoteId),
    title,
    content,
    images,
    tags: normalizeTags(raw.tags, { tolerant: true }),
    source: typeof raw.source === 'string' && SOURCES.has(raw.source) ? raw.source : 'manual',
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId.slice(0, 128) : null,
    sessionTitle:
      typeof raw.sessionTitle === 'string' ? raw.sessionTitle.slice(0, 200) : null,
    messageIndex:
      Number.isInteger(raw.messageIndex) && raw.messageIndex >= 1 ? raw.messageIndex : null,
    messageSeq:
      Number.isInteger(raw.messageSeq) && raw.messageSeq >= 0 ? raw.messageSeq : null,
    messageRole:
      typeof raw.messageRole === 'string' && ROLES.has(raw.messageRole)
        ? raw.messageRole
        : null,
    messageTime:
      Number.isInteger(raw.messageTime) && raw.messageTime >= 0 ? raw.messageTime : null,
    pinned: raw.pinned === true,
    archived: raw.archived === true,
    createdAt:
      Number.isInteger(raw.createdAt) && raw.createdAt >= 0 ? raw.createdAt : now,
    updatedAt:
      Number.isInteger(raw.updatedAt) && raw.updatedAt >= 0 ? raw.updatedAt : now,
  }
}

export function normalizeNewPlan(input, now) {
  if (!isPlainObject(input)) fail('body', 'request body must be an object')
  const titleRaw =
    input.title === undefined
      ? ''
      : readString(input.title, 'title', LIMITS.NOTE_TITLE_MAX)
  const stages = normalizeStages(input.stages, now, { tolerant: false })
  return {
    id: newPlanId(),
    title: titleRaw.trim() || '未命名计划',
    archived: readBool(input.archived, 'archived', false),
    createdAt: now,
    updatedAt: now,
    stages,
  }
}

export function normalizePlanPatch(existing, patch, now) {
  if (!isPlainObject(patch)) fail('body', 'request body must be an object')
  const next = {
    ...existing,
    stages: existing.stages.map((stage) => ({
      ...stage,
      steps: stage.steps.map((step) => ({ ...step })),
    })),
  }
  if (Object.hasOwn(patch, 'title')) {
    const title = readString(patch.title, 'title', LIMITS.NOTE_TITLE_MAX).trim()
    next.title = title || '未命名计划'
  }
  if (Object.hasOwn(patch, 'archived')) {
    next.archived = readBool(patch.archived, 'archived', existing.archived)
  }
  if (Object.hasOwn(patch, 'stages')) {
    next.stages = normalizeStages(patch.stages, now, { tolerant: false })
  }
  next.updatedAt = now
  return next
}

export function normalizeLoadedPlan(raw, now) {
  if (!isPlainObject(raw)) return null
  let title = typeof raw.title === 'string' ? raw.title.slice(0, LIMITS.NOTE_TITLE_MAX) : ''
  if (title.trim() === '') title = '未命名计划'
  return {
    id: normalizeId(raw.id, PLAN_ID, newPlanId),
    title,
    archived: raw.archived === true,
    createdAt:
      Number.isInteger(raw.createdAt) && raw.createdAt >= 0 ? raw.createdAt : now,
    updatedAt:
      Number.isInteger(raw.updatedAt) && raw.updatedAt >= 0 ? raw.updatedAt : now,
    stages: normalizeStages(raw.stages, now, { tolerant: true }),
  }
}

export function defaultPrefs() {
  return {
    schemaVersion: 1,
    theme: 'auto',
    activeTab: 'notes',
    lastPlanId: null,
    lastNoteId: null,
  }
}

export function normalizePrefs(raw, { tolerant = true } = {}) {
  if (!isPlainObject(raw)) {
    if (tolerant) return defaultPrefs()
    fail('body', 'request body must be an object')
  }
  const pick = (value, field, allowed, fallback) => {
    if (value === undefined) return fallback
    if (typeof value === 'string' && allowed.has(value)) return value
    if (tolerant) return fallback
    return readEnum(value, field, allowed, fallback)
  }
  const pickId = (value, field) => {
    if (value === null || value === undefined) return null
    if (typeof value === 'string' && value.length <= 64) return value
    if (tolerant) return null
    return readNullableString(value, field, 64)
  }
  return {
    schemaVersion: 1,
    theme: pick(raw.theme, 'theme', THEMES, 'auto'),
    activeTab: pick(raw.activeTab, 'activeTab', TABS, 'notes'),
    lastPlanId: pickId(raw.lastPlanId, 'lastPlanId'),
    lastNoteId: pickId(raw.lastNoteId, 'lastNoteId'),
  }
}

export function progressOf(plan) {
  const steps = (plan?.stages ?? []).flatMap((stage) => stage.steps ?? [])
  const done = steps.filter((step) => step.status === 'done').length
  return {
    done,
    total: steps.length,
    percent: steps.length === 0 ? 0 : Math.round((done / steps.length) * 100),
  }
}

export function sortNotes(notes) {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.updatedAt - a.updatedAt || b.createdAt - a.createdAt
  })
}

export function sortPlans(plans) {
  return [...plans].sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt)
}
