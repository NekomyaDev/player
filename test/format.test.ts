// format.ts: v3 read as it is, v4 lowered to the runtime's ModelDef, the refusals.
//   node --test web/sdk/test/        (Node 23.6+ runs the TypeScript as it is)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { FEATURES, FORMAT, FORMAT_VERSION, langOf, pickLabel, readModel } from '../src/runtime/format.ts'

const example = () => JSON.parse(readFileSync(new URL('./fixtures/example-k01.model.json', import.meta.url), 'utf8'))
const v3 = () => ({
  format: 'livemaker-puppet', version: 3, name: 'T', canvas: [64, 64],
  anchors: { head: { cx: 32, cy: 20, rx: 12, ry: 14 }, face: [20, 8, 44, 34], neck_y: 34, top_y: 0, bottom_y: 63, hair_root_y: 6 },
  layers: [{ id: 'body', name: '体 Body', texture: 'textures/body.png', webp: true, x: 0, y: 0, w: 64, h: 64, group: 'body', depth: 0 }],
  expressions: [{ id: 'x_expr_03637e', label: '害羞', key: '2', instruction: 'shy' }],
})

test('the constants', () => {
  assert.equal(FORMAT, 'livliv-model')
  assert.equal(FORMAT_VERSION, 4)
  assert.deepEqual(FEATURES, [])
})

test('v3 is read as it is: the same object, untouched', () => {
  const m = v3(), before = JSON.stringify(m)
  assert.equal(readModel(m), m)
  assert.equal(JSON.stringify(m), before)
  const old = v3() as Record<string, unknown>
  delete old.format; delete old.version  // the earliest builds wrote neither
  assert.equal(readModel(old), old)
  assert.throws(() => readModel({ ...v3(), version: 4 }), /never existed/)
})

test('refusals', () => {
  assert.throws(() => readModel(null), /not a LivLiv model/)
  assert.throws(() => readModel([]), /not a LivLiv model/)
  assert.throws(() => readModel({ ...example(), format: 'vrm' }), /not a LivLiv model \(format "vrm"\)/)
  assert.throws(() => readModel({ ...example(), version: 5 }), /version 5; this player reads up to 4: update the player/)
  assert.throws(() => readModel({ ...example(), requires: ['mesh-warp', 'x'] }), /needs mesh-warp, x, which this player does not have/)
  const m = example()
  m.layers[0].texture = 'textures/../../secret.webp'
  assert.throws(() => readModel(m), /not an image path/)
  const u = example()
  u.layers[1].frames = ['https://example.com/a.webp']
  assert.throws(() => readModel(u), /not an image path/)
  assert.throws(() => readModel({ ...example(), files: { keyforms: '../keyforms.json' } }), /files.keyforms/)
  assert.throws(() => readModel({ ...example(), canvas: [9000, 100] }), /canvas 9000 x 100 is out of range/)
  const many = example()
  many.layers = Array.from({ length: 513 }, (_, i) => ({ ...many.layers[0], id: `l${i}` }))
  assert.throws(() => readModel(many), /513 layers/)
  assert.throws(() => readModel({ ...example(), layers: [] }), /no layers/)
})

test('a full-body character waits for a later version; a half-body one is never taken for one', () => {
  // as livliv.ai writes a full-body build: the body's points [x, y, confidence], its ground line, the frame it is drawn by
  const body = { hip_l: [600, 1700, 0.9], hip_r: [900, 1700, 0.9], ankle_l: [620, 2900, 0.9], ankle_r: [880, 2900, 0.9], ground_y: 2990 }
  const tall = example()
  tall.canvas = [1536, 3072]; tall.anchors.body = body; tall.anchors.frame = [0, 0, 1536, 1536]
  for (const m of [tall, { ...v3(), anchors: { ...v3().anchors, body } }]) {
    assert.throws(() => readModel(m), (e: Error & { code?: string }) => e.code === 'missing-feature' && /full-body characters arrive in a later version/.test(e.message))
  }
  // a half-body build has no anchors.body (the featured characters, all half-body, are read in characters.test.ts)
  const half = example()
  assert.equal(half.anchors.body, undefined)
  assert.doesNotThrow(() => readModel(half))
  half.anchors.body = null
  assert.doesNotThrow(() => readModel(half))
})

