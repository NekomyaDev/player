// The blink hand-over, without a GPU: the open eye's fade (eyeFade) and the blink's curve (blinkOpen). With the hand-over
// off both are exactly what they were; with it on the open eye stays whole until it is a thin slit, and a blink sampled
// at any frame rate from any phase shows the eyes shut at least once. (What is drawn needs a GPU: not checked here.)
import assert from 'node:assert/strict'
import { describe, it, type TestContext } from 'node:test'
import { BLINK_HOLD, IdleDriver, blinkOpen, blinkOver, defaultParams, eyeFade, smooth } from '../src/runtime/puppet'
import { LivelyIdle } from '../src/runtime/idle'

/** the blink curve before the hand-over, as both idle motions wrote it */
const before = (t: number) => {
  const b = t / 0.075
  return Math.max(0, Math.min(1, b < 1 ? 1 - b : b < 2.6 ? (b - 1) / 1.6 : 1))
}

/** a seeded Math.random for one test */
function seeded(t: TestContext, seed = 7) {
  t.mock.method(Math, 'random', () => { seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296 })
}

/** each blink's sampled eye-open values: a blink begun at a random point between two frames, sampled every 1/fps s */
function sampled(fps: number, hold: number, blinks = 400) {
  const out: number[][] = []
  for (let k = 0; k < blinks; k++) {
    const vals: number[] = []
    for (let t = ((k + 0.5) / blinks) / fps; !blinkOver(t, hold); t += 1 / fps) vals.push(blinkOpen(t, hold))
    out.push(vals)
  }
  return out
}

/** the eye-open values of `seconds` of an idle motion at 60 fps, and its blinks' lowest values */
function run(apply: (P: ReturnType<typeof defaultParams>, t: number, dt: number) => void, seconds: number) {
  const P = defaultParams(), lows: number[] = []
  let low = 1, inBlink = false
  for (let i = 1; i <= seconds * 60; i++) {
    Object.assign(P, defaultParams())
    apply(P, i / 60, 1 / 60)
    const e = P.eyeLOpen
    if (e < 0.5) { inBlink = true; low = Math.min(low, e) }
    else if (inBlink) { lows.push(low); low = 1; inBlink = false }
  }
  return lows
}

describe('blink hand-over', () => {
  it('off: the open eye fades as it did, 0.2 to 0.02', () => {
    for (let k = 0; k <= 1000; k++) {
      const o = k / 1000
      assert.equal(eyeFade(o, false), smooth(0.02, 0.2, o))
    }
  })

  it('on: the open eye is whole down to a thin slit, and the same as before from 0.2 up', () => {
    for (let k = 0; k <= 1000; k++) {
      const o = k / 1000
      if (o >= 0.2) assert.equal(eyeFade(o, true), eyeFade(o, false), `open ${o}`)
      if (o >= 0.06) assert.equal(eyeFade(o, true), 1, `open ${o}`)
      if (o <= 0.03) assert.equal(eyeFade(o, true), 0, `open ${o}`)
    }
    // where the old fade had both eyes half there, the open eye is now whole
    assert.ok(eyeFade(0.11, false) < 0.6 && eyeFade(0.11, true) === 1)
  })

  it('the blink curve without a hold is exactly the old one', () => {
    for (let k = 0; k <= 4000; k++) {
      const t = k / 10000
      assert.equal(blinkOpen(t), before(t), `t ${t}`)
      assert.equal(blinkOpen(t, 0), before(t), `t ${t}`)
      assert.equal(blinkOver(t), t / 0.075 >= 2.6, `t ${t}`)
    }
  })

  it('with BLINK_HOLD every blink has a shut frame at 60 and at 30 fps; without, many have none', () => {
    for (const fps of [60, 30]) {
      const held = sampled(fps, BLINK_HOLD), plain = sampled(fps, 0)
      assert.ok(held.every((v) => v.includes(0)), `${fps} fps: every blink shut with the hold`)
      const missed = plain.filter((v) => !v.includes(0)).length
      assert.ok(missed > plain.length / 4, `${fps} fps: ${missed} of ${plain.length} blinks never shut without it`)
    }
    // the hold only adds the shut time: the close and the open take as long as before
    assert.equal(blinkOpen(0.0375, BLINK_HOLD), before(0.0375))
    assert.equal(blinkOpen(0.1, BLINK_HOLD), 0)
    assert.ok(Math.abs(blinkOpen(0.15, BLINK_HOLD) - before(0.15 - BLINK_HOLD)) < 1e-12)
    assert.ok(blinkOver(0.195 + BLINK_HOLD, BLINK_HOLD) && !blinkOver(0.19 + BLINK_HOLD, BLINK_HOLD))
  })

  it('the idle motions hold no blink unless told to, and every blink shuts when they do', (t) => {
    seeded(t)
    const lively = new LivelyIdle(), classic = new IdleDriver()
    assert.equal(lively.blinkHold, 0)
    assert.equal(classic.blinkHold, 0)
    lively.blinkHold = BLINK_HOLD; classic.blinkHold = BLINK_HOLD
    for (const lows of [run((P, s, dt) => lively.apply(P, s, dt), 120), run((P, s, dt) => classic.apply(P, s, dt), 120)]) {
      assert.ok(lows.length >= 15, `${lows.length} blinks`)
      assert.ok(lows.every((v) => v === 0), `lowest values: ${lows.filter((v) => v > 0).join(', ')}`)
    }
  })
})
