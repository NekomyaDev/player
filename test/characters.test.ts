// The featured characters in characters/: each one a v4 package as LivLiv writes it, complete (every image and file it
// names is there, as the player asks for them), under their licence, carrying the LivLiv mark, its expressions
// named in every language livliv.ai speaks. Skipped where there are none (this repository's own copy).
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { FORMAT, FORMAT_VERSION, readModel } from '../src/runtime/format'

const root = fileURLToPath(new URL('../characters/', import.meta.url))
const ids = existsSync(root) ? readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory()).sort() : []
const LANGS = ['en', 'zh', 'zh-Hant', 'ja']

describe('featured characters', { skip: !ids.length && 'no characters/ here' }, () => {
  it('come with their licence, and a list of them all', () => {
    assert.ok(existsSync(join(root, 'LICENSE.md')))
    assert.ok(existsSync(join(root, 'CREDITS.md')))
    const list = JSON.parse(readFileSync(join(root, 'index.json'), 'utf8')) as { id: string; name: string }[]
    assert.deepEqual(list.map((c) => c.id), ids)
    for (const c of list) assert.equal(c.name, JSON.parse(readFileSync(join(root, c.id, 'model.json'), 'utf8')).name)
  })

  for (const id of ids) {
    it(id, () => {
      const dir = join(root, id)
      const raw = JSON.parse(readFileSync(join(dir, 'model.json'), 'utf8'))
      assert.equal(raw.format, FORMAT)
      assert.ok(raw.version <= FORMAT_VERSION)
      assert.deepEqual(raw.requires ?? [], [])
      assert.equal(raw.meta?.license?.id, { p01: 'CC-BY-NC-SA-4.0', p02: 'CC-BY-NC-SA-4.0', p03: 'LicenseRef-Third-Party-Character' }[id] ?? 'LicenseRef-LivLiv-Samples')
      assert.equal(raw.meta?.watermark?.kind, 'livliv')  // the LivLiv logo, in the corner only
      assert.equal(raw.meta?.watermark?.center, false)
      for (const e of raw.expressions || []) assert.deepEqual(LANGS.filter((l) => !e.label?.[l]), [], `${e.id}'s names`)
      for (const f of Object.values(raw.files || {}) as string[]) assert.ok(existsSync(join(dir, f)), f)
      assert.equal(raw.rig?.body?.bust ?? 0, 0, 'no chest spring, for players that still read it')
      // the cover a page shows first: a WebP with alpha (VP8X), 512 x 768, small enough to come well before the package
      const cover = readFileSync(join(dir, 'cover.webp'))
      assert.equal(cover.toString('latin1', 8, 16), 'WEBPVP8X')
      assert.deepEqual([cover.readUIntLE(24, 3) + 1, cover.readUIntLE(27, 3) + 1], [512, 768])
      assert.ok(cover.length < 120_000, `${cover.length} bytes`)
      if (existsSync(join(root, `${id}.livliv`))) assert.ok(!readFileSync(join(root, `${id}.livliv`)).includes('cover.webp'), 'the package has no cover')
      // as the player reads it: every image it will ask for is there, each expression has its layer
      const m = readModel(raw, 'en')
      assert.ok(m.name)
      assert.equal(m.watermark, 'LivLiv')
      const missing: string[] = []
      for (const L of m.layers) {
        for (const p of [L.texture, ...(L.frames || []), L.mask, L.talk, L.brow_tex]) {
          if (!p) continue
          const f = L.webp ? p.replace(/\.png$/, '.webp') : p
          if (!existsSync(join(dir, f))) missing.push(f)
        }
      }
      assert.deepEqual(missing, [])
      const params = new Set(m.layers.map((L) => L.param).filter(Boolean))
      for (const e of m.expressions || []) assert.ok(e.id === 'smile' || params.has(e.id), `expression ${e.id}`)
    })
  }
})
