// The character's feel settings (tuning) that the player itself reads, without a GPU: the blink rate in the idle motion,
// and the mouth and expression gains that face tracking and lip sync take from the host. At 1 (or missing) everything
// is as it was. setTuning() changes them live (the renderer's settings are checked in the browser smoke test).
import assert from 'node:assert/strict'
import { describe, it, type TestContext } from 'node:test'
import { BodyPlayer, type Body, type Host, type Tuning } from '../src/body'
import { factor } from '../src/feel'
import { FaceTracker } from '../src/runtime/tracking'
import { VoiceMeter } from '../src/runtime/voice'
import { startFaceTracking } from '../src/tracking'
import { startLipSync } from '../src/voice'

/** the globals a BodyPlayer touches, faked for one test; returns a function that runs one frame of 1/60 s */
function page(t: TestContext) {
  const names = ['window', 'document', 'addEventListener', 'removeEventListener', 'requestAnimationFrame', 'cancelAnimationFrame', 'matchMedia']
  const saved = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const)
  t.after(() => { for (const [name, d] of saved) { if (d) Object.defineProperty(globalThis, name, d); else Reflect.deleteProperty(globalThis, name) } })
  const set = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { configurable: true, value })
  let next: FrameRequestCallback = () => {}, now = 0
  set('window', { devicePixelRatio: 1 })
  set('document', { addEventListener() {}, removeEventListener() {} })
  set('addEventListener', () => {}); set('removeEventListener', () => {})
  set('requestAnimationFrame', (f: FrameRequestCallback) => { next = f; return 1 }); set('cancelAnimationFrame', () => {})
  Reflect.deleteProperty(globalThis, 'matchMedia')
  t.mock.method(performance, 'now', () => now)
  return { frame() { now += 1000 / 60; next(now) } }
}

/** a seeded Math.random for one test */
function seeded(t: TestContext, seed = 7) {
  t.mock.method(Math, 'random', () => { seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296 })
}

const body = (): Body => ({ format: 'test', async load() { return { name: 'Test', expressions: [] } }, render() {}, head() { return { x: 0.5, y: 0.3, rx: 0.1, ry: 0.1 } }, dispose() {} })
const canvas = () => ({ clientWidth: 200, clientHeight: 300, style: {}, addEventListener() {}, removeEventListener() {} }) as unknown as HTMLCanvasElement

/** blinks in `seconds` of idle motion, with the body player's feel settings changed as `feel` says */
async function blinks(t: TestContext, feel: Partial<Tuning>, seconds = 120) {
  const { frame } = page(t)
  seeded(t)
  const p = new BodyPlayer(canvas(), body(), { autoplay: false, followPointer: false })
  await p.load(new Map([['m', new Blob(['x'])]]))
  p.setTuning(feel)
  const eyes: number[] = []
  p.onFrame = (pose) => { eyes.push(pose.params.eyeLOpen) }
  p.play()
  for (let i = 0; i < seconds * 60; i++) frame()
  p.dispose()
  let n = 0
  for (let i = 1; i < eyes.length; i++) if (eyes[i] < 0.5 && eyes[i - 1] >= 0.5) n++
  return { n, eyes }
}

/** a host that only collects the drivers, with the feel settings given */
function host(tuning?: Partial<Tuning>) {
  const drivers: Parameters<Host['use']>[0][] = []
  const h: Host = { use(d) { drivers.push(d); return () => d.dispose?.() }, blink() {}, ...(tuning ? { tuning: { ...defaults, ...tuning } } : {}) }
  return { h, drivers }
}
const defaults: Tuning = { turn: 1, nod: 1, hair: 1, blink: 1, expr: 1, mouth: 1, breath: 1, gaze: 1 }
const frameOf = () => {
  const P = { mouthOpen: 0, vowel: 0, smile: 0 } as Record<string, number>
  return { params: P, dt: 1 / 60, time: 0, tracked: false, talk: 0, grounded: false, move: { x: 0, y: 0, s: 1 }, add() {} } as never
}

