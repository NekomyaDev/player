// The idle motion going on again after frames drawn without it eases in from the pose those frames showed, instead of
// jumping in one frame to where it stopped. A player whose idle motion was never off plays exactly as before.
import assert from 'node:assert/strict'
import { it, type TestContext } from 'node:test'
import { BodyPlayer, type Body, type Pose } from '../src/body'
import { Idle } from '../src/follow'

function page(t: TestContext) {
  const names = ['window', 'document', 'addEventListener', 'removeEventListener', 'requestAnimationFrame', 'cancelAnimationFrame', 'matchMedia']
  const saved = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const)
  t.after(() => { for (const [name, d] of saved) { if (d) Object.defineProperty(globalThis, name, d); else Reflect.deleteProperty(globalThis, name) } })
  const set = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { configurable: true, value })
  let next: FrameRequestCallback = () => {}, now = 0
  set('window', { devicePixelRatio: 1 }); set('document', { addEventListener() {}, removeEventListener() {} })
  set('addEventListener', () => {}); set('removeEventListener', () => {})
  set('requestAnimationFrame', (f: FrameRequestCallback) => { next = f; return 1 }); set('cancelAnimationFrame', () => {})
  Reflect.deleteProperty(globalThis, 'matchMedia')
  t.mock.method(performance, 'now', () => now)
  let seed = 11
  t.mock.method(Math, 'random', () => { seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296 })
  return { frame() { now += 1000 / 60; next(now) } }
}
const body = (): Body => ({ format: 'test', async load() { return { name: 'T', expressions: [] } }, render() {}, head() { return { x: 0.5, y: 0.3, rx: 0.1, ry: 0.1 } }, dispose() {} })
const canvas = () => ({ clientWidth: 200, clientHeight: 300, style: {}, addEventListener() {}, removeEventListener() {} }) as unknown as HTMLCanvasElement
const KEYS = ['angleX', 'angleY', 'angleZ', 'bodyX', 'bodyZ', 'breath', 'eyeLOpen', 'eyeBallX', 'browLY'] as const
const SPAN = { angleX: 60, angleY: 60, angleZ: 60, bodyX: 20, bodyZ: 20, breath: 1, eyeLOpen: 1, eyeBallX: 2, browLY: 2 }
/** the biggest step of any key from one frame to the next, in its range's share (the eyes left out: a blink is quick) */
const steps = (poses: Pose['params'][]) => {
  let most = 0
  for (let i = 1; i < poses.length; i++) for (const k of KEYS) if (k !== 'eyeLOpen') most = Math.max(most, Math.abs(poses[i][k] - poses[i - 1][k]) / SPAN[k])
  return most
}

/** idle on 40 s (its moves included), off 2 s (a held pose), on again: the biggest step in the steady idle, and from
 *  the last frame without it into the first two seconds with it */
async function toggle(t: TestContext, held: Partial<Pose['params']>) {
  const { frame } = page(t)
  const p = new BodyPlayer(canvas(), body(), { autoplay: false, followPointer: false })
  await p.load(new Map([['m', new Blob(['x'])]]))
  const poses: Pose['params'][] = []
  p.onFrame = (pose) => { poses.push(pose.params) }
  p.play()
  for (let i = 0; i < 40 * 60; i++) frame()
  const steady = steps(poses.slice(60))
  p.idle = false; Object.assign(p.params, held)
  for (let i = 0; i < 120; i++) frame()
  const off = poses.length - 1
  p.idle = true
  for (let i = 0; i < 120; i++) frame()
  p.dispose()
  const first = Math.max(...KEYS.map((k) => Math.abs(poses[off + 1][k] - poses[off][k]) / SPAN[k]))
  return { steady, resumed: steps(poses.slice(off)), first }
}

it('the idle motion goes on again from the pose shown without it, with no jump', async (t) => {
  for (const held of [{}, { angleX: 20, angleY: -12, bodyX: 5, eyeLOpen: 0.2, breath: 0.8 }]) {
    const r = await toggle(t, held)
    assert.ok(r.first < 0.01, `${JSON.stringify(held)}: the first frame moves ${r.first.toFixed(4)} of a range`)
    assert.ok(r.resumed <= Math.max(r.steady, 0.03), `${JSON.stringify(held)}: a step of ${r.resumed.toFixed(4)} as it eases in, ${r.steady.toFixed(4)} at most in its own motion`)
  }
})

it('as 0.5 had it (no easing in), the same toggle jumps', async (t) => {
  t.mock.method(Idle.prototype, 'resume', function () {})
  const r = await toggle(t, {})
  assert.ok(r.first > 0.02, `the first frame moves ${r.first.toFixed(4)} of a range: the test sees the jump`)
})

it('an idle motion never turned off never eases in: the frames are as before', async (t) => {
  const { frame } = page(t)
  const resume = t.mock.method(Idle.prototype, 'resume')
  const p = new BodyPlayer(canvas(), body(), { autoplay: false })
  await p.load(new Map([['m', new Blob(['x'])]]))
  p.play()
  for (let i = 0; i < 300; i++) frame()
  p.idle = false; p.idle = true  // off and on with no frame between: nothing was shown without it
  for (let i = 0; i < 60; i++) frame()
  assert.equal(resume.mock.callCount(), 0)
  p.idle = false; frame(); p.idle = true; frame()
  assert.equal(resume.mock.callCount(), 1)
  p.dispose()
})

it('values of the page that are no numbers do not stay in the idle motion it eases back from', async (t) => {
  for (const bad of [NaN, '5', Infinity]) {
    const { frame } = page(t)
    const p = new BodyPlayer(canvas(), body(), { autoplay: false, followPointer: false })
    await p.load(new Map([['m', new Blob(['x'])]]))
    const seen: number[] = [], eyes: number[] = []
    p.onFrame = (pose) => { seen.push(pose.params.angleX); eyes.push(pose.params.eyeBallX) }
    p.play()
    Object.assign(p.params, { angleX: bad, eyeBallX: bad })
    for (let i = 0; i < 60; i++) frame()
    p.idle = false
    for (let i = 0; i < 10; i++) frame()
    p.idle = true
    seen.length = 0; eyes.length = 0
    for (let i = 0; i < 60 * 20; i++) frame()
    const distinct = (a: number[]) => new Set(a.map((v) => v.toFixed(3))).size
    assert.ok(distinct(seen) > 100 && distinct(eyes) > 20, `${String(bad)}: the head took ${distinct(seen)} values, the eyes ${distinct(eyes)}`)
    assert.ok([...seen, ...eyes].every(Number.isFinite))
    p.dispose()
  }
})
