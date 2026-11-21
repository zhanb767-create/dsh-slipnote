import { isLoopbackRequest } from './loopback.js'
import { MemoError } from './schema.js'

export const MEMO_API_PREFIX = '/api/memo'
export const MAX_BODY_BYTES = 24 * 1024 * 1024

class HttpError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

function sendJson(res, status, payload, extraHeaders) {
  if (res.writableEnded) return
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value)
  }
  res.end(JSON.stringify(payload))
}

function sendData(res, data, status = 200) {
  sendJson(res, status, { ok: true, data })
}

function fail(res, status, code, message, details) {
  const error = { code, message }
  if (details !== undefined) error.details = details
  sendJson(res, status, { ok: false, error })
}

function methodNotAllowed(res, allowed) {
  sendJson(
    res,
    405,
    { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } },
    { Allow: allowed.join(', ') },
  )
}

/**
 * Ask DSH's Connection service whether this request may reach a route that is
 * not part of the host's own /api surface. The service applies the Host/Origin
 * fence and the browser login together, so a page on another origin and a
 * browser without a DSH session are both stopped here. A missing gate or a
 * gate that throws fails closed: this route is not allowed to become the one
 * unguarded way into the on-disk notes.
 */
function rejectUnadmitted(requestRejection, req, res) {
  if (typeof requestRejection !== 'function') {
    fail(res, 503, 'GATE_UNAVAILABLE', 'DSH connection gate is unavailable.')
    return true
  }
  let status
  try {
    status = requestRejection(req)
  } catch {
    status = 403
  }
  if (status === undefined) return false
  if (status === 401) {
    fail(res, 401, 'UNAUTHORIZED', '请先登录 DSH：重新打开 DSH 启动时打印的网址。')
    return true
  }
  fail(res, 403, 'FORBIDDEN', '请求来自不受信任的来源，已被拒绝。')
  return true
}

function readBody(req) {
  const declared = Number(req.headers?.['content-length'] ?? 0)
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    req.resume()
    return Promise.reject(new HttpError(413, 'BODY_TOO_LARGE', 'Request body is too large.'))
  }
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let settled = false
    const settle = (fn, value) => {
      if (settled) return
      settled = true
      fn(value)
    }
    req.on('data', (chunk) => {
      if (settled) return
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        settle(reject, new HttpError(413, 'BODY_TOO_LARGE', 'Request body is too large.'))
        req.removeAllListeners('data')
        req.resume()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => settle(resolve, Buffer.concat(chunks).toString('utf8')))
    req.on('error', (error) => settle(reject, error))
  })
}

async function readJson(req) {
  const text = await readBody(req)
  if (text.trim() === '') throw new HttpError(400, 'EMPTY_BODY', 'Request body is empty.')
  let value
  try {
    value = JSON.parse(text)
  } catch {
    throw new HttpError(400, 'BAD_JSON', 'Request body is not valid JSON.')
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'BAD_JSON', 'Request body must be a JSON object.')
  }
  return value
}

function includeArchived(url) {
  const value = url.searchParams.get('includeArchived')
  return value === '1' || value === 'true'
}

function decodeId(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    throw new HttpError(400, 'BAD_URL', 'Invalid path encoding.')
  }
}

function exportFileName(format, now) {
  const date = new Date(now).toISOString().slice(0, 10)
  return `dsh-slipnote-${date}.${format === 'md' ? 'md' : 'json'}`
}

