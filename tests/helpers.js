import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

export function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'dsh-slipnote-test-'))
}

export function removeTempDir(dir) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    /* best effort */
  }
}

export function makeRequest({
  method = 'GET',
  url = '/api/memo/bootstrap',
  body = '',
  headers = {},
  remoteAddress = '127.0.0.1',
} = {}) {
  const req = Readable.from(body === '' ? [] : [Buffer.from(body, 'utf8')])
  req.method = method
  req.url = url
  req.headers = headers
  req.socket = { remoteAddress }
  return req
}

export function makeResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    chunks: [],
    writableEnded: false,
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value
    },
    end(chunk) {
      if (chunk !== undefined) this.chunks.push(Buffer.from(chunk))
      this.writableEnded = true
    },
  }
  return res
}

export function jsonBody(res) {
  return JSON.parse(Buffer.concat(res.chunks).toString('utf8'))
}
