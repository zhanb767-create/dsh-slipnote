import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) out.push(...walk(path))
    else out.push(path)
  }
  return out
}

test('package manifest has no third-party runtime dependencies', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.equal(pkg.name, 'dsh-slipnote')
  assert.equal(pkg.type, 'module')
  assert.equal(pkg.dependencies, undefined)
  assert.deepEqual(Object.keys(pkg.peerDependencies), ['react'])
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.equal(pkg.dsh.client.immediately, true)
  assert.deepEqual(pkg.exports['./client'], './client.js')
})

test('browser artifact uses the ModuleLoader shape and the package id', () => {
  const source = readFileSync(join(root, 'client.js'), 'utf8')
  assert.match(source, /window\.__ModuleLoader__\.load\(/)
  assert.match(source, /id: 'dsh-slipnote'/)
  assert.match(source, /factory\(require\)/)
  assert.match(source, /require\('react'\)/)
  assert.match(source, /name: 'main'/)
  assert.match(source, /name: 'sidebar\.panellist'/)
})

test('no Python files or vendored node_modules are present', () => {
  const files = walk(root)
  assert.equal(files.some((file) => file.endsWith('.py')), false)
  assert.equal(files.some((file) => file.includes('node_modules')), false)
  assert.ok(files.some((file) => file.endsWith('cordis.patch.yml')))
  assert.ok(files.some((file) => file.endsWith('安装.cmd')))
  assert.ok(files.some((file) => file.endsWith('卸载.cmd')))
})