async function dispatch(store, method, segments, url, req, res, now) {
  if (segments.length === 0) {
    if (method !== 'GET') return methodNotAllowed(res, ['GET'])
    return sendData(res, store.bootstrap())
  }

  const [head, idPart, ...tail] = segments
  const id = idPart === undefined ? undefined : decodeId(idPart)

  if (head === 'bootstrap') {
    if (segments.length !== 1) return fail(res, 404, 'NOT_FOUND', 'Unknown route.')
    if (method !== 'GET') return methodNotAllowed(res, ['GET'])
    return sendData(res, store.bootstrap())
  }

  if (head === 'notes') {
    if (segments.length === 1) {
      if (method === 'GET') {
        return sendData(res, {
          notes: store.listNotes({
            q: url.searchParams.get('q') ?? '',
            tag: url.searchParams.get('tag') ?? '',
            includeArchived: includeArchived(url),
          }),
        })
      }
      if (method === 'POST') {
        const note = await store.createNote(await readJson(req))
        return sendData(res, { note }, 201)
      }
      return methodNotAllowed(res, ['GET', 'POST'])
    }
    if (segments.length !== 2) return fail(res, 404, 'NOT_FOUND', 'Unknown route.')
    if (method === 'GET') {
      const note = store.getNote(id)
      if (!note) return fail(res, 404, 'NOTE_NOT_FOUND', '备忘录不存在。')
      return sendData(res, { note })
    }
    if (method === 'PATCH') {
      const note = await store.updateNote(id, await readJson(req))
      return sendData(res, { note })
    }
    if (method === 'DELETE') {
      await store.deleteNote(id)
      return sendData(res, { deleted: true, id })
    }
    return methodNotAllowed(res, ['GET', 'PATCH', 'DELETE'])
  }

  if (head === 'plans') {
    if (segments.length === 1) {
      if (method === 'GET') {
        return sendData(res, {
          plans: store.listPlans({ includeArchived: includeArchived(url) }),
        })
      }
      if (method === 'POST') {
        const plan = await store.createPlan(await readJson(req))
        return sendData(res, { plan }, 201)
      }
      return methodNotAllowed(res, ['GET', 'POST'])
    }
    if (segments.length !== 2) return fail(res, 404, 'NOT_FOUND', 'Unknown route.')
    if (method === 'GET') {
      const plan = store.getPlan(id)
      if (!plan) return fail(res, 404, 'PLAN_NOT_FOUND', '计划不存在。')
      return sendData(res, { plan })
    }
    if (method === 'PATCH') {
      const plan = await store.updatePlan(id, await readJson(req))
      return sendData(res, { plan })
    }
    if (method === 'DELETE') {
      await store.deletePlan(id)
      return sendData(res, { deleted: true, id })
    }
    return methodNotAllowed(res, ['GET', 'PATCH', 'DELETE'])
  }

  if (head === 'prefs') {
    if (segments.length !== 1) return fail(res, 404, 'NOT_FOUND', 'Unknown route.')
    if (method === 'GET') return sendData(res, { prefs: store.getPrefs() })
    if (method === 'PUT') {
      const prefs = await store.updatePrefs(await readJson(req))
      return sendData(res, { prefs })
    }
    return methodNotAllowed(res, ['GET', 'PUT'])
  }

  if (head === 'export') {
    if (segments.length !== 1) return fail(res, 404, 'NOT_FOUND', 'Unknown route.')
    if (method !== 'GET') return methodNotAllowed(res, ['GET'])
    const format = url.searchParams.get('format') ?? 'json'
    if (format !== 'json' && format !== 'md') {
      return fail(res, 400, 'BAD_FORMAT', 'format 必须是 json 或 md。')
    }
    const content = format === 'md' ? store.exportMarkdown() : JSON.stringify(store.exportJson(), null, 2)
    return sendData(res, {
      format,
      filename: exportFileName(format, now()),
      content,
    })
  }

  if (head === 'import') {
    if (segments.length !== 1) return fail(res, 404, 'NOT_FOUND', 'Unknown route.')
    if (method !== 'POST') return methodNotAllowed(res, ['POST'])
    const body = await readJson(req)
    const mode = body.mode ?? 'merge'
    const data = body.data ?? body
    const imported = await store.importData(mode, data)
    return sendData(res, { imported })
  }

  if (tail.length >= 0) return fail(res, 404, 'NOT_FOUND', 'Unknown route.')
}

export async function handleMemoRequest(store, req, res, { requestRejection } = {}) {
  if (rejectUnadmitted(requestRejection, req, res)) return

  if (!isLoopbackRequest(req)) {
    return fail(res, 403, 'FORBIDDEN', 'Only loopback requests are allowed.')
  }

  let url
  try {
    url = new URL(req.url ?? '/', 'http://127.0.0.1')
  } catch {
    return fail(res, 400, 'BAD_URL', 'Request URL is invalid.')
  }
  if (
    url.pathname !== MEMO_API_PREFIX &&
    !url.pathname.startsWith(`${MEMO_API_PREFIX}/`)
  ) {
    return fail(res, 404, 'NOT_FOUND', 'Unknown route.')
  }
  const rest = url.pathname
    .slice(MEMO_API_PREFIX.length)
    .replace(/^\/+|\/+$/g, '')
  const segments = rest === '' ? [] : rest.split('/').filter(Boolean)
  const method = (req.method ?? 'GET').toUpperCase()

  try {
    await dispatch(store, method, segments, url, req, res, () => Date.now())
  } catch (error) {
    if (error instanceof MemoError) {
      return fail(res, error.status, error.code, error.message, error.details)
    }
    if (error instanceof HttpError) {
      return fail(res, error.status, error.code, error.message)
    }
    console.error('[dsh-slipnote] request failed:', error)
    return fail(res, 500, 'INTERNAL', error?.message ?? 'Internal error.')
  }
}

export function createMemoRoute(store, options = {}) {
  return {
    kind: 'prefix',
    path: MEMO_API_PREFIX,
    handler: (req, res) => handleMemoRequest(store, req, res, options),
  }
}
