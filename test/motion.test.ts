// The motion that needs no GPU: actions, the idle motion, talking, the lip-sync envelope, the filters, the face trace
// the tracking tests play, and the mark's timing and place.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ActionPlayer } from '../src/runtime/actions'
import { IdleDriver, PARAM_RANGES, defaultParams, type Params } from '../src/runtime/puppet'
import { TalkMotion } from '../src/runtime/talk'
import { envelope } from '../src/runtime/speech'
import { VowelCue } from '../src/runtime/vowel'
import { OneEuro } from '../src/runtime/filters'
import { BS, synthTrace } from '../src/runtime/trace'
import { cornerSpot, eyeOpen } from '../src/runtime/brand'
import { Idle, type Seen } from '../src/follow'

const outOfRange = (P: Params) => {
  for (const [k, [lo, hi]] of Object.entries(PARAM_RANGES)) {
    const v = P[k as keyof Params]
    if (!(v >= lo - 1e-9 && v <= hi + 1e-9)) return `${k} = ${v}`
  }
  return null
}
const max = (xs: ArrayLike<number>) => Math.max(...Array.from(xs))

describe('actions', () => {
  it('scales head, body and picture movement without changing the action timing', () => {
    for (const grounded of [false, true]) for (const id of ['nod', 'shake', 'tilt', 'hop', 'shy'] as const) {
      const full = new ActionPlayer(), soft = new ActionPlayer()
      full.grounded = soft.grounded = grounded
      full.play(id); soft.play(id, 0.4)
      for (let i = 0; i < 180; i++) {
        const a = { ...full.update(1 / 60) }, b = soft.update(1 / 60)
        for (const [key, value] of Object.entries(a)) assert.ok(Math.abs((b[key as keyof Params] ?? 0) - value * 0.4) < 1e-9)
        assert.ok(Math.abs(soft.y - full.y * 0.4) < 1e-9)
        assert.equal(soft.busy, full.busy)
      }
    }
  })

  for (const id of ['nod', 'shake', 'tilt', 'hop', 'shy'] as const) {
    it(`${id} moves, then ends with nothing left`, () => {
      const a = new ActionPlayer()
      a.play(id)
      let most = 0
      for (let i = 0; i < 180; i++) {
        const o = a.update(1 / 60)
        most = Math.max(most, ...Object.values(o).map((v) => Math.abs(v ?? 0)), Math.abs(a.y))
      }
      assert.ok(most > 0)
      assert.equal(a.busy, false)
      assert.ok(Object.values(a.update(1 / 60)).every((v) => !v))
    })
  }

  it('away eases in, and out when pressed again', () => {
    const a = new ActionPlayer()
    a.play('away')
    for (let i = 0; i < 180; i++) a.update(1 / 60)
    assert.ok(a.awayW > 0.95)
    a.play('away')
    for (let i = 0; i < 180; i++) a.update(1 / 60)
    assert.equal(a.awayW, 0)
  })
})

describe('idle motion', () => {
  it('blinks, turns toward the pointer and stays in range', () => {
    const idle = new IdleDriver(), P = defaultParams()
    idle.look = { x: 1, y: 0 }
    let closed = false
    for (let t = 0; t < 30; t += 1 / 60) {
      idle.apply(P, t, 1 / 60)
      closed ||= P.eyeLOpen < 0.1
      assert.equal(outOfRange(P), null)
    }
    assert.ok(closed, 'blinked')
    assert.ok(P.angleX > 10, `turned: ${P.angleX}`)
  })
})

