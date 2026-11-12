// The player's contracts that need no GPU: the params and their ranges, the format check before anything is drawn (the
// reader itself: format.test.ts), and the package's own version.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { FORMAT_VERSION, PARAM_RANGES, VERSION, defaultParams } from '../src/index'
import { FORMAT, LEGACY_FORMAT, Puppet, readModel, type ModelDef } from '../src/runtime/puppet'

describe('params', () => {
  it('has a range for every param, and the defaults lie in them', () => {
    const p = defaultParams()
    assert.deepEqual(Object.keys(PARAM_RANGES).sort(), Object.keys(p).sort())
    for (const [k, [lo, hi]] of Object.entries(PARAM_RANGES)) {
      const v = p[k as keyof typeof p]
      assert.ok(lo < hi && v >= lo && v <= hi, `${k}: ${v} in [${lo}, ${hi}]`)
    }
  })

  it('gives a fresh object each time', () => {
    defaultParams().angleX = 10
    assert.equal(defaultParams().angleX, 0)
  })
})

describe('format check', () => {
  // loadModel checks the model before it touches WebGL, so it runs on a bare object here
  const load = (m: Partial<ModelDef>) => Puppet.prototype.loadModel.call({} as Puppet, m as ModelDef, () => Promise.reject(new Error('no images')))
  const model = (o: Partial<ModelDef>) => ({ format: FORMAT, version: FORMAT_VERSION, layers: [], ...o })

  it('refuses a newer format version, asking for a newer player', async () => {
    await assert.rejects(load(model({ version: FORMAT_VERSION + 1 })), /update the player/)
  })

  it('refuses another format', async () => {
    await assert.rejects(load(model({ format: 'something-else' })), /not a LivLiv model/)
  })

  it('reads a model from before v4 (no version) as it is', async () => {
    // past the checks it asks for the images: with none it fails there, not on the version
    const v3 = {
      format: LEGACY_FORMAT, name: 'T', canvas: [64, 64],
      anchors: { head: { cx: 32, cy: 20, rx: 12, ry: 14 }, face: [20, 8, 44, 34], neck_y: 34, top_y: 0, bottom_y: 63, hair_root_y: 6 },
      layers: [{ id: 'body', name: 'body', texture: 'textures/body.png', x: 0, y: 0, w: 64, h: 64, group: 'body', depth: 0 }],
    } as unknown as ModelDef
    await assert.rejects(load(v3), /no images/)
  })
})

describe('rig', () => {
  it('keeps the chest spring off whatever the model saved', () => {
    const model = readModel(JSON.parse(readFileSync(new URL('./fixtures/example-k01.model.json', import.meta.url), 'utf8')))
    assert.ok(model.rig!.body!.bust! > 0, 'the fixture saves one')
    // the model's fields without the GPU: each layer stands in for what buildLayer makes of it
    const p = Object.assign(Object.create(Puppet.prototype) as Puppet, {
      procJaw: 0, lidCurve: false, chains: {}, drive: {}, buildLayer: (def: unknown) => ({ def, rest: new Float32Array(0) }),
    })
    const build = (p as unknown as { build: (m: ModelDef, imgs: unknown[], k: undefined, built: unknown[]) => void }).build
    build.call(p, model, model.layers.map(() => ({ main: {}, frames: [] })), undefined, [])
    assert.equal(p.rig.body.bust, 0)
    assert.equal(p.rig.body.yaw, model.rig!.body!.yaw ?? 0.35, 'the rest of rig.body is the model\'s')
  })
})

it('VERSION matches package.json', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(VERSION, pkg.version)
})
