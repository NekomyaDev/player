// The long hair's swing below the shoulders (puppet.ts SWAY): the pendulum, the weights by height, the body's coverage field, which
// hair hangs from the head.
// No GPU: the parts the Puppet calls are plain functions.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SWAY, blurField, coverField, fieldAt, hangingCells, hangsAt, stepSway, swayState, swayWeight } from '../src/runtime/puppet'

const FW = 300
/** the pivot's x over time: still, a quick move of 40 px eased over 0.35 s, then still again */
const jerk = (t: number) => (t < 0.5 ? 0 : t < 0.85 ? 40 * (0.5 - 0.5 * Math.cos((Math.PI * (t - 0.5)) / 0.35)) : 40)

function run(strength: (t: number) => number, seconds: number, dt = 1 / 60) {
  const sw = swayState(), xs: number[] = []
  for (let i = 0; i < seconds / dt; i++) {
    const t = i * dt
    stepSway(sw, jerk(t), dt, strength(t), FW)
    xs.push(sw.x)
  }
  return xs
}

describe('the swing', () => {
  it('stays at exactly 0 with the slider at 0, whatever the head does', () => {
    assert.ok(run(() => 0, 6).every((x) => x === 0))
  })

  it('is thrown by a move, stays within its limit and settles by itself', () => {
    const xs = run(() => 1, 8)
    const peak = Math.max(...xs.map(Math.abs))
    assert.ok(peak > 1, `peak ${peak}`)
    assert.ok(peak <= SWAY.limit * FW + 1e-9)
    const after = xs.slice(Math.round(5 / (1 / 60)))  // 4 s after the move
    assert.ok(Math.max(...after.map(Math.abs)) < 0.01 * peak)
  })

  it('swings about twice as far at twice the strength', () => {
    const p1 = Math.max(...run(() => 1, 4).map(Math.abs)), p2 = Math.max(...run(() => 2, 4).map(Math.abs))
    assert.ok(p2 > 1.8 * p1 && p2 < 2.2 * p1, `${p1} ${p2}`)
  })

  it('comes back to exactly 0 when the slider goes to 0 mid-swing', () => {
    const xs = run((t) => (t < 1 ? 1 : 0), 12)
    assert.notEqual(xs[Math.round(1 / (1 / 60))], 0)
    assert.equal(xs[xs.length - 1], 0)
  })

  it('takes the same steps at 24 and 60 frames a second, near enough', () => {
    const a = Math.max(...run(() => 1, 4, 1 / 60).map(Math.abs)), b = Math.max(...run(() => 1, 4, 1 / 24).map(Math.abs))
    assert.ok(Math.abs(a - b) < 0.25 * a, `${a} ${b}`)
  })
})

describe('the weights by height', () => {
  const top = 500, len = 400
  it('are none at the shoulders and above, all of it at the tips', () => {
    assert.equal(swayWeight(300, top, len, 0, 0), 0)
    assert.equal(swayWeight(top, top, len, 0, 0), 0)
    assert.equal(swayWeight(top + len, top, len, 0, 0), 1)
    assert.equal(swayWeight(top + 2 * len, top, len, 0, 0), 1)
  })
  it('rise all the way down', () => {
    let last = -1
    for (let y = top; y <= top + len; y += 10) { const w = swayWeight(y, top, len, 0, 0); assert.ok(w >= last); last = w }
  })
  it('leave the bangs alone and take less over the body', () => {
    assert.equal(swayWeight(top + len, top, len, 1, 0), 0)
    assert.ok(Math.abs(swayWeight(top + len, top, len, 0, 1) - (1 - SWAY.body)) < 1e-9)
  })
})

