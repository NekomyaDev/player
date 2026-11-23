// Long hair lying on the body goes with the body (puppet.ts hairRestOf): the setting as the renderer reads it. Where it acts (the
// hair layers' weights over the body, from the neck down) is checked in the browser smoke test, with the frames it draws.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { HAIR_REST_DEFAULT, hairRestOf, type Tuning } from '../src/runtime/puppet'

describe('hair resting on the body', () => {
  it('is on by default: a model that says nothing gets 1', () => {
    assert.equal(HAIR_REST_DEFAULT, 1)
    assert.equal(hairRestOf(undefined), 1)
    assert.equal(hairRestOf({}), 1)
  })

  // the schema and setTuning take 0..10, as for every feel setting; like gaze, this one stops at 1 (all of the head's
  // motion that the body can take over), so more counts as 1
  it('reads a number from 0 up, at most 1: more counts as 1', () => {
    assert.equal(hairRestOf({ hairRest: 0 }), 0)
    assert.equal(hairRestOf({ hairRest: 0.7 }), 0.7)
    assert.equal(hairRestOf({ hairRest: 1 }), 1)
    assert.equal(hairRestOf({ hairRest: 3 }), 1)
    assert.equal(hairRestOf({ hairRest: 10 }), 1)
  })

  it('takes anything else as the default', () => {
    for (const v of [-1, Number.NaN, Infinity, '0.5', null]) assert.equal(hairRestOf({ hairRest: v } as unknown as Partial<Tuning>), 1)
  })
})