test('v4 lowered to the runtime\'s shape', () => {
  const src = example(), m = readModel(src, 'en')
  assert.notEqual(m, src)
  assert.equal(readModel(m), m)  // read again: as it is
  assert.equal(m.format, 'livliv-model'); assert.equal(m.version, 4); assert.equal(m.name, 'Sena')
  assert.deepEqual(m.canvas, [1024, 1536])
  assert.equal(m.layers.length, src.layers.length)
  const shy = m.layers.find((l) => l.id === 'expr_shy')!
  assert.equal(shy.param, 'shy')                 // v4 `expression` is the runtime's `param`
  assert.equal(shy.name, 'expr_shy')             // no label: the id
  assert.equal(shy.texture, 'textures/expr_shy.webp')
  assert.equal(shy.webp, undefined)              // the path is the file: nothing rewrites .png to .webp
  assert.equal(m.layers.find((l) => l.id === 'body')!.param, undefined)
  assert.deepEqual(m.profile, { id: 'anime_half', label: '', class: { input: { facing: 'front', glasses: undefined } } })
  assert.equal(m.watermark, 'LivLiv')
  assert.equal(m.meta!.license!.id, src.meta.license.id)
  assert.equal(m.keyforms, undefined)
  assert.deepEqual(m.expressions!.map((e) => [e.id, e.label, e.key]), [['smile', 'Smile', '1'], ['shy', 'Shy', '2'], ['angry', 'Angry', '3'], ['sad', 'Sad', '4']])
  assert.equal(m.expressions![1].labels!.ja, '照れ')
  assert.deepEqual(m.rig, src.rig); assert.deepEqual(m.anchors, src.anchors)
})

test('v4 fields that move', () => {
  const src = example()
  src.tuning = { turn: 0.8, hair_front: 0.3, hair_back: 1.2 }
  src.files = { keyforms: 'keyforms.json', avatar: 'avatar.webp', 'x-thing': 1 }
  src.meta.watermark = { kind: 'text', text: '© Mira' }
  src.layers[0].label = { en: 'Back hair', ja: '後ろ髪' }
  src.profile = { id: 'chibi', facing: 'front', glasses: true }
  const m = readModel(src)
  assert.deepEqual(m.tuning, { turn: 0.8, hairFront: 0.3, hairBack: 1.2 })
  assert.equal(m.keyforms, 'keyforms.json')
  assert.equal(m.watermark, '© Mira')
  assert.equal(m.layers[0].name, 'Back hair')
  assert.deepEqual(m.profile!.class, { input: { facing: 'front', glasses: true } })
  src.meta.watermark = { kind: 'none' }
  assert.equal(readModel(src).watermark, null)
  delete src.meta.watermark
  assert.equal(readModel(src).watermark, null)
})

test('labels by language', () => {
  const L = { zh: '生气', 'zh-Hant': '生氣', en: 'Angry', ja: '怒り' }
  assert.equal(pickLabel(L, 'ja-JP', 'angry'), '怒り')
  assert.equal(pickLabel(L, 'zh-TW', 'angry'), '生氣')
  assert.equal(pickLabel(L, 'zh-Hant-HK', 'angry'), '生氣')
  assert.equal(pickLabel(L, 'zh-CN', 'angry'), '生气')
  assert.equal(pickLabel(L, 'zh', 'angry'), '生气')
  assert.equal(pickLabel(L, 'fr-FR', 'angry'), 'Angry')                 // then English
  assert.equal(pickLabel({ zh: '猫猫眼' }, 'en', 'x_5f2a91'), '猫猫眼')    // then Chinese
  assert.equal(pickLabel({ 'zh-Hant': '星星眼' }, 'zh-CN', 'x'), '星星眼')  // any
  assert.equal(pickLabel({ ko: '윙크' }, 'en', 'x'), '윙크')
  assert.equal(pickLabel({}, 'en', 'x_1'), 'x_1')                        // then the id
  assert.equal(pickLabel(undefined, 'en', 'x_1'), 'x_1')
  assert.equal(pickLabel({ EN: 'Shy' }, 'en-GB', 'shy'), 'Shy')          // tags compare without case
  assert.equal(pickLabel({ 'zh-Hant': '笑', zh: '笑一下' }, 'zh-TW', 's'), '笑')
})

test('langOf', () => {
  assert.equal(langOf('害羞'), 'zh'); assert.equal(langOf('にやり'), 'ja'); assert.equal(langOf('照れ顔'), 'ja')
  assert.equal(langOf('귀엽다'), 'ko'); assert.equal(langOf('Pouty'), 'en')
})
