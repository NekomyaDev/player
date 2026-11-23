// The pose and face a character takes, on their own: what the drivers, the idle motion and the bodies that are not a
// puppet (a PNGTuber, a VRM) work with, so that none of them has to load the renderer for these. puppet.ts exports them too.

export type Params = {
  angleX: number; angleY: number; angleZ: number
  eyeLOpen: number; eyeROpen: number; eyeBallX: number; eyeBallY: number
  browLY: number; browRY: number
  mouthOpen: number; smile: number
  /** the voice's vowel (vowel.ts): -1 round (o, u) .. +1 wide (i, e), 0 neither */
  vowel: number
  bodyX: number; bodyZ: number; breath: number
}
export const defaultParams = (): Params => ({
  angleX: 0, angleY: 0, angleZ: 0, eyeLOpen: 1, eyeROpen: 1, eyeBallX: 0, eyeBallY: 0,
  browLY: 0, browRY: 0, mouthOpen: 0, smile: 0, vowel: 0, bodyX: 0, bodyZ: 0, breath: 0,
})
export const PARAM_RANGES: Record<keyof Params, [number, number]> = {
  angleX: [-30, 30], angleY: [-30, 30], angleZ: [-30, 30], eyeLOpen: [0, 1], eyeROpen: [0, 1],
  eyeBallX: [-1, 1], eyeBallY: [-1, 1], browLY: [-1, 1], browRY: [-1, 1],
  mouthOpen: [0, 1], smile: [0, 1], vowel: [-1, 1], bodyX: [-10, 10], bodyZ: [-10, 10], breath: [0, 1],
}

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** the open eye's opacity (its patch, iris and highlights) at eye-open `open`. With the blink hand-over
 *  (Puppet.blinkHandover) it is drawn whole until it is squashed to a thin slit and goes between 0.06 and 0.03; without,
 *  it fades from 0.2 to 0.02 while the closed eye comes in under it, and the two half there showed the iris as a
 *  see-through grey smear for a few frames of every blink. The closed eye's own fade is the same either way */
export const eyeFade = (open: number, handover: boolean) => (handover ? smooth(0.03, 0.06, open) : smooth(0.02, 0.2, open))

/** how long a blink holds the eyes shut with the hand-over (s). The close takes 75 ms and its bottom is an instant: a
 *  frame (17 ms at 60 fps, 33 ms in a 30 fps recording) often missed it, and that blink never showed the closed eye.
 *  35 ms: every blink has a shut frame at 30 fps too */
export const BLINK_HOLD = 0.035
/** a blink's eye-open value `t` s after it began: shut in 75 ms, held shut for `hold` s, open again in 120 ms */
export const blinkOpen = (t: number, hold = 0) => {
  const b = t / 0.075, h = hold / 0.075
  return Math.max(0, Math.min(1, b < 1 ? 1 - b : b < 1 + h ? 0 : b < 2.6 + h ? (b - 1 - h) / 1.6 : 1))
}
/** whether a blink that began `t` s ago is over */
export const blinkOver = (t: number, hold = 0) => t / 0.075 >= 2.6 + hold / 0.075
