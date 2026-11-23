import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { modelFiles, packageModelJson } from '../src/index'
import { leavesPackage } from '../src/zip'

test('portable files preserve the original manifest, licenses and all declared folder resources', async (t) => {
  const raw = JSON.parse(await readFile(new URL('./fixtures/example-k01.model.json', import.meta.url), 'utf8'))
  raw.files = { avatar: 'avatar.webp', keyforms: 'keyforms.json' }
  const manifest = JSON.stringify(raw), requested: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: URL) => {
    requested.push(url.href)
    return new Response(url.pathname.endsWith('model.json') ? manifest : url.pathname.endsWith('keyforms.json') ? '{}' : 'original texture', { headers: { 'content-type': url.pathname.endsWith('.json') ? 'application/json' : 'image/webp' } })
  })
  const files = await modelFiles('https://model.test/character/?access=fixture')
  assert.equal(await files.get('model.json')!.text(), manifest)
  assert.ok(files.has(raw.layers[0].texture)); assert.ok(files.has('keyforms.json')); assert.ok(files.has('avatar.webp'))
  assert.ok(requested.every((u) => new URL(u).searchParams.get('access') === 'fixture'))
  assert.ok(requested.every((u) => new URL(u).pathname.startsWith('/character/')))
  const copy = await modelFiles(files)
  assert.deepEqual([...copy.keys()], [...files.keys()])
})

test('portable source reads reject missing remote resources and unsafe paths instead of saving an incomplete model', async (t) => {
  const raw = await readFile(new URL('./fixtures/example-k01.model.json', import.meta.url), 'utf8')
  t.mock.method(globalThis, 'fetch', async (url: URL) => new Response(url.pathname.endsWith('model.json') ? raw : 'missing', { status: url.pathname.endsWith('model.json') ? 200 : 404 }))
  await assert.rejects(modelFiles('https://model.test/character/'), { name: 'LivLivError', code: 'http', status: 404, message: /could not load \/character\/\S+ \(HTTP 404\)/ })
  await assert.rejects(modelFiles(new Map([['../model.json', new Blob(['{}'])]])), /outside/)
  t.mock.method(globalThis, 'fetch', async () => new Response('{"format": "something-else"}'))
  await assert.rejects(modelFiles('https://model.test/character/'), { name: 'LivLivError', code: 'not-a-model' })
  t.mock.method(globalThis, 'fetch', async () => new Response('not json'))
  await assert.rejects(modelFiles('https://model.test/character/'), { name: 'LivLivError', code: 'not-a-model' })
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch') })
  await assert.rejects(modelFiles('https://model.test/character/'), { name: 'LivLivError', code: 'unreachable' })
  const stopped = new AbortController(); stopped.abort()
  await assert.rejects(modelFiles('https://model.test/character/', { signal: stopped.signal }), { name: 'AbortError' })
})


test('opaque extension fields are preserved without fetching them and encoded paths cannot leave the model folder', async (t) => {
  const raw = JSON.parse(await readFile(new URL('./fixtures/example-k01.model.json', import.meta.url), 'utf8'))
  raw.files = { 'x-backup': '%2e%2e/api/private' }
  const requested: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: URL) => { requested.push(url.href); return new Response(url.pathname.endsWith('model.json') ? JSON.stringify(raw) : 'texture') })
  const files = await modelFiles('https://model.test/character/')
  assert.equal(JSON.parse(await files.get('model.json')!.text()).files['x-backup'], '%2e%2e/api/private')
  assert.ok(requested.every((u) => new URL(u).pathname.startsWith('/character/')))
  raw.files = { avatar: '%2e%2e/private.webp' }; requested.length = 0
  await assert.rejects(modelFiles('https://model.test/character/'))
  assert.ok(requested.every((u) => new URL(u).pathname.startsWith('/character/')))
  raw.files = { avatar: 'folder%2f..%2f..%2fprivate.webp' }; requested.length = 0
  await assert.rejects(modelFiles('https://model.test/character/'))
  assert.ok(requested.every((u) => new URL(u).pathname.startsWith('/character/')))
})


test('cancelling local package reads rejects with the original abort reason', async () => {
  const end = new Uint8Array(22); new DataView(end.buffer).setUint32(0, 0x06054b50, true)
  const blob = new Blob([end])
  for (const source of [blob, new Map([['model.livliv', blob]])]) {
    const controller = new AbortController(), reason = new DOMException('Export cancelled', 'AbortError')
    const pending = modelFiles(source, { signal: controller.signal }); controller.abort(reason)
    await assert.rejects(pending, (error) => error === reason)
  }
})

test('modelFiles takes names with # and ?, and refuses what leaves the package, control characters and ":"', async () => {
  const blob = new Blob(['x'])
  const ok = ['textures/a#b.webp', 'x?.png', './model.json', 'folder\\inner\\file.png', 'a..b/c.webp', '.hidden', 'notes v2 (final).txt']
  const got = await modelFiles(new Map(ok.map((k) => [k, blob])))
  assert.deepEqual([...got.keys()], ['textures/a#b.webp', 'x?.png', 'model.json', 'folder/inner/file.png', 'a..b/c.webp', '.hidden', 'notes v2 (final).txt'])
  for (const bad of ['../model.json', '/etc/x', 'C:/x.png', 'c:x', 'a/./b', 'a/../b', 'a/..', '']) {
    await assert.rejects(modelFiles(new Map([[bad, blob]])), { name: 'LivLivError', code: 'invalid', message: /outside its package/ }, JSON.stringify(bad))
    if (bad) assert.equal(leavesPackage(bad.replace(/^(\.\/)+/, '')), true, bad)
  }
  for (const bad of ['tex.webp:stream', 'notes: v2.txt', 'a\u0000b.png', 'tab\there.png', 'line\nbreak', 'x\u001f', 'del\u007f.png']) {
    await assert.rejects(modelFiles(new Map([[bad, blob]])), { name: 'LivLivError', code: 'invalid', message: /cannot safely have/ }, JSON.stringify(bad))
    assert.equal(leavesPackage(bad), false, `${JSON.stringify(bad)}: a package may hold it, and load() reads one that does`)
  }
})

test('the package\'s own model.json: the shortest, the first of those as long, as load() picks it', () => {
  assert.equal(packageModelJson(['a/b/model.json', 'x/model.json', 'textures/a.webp']), 'x/model.json')
  assert.equal(packageModelJson(['b/model.json', 'a/model.json']), 'b/model.json')
  assert.equal(packageModelJson(new Set(['deep/er/model.json', 'model.json'])), 'model.json')
  assert.equal(packageModelJson(['models.json', 'amodel.json', 'textures/x.png']), undefined)
  assert.equal(packageModelJson([]), undefined)
})