describe('the players\' idle (attend: follows the pointer with the eyes and the face)', () => {
  // a face in the upper middle of a 400 x 500 canvas, as pointAt reads a drawn puppet
  const seen = { model: { anchors: { head: { cx: 0, cy: -0.4, rx: 0.3, ry: 0.3 } } }, lastView: [1, 1, 0, 0, 2, 2] } as unknown as Seen
  const run = (idle: Idle, secs: number, each: (t: number) => void = () => {}) => {
    const P = defaultParams(), seenP: Params[] = []
    for (let i = 0; i < secs * 60; i++) {
      each(i / 60)
      idle.apply(P, i / 60, 1 / 60, { busy: false, tracked: false, faceFree: true })
      idle.shown(P)
      assert.equal(outOfRange(P), null)
      seenP.push({ ...P })
    }
    return seenP
  }

  for (const side of [1, -1]) {
    it(`a pointer moving on the ${side > 0 ? 'right' : 'left'}: the eyes lead there, the head turns at most ~13°`, () => {
      const idle = new Idle()
      const frames = run(idle, 3, (t) => idle.pointer(seen, 200 + side * (150 + 30 * Math.sin(t * 6)), 140, 400, 500, true))
      assert.ok(Math.max(...frames.map((P) => side * P.eyeBallX)) > 0.3, 'eyes toward it')
      assert.ok(Math.max(...frames.map((P) => Math.abs(P.angleX))) <= 14, 'head within ~13°')
    })
  }

  it('a pointer at rest lets go after a while: the character looks back', () => {
    const idle = new Idle()
    const frames = run(idle, 5, () => idle.pointer(seen, 380, 140, 400, 500, true))
    assert.ok(Math.abs(frames[frames.length - 1].eyeBallX) < 0.3)
  })

  it('lookAt holds the attention, whatever the pointer does; null lets go', () => {
    const idle = new Idle()
    idle.lookAt(seen, -0.9, 0, 400, 500)
    const frames = run(idle, 4, () => idle.pointer(seen, 390, 250, 400, 500, true))
    const P = frames[frames.length - 1]
    assert.ok(P.eyeBallX < -0.5 && P.angleX < -5, `eyes ${P.eyeBallX}, head ${P.angleX}`)
    idle.lookAt(seen, null, 0, 400, 500)
    const after = run(idle, 4)
    assert.ok(Math.abs(after[after.length - 1].eyeBallX) < 0.5)
  })
})

describe('talking', () => {
  it('stays still in silence', () => {
    const t = new TalkMotion(), P = defaultParams()
    for (let i = 0; i < 120; i++) {
      const o = t.update(0, 1 / 60, P)
      assert.ok(Math.abs(o.angleX ?? 0) + Math.abs(o.angleY ?? 0) + Math.abs(o.browLY ?? 0) < 1e-6)
    }
  })

  it('nods on syllables', () => {
    const t = new TalkMotion(), P = defaultParams()
    for (let i = 0; i < 240; i++) t.update(i % 15 < 7 ? 0.8 : 0.05, 1 / 60, P)  // four syllables a second
    assert.ok(t.stats.onsets > 10, `onsets: ${t.stats.onsets}`)
    assert.ok(t.stats.nods > 0)
  })
})

describe('lip-sync envelope', () => {
  const sr = 24000
  const tone = (secs: number, on: (t: number) => boolean) =>
    Float32Array.from({ length: secs * sr }, (_, i) => (on(i / sr) ? 0.3 * Math.sin(2 * Math.PI * 400 * (i / sr)) : 0))

  it('is closed for silence', () => {
    assert.equal(max(envelope(new Float32Array(sr), sr)), 0)
  })

  it('opens while the voice sounds and closes after it', () => {
    const e = envelope(tone(2, (t) => t > 0.5 && t < 1), sr)  // 100 frames a second
    assert.ok(max(e.slice(55, 95)) > 0.5)
    assert.ok(max(e.slice(0, 40)) < 0.05)
    assert.ok(max(e.slice(130)) < 0.05)
  })

  it('the vowel cue stays 0 in silence', () => {
    assert.equal(new VowelCue().push(new Float32Array(512), 46.875, 0, 0.02), 0)
  })
})

describe('filters and traces', () => {
  it('One Euro leaves a constant alone and follows a step', () => {
    const f = new OneEuro(1, 0.1)
    for (let i = 0; i < 30; i++) assert.ok(Math.abs(f.filter(5, 1 / 30) - 5) < 1e-9)
    let v = 5
    for (let i = 0; i < 60; i++) v = f.filter(10, 1 / 30)
    assert.ok(v > 9.5, `${v}`)
  })

  it('the synthetic face trace: 24 s at 30 fps, the same each time, no face at 10-12 s', () => {
    const a = synthTrace()
    assert.equal(a.length, 720)
    assert.deepEqual(a, synthTrace())
    const lost = a.filter((f) => !f.m && !f.b).map((f) => f.t)
    assert.equal(lost.length, 60)
    assert.ok(Math.min(...lost) >= 10_000 && Math.max(...lost) < 12_000)
    assert.equal(a.find((f) => f.b)!.b!.length, BS.length)
  })
})

describe('the mark', () => {
  it('blinks once every 5.5 s', () => {
    assert.equal(eyeOpen(0), 1)
    assert.ok(Math.min(...Array.from({ length: 550 }, (_, i) => eyeOpen(i * 10))) < 0.2)
  })

  it('sits in the bottom-right corner', () => {
    const c = cornerSpot(1920, 1080)
    assert.ok(c.right > 1600 && c.right < 1920 && c.y > 900 && c.y < 1080 && c.logo > 0)
  })
})
