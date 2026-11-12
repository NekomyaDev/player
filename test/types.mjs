// The package as a project that installed it sees it: its entries and types under the moduleResolution settings TypeScript
// projects use, with the declarations checked (skipLibCheck off). A broken declaration fails here; with skipLibCheck on it
// would pass and leave `any` behind, which the @ts-expect-error below catches.
//   npm run build && npm run test:types
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const { name } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
if (!fs.existsSync(path.join(root, 'dist/index.js'))) { console.error('types: build first (npm run build)'); process.exit(1) }
const dir = path.join(root, 'node_modules/.tmp/consumer')
fs.rmSync(dir, { recursive: true, force: true })
fs.mkdirSync(path.join(dir, 'node_modules', path.dirname(name)), { recursive: true })
fs.symlinkSync(root, path.join(dir, 'node_modules', name), 'dir')
fs.writeFileSync(path.join(dir, 'use.ts'), `
import { LivLivError, Player, VERSION, type ActionId, type Driver, type Fit, type Frame, type LivLivErrorCode, type LoadOptions, type LoadProgress, type ModelInfo, type PlaybackPose, type View } from '${name}'
import { preloadFaceModel, startFaceTracking, TrackingFilter, parameterRule, readTrackingProfile, TRACKING_PARAMETERS, type TrackingParameter, type TrackingProfile, type ParameterRule, type FaceTracking } from '${name}/tracking'
import { createSpeech, startLipSync, type ClipHooks, type LipSync } from '${name}/voice'
import { BODY_LIMIT, BodyPlayer, LivLivError as FromBody, type Body } from '${name}/body'
import { PngBody } from '${name}/png'
import { VrmBody } from '${name}/vrm'
declare const canvas: HTMLCanvasElement
const player = new Player(canvas, { parameterProfile: {} })
player.parameterProfile = { angleX: { input: [-20, 20], output: [-30, 30], curve: 1, smoothing: .2 } }
const sampleAngle: number | undefined = player.parameterSample?.output.angleX
void sampleAngle
const model: Promise<ModelInfo> = player.load('/avatars/sena.livliv')
const driver: Driver = { update(frame) { frame.add({ angleX: 1 }) } }
const view: View = player.view
const tracking: Promise<FaceTracking> = startFaceTracking(player)
const channels: readonly TrackingParameter[] = TRACKING_PARAMETERS
const rule: ParameterRule = parameterRule('angleX')
const filter = new TrackingFilter(); filter.apply(player.params, 1 / 60); filter.reset()
const profile: TrackingProfile = readTrackingProfile({ angleX: rule })
void tracking.then((face) => { face.profile = profile; const value: number | undefined = face.sample?.output.angleX; return value })
void channels
// @ts-expect-error breathing is not a camera tracking input
const unsupported: TrackingProfile = { breath: rule }
void unsupported
const sync: Promise<LipSync> = startLipSync(player)
const png = new PngBody({ pixelated: true })
png.pixelated = false
const body: Body = png
const bodyPlayer = new BodyPlayer(canvas, body)
const anchor = player.getAnchor('head')
const bodyAnchor = bodyPlayer.getAnchor('body')
void [anchor?.rotation, anchor?.scale, bodyAnchor?.x]
// @ts-expect-error only the two documented attachment points are available
player.getAnchor('hand')
player.use(driver)
const hooks: ClipHooks = { onEnd() {}, onFail() {} }
createSpeech(player).say(new Response(new Blob()), hooks)
const pose: PlaybackPose = { ...player.getPose(), crouch: -0.02, dip: 0, talk: 0 }
const shot: Fit = 'knee'
player.view.fit = shot
const old: PlaybackPose = { params: pose.params, move: pose.move, expr: {}, view: { x: 0, y: 0, zoom: 1, head: false } }
// @ts-expect-error a shot is one of three
player.view.fit = 'feet'
const tall: boolean = player.model!.fullBody
player.use({ update(f: Frame) { f.talk += f.grounded ? -0.01 : 0 } })
void [old, tall]
player.renderPose(pose, 1 / 30, [640, 960])
void [VERSION, model, view, tracking, sync, preloadFaceModel(), createSpeech(player), BODY_LIMIT, bodyPlayer, new VrmBody()]
// the expressions getter keeps the model's label fields on both players (issue #8): label is a string, labels a map
const playerLabels: string[] = player.expressions.map((e) => e.label)
const playerTranslations: string[] = player.expressions.map((e) => e.labels.en)
const bodyLabels: string[] = bodyPlayer.expressions.map((e) => e.label)
const bodyTranslations: string[] = bodyPlayer.expressions.map((e) => e.labels.en)
void [playerLabels, playerTranslations, bodyLabels, bodyTranslations]
// @ts-expect-error unknown expression fields stay rejected, not widened to any
void player.expressions.map((e) => e.nope)
const options: LoadOptions = { signal: new AbortController().signal, poster: '/cover.webp', onProgress: (p: LoadProgress) => void (p.step === 'download' ? p.progress : 0) }
const again: Promise<ModelInfo> = player.load('/avatars/sena.livliv', options)
const point: [number, number] = player.canvasToModel(1, 2)
const moved: number = player.poke(point[0], point[1])
const code: LivLivErrorCode | null = again instanceof LivLivError ? again.code : null
const move: ActionId = 'nod'
player.act(move)
player.setAway(true)
player.maxPixelRatio = 1
void [moved, code, new FromBody('http', 'x', { status: 404 }).status]
// the types are real, not any: these must be errors
// @ts-expect-error a switch now: setAway
player.act('away')
// @ts-expect-error not part of the API
void player.puppet
// @ts-expect-error nor are the insides
void player.frame
// @ts-expect-error the codes are a list
const nope: LivLivErrorCode = 'nope'
void nope
// @ts-expect-error not an action
player.act('nope')
// @ts-expect-error a name is text
const n: number = (await model).name
void n
`)
const tsc = createRequire(path.join(root, 'package.json')).resolve('typescript/bin/tsc')
let failed = 0
for (const [moduleResolution, module] of [['node16', 'node16'], ['nodenext', 'nodenext'], ['bundler', 'esnext']]) {
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { noEmit: true, strict: true, target: 'es2022', lib: ['es2023', 'dom', 'dom.iterable'],
    module, moduleResolution, skipLibCheck: false, types: [] }, files: ['use.ts'] }))
  try {
    execFileSync(process.execPath, [tsc, '-p', dir], { stdio: 'pipe' })
    console.log(`ok   moduleResolution ${moduleResolution}`)
  } catch (e) {
    failed++
    console.log(`FAIL moduleResolution ${moduleResolution}\n${String(e.stdout).split('\n').slice(0, 12).join('\n')}`)
  }
}
fs.rmSync(dir, { recursive: true, force: true })
process.exit(failed ? 1 : 0)
