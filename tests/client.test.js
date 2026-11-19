import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const clientPath = fileURLToPath(new URL('../client.js', import.meta.url))

function loadClient() {
  let captured = null
  let uuidCounter = 0
  const store = new Map()
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    crypto: {
      randomUUID: () =>
        `00000000-0000-4000-8000-${String(uuidCounter++).padStart(12, '0')}`,
    },
    localStorage: {
      getItem(key) {
        return store.has(key) ? store.get(key) : null
      },
      setItem(key, value) {
        store.set(key, String(value))
      },
    },
    window: {
      __ModuleLoader__: {
        load(payload) {
          captured = payload
        },
      },
    },
  }
  vm.runInNewContext(readFileSync(clientPath, 'utf8'), sandbox, { filename: clientPath })
  assert.ok(captured, 'ModuleLoader.load must be called')
  const React = {
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children }
    },
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, () => {}]
    },
    useEffect() {},
    useRef(value) {
      return { current: value }
    },
  }
  const client = captured.factory((name) => {
    if (name === 'react') return React
    throw new Error(`unexpected require: ${name}`)
  })
  return { captured, client, React }
}

test('client bundle id, inject list, and slot registration', () => {
  const { captured, client } = loadClient()
  assert.equal(captured.id, 'dsh-slipnote')
  assert.ok(client.inject.includes('slots'))
  assert.ok(client.inject.includes('sessions'))
  assert.ok(client.inject.includes('conversation'))
  assert.ok(client.inject.includes('uiWorkspace'))

  const registrations = []
  const ctx = {
    locale: {
      bind: () => (key) => key,
      register: () => () => {},
    },
    effect(fn) {
      return fn()
    },
    slots: {
      inject(name, callback) {
        return callback()
      },
      register(options, render) {
        registrations.push({ options, render })
        return () => {}
      },
    },
    layout: { selectPanel() {} },
  }
  client.apply(ctx)
  const main = registrations.find((item) => item.options.name === 'main')
  const sidebar = registrations.find((item) => item.options.name === 'sidebar.panellist')
  const action = registrations.find(
    (item) => item.options.name === 'conversation.chat.assistant-actions',
  )
  assert.equal(main.options.key, 'dsh-slipnote')
  assert.equal(sidebar.options.id, 'dsh-slipnote')
  assert.equal(sidebar.options.order, 5)
  assert.equal(action.options.id, 'dsh-slipnote-save')
  assert.equal(action.options.order, 20)
  assert.equal(typeof main.render, 'function')
  assert.equal(typeof sidebar.render, 'function')
  assert.equal(typeof action.render, 'function')

  assert.doesNotThrow(() => main.render({}))
  assert.doesNotThrow(() => sidebar.render({ size: 20, active: true }))
  assert.doesNotThrow(() =>
    action.render({
      memoCtx: ctx,
      messageId: 'm2',
      sessionId: 's1',
      t: (key) => key,
    }),
  )
})

test('NotesTab and PlansTab render empty state without throwing', () => {
  const { client } = loadClient()
  const data = client.__test.emptyData()
  const actions = {
    offline: () => true,
    createNote: async () => ({}),
    updateNote: async () => ({}),
    deleteNote: async () => {},
    createPlan: async () => ({}),
    updatePlan: async () => ({}),
    deletePlan: async () => {},
    importData: async () => {},
  }
  const ctx = { sessions: { list: { getSnapshot: () => ({ byId: {} }) } } }
  const props = {
    ctx,
    t: (key) => key,
    data,
    actions,
    notify() {},
    onError() {},
  }
  assert.doesNotThrow(() => client.__test.NotesTab(props))
  assert.doesNotThrow(() => client.__test.PlansTab(props))
})

test('message extraction counts user/assistant messages and keeps seq', () => {
  const { client } = loadClient()
  const messages = client.__test.messagesFromEntries([
    { type: 'transient', event: { type: 'assistant/chunk' } },
    {
      type: 'event',
      event: {
        type: 'user/message',
        seq: 11,
        time: 100,
        data: { id: 'm1', content: 'hello' },
      },
    },
    {
      type: 'event',
      event: {
        type: 'assistant/message',
        seq: 12,
        time: 101,
        data: { message: { id: 'm2', content: [{ text: 'world' }] } },
      },
    },
  ])
  assert.equal(messages.length, 2)
  assert.equal(messages[0].index, 1)
  assert.equal(messages[1].index, 2)
  assert.equal(messages[1].role, 'assistant')
  assert.equal(messages[1].content, 'world')
  assert.equal(messages[1].seq, 12)
})