describe('feel settings the player reads', () => {
  it('reads a setting as a number from 0 up, anything else as 1', () => {
    assert.deepEqual([0, 0.5, 1, 3, 10].map(factor), [0, 0.5, 1, 3, 10])
    assert.deepEqual([undefined, null, NaN, Infinity, -1, '2', {}].map(factor), [1, 1, 1, 1, 1, 1, 1])
  })

  it('blink: the idle motion blinks as often as it says, and at 1 exactly as before', async (t) => {
    // (some blinks come with big glances, whatever the rate: the counts follow the rate, not in proportion)
    const base = await blinks(t, {}, 300), same = await blinks(t, { blink: 1 }, 300), fast = await blinks(t, { blink: 3 }, 300), slow = await blinks(t, { blink: 0.4 }, 300)
    assert.deepEqual(same.eyes, base.eyes, 'blink 1 is the same frames as no setting')
    assert.ok(base.n >= 50, `${base.n} blinks in five minutes`)
    assert.ok(fast.n > base.n * 2, `blink 3: ${fast.n} blinks against ${base.n}`)
    assert.ok(slow.n < base.n * 0.6, `blink 0.4: ${slow.n} blinks against ${base.n}`)
  })

  it('mouth: live lip sync opens the mouth as far as the page\'s gain times the character\'s own', async (t) => {
    t.mock.method(VoiceMeter.prototype, 'start', async function () {})
    t.mock.method(VoiceMeter.prototype, 'read', function (this: VoiceMeter) { this.level = Math.min(1, 0.4 * this.gain); return this.level })
    for (const [tuning, gain, open] of [[undefined, 1, 0.4], [{}, 1, 0.4], [{ mouth: 2 }, 1, 0.8], [{ mouth: 0.5 }, 1.5, 0.3], [{ mouth: 0 }, 1, 0], [{ mouth: NaN }, 1, 0.4]] as const) {
      const { h, drivers } = host(tuning)
      const lip = await startLipSync(h, undefined, { motion: 0 })
      lip.gain = gain
      const f = frameOf() as { params: { mouthOpen: number } }
      drivers[0].update(f as never, h)
      assert.ok(Math.abs(f.params.mouthOpen - open) < 1e-12, `${JSON.stringify(tuning)} x ${gain}: ${f.params.mouthOpen}`)
      assert.equal(lip.gain, gain, 'the page\'s own gain reads back as it was set')
      lip.stop()
    }
  })

  it('mouth and expr: face tracking reads its gains from the host each frame', async (t) => {
    const seen: [number, number][] = []
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'document')
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => null }) } })
    t.after(() => { if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document') })
    t.mock.method(FaceTracker.prototype, 'start', async function (this: FaceTracker) { this.ok = true })
    t.mock.method(FaceTracker.prototype, 'stop', function () {})
    t.mock.method(FaceTracker.prototype, 'poll', function (this: FaceTracker) { seen.push([this.mouthGain, this.exprGain]); return true })
    t.mock.method(FaceTracker.prototype, 'apply', function () {})
    for (const tuning of [undefined, {}, { mouth: 1.6, expr: 0.7 }, { mouth: 0, expr: 0 }]) {
      const { h, drivers } = host(tuning)
      const ft = await startFaceTracking(h)
      drivers[0].update(frameOf(), h)
      ft.stop()
    }
    assert.deepEqual(seen, [[1, 1], [1, 1], [1.6, 0.7], [0, 1e-3]])
  })

  it('setTuning changes them live: the next frames blink at the new rate', async (t) => {
    const { frame } = page(t)
    seeded(t)
    const p = new BodyPlayer(canvas(), body(), { autoplay: false, followPointer: false })
    await p.load(new Map([['m', new Blob(['x'])]]))
    let n = 0, last = 1
    p.onFrame = (pose) => { if (pose.params.eyeLOpen < 0.5 && last >= 0.5) n++; last = pose.params.eyeLOpen }
    p.play()
    for (let i = 0; i < 60 * 60; i++) frame()
    const before = n
    p.setTuning({ blink: 4 })
    n = 0
    for (let i = 0; i < 60 * 60; i++) frame()
    assert.ok(n > before * 2.5, `${n} blinks in the minute after, ${before} in the one before`)
    p.dispose()
  })

  it('setTuning: a faster blink rate is seen at once, not after the slower one\'s wait', async (t) => {
    const { frame } = page(t)
    seeded(t)
    const p = new BodyPlayer(canvas(), body(), { autoplay: false, followPointer: false })
    await p.load(new Map([['m', new Blob(['x'])]]))
    p.setTuning({ blink: 0.2 })
    let n = 0, last = 1
    p.onFrame = (pose) => { if (pose.params.eyeLOpen < 0.5 && last >= 0.5) n++; last = pose.params.eyeLOpen }
    p.play()
    for (let i = 0; i < 40 * 60; i++) frame()  // a blink every 9-28 s
    p.setTuning({ blink: 5 })
    n = 0
    let first = -1
    for (let i = 0; i < 6 * 60; i++) { frame(); if (n && first < 0) first = i / 60 }
    assert.ok(first >= 0 && first < 2, `the first blink after the change came ${first} s later`)
    p.dispose()
  })

  it('setTuning: undefined or null puts a setting back, and a wrong call changes nothing', async (t) => {
    page(t)
    const p = new BodyPlayer(canvas(), body(), { autoplay: false })
    await p.load(new Map([['m', new Blob(['x'])]]))
    p.setTuning({ blink: 3, mouth: 0, hairFront: 2, fringe: 0.5 })
    assert.deepEqual({ ...p.tuning }, { ...defaults, blink: 3, mouth: 0, hairFront: 2, fringe: 0.5 })
    p.setTuning({ blink: undefined, hairFront: null, mouth: 1.25 })
    assert.deepEqual({ ...p.tuning }, { ...defaults, mouth: 1.25, fringe: 0.5 }, 'blink back to 1, hairFront gone')
    const was = { ...p.tuning }
    for (const bad of [{ blink: -1 }, { blink: NaN }, { blink: Infinity }, { mouth: '2' }, { blinks: 2 }, { expr: 2, nope: 1 }, { expr: 2, turn: -0.1 }]) {
      assert.throws(() => p.setTuning(bad as never), TypeError, JSON.stringify(bad))
      assert.deepEqual({ ...p.tuning }, was, `${JSON.stringify(bad)} changed nothing`)
    }
    assert.throws(() => p.setTuning(null as never), TypeError)
    p.setTuning({ hairSway: 1e6, blink: 10 })
    assert.equal(p.tuning.hairSway, 10, 'above 10 counts as 10, as in a model file')
    assert.equal(p.tuning.blink, 10)
    const view = p.tuning
    assert.equal(p.tuning, view, 'the same frozen copy until the settings change')
    p.setTuning({ mouth: 0.5 })
    assert.notEqual(p.tuning, view)
    assert.equal(view.mouth, 1.25, 'a copy given out before stays as it was')
    await p.load(new Map([['m', new Blob(['x'])]]))
    assert.deepEqual({ ...p.tuning }, defaults, 'a load starts again from the character\'s own')
    p.dispose()
  })

  it('a body player\'s feel settings start at 1, and its tuning is a frozen copy', async (t) => {
    page(t)
    const p = new BodyPlayer(canvas(), body(), { autoplay: false })
    await p.load(new Map([['m', new Blob(['x'])]]))
    assert.deepEqual({ ...p.tuning }, defaults)
    assert.ok(Object.isFrozen(p.tuning))
    assert.throws(() => { (p.tuning as Tuning).blink = 5 })
    assert.equal(p.tuning.blink, 1)
    p.dispose()
  })
})