describe("the body's coverage", () => {
  it('a blur keeps a flat field flat and stays within 0-1', () => {
    const a = new Float32Array(20 * 10).fill(0.6)
    assert.ok(blurField(a, 20, 10, 3).every((v) => Math.abs(v - 0.6) < 1e-6))
    const one = new Float32Array(21 * 21); one[10 * 21 + 10] = 1
    const b = blurField(one, 21, 21, 2)
    assert.ok(b.every((v) => v >= 0 && v <= 1))
    assert.ok(Math.abs(b[10 * 21 + 8] - b[10 * 21 + 12]) < 1e-9 && b[10 * 21 + 10] > b[10 * 21 + 13])
  })
  it('is read between cells and held at the edges', () => {
    const F = { g: 10, w: 2, h: 1, a: Float32Array.from([0, 1]) }
    assert.ok(Math.abs(fieldAt(F, 10, 5) - 0.5) < 1e-9)
    assert.equal(fieldAt(F, -100, 5), 0)
    assert.equal(fieldAt(F, 1000, 5), 1)
    assert.equal(fieldAt(undefined, 10, 5), 0)
  })
  it("without the texture's pixels, the body's box stands in for them", () => {
    const F = coverField({ x: 200, y: 400, w: 600, h: 800 }, [1000, 1400], FW)
    assert.ok(fieldAt(F, 500, 800) > 0.9)
    assert.ok(fieldAt(F, 50, 100) < 0.05)
  })
  it('from the pixels when it may read them', () => {
    const F = coverField({ x: 0, y: 0, w: 10, h: 10 }, [400, 400], FW, (w, h) => new Float32Array(w * h).fill(1))
    assert.ok(fieldAt(F, 200, 200) > 0.99)
  })
})

describe('the hair that hangs from the head', () => {
  /** a 12 x 20 lattice: a column of hair from the top down to row 14, and what else is drawn */
  const grid = (more: [number, number][]) => {
    const w = 12, h = 20, c = new Uint8Array(w * h)
    for (let y = 0; y <= 14; y++) c[y * w + 3] = 1
    for (const [x, y] of more) c[y * w + x] = 1
    return { c, w, h }
  }
  it('reaches all the way down a lock that starts above the neck', () => {
    const { c, w, h } = grid([])
    const r = hangingCells(c, w, h, 4, 1)
    for (let y = 0; y <= 14; y++) assert.equal(r[y * w + 3], 1)
  })
  it('leaves out a scrap apart from the hair, and keeps it out of the vertices around it', () => {
    const { c, w, h } = grid([[10, 12], [10, 13]])
    const r = hangingCells(c, w, h, 4, 1)
    assert.equal(r[12 * w + 10], 0)
    const H = { ox: 0, oy: 0, w, h, r }
    assert.equal(hangsAt(H, 10, 12), false)
    assert.equal(hangsAt(H, 11, 14), false)
    assert.equal(hangsAt(H, 4, 10), true)
  })
  it('crosses a gap of up to twice the bridge (a hair tie), not a wider one', () => {
    const tail = (gap: number) => grid([[3 + gap + 1, 14], [3 + gap + 1, 15], [3 + gap + 1, 16]])
    for (const [gap, b, hangs] of [[2, 1, 1], [3, 1, 0], [4, 2, 1], [5, 2, 0]] as const) {
      const { c, w, h } = tail(gap)
      assert.equal(hangingCells(c, w, h, 4, b)[16 * w + 3 + gap + 1], hangs, `gap ${gap}, bridge ${b}`)
    }
  })
  it('does not start from hair below the neck, and without a map all of the hair swings', () => {
    const w = 6, h = 10, c = new Uint8Array(w * h)
    for (let y = 5; y < 10; y++) c[y * w + 2] = 1
    assert.ok(hangingCells(c, w, h, 4, 1).every((v) => v === 0))
    assert.equal(hangsAt(undefined, 2, 7), true)
    assert.equal(hangsAt({ ox: -2, oy: -2, w: 2, h: 2, r: Uint8Array.from([1, 1, 1, 1]) }, -1, -1), true)
    assert.equal(hangsAt({ ox: -2, oy: -2, w: 2, h: 2, r: Uint8Array.from([1, 1, 1, 1]) }, 5, 5), false)
  })
})