test('noteFromMessage keeps snapshot provenance', () => {
  const { client } = loadClient()
  const note = client.__test.noteFromMessage(
    {
      content: '第一行\n第二行',
      index: 4,
      seq: 19,
      role: 'assistant',
      time: 1762500000000,
    },
    's_1',
    '会话标题',
  )
  assert.equal(note.title, '第一行')
  assert.equal(note.content, '第一行\n第二行')
  assert.equal(note.source, 'snapshot')
  assert.equal(note.sessionId, 's_1')
  assert.equal(note.sessionTitle, '会话标题')
  assert.equal(note.messageIndex, 4)
  assert.equal(note.messageSeq, 19)
  assert.equal(note.messageRole, 'assistant')
  assert.equal(note.messageTime, 1762500000000)
})

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII='

test('snapshots keep assistant text and drop reasoning and tool blocks', () => {
  const { client } = loadClient()
  const messages = client.__test.messagesFromEntries([
    {
      type: 'event',
      event: {
        type: 'assistant/message',
        seq: 7,
        time: 9,
        data: {
          message: {
            id: 'm2',
            content: [
              { type: 'reasoning', text: 'hidden reasoning' },
              { type: 'tool-call', id: 'call_1', name: 'bash', arguments: '{}' },
              { type: 'text', text: 'visible answer' },
            ],
          },
        },
      },
    },
  ])
  assert.equal(messages.length, 1)
  assert.equal(messages[0].content, 'visible answer')
  const note = client.__test.noteFromMessage(messages[0], 's1', 'Session')
  assert.equal(note.title, 'visible answer')
  assert.ok(!note.content.includes('hidden reasoning'))
  assert.ok(!note.content.includes('tool-call'))
})

test('titles are short and image-only notes are valid', () => {
  const { client } = loadClient()
  const title = client.__test.titleFromContent(
    ['好的', '以下是这次改动的完整说明，包含背景、实现细节、验证步骤，以及还需要继续处理的事项。'].join(
      String.fromCharCode(10),
    ),
  )
  assert.ok(!title.startsWith('好的'))
  assert.ok(!title.startsWith('以下是'))
  assert.ok(title.length <= 37)
  assert.equal(
    client.__test.titleFromContent('', { hasImages: true, fallback: 'fallback' }),
    '图片备忘录',
  )

  client.__test.resetLocal()
  const note = client.__test.localCreateNote({ title: '', content: '', images: [{ dataUrl: PNG }] })
  assert.equal(note.title, '图片备忘录')
  assert.equal(note.images.length, 1)
  assert.equal(client.__test.noteToDraft(note).images.length, 1)
})

test('client helpers normalize tags and content blocks', () => {
  const { client } = loadClient()
  assert.deepEqual(Array.from(client.__test.parseTags('A, b，c\n#A')), ['a', 'b', 'c'])
  assert.equal(client.__test.contentToText([{ text: 'a' }, { text: 'b' }]), 'a\nb')
  assert.equal(client.__test.firstLine('  x\n y'), 'x')
  assert.equal(client.__test.progressOf({ stages: [{ steps: [{ status: 'done' }, {}] }] }).percent, 50)
})

test('offline updates accept empty stages and imports do not duplicate', () => {
  const { client } = loadClient()
  client.__test.resetLocal()
  const plan = client.__test.localCreatePlan({
    title: 'P',
    stages: [{ title: 'S', steps: [{ text: 'A' }] }],
  })
  const updated = client.__test.localUpdatePlan(plan.id, { stages: [] })
  assert.equal(updated.stages.length, 0)

  const result = client.__test.localImportData('merge', {
    notes: [
      { title: 'n1', content: 'x' },
      { title: 'n2', content: 'y' },
    ],
    plans: [{ title: 'p1', stages: [] }],
  })
  assert.equal(result.notes, 2)
  assert.equal(result.plans, 1)
  const merged = client.__test.localData()
  assert.equal(merged.notes.length, 2)
  assert.equal(merged.plans.length, 2)
  assert.equal(new Set(merged.notes.map((note) => note.id)).size, 2)
  assert.equal(merged.notes.filter((note) => note.title === 'n1').length, 1)
  assert.equal(merged.plans.find((row) => row.title === 'p1').stages.length, 0)

  client.__test.localImportData('replace', {
    notes: [{ title: 'only', content: 'z' }],
    plans: [],
  })
  const replaced = client.__test.localData()
  assert.equal(replaced.notes.length, 1)
  assert.equal(replaced.notes[0].title, 'only')
  assert.equal(replaced.plans.length, 0)
})
