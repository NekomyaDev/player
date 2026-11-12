import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectedAnchor } from '../src/anchors'
import { PngBody } from '../src/png'
import { defaultParams } from '../src/runtime/params'

test('projected anchors use canvas aspect for clockwise rotation and width', () => {
  const a = projectedAnchor([.5, .3], [.6, .4], 2)
  assert.ok(Math.abs(a.rotation - Math.atan2(.2, .1)) < 1e-12)
  assert.ok(Math.abs(a.scale - Math.sqrt(.05) * 2) < 1e-12)
})

test('PNG attachments follow the drawn picture and pixel filtering can change without reloading', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap')
  Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, value: async () => ({ width: 16, height: 32, close() {} }) })
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'createImageBitmap', previous); else Reflect.deleteProperty(globalThis, 'createImageBitmap') })
  const g = { imageSmoothingEnabled: true, clearRect() {}, save() {}, translate() {}, rotate() {}, drawImage() {}, restore() {} }
  const canvas = { width: 0, height: 0, getContext: () => g } as unknown as HTMLCanvasElement
  const body = new PngBody()
  body.attach(canvas)
  await body.load(new Map([['closed.png', new Blob(['test'])], ['open.png', new Blob(['test'])]]))
  const pose = { params: defaultParams(), move: { x: 0, y: 0, s: 1 }, expr: {} }
  pose.params.breath = 0
  body.render(canvas, pose, 200, 400)
  assert.equal(g.imageSmoothingEnabled, true)
  const head = body.anchor('head')!, torso = body.anchor('body')!
  assert.ok(Math.abs(head.x - .5) < 1e-12 && Math.abs(head.y - .26) < 1e-12)
  assert.ok(Math.abs(torso.y - .65) < 1e-12)
  head.x = 99; assert.equal(body.anchor('head')!.x, .5, 'anchor snapshots do not mutate the renderer')
  body.pixelated = true; pose.move.x = .2; pose.move.y = .1
  body.render(canvas, pose, 200, 400)
  assert.equal(g.imageSmoothingEnabled, false)
  assert.ok(Math.abs(body.anchor('head')!.x - .6) < 1e-12)
  assert.ok(Math.abs(body.anchor('head')!.y - .21) < 1e-12)
  pose.params.angleZ = 40
  body.render(canvas, pose, 200, 400)
  assert.ok(Math.abs(body.anchor('head')!.rotation - Math.PI / 18) < 1e-12)
  body.dispose(); assert.equal(body.anchor('head'), null)
})
