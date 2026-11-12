// Browser smoke test: every featured character in characters/ loaded and drawn by the built player (dist/) in headless
// Chromium (WebGL2 in software), with its mark, plus loading from files, a v3 package drawing like its v4, and
// refusing a newer format (see smoke.html); then the characters that aren't LivLiv models, a PNGTuber and a VRM
// (bodies.html).
//   npm run build && npm run test:browser
// Needs a Chromium for playwright-core once: npx playwright-core install chromium-headless-shell
// With an engine's name (firefox, webkit: npm run test:engines), a small sample on that browser's engine: what the three
// engines might do differently (loads replaced, the context lost and given up, the poster, the contract of the two classes).
import { createServer } from 'node:http'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, firefox, webkit } from 'playwright-core'
import { crc32, deflateSync } from 'node:zlib'
import { tinyVrm } from './tiny-vrm.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const chars = join(root, 'characters')
if (!existsSync(join(root, 'dist/index.js'))) { console.error('smoke: build first (npm run build)'); process.exit(1) }
const ids = existsSync(chars) ? readdirSync(chars).filter((d) => statSync(join(chars, d)).isDirectory()).sort() : []
if (!ids.length) { console.error('smoke: no featured characters in characters/'); process.exit(1) }
/** each character's files, as paths inside its folder (the page loads them as a picked folder) */
const list = (dir, at = '') => readdirSync(join(dir, at), { withFileTypes: true })
  .flatMap((d) => (d.isDirectory() ? list(dir, join(at, d.name)) : [join(at, d.name).split('\\').join('/')]))
const files = Object.fromEntries(ids.map((id) => [id, list(join(chars, id))]))

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' }
const vrm = tinyVrm()
/** an image bomb: a 9000 x 9000 PNG (all black, 80 KB), past the player's 8192 px a side */
function bombPng(side = 9000) {
  const chunk = (type, data) => {
    const b = Buffer.alloc(12 + data.length), t = Buffer.concat([Buffer.from(type), data])
    b.writeUInt32BE(data.length, 0); t.copy(b, 4); b.writeUInt32BE(crc32(t), 8 + data.length)
    return b
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(side, 0); ihdr.writeUInt32BE(side, 4); ihdr[8] = 8; ihdr[9] = 0
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.alloc(side * (side + 1)))), chunk('IEND', Buffer.alloc(0))])
}
const bomb = bombPng()
/** a face model that takes a while to arrive, for what happens to its download (runDownload in bodies.html) */
const slowModel = { asked: 0, finished: 0 }
/** requests per route of runDropped */
const dropped = {}
/** the slow routes (runLoads): how many were asked for, ran to the end, were closed before it */
const slow = { asked: 0, finished: 0, cut: 0 }
const slowly = (res, b, headers, ms = 40, parts = 25) => {
  slow.asked++
  res.writeHead(200, { 'content-type': 'application/octet-stream', ...headers })
  let i = 0
  const tick = setInterval(() => {
    res.write(b.subarray(Math.floor((i * b.length) / parts), Math.floor(((i + 1) * b.length) / parts)))
    if (++i === parts) { clearInterval(tick); slow.finished++; res.end() }
  }, ms)
  res.on('close', () => { if (i < parts) { slow.cut++; clearInterval(tick) } })
}
/** a PNG of one colour */
function solidPng(hex, side = 8) {
  const chunk = (type, data) => {
    const b = Buffer.alloc(12 + data.length), t = Buffer.concat([Buffer.from(type), data])
    b.writeUInt32BE(data.length, 0); t.copy(b, 4); b.writeUInt32BE(crc32(t), 8 + data.length)
    return b
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(side, 0); ihdr.writeUInt32BE(side, 4); ihdr[8] = 8; ihdr[9] = 2
  const line = Buffer.concat([Buffer.from([0]), ...Array.from({ length: side }, () => Buffer.from(hex, 'hex'))])
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: side }, () => line)))), chunk('IEND', Buffer.alloc(0))])
}
const server = createServer((req, res) => {
  if (req.url.startsWith('/__model.task')) {
    slowModel.asked++
    res.writeHead(200, { 'content-type': 'application/octet-stream' })
    let left = 25
    const tick = setInterval(() => {
      if (res.destroyed) { clearInterval(tick); return }
      res.write(Buffer.alloc(150_000))
      if (--left === 0) { clearInterval(tick); slowModel.finished++; res.end() }
    }, 40)
    res.on('close', () => clearInterval(tick))
    return
  }
  const taking = req.url.match(/^\/__slow(-nosize)?\/(.+)\.livliv$/)
  if (taking) {
    const b = readFileSync(join(chars, `${taking[2]}.livliv`))
    slowly(res, b, taking[1] ? {} : { 'content-length': b.length })
    return
  }
  const picture = req.url.match(/^\/__slow-png\/(\w+)\.png$/)
  if (picture) { const b = solidPng(picture[1]); slowly(res, b, { 'content-type': 'image/png', 'content-length': b.length }, 60, 5); return }
  const drop = req.url.match(/^\/__dropped\/(once|always|missing)\/(.+)\.livliv$/)
  if (drop) {
    const [, how, id] = drop, n = (dropped[how] = (dropped[how] || 0) + 1)
    if (how === 'missing') { res.writeHead(404).end(); return }
    const b = readFileSync(join(chars, `${id}.livliv`))
    if (how === 'always' || n === 1) {  // half of the file, then the connection goes
      res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': b.length })
      res.write(b.subarray(0, b.length >> 1), () => res.destroy())
      return
    }
    res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': b.length }).end(b)
    return
  }
  if (req.url === '/__tiny.vrm') { res.writeHead(200, { 'content-type': 'model/gltf-binary' }).end(vrm); return }
  const spoiled = req.url.match(/^\/__tiny\/([^/]+)\.vrm$/)
  if (spoiled) { res.writeHead(200, { 'content-type': 'model/gltf-binary' }).end(tinyVrm(JSON.parse(decodeURIComponent(spoiled[1])))); return }
  if (req.url === '/__bomb.png') { res.writeHead(200, { 'content-type': 'image/png' }).end(bomb); return }
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '')
  const f = join(root, p)
  if (!f.startsWith(root) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404).end(); return }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }).end(readFileSync(f))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))

