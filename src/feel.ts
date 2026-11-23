// A feel setting (a model's tuning) as the player reads it, in a module of its own: lip sync and face tracking read it
// without taking in the player.

/** a feel setting as the player reads it: a number from 0 up, anything else (missing, null, NaN, below 0) the default 1
 *  @internal */
export const factor = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 1)
