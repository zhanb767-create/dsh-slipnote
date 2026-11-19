import test from 'node:test'
import assert from 'node:assert/strict'

import {
  LIMITS,
  MemoError,
  normalizeLoadedNote,
  normalizeLoadedPlan,
  normalizeNewNote,
  normalizeNewPlan,
  normalizePrefs,
  normalizeTags,
  progressOf,
  sortNotes,
} from '../src/schema.js'

test('new notes normalize tags, title, and nullable source fields', () => {
  const note = normalizeNewNote(
    {
      title: '',
      content: '  first line\nsecond',
      tags: [' #One ', 'one', 'Two'],
      source: 'snapshot',
      sessionId: 's1',
      sessionTitle: 'Session',
      messageIndex: 3,
      messageSeq: 9,
      messageRole: 'assistant',
      messageTime: 123,
    },
    500,
  )
  assert.equal(note.title, 'first line')
  assert.deepEqual(note.tags, ['one', 'two'])
  assert.equal(note.source, 'snapshot')
  assert.equal(note.messageIndex, 3)
  assert.equal(note.messageSeq, 9)
  assert.equal(note.messageRole, 'assistant')
  assert.equal(note.createdAt, 500)
})

test('tags are lowercased, de-duplicated, and capped', () => {
  assert.deepEqual(normalizeTags(['A', 'a', '#B']), ['a', 'b'])
  assert.equal(
    normalizeTags(Array.from({ length: 25 }, (_, i) => `t${i}`), { tolerant: true }).length,
    LIMITS.NOTE_TAGS_MAX,
  )
  assert.throws(() => normalizeTags('not-an-array'), MemoError)
})

test('loaded plans tolerate an invalid doneAt instead of failing the whole file', () => {
  const plan = normalizeLoadedPlan(
    {
      id: 'p_x',
      title: 'Plan',
      stages: [
        {
          id: 'st_x',
          title: 'Stage',
          steps: [{ id: 'sp_x', text: 'Step', status: 'done', doneAt: 'not-a-number' }],
        },
      ],
    },
    777,
  )
  assert.equal(plan.stages[0].steps[0].status, 'done')
  assert.equal(plan.stages[0].steps[0].doneAt, 777)
})

test('loaded notes tolerate malformed optional fields', () => {
  const note = normalizeLoadedNote(
    {
      id: 'bad id',
      title: '',
      content: 'body',
      tags: ['ok', 3],
      source: 'nope',
      messageIndex: 'x',
      messageRole: 'system',
    },
    100,
  )
  assert.match(note.id, /^n_/)
  assert.equal(note.title, 'body')
  assert.deepEqual(note.tags, ['ok'])
  assert.equal(note.source, 'manual')
  assert.equal(note.messageIndex, null)
  assert.equal(note.messageRole, null)
})

test('plans normalize orders and progress', () => {
  const plan = normalizeNewPlan(
    {
      title: 'P',
      stages: [
        { title: 'B', order: 5, steps: [{ text: 's2', order: 4 }] },
        { title: 'A', order: 1, steps: [{ text: 's1', status: 'done' }] },
      ],
    },
    10,
  )
  assert.equal(plan.stages[0].title, 'A')
  assert.equal(plan.stages[0].order, 0)
  assert.equal(plan.stages[1].steps[0].order, 0)
  assert.deepEqual(progressOf(plan), { total: 2, done: 1, percent: 50 })
})

test('prefs normalize unknown values and notes sort pinned first', () => {
  const prefs = normalizePrefs({ activeTab: 'bogus', theme: 'dark', lastNoteId: 3 }, { tolerant: true })
  assert.equal(prefs.activeTab, 'notes')
  assert.equal(prefs.theme, 'dark')
  assert.equal(prefs.lastNoteId, null)
  const sorted = sortNotes([
    { id: 'a', pinned: false, updatedAt: 2 },
    { id: 'b', pinned: true, updatedAt: 1 },
  ])
  assert.equal(sorted[0].id, 'b')
})

test('notes accept images and image-only content', () => {
  const dataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII='
  const note = normalizeNewNote(
    {
      title: '',
      content: '',
      images: [{ id: 'img_12345678', name: 'shot.png', dataUrl, width: 1, height: 1 }],
    },
    1,
  )
  assert.equal(note.title, '图片备忘录')
  assert.equal(note.images.length, 1)
  assert.equal(note.images[0].mime, 'image/png')
  assert.equal(note.images[0].name, 'shot.png')

  const loaded = normalizeLoadedNote(note, 2)
  assert.equal(loaded.images[0].dataUrl, dataUrl)

  assert.throws(
    () =>
      normalizeNewNote({
        content: 'x',
        images: [{ dataUrl: 'data:text/plain;base64,QQ==' }],
      }),
    /image dataUrl/,
  )
})

test('content limits are enforced', () => {
  assert.throws(
    () => normalizeNewNote({ content: 'x'.repeat(LIMITS.NOTE_CONTENT_MAX + 1) }, 1),
    (error) => error.code === 'VALIDATION',
  )
  assert.throws(
    () => normalizeNewNote({ title: 'x'.repeat(LIMITS.NOTE_TITLE_MAX + 1) }, 1),
    (error) => error.code === 'VALIDATION',
  )
})
