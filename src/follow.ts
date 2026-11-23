// The idle motion both players play: livliv.ai's own (runtime/idle.ts LivelyIdle with IDLE_STYLE), whose pointer style is
// 'attend': the head turns a little and the eyes lead, the face reacts as the pointer comes near or rests on it, and the
// character looks back at the viewer when it leaves. What a player tells it each frame (talking or acting, a face tracker
// driving, an expression showing) and where the pointer is, in one place for Player and BodyPlayer.
import { LivelyIdle, pointAt } from './runtime/idle'
import { defaultParams, type Params } from './runtime/params'
import type { Puppet } from './runtime/puppet'

/** the keys the idle motion sets (with it on, your values for these are not used); its smile is added to yours */
export const IDLE_KEYS = ['angleX', 'angleY', 'angleZ', 'eyeLOpen', 'eyeROpen', 'eyeBallX', 'eyeBallY', 'browLY', 'browRY', 'bodyX', 'bodyZ', 'breath'] as const

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
/** seconds the idle motion takes to ease in from the pose it took over from (resume) */
const RESUME = 0.4

/** what pointAt reads of a puppet: where the head is drawn (a BodyPlayer passes its body's head in canvas shares) */
export type Seen = Pick<Puppet, 'model' | 'lastView'>

export class Idle {
  readonly lv = new LivelyIdle()
  private P = defaultParams()
  /** the 'turn' style's input, which the idle keeps while a face tracker drives (what tracking shows stays as it was) */
  private turn = { x: 0, y: 0 }
  /** lookAt's target holds the attention: the pointer is not followed meanwhile */
  private held = false
  /** the idle motion went on again (resume): the pose it took over from, and when */
  private resumed: { from: Params; t: number } | null = null

  constructor() {
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) this.lv.moves = 0
  }

  /** one frame of the idle motion into P: the keys it sets, and its smile over P's */
  apply(P: Params, t: number, dt: number, now: { busy: boolean; tracked: boolean; faceFree: boolean }) {
    const lv = this.lv
    lv.busy = now.busy; lv.tracked = now.tracked; lv.faceFree = now.faceFree
    lv.look = this.turn
    lv.apply(this.P, t, dt)
    const r = this.resumed, x = r ? Math.min(1, Math.max(0, (t - r.t) / RESUME)) : 1, w = x * x * (3 - 2 * x)
    if (r && w >= 1) this.resumed = null
    for (const k of IDLE_KEYS) P[k] = r && w < 1 ? r.from[k] + (this.P[k] - r.from[k]) * w : this.P[k]
    P.smile = Math.max(P.smile, this.P.smile)
  }

  /** The idle motion goes on again after frames drawn without it: from `from` (the pose those frames showed for the keys it
   *  sets: the player's own values), its springs at rest there, easing into its own motion over RESUME seconds, instead of
   *  jumping in one frame to where it stopped (and its eyes and breath to wherever they were) */
  resume(from: Params, t: number) {
    this.lv.startFrom(from)
    for (const k of ['eyeBallX', 'eyeBallY', 'browLY', 'browRY'] as const) this.P[k] = from[k]
    this.resumed = { from: { ...from }, t }
  }

  /** after the frame: the head as shown, everything over the idle included (the body follows it) */
  shown(P: Params) { this.lv.shown.x = P.angleX; this.lv.shown.z = P.angleZ }

  /** the pointer at (x, y), CSS px from the canvas's top left (w × h its CSS size); on: it counts as on the stage (off,
   *  the character looks back) */
  pointer(p: Seen, x: number, y: number, w: number, h: number, on: boolean) {
    if (this.held) return
    pointAt(this.lv, p as Puppet, x, y, w, h, on)
    if (on) this.turn = { x: clamp((x / Math.max(1, w) - 0.5) * 2, -1, 1), y: clamp(-(y / Math.max(1, h) - 0.3) * 1.6, -1, 1) }
  }

  /** the pointer left the page */
  leave() { if (!this.held) this.lv.pointer.on = false; this.turn = { x: 0, y: 0 } }

  /** looks toward (x, y), each -1..1 from the canvas center (y up), and keeps looking there; null lets go */
  lookAt(p: Seen, x: number | null, y: number, w: number, h: number) {
    this.held = false
    if (x === null) { this.lv.pointer = { ...this.lv.pointer, on: false, keep: false }; this.turn = { x: 0, y: 0 }; return }
    this.pointer(p, ((x + 1) / 2) * w, ((1 - y) / 2) * h, w, h, true)
    this.lv.pointer.keep = true
    this.held = true
    this.turn = { x, y }
  }

  blink(t: number) { this.lv.nextBlink = Math.min(this.lv.nextBlink, t) }
}
