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
  assert.deepEqual(FEATURES, ['full_body'])
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

// a full-body model: anchors.body with anchors.frame, rig.lattice
const tall = () => {
  const m = v3() as ReturnType<typeof v3> & { anchors: Record<string, unknown>; rig?: Record<string, unknown> }
  m.canvas = [64, 128]
  m.anchors = { ...m.anchors, bottom_y: 120, frame: [0, 0, 64, 96], hair_bottom_y: 60,
    body: { hip_l: [36, 70, 0.9], hip_r: [28, 70, 0.9], ankle_l: [36, 116, 0.8], ankle_r: [28, 116, 0.8], knee_l: [36, 94, 0.8], ground_y: 122, hem_y: 84, hem_x: [20, 44] } }
  m.layers[0] = { ...m.layers[0], h: 128 }
  m.rig = { lattice: 6 }
  return m
}

test('a full-body model is read; its body, frame and lattice are checked', () => {
  assert.equal(readModel(tall()).anchors.body!.ground_y, 122)
  const bad = (f: (m: ReturnType<typeof tall>) => void, why: RegExp) => { const m = tall(); f(m); assert.throws(() => readModel(m), why) }
  bad((m) => { delete (m.anchors.body as Record<string, unknown>).ankle_r }, /anchors.body has no ankle_r/)
  bad((m) => { (m.anchors.body as Record<string, unknown>).hip_l = [36, 70] }, /anchors.body.hip_l is not a list of 3 to 3 numbers/)
  bad((m) => { (m.anchors.body as Record<string, unknown>).knee_l = [36, 'x', 1] }, /anchors.body.knee_l/)
  bad((m) => { (m.anchors.body as Record<string, unknown>).hip_r = [28, 118, 0.9] }, /hips below its ankles/)
  bad((m) => { (m.anchors.body as Record<string, unknown>).ground_y = NaN }, /ground_y/)
  bad((m) => { (m.anchors.body as Record<string, unknown>).hip_l = [36, 30, 0.9] }, /hips above its neck/)
  bad((m) => { (m.anchors.body as Record<string, unknown>).hem_x = [20] }, /hem_x/)
  bad((m) => { delete m.anchors.frame }, /without anchors.frame/)
  bad((m) => { m.anchors.frame = [0, 0, 64, 300] }, /not a box on the canvas/)
  bad((m) => { m.anchors.frame = [0, 0, 8, 8] }, /not a box on the canvas/)
  assert.doesNotThrow(() => { const m = tall(); m.anchors.frame = [0, -10, 64, 86]; readModel(m) })
  bad((m) => { m.anchors.body = 'x' }, /anchors.body is not an object/)
  bad((m) => { m.rig = { lattice: 1 } }, /rig.lattice is not a whole number from 6 to 256/)
  bad((m) => { m.rig = { lattice: 12.5 } }, /rig.lattice/)
  // a pinned lattice counts the vertices LIMITS holds a model to
  const big = tall()
  big.canvas = [8192, 8192]; big.layers = [0, 1].map((i) => ({ ...big.layers[0], id: `l${i}`, w: 8192, h: 8192 }))
  big.anchors.frame = [0, 0, 8192, 8192]
  big.rig = { lattice: 6 }
  assert.throws(() => readModel(big), /vertices/)
  big.rig = { lattice: 64 }
  assert.doesNotThrow(() => readModel(big))
})

test('a full-body v4 model keeps its body, frame, lattice and fringe; a half-body one is never taken for one', () => {
  const body = { hip_l: [600, 1700, 0.9], hip_r: [900, 1700, 0.9], ankle_l: [620, 2900, 0.9], ankle_r: [880, 2900, 0.9], ground_y: 2990 }
  const src = example()
  src.canvas = [1536, 3072]; src.anchors.body = body; src.anchors.frame = [0, 0, 1536, 1536]; src.anchors.hair_bottom_y = 1200
  src.rig = { ...src.rig, lattice: 12 }; src.tuning = { ...src.tuning, fringe: 1.5 }
  // a writer lists the feature (FORMAT.md), so that a player without it refuses the model; this one reads it either way
  assert.doesNotThrow(() => readModel({ ...src, requires: ['full_body'] }))
  const m = readModel(src)
  assert.deepEqual(m.anchors.body, body); assert.deepEqual(m.anchors.frame, [0, 0, 1536, 1536]); assert.equal(m.anchors.hair_bottom_y, 1200)
  assert.equal(m.rig!.lattice, 12); assert.equal(m.tuning!.fringe, 1.5)
  // a half-body build has no anchors.body (the featured characters, all half-body, are read in characters.test.ts)
  const half = example()
  assert.equal(half.anchors.body, undefined)
  assert.equal(readModel(half).anchors.body, undefined)
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
