import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BodyPlayer, type Body, type Pose } from '../src/body'

// Exercise the public playback contract without a GPU; the browser suite covers the concrete renderers.
test('a recorded final pose replays at exact output dimensions without drivers or actions running twice', async (t) => {
  const names = ['window', 'document', 'addEventListener', 'removeEventListener', 'requestAnimationFrame', 'cancelAnimationFrame']
  const saved = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const)
  t.after(() => { for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name) } })
  let next: FrameRequestCallback = () => {}, now = 0
  const set = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { configurable: true, value })
  set('window', { devicePixelRatio: 1 })
  set('document', { addEventListener() {}, removeEventListener() {} })
  set('addEventListener', () => {}); set('removeEventListener', () => {})
  set('requestAnimationFrame', (f: FrameRequestCallback) => { next = f; return 1 }); set('cancelAnimationFrame', () => {})
  t.mock.method(performance, 'now', () => now)
  const frames: { pose: Pose; width: number; height: number }[] = []
  const body: Body = {
    format: 'test', async load() { return { name: 'Test', expressions: [{ id: 'happy', label: 'Happy' }] } },
    render(_canvas, pose, width, height) { frames.push({ pose: structuredClone(pose), width, height }) },
    head() { return { x: 0.5, y: 0.3, rx: 0.1, ry: 0.1 } }, dispose() {},
  }
  const canvas = { toDataURL() { return 'data:image/png,test' }, clientWidth: 200, clientHeight: 300, style: {}, addEventListener() {}, removeEventListener() {} } as unknown as HTMLCanvasElement
  const player = new BodyPlayer(canvas, body, { autoplay: false, idle: false, followPointer: false })
  await player.load(new Map([['model', new Blob(['test'])]]))
  let drivers = 0, observed = 0
  player.use({ update(frame) { drivers++; frame.params.angleX = 12; frame.params.mouthOpen = 0.7; frame.move.x = 0.1 } })
  player.onFrame = (pose) => { observed++; pose.params.angleX = 99 }
  player.setExpression('happy'); player.act('hop'); player.play()
  for (let i = 0; i < 5; i++) { now += 16; next(now) }
  player.pause()
  assert.equal(observed, 5)
  assert.equal(player.getPose().params.angleX, 12, 'an empty profile preserves the existing driver result')
  player.parameterProfile = { angleX: { input: [-15, 15], output: [-30, 30], smoothing: 0, curve: 1 }, mouthOpen: { input: [0, .7], output: [0, 1], smoothing: 0, curve: 1 } }
  player.play(); now += 16; next(now); player.pause()
  assert.equal(player.parameterSample?.input.angleX, 12)
  assert.equal(player.parameterSample?.output.angleX, 24)
  assert.equal(player.getPose().params.mouthOpen, 1, 'speech channels use the same final mapping')
  assert.equal(player.params.angleX, 0, 'the mapping does not feed back into base parameters')
  const pose = player.getPose(), count = drivers
  assert.equal(pose.params.angleX, 24, 'observers receive independent copies')
  assert.ok(Math.abs(pose.move.y) > 0.001, 'the captured move includes the action')
  assert.ok(pose.expr.happy > 0)
  player.renderPose(pose, 1 / 30, [640, 960])
  assert.equal(drivers, count, 'replay bypasses the live drivers')
  assert.deepEqual(frames.at(-1), { pose: { params: pose.params, move: pose.move, expr: pose.expr }, width: 640, height: 960 })
  assert.deepEqual(Object.keys(pose).sort(), ['expr', 'move', 'params', 'view'], 'a half-body pose has no full-body fields')
  player.renderPose({ ...pose, crouch: -0.03, dip: -0.01, talk: -0.02 }, 1 / 30, [640, 960])
  assert.deepEqual(frames.at(-1), frames.at(-2), 'the full-body fields change nothing on a half-body character')
  player.snapshot()
  assert.equal(drivers, count)
  assert.equal(frames.at(-1)?.width, 640, 'snapshot retains explicit playback dimensions')
  assert.equal(frames.at(-1)?.pose.params.angleX, 24)
  player.resize()
  assert.equal(drivers, count, 'resize redraws the recorded pose')
  assert.equal(frames.at(-1)?.pose.params.angleX, 24)
  assert.equal(frames.at(-1)?.width, 200, 'resize follows the new canvas CSS dimensions')
  pose.params.angleX = -20
  assert.equal(player.getPose().params.angleX, 24, 'saved poses cannot mutate the player')
  player.renderPose({ ...pose, params: { ...pose.params, angleX: NaN, angleY: 500 }, move: { x: Infinity, y: 0.01, s: 1 }, expr: { happy: 3 } })
  const kept = frames.at(-1)!.pose
  assert.deepEqual([kept.params.angleX, kept.params.angleY, kept.move.x, kept.expr.happy], [0, 30, 0, 1], 'a pose from elsewhere is kept in range')
  assert.throws(() => player.renderPose(pose, 0, [640] as unknown as [number, number]), /dimensions/)
  player.play()
  assert.throws(() => player.renderPose(pose), /pause/)
  player.dispose()
  assert.equal(player.onFrame, undefined)
  assert.doesNotThrow(() => { player.renderPose(pose); player.resize(); player.snapshot() }, 'a disposed player draws nothing, as in 0.3')
})


test('a live output host can keep final poses running while its canvas is outside the viewport', async (t) => {
  const names = ['window', 'document', 'addEventListener', 'removeEventListener', 'requestAnimationFrame', 'cancelAnimationFrame', 'IntersectionObserver']
  const saved = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const)
  t.after(() => { for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name) } })
  const set = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { configurable: true, value })
  set('window', { devicePixelRatio: 1 }); set('document', { addEventListener() {}, removeEventListener() {} })
  set('addEventListener', () => {}); set('removeEventListener', () => {})
  let frame: FrameRequestCallback = () => {}, visibility: (entries: { isIntersecting: boolean }[]) => void = () => {}
  set('requestAnimationFrame', (f: FrameRequestCallback) => { frame = f; return 1 }); set('cancelAnimationFrame', () => {})
  set('IntersectionObserver', class { constructor(callback: typeof visibility) { visibility = callback } observe() {} disconnect() {} })
  for (const renderWhenHidden of [false, true]) {
    const body: Body = { format: 'test', async load() { return { name: 'Test', expressions: [] } }, render() {}, head() { return { x: .5, y: .3, rx: .1, ry: .1 } }, dispose() {} }
    const canvas = { clientWidth: 200, clientHeight: 300, style: {}, addEventListener() {}, removeEventListener() {} } as unknown as HTMLCanvasElement
    const player = new BodyPlayer(canvas, body, { autoplay: false, idle: false, renderWhenHidden })
    await player.load(new Map([['model', new Blob(['test'])]]))
    let poses = 0
    player.use({ update(f) { f.params.angleX = 14 } }); player.onFrame = () => { poses++ }
    player.play(); visibility([{ isIntersecting: false }])
    for (let i = 1; i <= 3; i++) frame(performance.now() + i * 16)
    assert.equal(poses, renderWhenHidden ? 3 : 0)
    if (renderWhenHidden) assert.equal(player.getPose().params.angleX, 14)
    visibility([{ isIntersecting: true }]); frame(performance.now() + 64)
    assert.equal(poses, renderWhenHidden ? 4 : 1)
    player.dispose()
  }
})
