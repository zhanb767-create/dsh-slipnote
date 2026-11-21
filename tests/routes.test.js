import test from 'node:test'
import assert from 'node:assert/strict'

import { handleMemoRequest, createMemoRoute, MAX_BODY_BYTES } from '../src/routes.js'
import { MemoStore } from '../src/store.js'
import { jsonBody, makeRequest, makeResponse, makeTempDir, removeTempDir } from './helpers.js'

const allowRequest = () => undefined

async function call(store, options, requestRejection = allowRequest) {
  const res = makeResponse()
  await handleMemoRequest(store, makeRequest(options), res, { requestRejection })
  return { res, body: jsonBody(res) }
}

test('route is a prefix route under /api/memo and is not /api/notes', () => {
  const route = createMemoRoute({})
  assert.equal(route.kind, 'prefix')
  assert.equal(route.path, '/api/memo')
  assert.notEqual(route.path, '/api/notes')
})

test('CRUD, search, export, prefs, and bootstrap work over the API', async () => {
  const dir = makeTempDir()
  try {
    const store = new MemoStore({ dir, now: () => 1000 })
    store.load()

    const bootstrap = await call(store, { url: '/api/memo/bootstrap' })
    assert.equal(bootstrap.res.statusCode, 200)
    assert.equal(bootstrap.body.ok, true)
    assert.deepEqual(bootstrap.body.data.notes, [])

    const created = await call(store, {
      method: 'POST',
      url: '/api/memo/notes',
      body: JSON.stringify({ title: 'Hello', content: 'World', tags: ['x'] }),
    })
    assert.equal(created.res.statusCode, 201)
    assert.equal(created.body.data.note.title, 'Hello')
    const noteId = created.body.data.note.id

    const listed = await call(store, { url: '/api/memo/notes?q=hello' })
    assert.equal(listed.body.data.notes.length, 1)

    const patched = await call(store, {
      method: 'PATCH',
      url: `/api/memo/notes/${noteId}`,
      body: JSON.stringify({ pinned: true }),
    })
    assert.equal(patched.body.data.note.pinned, true)

    const fetched = await call(store, { url: `/api/memo/notes/${noteId}` })
    assert.equal(fetched.body.data.note.id, noteId)

    const prefs = await call(store, {
      method: 'PUT',
      url: '/api/memo/prefs',
      body: JSON.stringify({ activeTab: 'plans' }),
    })
    assert.equal(prefs.body.data.prefs.activeTab, 'plans')

    const exported = await call(store, { url: '/api/memo/export?format=md' })
    assert.equal(exported.body.data.format, 'md')
    assert.match(exported.body.data.content, /Hello/)

    const plan = await call(store, {
      method: 'POST',
      url: '/api/memo/plans',
      body: JSON.stringify({
        title: 'Plan',
        stages: [{ title: 'S', steps: [{ text: 'A', status: 'done' }] }],
      }),
    })
    assert.equal(plan.res.statusCode, 201)
    assert.equal(plan.body.data.plan.stages.length, 1)

    const imported = await call(store, {
      method: 'POST',
      url: '/api/memo/import',
      body: JSON.stringify({
        mode: 'merge',
        data: {
          schemaVersion: 1,
          notes: [{ title: 'Imported', content: 'x' }],
          plans: [],
        },
      }),
    })
    assert.equal(imported.res.statusCode, 200)
    assert.equal(imported.body.data.imported.notes, 1)

    const removed = await call(store, {
      method: 'DELETE',
      url: `/api/memo/notes/${noteId}`,
    })
    assert.equal(removed.body.data.deleted, true)
  } finally {
    removeTempDir(dir)
  }
})

test('non-loopback requests are forbidden', async () => {
  const dir = makeTempDir()
  try {
    const store = new MemoStore({ dir })
    store.load()
    const { res, body } = await call(store, {
      remoteAddress: '10.1.2.3',
      url: '/api/memo/bootstrap',
    })
    assert.equal(res.statusCode, 403)
    assert.equal(body.error.code, 'FORBIDDEN')
  } finally {
    removeTempDir(dir)
  }
})

test('DSH connection gate refuses unauthenticated, untrusted, and throwing callers', async () => {
  const dir = makeTempDir()
  try {
    const store = new MemoStore({ dir })
    store.load()
    let seen
    const unauthorized = await call(store, { url: '/api/memo/bootstrap' }, (request) => {
      seen = request
      return 401
    })
    assert.equal(seen.url, '/api/memo/bootstrap')
    assert.equal(unauthorized.res.statusCode, 401)
    assert.equal(unauthorized.body.error.code, 'UNAUTHORIZED')

    const forbidden = await call(store, { url: '/api/memo/bootstrap' }, () => 403)
    assert.equal(forbidden.res.statusCode, 403)
    assert.equal(forbidden.body.error.code, 'FORBIDDEN')

    const throwing = await call(store, { url: '/api/memo/bootstrap' }, () => {
      throw new Error('gate bug')
    })
    assert.equal(throwing.res.statusCode, 403)

    const missing = await call(store, { url: '/api/memo/bootstrap' }, null)
    assert.equal(missing.res.statusCode, 503)
    assert.equal(missing.body.error.code, 'GATE_UNAVAILABLE')
  } finally {
    removeTempDir(dir)
  }
})

test('image-only notes round-trip through the API and Markdown export', async () => {
  const dir = makeTempDir()
  try {
    const store = new MemoStore({ dir })
    store.load()
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII='
    const created = await call(store, {
      method: 'POST',
      url: '/api/memo/notes',
      body: JSON.stringify({
        title: '',
        content: '',
        images: [{ name: 'shot.png', dataUrl, width: 1, height: 1 }],
      }),
    })
    assert.equal(created.res.statusCode, 201)
    assert.equal(created.body.data.note.title, '图片备忘录')
    assert.equal(created.body.data.note.images.length, 1)

    const reloaded = new MemoStore({ dir })
    reloaded.load()
    assert.equal(reloaded.getNote(created.body.data.note.id).images[0].mime, 'image/png')

    const md = await call(store, { url: '/api/memo/export?format=md' })
    assert.match(md.body.data.content, /!\[shot\.png\]\(data:image\/png;base64,/)
  } finally {
    removeTempDir(dir)
  }
})

test('method, body, and route errors use status codes and Allow headers', async () => {
  const dir = makeTempDir()
  try {
    const store = new MemoStore({ dir })
    store.load()

    const wrongMethod = await call(store, { method: 'PUT', url: '/api/memo/notes' })
    assert.equal(wrongMethod.res.statusCode, 405)
    assert.equal(wrongMethod.res.headers.allow, 'GET, POST')

    const missing = await call(store, { url: '/api/memo/nope' })
    assert.equal(missing.res.statusCode, 404)

    const badJson = await call(store, {
      method: 'POST',
      url: '/api/memo/notes',
      body: '{oops',
    })
    assert.equal(badJson.res.statusCode, 400)
    assert.equal(badJson.body.error.code, 'BAD_JSON')

    const empty = await call(store, { method: 'POST', url: '/api/memo/notes' })
    assert.equal(empty.res.statusCode, 400)
    assert.equal(empty.body.error.code, 'EMPTY_BODY')

    const tooBig = await call(store, {
      method: 'POST',
      url: '/api/memo/notes',
      headers: { 'content-length': String(MAX_BODY_BYTES + 1) },
    })
    assert.equal(tooBig.res.statusCode, 413)

    const badFormat = await call(store, { url: '/api/memo/export?format=xml' })
    assert.equal(badFormat.res.statusCode, 400)
  } finally {
    removeTempDir(dir)
  }
})
