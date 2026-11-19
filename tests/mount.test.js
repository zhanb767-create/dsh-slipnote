import test from 'node:test'
import assert from 'node:assert/strict'

import { apply } from '../index.js'
import { mountOnce } from '../src/mount-once.js'
import { makeTempDir, removeTempDir } from './helpers.js'

const MOUNTED = Symbol.for('dsh-slipnote.mounted')

test('mountOnce runs the body exactly once and resets after a throw', () => {
  delete globalThis[MOUNTED]
  let calls = 0
  assert.equal(mountOnce(() => ++calls), 1)
  assert.equal(mountOnce(() => ++calls), undefined)
  assert.equal(calls, 1)

  delete globalThis[MOUNTED]
  assert.throws(() => mountOnce(() => {
    throw new Error('boom')
  }))
  assert.equal(globalThis[MOUNTED], false)
  assert.equal(mountOnce(() => 'again'), 'again')
  delete globalThis[MOUNTED]
})

test('apply registers one route only even if the package is mounted twice', () => {
  delete globalThis[MOUNTED]
  const dir = makeTempDir()
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = dir
  try {
    const routes = []
    const ctx = {
      effect(fn) {
        return fn()
      },
      webServer: {
        register(route) {
          if (routes.some((item) => item.kind === route.kind && item.path === route.path)) {
            throw new Error('duplicate route')
          }
          routes.push(route)
          return () => {
            const index = routes.indexOf(route)
            if (index >= 0) routes.splice(index, 1)
          }
        },
      },
    }
    apply(ctx)
    apply(ctx)
    assert.equal(routes.length, 1)
    assert.equal(routes[0].path, '/api/memo')
    assert.equal(typeof routes[0].handler, 'function')
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    removeTempDir(dir)
    delete globalThis[MOUNTED]
  }
})
