import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultParams } from '../src/runtime/params'
import { parameterRule, readTrackingProfile, TrackingFilter } from '../src/profile'
import { startFaceTracking } from '../src/tracking'
import { FaceTracker } from '../src/runtime/tracking'
import type { Driver, Frame } from '../src/base'

test('tracking ranges expand small movements, clamp, reverse, and preserve signed curve centers', () => {
  const filter = new TrackingFilter({ angleX: { ...parameterRule('angleX'), input: [-10, 10] }, mouthOpen: { ...parameterRule('mouthOpen'), output: [1, 0] } })
  assert.equal(filter.apply({ ...defaultParams(), angleX: 5, mouthOpen: .25 }, .1).angleX, 15)
  assert.equal(filter.apply({ ...defaultParams(), angleX: 40, mouthOpen: .25 }, .1).angleX, 30)
  assert.equal(filter.sample?.output.mouthOpen, .75)
  filter.profile = { angleX: { ...parameterRule('angleX'), curve: 2 } }
  assert.equal(filter.apply(defaultParams(), .1).angleX, 0)
  assert.equal(filter.apply({ ...defaultParams(), angleX: 15 }, .1).angleX, 7.5)
  assert.equal(filter.apply({ ...defaultParams(), angleX: -15 }, .1).angleX, -7.5)
  filter.profile = { angleX: { ...parameterRule('angleX'), input: [-10, 20], curve: 2 } }
  assert.equal(filter.apply(defaultParams(), .1).angleX, -10)
})

test('independent smoothing follows elapsed time and leaves other channels immediate', () => {
  const filter = new TrackingFilter({ mouthOpen: { ...parameterRule('mouthOpen'), smoothing: 1 } })
  filter.apply(defaultParams(), .01)
  const result = filter.apply({ ...defaultParams(), mouthOpen: 1, angleX: 20 }, .5)
  assert.ok(Math.abs(result.mouthOpen - (1 - Math.exp(-1))) < 1e-9)
  assert.equal(result.angleX, 20)
  filter.profile = { mouthOpen: { ...parameterRule('mouthOpen'), output: [0, .5] } }
  assert.equal(filter.apply({ ...defaultParams(), mouthOpen: 1 }, .01).mouthOpen, .5)
  const sample = filter.sample!; sample.output.mouthOpen = 9
  assert.equal(filter.sample?.output.mouthOpen, .5)
})

test('serialized tracking profiles validate channel names, limits, finite values and nonzero input spans', () => {
  assert.deepEqual(readTrackingProfile(null), {})
  assert.deepEqual(readTrackingProfile({ vowel: { output: [1, 1] }, bodyZ: { output: [5, 5] }, breath: { output: [1, 1] } }), {})
  assert.deepEqual(readTrackingProfile({ ignored: { input: [0, 1] } }), {})
  assert.deepEqual(readTrackingProfile({ angleX: { input: [1, 1], output: [-90, 90], curve: NaN, smoothing: 3 } }), { angleX: { input: [-30, 30], output: [-30, 30], curve: 1, smoothing: 1 } })
})

test('public face profile updates the same running tracker and exposes input/output samples', async (t) => {
  const old = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => null }) } })
  t.after(() => { if (old) Object.defineProperty(globalThis, 'document', old); else Reflect.deleteProperty(globalThis, 'document') })
  let starts = 0, stops = 0, driver: Driver | undefined
  t.mock.method(FaceTracker.prototype, 'start', async function(this: FaceTracker) { starts++; this.ok = true; this.target = { angleX: 5, mouthOpen: .25 } })
  t.mock.method(FaceTracker.prototype, 'stop', () => { stops++ })
  t.mock.method(FaceTracker.prototype, 'poll', () => true)
  t.mock.method(FaceTracker.prototype, 'apply', function(this: FaceTracker, pose: ReturnType<typeof defaultParams>) { Object.assign(pose, this.target) })
  const host = { use(value: Driver) { driver = value; return () => value.dispose?.() }, blink() {} }
  const face = await startFaceTracking(host, { profile: { angleX: { ...parameterRule('angleX'), input: [-10, 10] } } })
  const frame: Frame = { params: defaultParams(), move: { x: 0, y: 0, s: 1 }, time: 1, dt: .3, tracked: false, add() {} }
  driver!.update(frame, host)
  assert.equal(frame.params.angleX, 15)
  assert.equal(face.sample?.input.angleX, 5)
  assert.equal(face.sample?.output.angleX, 15)
  face.profile = { mouthOpen: { ...parameterRule('mouthOpen'), input: [0, .5] } }
  driver!.update(frame, host)
  assert.equal(frame.params.mouthOpen, .5)
  assert.equal(starts, 1)
  face.stop(); assert.equal(stops, 1)
})