describe('bounded for any face size', () => {
  /** the bridging as first written: each set cell widened over its window, one cell at a time */
  function reference(cells: Uint8Array, w: number, h: number, seed: number, bridge: number) {
    const a = new Uint8Array(w * h), d = new Uint8Array(w * h), out = new Uint8Array(w * h), stack: number[] = []
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (cells[y * w + x]) for (let k = Math.max(0, x - bridge); k <= Math.min(w - 1, x + bridge); k++) a[y * w + k] = 1
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (a[y * w + x]) for (let k = Math.max(0, y - bridge); k <= Math.min(h - 1, y + bridge); k++) d[k * w + x] = 1
    for (let i = 0; i < Math.min(h, Math.max(0, seed)) * w; i++) if (cells[i]) { out[i] = 1; stack.push(i) }
    while (stack.length) {
      const i = stack.pop()!, x = i % w, y = (i - x) / w
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && d[j] && !out[j]) { out[j] = 1; stack.push(j) }
    }
    return out
  }
  it('bridges exactly as the cell-by-cell way did, on random hair, every bridge', () => {
    let seed = 3
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    for (let t = 0; t < 60; t++) {
      const w = 1 + Math.floor(rand() * 40), h = 1 + Math.floor(rand() * 40), fill = rand() * 0.3, b = Math.floor(rand() * 12)
      const c = Uint8Array.from({ length: w * h }, () => (rand() < fill ? 1 : 0))
      const s = Math.floor(rand() * h)
      assert.deepEqual(hangingCells(c, w, h, s, b), reference(c, w, h, s, b), `${w} x ${h}, bridge ${b}`)
    }
  })
  it('a huge bridge costs no more than the cells: far less than cell by cell (512 x 512, bridge 20 000)', () => {
    const w = 512, h = 512, c = new Uint8Array(w * h)
    for (let i = 0; i < c.length; i += 7) c[i] = 1
    const time = (f: () => unknown) => { const t0 = performance.now(); f(); return performance.now() - t0 }
    time(() => hangingCells(c, w, h, 100, 20000))  // (warmed)
    const now = Math.min(time(() => hangingCells(c, w, h, 100, 20000)), time(() => hangingCells(c, w, h, 100, 20000)))
    const before = time(() => reference(c, w, h, 100, 20000))
    // measured side by side, so a busy machine slows both alike
    assert.ok(now * 5 < before, `${now.toFixed(1)} ms, cell by cell ${before.toFixed(1)} ms`)
  })
  it('a step with a number that is none is skipped, and the swing never leaves its limit, whatever the step', () => {
    const sw = swayState()
    for (let i = 0; i < 60; i++) stepSway(sw, 40 * Math.sin(i / 5), 1 / 60, 1, FW)
    const was = { ...sw }
    stepSway(sw, NaN, 1 / 60, 1, FW); stepSway(sw, 10, NaN, 1, FW); stepSway(sw, 10, 1 / 60, Infinity, FW); stepSway(sw, 10, 1 / 60, 1, NaN)
    assert.deepEqual(sw, was, 'nothing taken in')
    Object.assign(sw, { x: NaN })
    stepSway(sw, 10, 1 / 60, 1, FW)
    assert.ok([sw.x, sw.vx, sw.px, sw.pvx, sw.ax].every(Number.isFinite), 'a state gone bad starts again')
    for (const dt of [0.5, 2, 30]) {
      const s = swayState()
      for (let i = 0; i < 20; i++) { stepSway(s, i % 2 ? 300 : -300, dt, 2, FW); assert.ok(Math.abs(s.x) <= SWAY.limit * FW * 2 + 1e-9 && Number.isFinite(s.x), `dt ${dt}: ${s.x}`) }
    }
  })
})