const engine = process.argv[2]
if (engine) {
  const browser = await ({ firefox, webkit }[engine]).launch(engine === 'firefox' ? { firefoxUserPrefs: { 'webgl.force-enabled': true, 'webgl.disabled': false } } : {})
  let failedHere = 0
  const check = (ok, what) => { if (!ok) failedHere++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${engine}: ${what}`) }
  try {
    const ctx = await browser.newContext({ permissions: [] }), page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://127.0.0.1:${server.address().port}/test/smoke.html`)
    await page.waitForFunction(() => typeof window.run === 'function')
    if (!await page.evaluate(async () => (await import('/dist/index.js')).Player.isSupported())) {
      console.log(`FAIL ${engine}: no WebGL2 here. This sample needs a GPU or a software GL, which a Linux machine without a display may not have`)
      await browser.close(); server.close()
      process.exit(1)
    }
    const chosen = ids.slice(0, 3), nameIn = (id) => JSON.parse(readFileSync(join(chars, id, 'model.json'), 'utf8')).name
    await page.evaluate((f) => window.setFiles(f), files)
    const r = await page.evaluate((a) => window.runLoads(a), chosen)
    check(r.row.first === 'AbortError' && r.row.second === 'AbortError' && r.row.third === nameIn(chosen[2]) && r.row.shown === nameIn(chosen[2]) && r.row.went === 1, `the last of three loads plays, once: ${JSON.stringify(r.row)}`)
    // (WebKit may keep the connection of a download called off)
    if (engine !== 'webkit') check(slow.cut >= 2, `the replaced downloads stop: ${slow.cut} cut`)
    check(r.quiet === 0 && r.loud.join() === 'http', `nobody catching: replaced ${r.quiet}, a real error ${r.loud}`)
    check(r.already.said === 'AbortError' && r.already.running === nameIn(chosen[0]), 'a signal already aborted leaves the running load alone')
    check(r.own.said === 'AbortError' && r.own.kept && r.reason === 'my reason', "one's own signal")
    const rising = (steps) => { const d = steps.filter((s) => s.step === 'download').map((s) => s.progress); return d.every((v, i) => !i || v > d[i - 1]) && d.at(-1) === 1 && steps.at(-1).step === 'build' }
    check(rising(r.progress.package) && rising(r.progress.unknown) && rising(r.progress.folder), `progress rises to 1: ${r.progress.package.length} steps`)
    check(r.disposed[0] === 'AbortError', 'disposed while it runs')
    const q = await page.evaluate((id) => window.runPoster(id), chosen[0])
    check(/cover\.webp/.test(q.during.image) && q.same && q.over === 'none' && q.failed === 'none' && q.replaced === 'none' && q.disposed === 'none', 'the poster, and the background back after')
    // (only Chromium and Firefox get room back from a released context; Firefox has not been seen to drop one by count)
    const x = await page.evaluate(([id, big]) => window.runContext(id, big), [chosen[0], engine === 'firefox'])
    check(x.before === false && x.lost === true && x.told === 1 && x.running === 'context-lost' && x.load === 'context-lost' && x.snapshot === 'string', `the context lost: told ${x.told}, a load ${x.load}`)
    check(x.nextTask === true && x.releasedTold === 0 && x.reuse === 'released', `released: gone next task ${x.nextTask}, the canvas says ${x.reuse}`)
    check(x.remount.lost === false && x.remount.loaded === true && x.remount.share > 0.05, `unmount and mount in one task: ${JSON.stringify(x.remount)}`)
    if (engine === 'firefox') check(x.withRelease.lost === false, '40 players came and went with release: the one that stays stays')
    await page.goto(`http://127.0.0.1:${server.address().port}/test/bodies.html`)
    await page.waitForFunction(() => typeof window.runBodies === 'function')
    for (const kind of ['player', 'png']) {
      const c = await page.evaluate(([k, id]) => window.runContract(k, id), [kind, chosen[0]])
      check(c.snapshot && c.clamped.join() === '30,0' && c.nan.join() === '0,1,0' && c.failed === 'refused' && c.kept && c.after === null && c.away < 0.05 && c.back > 0.9, `the contract, ${kind}: ${c.name}`)
    }
    const b = await page.evaluate(() => window.runBodyLoads())
    check(b.row.a === 'AbortError' && b.row.b === 'AbortError' && b.row.last === 'loaded' && b.held.d === 'd' && b.held.calls.join() === 'a,d', 'a BodyPlayer, several loads')
    const v = await page.evaluate(() => window.runBodyContext())
    check(v.vrm.told === 1 && v.vrm.load === 'context-lost' && v.vrmReleased.reuse === 'released' && !!v.png.again, 'a BodyPlayer, the context')
    check(!errors.length, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`)
  } finally { await browser.close(); server.close() }
  console.log(failedHere ? `smoke ${engine}: ${failedHere} failed` : `smoke ${engine}: ok`)
  process.exit(failedHere ? 1 : 0)
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required',
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
let failed = 0
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`http://127.0.0.1:${server.address().port}/test/smoke.html`)
  await page.waitForFunction(() => typeof window.run === 'function')
  const { out, fromFiles, newer, legacy, packaged, vrmHere, vrmFolder, codes } = await page.evaluate((a) => window.run(a), { ids, files })
  const codesOk = Object.entries(codes).every(([want, got]) => want.split(' ')[0] === got)
  if (!codesOk) failed++
  console.log(`${codesOk ? 'ok  ' : 'FAIL'} what a load rejects with says what went wrong: ${Object.entries(codes).map(([k, v]) => (k.split(' ')[0] === v ? v : `${k}: ${v}`)).join(', ')}`)
  const vrmHereOk = /BodyPlayer/.test(vrmHere) && /BodyPlayer/.test(vrmFolder)
  if (!vrmHereOk) failed++
  console.log(`${vrmHereOk ? 'ok  ' : 'FAIL'} a VRM handed to a Player: ${vrmHere}`)
  for (const r of out) {
    // the featured characters carry the LivLiv mark in the corner only: the player must draw it there and nowhere else
    const ok = !r.error && r.share > 0.05 && r.glError === 0 && r.watermark === 'LivLiv' && r.mark > 0.001 && r.outside < 0.0003 && r.noise < 0.0005
      && r.license === ({ p01: 'CC-BY-NC-SA-4.0', p02: 'CC-BY-NC-SA-4.0', p03: 'LicenseRef-Third-Party-Character' }[r.id] ?? 'LicenseRef-LivLiv-Samples')
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.id.padEnd(6)} ${r.error ?? `${r.name} (${r.format}), ${r.expressions}, covers ${(r.share * 100).toFixed(1)} %, mark ${r.watermark} on ${(r.mark * 100).toFixed(2)} % (outside the corner ${(r.outside * 100).toFixed(2)} %, noise ${(r.noise * 100).toFixed(2)} %), ${r.ms} ms${r.glError ? `, GL error ${r.glError}` : ''}`}`)
  }
  const filesOk = !fromFiles.error && fromFiles.share > 0.05
  if (!filesOk) failed++
  console.log(`${filesOk ? 'ok  ' : 'FAIL'} from files: ${fromFiles.error ?? `${fromFiles.name}, covers ${(fromFiles.share * 100).toFixed(1)} %`}`)
  for (const k of packaged) {
    const ok = k.changed < 0.0005 && k.keys[0] === k.keys[1]
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${k.id}.livliv from a URL: ${(k.changed * 100).toFixed(2)} % of the pixels differ from its folder, keyforms ${k.keys.join(' / ')}`)
  }
  const legacyOk = !legacy.error && /^livemaker-puppet 3$/.test(legacy.format) && legacy.watermark === null && legacy.changed < 0.0005
  if (!legacyOk) failed++
  console.log(`${legacyOk ? 'ok  ' : 'FAIL'} v3 package: ${legacy.error ?? `${legacy.format}, ${(legacy.changed * 100).toFixed(2)} % of the pixels differ from its v4`}`)
  const newerOk = /update the player/.test(newer.message || '') && !!newer.kept
  if (!newerOk) failed++
  console.log(`${newerOk ? 'ok  ' : 'FAIL'} newer format refused: ${newer.message ?? newer.error} (kept: ${newer.kept})`)
  // hostile packages: refused with the model before kept; broken keyforms: played on the rig alone
  const kfId = ids.find((id) => JSON.parse(readFileSync(join(chars, id, 'model.json'), 'utf8')).files?.keyforms) ?? ids[0]
  const hostile = await page.evaluate(([a, b]) => window.runHostile(a, b), [ids[0], kfId])
  const why = { bomb: /too large/, path: /not an image path|not a path/, canvas: /canvas/, box: /box/, json: /not a model\.json/, layers: /layers/, mesh: /vertices/, chain: /no id/, browLine: /brow line/, rig: /rig\.roll/ }
  const code = { bomb: 'too-large', path: 'invalid', canvas: 'too-large', box: 'invalid', json: 'not-a-model', layers: 'too-large', mesh: 'too-large', chain: 'invalid', browLine: 'invalid', rig: 'invalid' }
  for (const [k, re] of Object.entries(why)) {
    const r = hostile[k], ok = !r.loaded && re.test(r.refused) && !!r.kept && r.code === code[k]
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} refuses ${k}: ${r.loaded ? 'it loaded' : r.refused.slice(0, 110)} (kept: ${r.kept})`)
  }
  const kfOk = hostile.keyforms.loaded && hostile.keyforms.share > 0.05
  if (!kfOk) failed++
  console.log(`${kfOk ? 'ok  ' : 'FAIL'} broken keyforms: ${hostile.keyforms.refused ?? `${hostile.keyforms.name} plays on the rig alone`}`)

  // a full-body character (see runFullBody): the shots, the feet on the ground, the dip, a recorded pose replayed
  {
    const r = await page.evaluate((id) => window.runFullBody(id), ids[0])
    const near = (a, b) => Math.abs(a - b) < 1e-9
    const checks = {
      'a half-body character is no full-body one': r.half.fullBody === false && r.half.keys === 'expr,move,params,view',
      'read as one': r.fullBody === true && r.size.split(',')[1] > r.size.split(',')[0],
      'the shots': r.shots.frame.head > r.shots.knee.head && r.shots.knee.head > r.shots.whole.head && Object.values(r.shots).every((x) => x.share > 0.02),
      'the pose': near(r.pose.crouch, -0.03) && near(r.pose.dip, -0.01) && near(r.pose.talk, -0.01) && r.pose.y === 0 && near(r.pose.x, 0.05) && r.pose.fit === 'whole',
      'the feet stay': r.restFeet > 2 && Math.abs(r.crouchFeet - r.restFeet) <= 1 && Math.abs(r.sunkFeet - r.restFeet) <= 1 && r.liftFeet > r.restFeet + 3,
      'replayed exactly': r.replayed === 0 && r.without > 0.001,
      'a lean away is not followed': r.leanAway.y === 0 && r.leanAway.crouch === 0,
      'a NaN from a driver': r.afterNaN.x === 0 && r.afterNaN.hem && r.afterNaN.share > 0.02,
      'a recorded pose held to live ranges': r.held.y === 0 && r.held.crouch === -0.15 && r.held.dip === -0.15,
      'anchors': r.anchors.head && r.anchors.body,
    }
    const wrong = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k)
    if (wrong.length) failed++
    console.log(`${wrong.length ? 'FAIL' : 'ok  '} a full-body character${wrong.length ? `: ${wrong.join(', ')}: ${JSON.stringify(r)}` : `: head ${r.shots.frame.head.toFixed(2)} / ${r.shots.knee.head.toFixed(2)} / ${r.shots.whole.head.toFixed(2)} of the width by shot, feet ${r.restFeet} px up at rest, ${r.crouchFeet} crouched, ${r.sunkFeet} asked to sink, ${r.liftFeet} lifted`}`)
  }

  // a model that breaks while it is built (see runKeep): the character before stays, to the pixel
  const has = (test) => ids.find((id) => test(JSON.parse(readFileSync(join(chars, id, 'model.json'), 'utf8')), id))
  const rigged = has((m) => m.rig?.chains?.length && m.files?.keyforms) ?? kfId
  const chained = has((m, id) => m.rig?.chains?.length && id !== rigged) ?? ids[0]
  const keep = await page.evaluate(([a, b]) => window.runKeep(a, b), [chained, rigged])
  const { none: noFail, left: keepLeft, ...failures } = keep
  const keepOk = noFail.differ === 0 && Object.values(keepLeft).every((n) => n <= 0) && Object.values(failures).every((r) => r.said && r.reached && r.differ === 0 && r.sameFields && r.sameGpu && !/^refused/.test(r.next) && r.glError === 0)
  if (!keepOk) failed++
  console.log(`${keepOk ? 'ok  ' : 'FAIL'} a model breaks while it is built (${rigged} over ${chained}): ${Object.entries(failures).map(([k, r]) => `${k}: ${r.reached ? '' : 'NOT REACHED '}${r.differ} values differ${r.sameFields ? '' : ', FIELDS changed'}${r.sameGpu ? '' : ', GPU changed'}${/^refused/.test(r.next) ? `, then ${r.next}` : ''}${r.glError ? `, GL error ${r.glError}` : ''}`).join('; ')}${keepOk ? '' : `; with no failure ${noFail.differ}; left ${JSON.stringify(keepLeft)}`}`)

  // random changes to a model.json in the real player (see runFuzz): the seeds of a run are the same every time
  const fuzzed = await page.evaluate(([a, b]) => window.runFuzz(a, b, 1, 150), [ids.find((i) => i === 'k02') ?? ids[0], ids[0]])
  const fuzzOk = !fuzzed.wrong.length
  if (!fuzzOk) failed++
  console.log(`${fuzzOk ? 'ok  ' : 'FAIL'} 150 changed models: ${fuzzed.counts.refused} refused, ${fuzzed.counts.loaded} loaded, of them ${fuzzed.counts.blank} blank${fuzzOk ? '' : `\n  ${fuzzed.wrong.join('\n  ')}`}`)
  // a package whose connection drops (see runDropped)
  const drops = await page.evaluate((id) => window.runDropped(id), ids[0])
  const dropsOk = /^played/.test(drops.once) && dropped.once === 2 && /could not load/.test(drops.always) && !/Failed to fetch/.test(drops.always) && dropped.always === 2
    && /HTTP 404/.test(drops.missing) && dropped.missing === 1 && JSON.stringify(drops.said) === JSON.stringify([['unreachable', null], ['http', 404]])
  if (!dropsOk) failed++
  console.log(`${dropsOk ? 'ok  ' : 'FAIL'} a package's connection drops: once "${drops.once}" (${dropped.once} requests), always "${drops.always.slice(0, 60)}…" (${dropped.always}), a 404 "${drops.missing.slice(0, 50)}…" (${dropped.missing})`)

  // several loads at once, called off, how far they have come (see runLoads)
  {
    const chosen = ids.slice(0, 3)
    const r = await page.evaluate((a) => window.runLoads(a), chosen)
    const nameIn = (id) => JSON.parse(readFileSync(join(chars, id, 'model.json'), 'utf8')).name
    const rising = (steps) => {
      const d = steps.filter((s) => s.step === 'download').map((s) => s.progress)
      return d.every((v, i) => !i || v > d[i - 1]) && d.at(-1) === 1 && steps.at(-1).step === 'build' && steps.filter((s) => s.step === 'build').length === 1
    }
    const checks = {
      'only the last plays': r.row.first === 'AbortError' && r.row.second === 'AbortError' && r.row.third === nameIn(chosen[2]) && r.row.shown === nameIn(chosen[2]) && r.row.went === 1,
      'the replaced downloads stop': slow.cut >= 2,
      'nobody catching': r.quiet === 0 && r.loud.join() === 'http',
      'a signal already aborted': r.already.said === 'AbortError' && r.already.running === nameIn(chosen[0]),
      "one's own signal": r.own.said === 'AbortError' && r.own.kept && r.reason === 'my reason',
      'progress': rising(r.progress.package) && r.progress.package.filter((s) => s.step === 'download').length > 5 && rising(r.progress.unknown) && rising(r.progress.folder) && r.progress.files.length === 1 && r.progress.files[0].step === 'build',
      'a callback that throws': r.badCallback === nameIn(chosen[0]),
      'dispose': r.disposed[0] === 'AbortError' && /disposed/.test(r.disposed[1]) && r.after === 'AbortError',
    }
    const wrong = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k)
    if (wrong.length) failed++
    console.log(`${wrong.length ? 'FAIL' : 'ok  '} several loads, called off: ${wrong.length ? `${wrong.join(', ')}: ${JSON.stringify(r).slice(0, 900)}` : `${slow.cut} downloads stopped of ${slow.asked}; ${r.progress.package.length} steps from a package`}`)
    const q = await page.evaluate((id) => window.runPoster(id), chosen[0])
    const has = (v) => /cover\.webp/.test(v), posterOk = has(q.during.image) && q.during.size === 'contain' && q.during.repeat === 'no-repeat' && q.during.color === 'rgb(1, 2, 3)' && q.same
      && q.over === 'none' && has(q.failing) && q.failed === 'none' && q.replaced === 'none' && q.disposed === 'none'
    if (!posterOk) failed++
    console.log(`${posterOk ? 'ok  ' : 'FAIL'} poster: shown until the first frame, the canvas's own background after${posterOk ? '' : `: ${JSON.stringify(q)}`}`)
  }

  // the context lost, and given up (see runContext)
  {
    const r = await page.evaluate((id) => window.runContext(id), ids[0])
    const checks = {
      lost: r.before === false && r.lost === true && r.told === 1,
      'a load running': r.running === 'context-lost', 'a load after': r.load === 'context-lost', 'frames, a snapshot': r.snapshot === 'string', 'a new player on it': r.newOnLost === 'context-lost',
      release: r.sameTask === false && r.nextTask === true && r.releasedTold === 0 && r.reuse === 'released',
      'unmount and mount': r.remount.lost === false && r.remount.loaded === true && r.remount.told === 0 && r.remount.share > 0.05,
      'with release, the one that stays stays': r.withRelease.lost === false && r.withRelease.told === 0,
      'without, it is pushed out and told': r.withoutRelease.lost === true && r.withoutRelease.told === 1 && r.overLimitLoad === 'context-lost',
    }
    const wrong = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k)
    if (wrong.length) failed++
    console.log(`${wrong.length ? 'FAIL' : 'ok  '} the context lost and given up${wrong.length ? `: ${wrong.join(', ')}: ${JSON.stringify(r)}` : ': told once, frames idle, loads say so; 40 players came and went beside one that stayed'}`)
  }

  // disposing while something runs (see runLifecycle)
  const life = await page.evaluate((id) => window.runLifecycle(id), ids[0])
  const lifeOk = /AbortError: .*disposed/.test(life.load) && life.model === null && life.drawn === 0 && life.freed >= life.made && life.glError === 0
    && life.driver === 1 && !!life.again && life.mic === 'ended' && life.supported === true
    && Object.values(life.left).every((n) => n <= 0)
  if (!lifeOk) failed++
  console.log(`${lifeOk ? 'ok  ' : 'FAIL'} dispose while running: load "${life.load}", ${life.made} textures made, ${life.freed} freed, drawn ${life.drawn}, GL error ${life.glError}, driver disposed ${life.driver}, a new player ${life.again}, microphone ${life.mic}, left on the GPU after 3 loads and dispose ${JSON.stringify(life.left)}`)

  // bodies: a PNGTuber shows each picture and follows the drivers; a VRM loads, draws and takes its expressions
  await page.goto(`http://127.0.0.1:${server.address().port}/test/bodies.html`)
  await page.waitForFunction(() => typeof window.runBodies === 'function')
  const { png, vrm: v, pngFailed, pngOnGl, vrmAgain, vrmOn2d } = await page.evaluate(() => window.runBodies())
  const is = (rgb, [r, g, b]) => Math.abs(rgb[0] - r) < 40 && Math.abs(rgb[1] - g) < 40 && Math.abs(rgb[2] - b) < 40
  const pngOk = !png.error && png.format === 'png' && is(png.shown.closed, [255, 0, 0]) && is(png.shown.open, [0, 255, 0])
    && is(png.shown.blink, [0, 0, 255]) && is(png.shown.blinkOpen, [255, 255, 0]) && png.tracked && png.angle > 0 && png.mouth > 0.3
  if (!pngOk) failed++
  console.log(`${pngOk ? 'ok  ' : 'FAIL'} PNGTuber: ${png.error ?? `pictures ${['closed', 'open', 'blink', 'blinkOpen'].map((k) => png.shown[k].join(',')).join(' / ')}, face tracked ${png.tracked} (turn ${png.angle.toFixed(2)}°), speech opens the mouth to ${png.mouth.toFixed(2)}`}`)
  const rate = await page.evaluate(() => window.runSpeechRate())
  const secs = (bs) => bs.reduce((s, b) => s + b.seconds, 0)
  const rateOk = (bs, want) => bs.length > 0 && bs.every((b) => b.rate === want) && Math.abs(secs(bs) - 1) < 0.02
  // decoded whole, the browser resamples to its own rate: only the second counts there
  const speechOk = rate.bad100.length > 0 && rate.idleFired && rateOk(rate.wav16, 16000) && rateOk(rate.wav24, 24000) && rate.generic16.length > 0 && Math.abs(secs(rate.generic16) - 1) < 0.02
  if (!speechOk) failed++
  console.log(`${speechOk ? 'ok  ' : 'FAIL'} speech keeps a WAV's own rate: bad rate ${JSON.stringify(rate.bad100)} (idle fired ${rate.idleFired}), 16 kHz ${JSON.stringify(rate.wav16)}, 24 kHz ${JSON.stringify(rate.wav24)}, decoded whole ${JSON.stringify(rate.generic16)}`)
  const playback = await page.evaluate(() => window.runStagePlayback())
  const playbackOk = playback.pose.width === 640 && playback.pose.height === 960 && playback.pose.drivers && playback.pose.action && playback.pose.mouth === 1
    && playback.pixel[1] > 200 && playback.volume === 0.35 && playback.response.join() === 'start,end'
    && playback.streamBefore && playback.streamLive && playback.streamSound && playback.streamStable && playback.streamEnded
    && playback.broken.at(-1) === 'fail' && playback.after.join() === 'start,end' && playback.cancelled && playback.cancelledOther && playback.afterStop.join() === 'start,end'
  if (!playbackOk) failed++
  console.log(`${playbackOk ? 'ok  ' : 'FAIL'} Stage playback poses, streamed voice hooks and cancellation: ${JSON.stringify(playback)}`)
  const vrmOk = !v.error && v.format === 'vrm' && v.share > 0.02 && v.happy && v.smile && !v.unknown && v.tracked && v.head
    && ['Smile', 'Happy', 'Sad', 'Surprised', 'Wink'].every((l) => v.expressions.includes(l))
  if (!vrmOk) failed++
  console.log(`${vrmOk ? 'ok  ' : 'FAIL'} VRM: ${v.error ?? `${v.name}, ${v.expressions.join(' / ')}, covers ${(v.share * 100).toFixed(1)} %, face tracked ${v.tracked}`}`)
  for (const spec of [1, 0]) {
    const u = encodeURIComponent(JSON.stringify({ spec }))
    const r = await page.evaluate((url) => window.runVrmPose(url), `/__tiny/${u}.vrm`)
    const ok = String(r.spec) === String(spec) && r.hand < -0.1 && r.yaw > 0.1 && r.pitch > 0.1 && r.roll > 0.1 && r.up > 0.05 && r.down === 0 && r.right > 0.05
      && r.terms.spec === String(spec) && r.terms.author.name === 'LivLiv Player tests' && r.terms.use === 'everyone' && r.terms.commercial === (spec ? 'personal non-profit' : 'allow') && r.terms.license
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} VRM ${spec === 0 ? '0.x' : '1.0'} stands and moves: hand ${r.hand.toFixed(2)} below the shoulder, turn ${r.yaw.toFixed(2)}, nod ${r.pitch.toFixed(2)}, roll ${r.roll.toFixed(2)}, gaze up ${r.up.toFixed(2)} down ${r.down.toFixed(2)} right ${r.right.toFixed(2)}; terms ${r.terms.author.name}, ${r.terms.commercial}`)
  }
  // files a VRM player refuses, saying why; one naming an outside file must not make the page ask for it
  const tiny = (o) => `/__tiny/${encodeURIComponent(JSON.stringify(o))}.vrm`
  let outsideAsked = 0
  page.on('request', (r) => { if (new URL(r.url()).pathname === '/__outside.png') outsideAsked++ })
  const no = await page.evaluate((urls) => window.runVrmRefusals(urls), { noMesh: tiny({ noMesh: true }), draco: tiny({ draco: true }), bigImage: tiny({ bigImage: true }),
    outside: tiny({ outsideImage: `http://127.0.0.1:${server.address().port}/__outside.png` }) })
  const noOk = /no mesh/.test(no.noMesh) && /Draco/.test(no.draco) && /too large/.test(no.bigImage) && /outside itself/.test(no.outside) && outsideAsked === 0 && /not a VRM/.test(no.plainFile) && no.kept === 'Tiny'
  if (!noOk) failed++
  console.log(`${noOk ? 'ok  ' : 'FAIL'} VRM files refused, the character before kept (${no.kept}), outside requests ${outsideAsked}: ${[no.noMesh, no.draco, no.bigImage, no.outside, no.plainFile].map((m) => m.replace(/^LivLiv: \S+ /, '').slice(0, 34)).join(' | ')}`)

  // in any units: a character 100 times too big, or a tenth of the size, still fills the frame
  for (const unit of [100, 0.1]) {
    const u = encodeURIComponent(JSON.stringify({ unit }))
    const share = await page.evaluate((url) => window.runVrmShare(url), `/__tiny/${u}.vrm`)
    const ok = share > 0.1
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} VRM in units of ${unit}: covers ${(share * 100).toFixed(1)} % of the canvas`)
  }
  const pfOk = /needs at least/.test(pngFailed?.refused) && pngFailed.kept === 'First' && is(pngFailed.pixel, [255, 0, 0]) && /own/.test(pngOnGl)
  if (!pfOk) failed++
  console.log(`${pfOk ? 'ok  ' : 'FAIL'} PNGTuber, a failed load: ${pngFailed?.refused} (kept ${pngFailed?.kept}, pixel ${pngFailed?.pixel}); on a WebGL canvas: ${pngOnGl}`)
  const vaOk = vrmAgain?.aspect1 === 2 && vrmAgain.aspect2 === 2 && /not a VRM/.test(vrmAgain.refused) && vrmAgain.kept === 'Tiny' && vrmAgain.share > 0.02 && /2D/.test(vrmOn2d)
  if (!vaOk) failed++
  console.log(`${vaOk ? 'ok  ' : 'FAIL'} VRM, loaded again on a wide canvas: aspect ${vrmAgain?.aspect1}, ${vrmAgain?.aspect2}; a failed load kept ${vrmAgain?.kept}, covers ${(vrmAgain?.share * 100).toFixed(1)} %; on a 2D canvas: ${vrmOn2d}`)
  if (errors.length) { failed++; console.log(`FAIL page errors:\n  ${errors.join('\n  ')}`) }
  // a BodyPlayer's loads (see runBodyLoads)
  {
    const r = await page.evaluate(() => window.runBodyLoads())
    const blue = r.row.pixel[2] > 200 && r.row.pixel[0] < 50
    const stepsOk = r.row.steps.at(-1).step === 'build' && r.row.steps.filter((s) => s.step === 'download').at(-1).progress === 1
    const ok = r.row.a === 'AbortError' && r.row.b === 'AbortError' && r.row.last === 'loaded' && blue && stepsOk
      && r.held.a === 'a' && r.held.b === 'AbortError' && r.held.d === 'd' && r.held.calls.join() === 'a,d' && r.held.shown === 'd'
      && r.lateLost === false && r.lateLost2 === false && r.late2d === true && r.lateAgain === 'made'
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} BodyPlayer, several loads: ${ok ? 'the last plays; one already inside the Body finishes first' : JSON.stringify(r)}`)
  }

  // the context on a BodyPlayer (see runBodyContext)
  {
    const r = await page.evaluate(() => window.runBodyContext())
    const ok = r.vrm.told === 1 && r.vrm.lost === true && r.vrm.load === 'context-lost' && r.vrmReleased.lost === true && r.vrmReleased.reuse === 'released'
      && r.png.lost === false && !!r.png.again && r.png.again !== 'released'
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} the context on a BodyPlayer${ok ? ': a VRM is told and released like a Player; a PNGTuber has none to lose' : `: ${JSON.stringify(r)}`}`)
  }

  // what both players promise alike (see runContract)
  for (const kind of ['player', 'png']) {
    const r = await page.evaluate(([k, id]) => window.runContract(k, id), [kind, has((m) => m.rig?.chains?.length) ?? ids[0]])
    const near = (a, b) => Math.abs(a - b) < 1e-6
    const problems = Object.entries({
      'before a load': r.before === null && r.playing === false, 'model': r.name && r.expressions, 'pixel ratio': r.ratio.join() === '2,0.5,100,200', snapshot: r.snapshot,
      'frame time': near(r.times[0], 0.01) && near(r.times[1], 0.02), frame: r.frame && r.removed, range: r.clamped.join() === '30,0', 'not a number': r.nan.join() === '0,1,0',
      'from a driver': r.driver.join() === '0,1', alive: r.alive, away: r.away < 0.05 && r.back > 0.9 && /setAway/.test(r.oldAway),
      ...(kind === 'player' ? { 'canvas to model': r.toModel, poke: r.poke[1] > 0 } : {}), expressions2: r.unknown === false && r.neutral === true, 'play and pause': r.plays === true && r.paused === false,
      'failed load': r.failed === 'refused' && r.kept, disposed: r.after === null && /disposed/.test(r.disposedLoad) && r.gone === 1,
    }).filter(([, ok]) => !ok).map(([k]) => k)
    if (problems.length) failed++
    console.log(`${problems.length ? 'FAIL' : 'ok  '} contract, ${kind}: ${problems.length ? `${problems.join(', ')}: ${JSON.stringify(r)}` : 'the same on both'}`)
  }
  // a camera that is refused: the face model's download stops with it, unless someone asked for the model ahead of time
  await page.goto(`http://127.0.0.1:${server.address().port}/test/bodies.html`)
  await page.waitForFunction(() => typeof window.runBodies === 'function')
  const refused = await page.evaluate(() => window.runRefused())
  await new Promise((r) => setTimeout(r, 1500))
  const refusedOk = refused === 'NotAllowedError' && slowModel.finished === 0
  if (!refusedOk) failed++
  console.log(`${refusedOk ? 'ok  ' : 'FAIL'} camera refused (${refused}): the face model asked ${slowModel.asked} time(s), finished ${slowModel.finished}`)
  await page.evaluate(() => window.runRefused(true)).catch(() => {})
  await new Promise((r) => setTimeout(r, 2000))
  const aheadOk = slowModel.finished === 1
  if (!aheadOk) failed++
  console.log(`${aheadOk ? 'ok  ' : 'FAIL'} camera refused after a preload: the download goes on (finished ${slowModel.finished})`)

  // the example pages: the cover in the canvas's box until the character is ready, then the character over it
  for (const name of ['index', 'demo', 'gallery']) {
    const p = await browser.newPage()
    let go
    const held = new Promise((r) => { go = r })
    await p.route('**/characters/*.livliv', async (route) => { await held; await route.continue() })
    await p.goto(`http://127.0.0.1:${server.address().port}/example/${name}.html`)
    const waited = await p.waitForFunction(() => {
      const c = document.getElementById('cover'), s = document.getElementById('stage'), a = c.getBoundingClientRect(), b = s.getBoundingClientRect()
      return c.naturalWidth > 0 && !c.hidden && getComputedStyle(s).opacity === '0' && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
    }, null, { timeout: 8000 }).then(() => true, () => false)
    go()
    const faded = await p.waitForFunction(() => document.getElementById('cover').hidden && getComputedStyle(document.getElementById('stage')).opacity === '1', null, { timeout: 20000 }).then(() => true, () => false)
    if (!waited || !faded) failed++
    console.log(`${waited && faded ? 'ok  ' : 'FAIL'} example/${name}.html: cover first ${waited}, then the character ${faded}`)
    await p.close()
  }
  // the example pages say so when the context is lost, on the first screen
  {
    const p = await browser.newPage()
    await p.goto(`http://127.0.0.1:${server.address().port}/example/demo.html`)
    const up = await p.waitForFunction(() => window.player?.model, null, { timeout: 20000 }).then(() => true, () => false)
    await p.evaluate(() => window.player.canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext())
    const said = up && await p.waitForFunction(() => { const r = document.getElementById('lost')?.getBoundingClientRect(); return r && r.top >= 0 && r.bottom <= innerHeight }, null, { timeout: 5000 }).then(() => true, () => false)
    if (!said) failed++
    console.log(`${said ? 'ok  ' : 'FAIL'} example/demo.html: the context lost, the page says so`)
    await p.close()
  }
  // a camera start that hangs (a face model that never comes): the page says so after a while, and the button stays as it was
  {
    const p = await browser.newPage()
    await p.clock.install()
    await p.route(/face_landmarker\.task|tasks-vision.*wasm|vision_wasm/, () => {})  // never answered
    await p.goto(`http://127.0.0.1:${server.address().port}/example/demo.html`)
    await p.clock.runFor(100)
    const up = await p.waitForFunction(() => window.player?.model, null, { timeout: 30000, polling: 200 }).then(() => true, () => false)
    const cam = up && await p.getByRole('button', { name: /camera/i }).first().click().then(() => true, () => false)
    if (cam) await p.getByRole('button', { name: 'Turn on camera' }).click()
    await new Promise((r) => setTimeout(r, 500))
    await p.clock.runFor(31000)
    const said = cam && await p.evaluate(() => document.getElementById('status').textContent)
    const ok = /Taking long/.test(said || '')
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} example/demo.html: a camera start that hangs says so: "${String(said).slice(0, 110)}"`)
    await p.close()
  }
  // React under StrictMode, which mounts everything twice (its files come from a CDN: without a connection, not tested)
  {
    const p = await browser.newPage(), said = []
    p.on('pageerror', (e) => said.push(e.message))
    await p.goto(`http://127.0.0.1:${server.address().port}/example/react.html`)
    const up = await p.waitForFunction(() => document.getElementById('status')?.textContent && window.__react, null, { timeout: 20000 }).then(() => true, () => false)
    if (!up) console.log('skip example/react.html: React did not come from the CDN')
    else {
      await p.waitForFunction(() => /·/.test(document.getElementById('status').textContent), null, { timeout: 20000 })
      const first = await p.textContent('#status')
      await p.click('#next')
      await p.waitForFunction((before) => document.getElementById('status').textContent !== before, first, { timeout: 20000 })
      const second = await p.textContent('#status'), kept = await p.evaluate(() => !document.querySelector('canvas').getContext('webgl2').isContextLost())
      const gl = await p.evaluateHandle(() => document.querySelector('canvas').getContext('webgl2'))
      await p.click('#toggle')
      await p.waitForFunction(() => !document.querySelector('canvas'), null, { timeout: 5000 })
      await new Promise((r) => setTimeout(r, 100))
      const gone = await gl.evaluate((c) => c.isContextLost())
      const ok = first !== second && kept && gone && !said.length && !/Error|LivLiv:/.test(second)
      if (!ok) failed++
      console.log(`${ok ? 'ok  ' : 'FAIL'} example/react.html under StrictMode: "${first}", then "${second}"; the context kept while mounted ${kept}, given up on unmount ${gone}${said.length ? `; errors ${said.join(' | ')}` : ''}`)
    }
    await p.close()
  }
  // ?model=: never a request to another site, however it is written; the page's own files still open
  for (const name of ['demo', 'vrm']) {
    const p = await browser.newPage(), asked = []
    p.on('request', (r) => asked.push(r.url()))
    let tried = 0, left = 0, said = 0
    for (const other of ['https://example.invalid/x/', '//example.invalid/x/', '\\\\example.invalid/x/', 'https:example.invalid/x/', ' https://example.invalid/x/']) {
      await p.goto(`http://127.0.0.1:${server.address().port}/example/${name}.html?model=${encodeURIComponent(other)}`)
      await p.waitForFunction(() => /this site only/.test(document.getElementById('status').textContent), null, { timeout: 8000 }).then(() => { said++ }, () => {})
      tried++
    }
    left = asked.filter((u) => /example\.invalid/.test(new URL(u).host)).length
    const ok = said === tried && !left
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} example/${name}.html: ?model= on another site: ${said}/${tried} said no, ${left} requests left this site`)
    await p.close()
  }
  {
    const p = await browser.newPage()
    await p.goto(`http://127.0.0.1:${server.address().port}/example/demo.html?model=${encodeURIComponent(`../characters/${ids[0]}/`)}`)
    const ok = await p.waitForFunction(() => window.player?.model, null, { timeout: 20000 }).then(() => true, () => false)
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} example/demo.html: ?model= on this site opens`)
    await p.close()
  }
  // no WebGL at all: the example pages say so, the check says no, new Player() says why (the pages fail on purpose: no
  // error of theirs counts here)
  const plain = await chromium.launch({ args: ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] })
  try {
    const p = await plain.newPage()
    for (const name of ['index', 'demo', 'gallery']) {
      await p.goto(`http://127.0.0.1:${server.address().port}/example/${name}.html`)
      await p.waitForFunction(() => /WebGL2/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {})
      // said where it can be read: on the first screen, whatever the canvas takes up
      const said = await p.evaluate(() => {
        const e = [...document.querySelectorAll('p')].find((x) => /WebGL2/.test(x.textContent)), r = e?.getBoundingClientRect()
        return !!r && r.top >= 0 && r.bottom <= innerHeight
      })
      if (!said) failed++
      console.log(`${said ? 'ok  ' : 'FAIL'} no WebGL: example/${name}.html ${said ? 'says so' : 'says nothing'}`)
    }
    const r = await p.evaluate(async () => {
      const { Player } = await import('/dist/index.js')
      let thrown = ''
      try { new Player(document.createElement('canvas')) } catch (e) { thrown = e.message }
      return { supported: Player.isSupported(), thrown }
    })
    const ok = r.supported === false && /turned off/.test(r.thrown)
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} no WebGL: isSupported ${r.supported}, new Player() says "${r.thrown}"`)
  } finally { await plain.close() }
} finally {
  await browser.close()
  server.close()
}
console.log(failed ? `smoke: ${failed} failed` : `smoke: all ${ids.length} characters ok`)
process.exit(failed ? 1 : 0)
