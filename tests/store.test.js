import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { MemoStore } from '../src/store.js'
import { makeTempDir, removeTempDir } from './helpers.js'

test('notes CRUD persists through an atomic reload', async () => {
  const dir = makeTempDir()
  try {
    const store = new MemoStore({ dir, now: () => 1000 })
    store.load()
    const note = await store.createNote({
      title: '',
      content: '第一行\n第二行',
      tags: [' #Work ', 'work'],
      source: 'manual',
    })
    assert.equal(note.title, '第一行')
    assert.deepEqual(note.tags, ['work'])
    assert.equal(note.createdAt, 1000)
    assert.ok(existsSync(join(dir, 'notes.json')))

    const updated = await store.updateNote(note.id, { pinned: true, content: 'changed' })
    assert.equal(updated.pinned, true)
    assert.equal(updated.content, 'changed')

    const reloaded = new MemoStore({ dir, now: () => 2000 })
    reloaded.load()
    assert.equal(reloaded.notes.length, 1)
    assert.equal(reloaded.getNote(note.id).content, 'changed')
    assert.equal(reloaded.getNote(note.id).pinned, true)

    assert.equal(reloaded.listNotes({ q: 'changed' }).length, 1)
    assert.equal(reloaded.listNotes({ q: 'missing' }).length, 0)

    await reloaded.deleteNote(note.id)
    const third = new MemoStore({ dir, now: () => 3000 })
    third.load()
    assert.equal(third.notes.length, 0)
  } finally {
    removeTempDir(dir)
  }
})

test('plans persist stages, steps, order, status and progress', async () => {
  const dir = makeTempDir()
  try {
    const store = new MemoStore({ dir, now: () => 1000 })
    store.load()
    const plan = await store.createPlan({
      title: 'P',
      stages: [
        {
          title: 'S1',
          steps: [
            { text: 'a', status: 'done' },
            { text: 'b', status: 'doing', note: 'n' },
          ],
        },
        { title: 'S2', steps: [{ text: 'c' }] },
      ],
    })
    assert.equal(plan.stages.length, 2)
    assert.equal(plan.stages[0].steps.length, 2)
    assert.equal(store.progress(plan.id).done, 1)
    assert.equal(store.progress(plan.id).total, 3)

    const reloaded = new MemoStore({ dir, now: () => 2000 })
    reloaded.load()
    const loaded = reloaded.getPlan(plan.id)
    assert.equal(loaded.stages[0].steps[0].status, 'done')
    assert.ok(loaded.stages[0].steps[0].doneAt > 0)
    assert.equal(loaded.stages[1].steps[0].order, 0)
  } finally {
    removeTempDir(dir)
  }
})

test('corrupt JSON is backed up and replaced with an empty collection', () => {
  const dir = makeTempDir()
  try {
    writeFileSync(join(dir, 'notes.json'), '{not json', 'utf8')
    const store = new MemoStore({ dir })
    store.load()
    assert.equal(store.notes.length, 0)
    assert.ok(store.warnings.some((item) => item.includes('notes.json')))
    const backups = readdirSync(join(dir, 'backups'))
    assert.ok(backups.some((item) => item.startsWith('notes.json.corrupt-')))
  } finally {
    removeTempDir(dir)
  }
})

test('a newer schemaVersion is read-only', async () => {
  const dir = makeTempDir()
  try {
    writeFileSync(
      join(dir, 'notes.json'),
      JSON.stringify({ schemaVersion: 2, notes: [] }),
      'utf8',
    )
    const store = new MemoStore({ dir })
    store.load()
    assert.equal(store.storageInfo().readOnly, true)
    await assert.rejects(
      () => store.createNote({ title: 'x', content: 'y' }),
      (error) => error.code === 'SCHEMA_TOO_NEW' && error.status === 409,
    )
  } finally {
    removeTempDir(dir)
  }
})

test('import merge regenerates ids; replace backs up and replaces', async () => {
  const dir = makeTempDir()
  try {
    const store = new MemoStore({ dir, now: () => 1000 })
    store.load()
    const original = await store.createNote({ title: 'original', content: 'x' })
    const payload = {
      schemaVersion: 1,
      notes: [{ id: 'n_same', title: 'imported', content: 'y', tags: ['a'] }],
      plans: [{ title: 'plan', stages: [{ title: 's', steps: [{ text: 't' }] }] }],
    }

    const merged = await store.importData('merge', payload)
    assert.equal(merged.notes, 1)
    assert.equal(store.notes.length, 2)
    assert.notEqual(store.notes[0].id, 'n_same')
    assert.ok(store.getNote(original.id) !== undefined)

    const replaced = await store.importData('replace', payload)
    assert.equal(replaced.plans, 1)
    assert.equal(store.notes.length, 1)
    assert.equal(store.notes[0].title, 'imported')
    assert.ok(existsSync(join(dir, 'backups')))
  } finally {
    removeTempDir(dir)
  }
})

test('JSON and Markdown exports contain both collections', async () => {
  const dir = makeTempDir()
  try {
    const store = new MemoStore({ dir, now: () => 1000 })
    store.load()
    await store.createNote({ title: 'N', content: 'body' })
    await store.createPlan({
      title: 'P',
      stages: [{ title: 'Stage', steps: [{ text: 'Step', status: 'done' }] }],
    })
    const json = store.exportJson()
    assert.equal(json.notes.length, 1)
    assert.equal(json.plans.length, 1)
    const md = store.exportMarkdown()
    assert.match(md, /# DSH 备忘录导出/)
    assert.match(md, /### N/)
    assert.match(md, /- \[x\] Step/)
  } finally {
    removeTempDir(dir)
  }
})
