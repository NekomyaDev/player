# @livliv-dev/player API

A lightweight 2.5D character player for the web. `Player` animates a LivLiv model (a `.livliv` package, or its folder:
`model.json` and `textures/`) on a `<canvas>` with WebGL2; VRM and PNGTuber characters play on the same API through
`@livliv-dev/player/body`. The core has no dependencies (~75 KB minified, ~30 KB gzipped, the renderer and the idle motion included).
Lip sync and face tracking are separate imports, so you only ship them if you use them.

> Install it with `npm install @livliv-dev/player`, or build it from this repository (see [Building](#building)).

```js
import { Player } from '@livliv-dev/player'

const player = new Player(document.querySelector('canvas'))
await player.load('/avatars/sena.livliv')      // the package as downloaded, or its folder unzipped: '/avatars/sena/'

player.setExpression('smile')                  // ids are in player.expressions
player.params.mouthOpen = 0.6                  // 0..1, e.g. your TTS loudness each frame
player.act('nod')
```

The character breathes, blinks, sways and looks toward the pointer by itself. Size the canvas with CSS; the drawing
follows its size (up to 2 device pixels per CSS pixel).

## The model package

Download it on livliv.ai from a character's page (**Model package**): one `.livliv` file, a ZIP of this folder.
Serve the file as it is, or unzip it and serve the folder like any static files:

```
sena/
  model.json        # the manifest and the rig: layers, anchors, expressions, meta (author, licence, the mark)
  textures/*.webp   # the layer images
  avatar.webp       # a small square picture
  keyforms.json     # head-turn key poses (refined characters only)
```

The format is open: [FORMAT.md](FORMAT.md), with a JSON Schema in [`schema/`](schema/). Packages exported before
November 2026 (`export.zip`: `model.json` says `livemaker-puppet`, version 3, and every image is there twice) still
load, as they are ([FORMAT-v3.md](FORMAT-v3.md)).

- `load()` takes the URL of a `.livliv` file, of `model.json`, or of its folder. Image paths are read relative to
  `model.json`, so the folder can live anywhere: your server, a CDN, another origin.
- **Prefer the `.livliv` on a page people wait for.** It is one request, where the folder is one for each image (30-70):
  on a slow path that saved more than half the wait in our measurements, and a browser's cache has only one file to check.
- **Another origin** (a CDN, `cdn.example.com` while the page is on `example.com`): the server must send
  `Access-Control-Allow-Origin` for `model.json` and every image (WebGL can only read images that allow it). Without it
  `load()` rejects with an error saying so.
- **No server at all** (a file the user picks, a drag and drop): pass the `.livliv` file, or a folder's files, instead
  of a URL, see `load()`.

`modelFiles(source, { signal, onProgress })` gives a model's own files, a `Map` of path → `Blob`, to save a character
with a project or package it again. From a URL it reads `model.json` as `load()` does (a model `load()` refuses is
refused) and fetches every image and file it names, rejecting if one does not come; a package or files you pass come
back unpacked, as they are. `model.json` is unchanged, with its licence and its mark, and the limits are `load()`'s.

## Player

```ts
new Player(canvas: HTMLCanvasElement, options?: PlayerOptions)
```

| option | default | |
|---|---|---|
| `idle` | `true` | moves by itself: breathing, blinking, swaying, looking around, now and then a small move (a glance aside, a look down). Off: only your `params` and drivers move it |
| `followPointer` | `'page'` | follows the pointer anywhere on the page, only over the canvas (`'canvas'`), or not (`false`): the eyes lead and the head turns a little (about 13° at most), the brows lift when it comes near or moves fast, a soft look and now and then a smile while it rests on the face, and the character looks back at the viewer when it rests elsewhere or leaves |
| `maxPixelRatio` | `2` | drawing-buffer pixels per CSS pixel at most; `1` saves power on high-DPI screens |
| `autoplay` | `true` | start the frame loop at once |
| `renderWhenHidden` | `false` | keep drawing (and calling `onFrame`) while the canvas is out of view, for a live output or a recording; the browser still slows a tab in the background |
| `parameterProfile` | none | a response profile for the final pose, see [Response profiles](#response-profiles) |
| `lang` | the browser's | the language `expressions[].label` is picked in (a BCP 47 tag: `en`, `ja`, `zh-TW` …) |

`idle`, `followPointer`, `renderWhenHidden` and `parameterProfile` can also be changed later on the player.

`new Player()` throws where WebGL2 cannot start: the browser has none or has it turned off, or the canvas already draws
in 2D. `Player.isSupported()` asks first, so a page can say so or show a picture instead.

### `load(source, options?): Promise<ModelInfo>`

Loads a model and shows it in place of the one before. A load that fails keeps the old one, whatever goes wrong. `source`
is one of:

- a URL (string or `URL`) of a `.livliv` (or `.zip`) package, of `model.json`, or of its folder; relative URLs resolve
  against the page. A query string (`?token=…`) is sent with every file.
- a package: a `File` or `Blob` of a `.livliv` (a ZIP; one made with the system's "compress folder" works too).
- files: a `FileList` / `File[]`, e.g. from `<input type="file" webkitdirectory>` (a folder) or
  `<input type="file" accept=".livliv">` (one package), or a `Map<string, Blob>` / `Record<string, Blob>` of
  path → file. The shallowest `model.json` is the model; images are found by their path relative to it, or by file
  name when the files carry no folders.

```js
input.onchange = () => player.load(input.files)
```

A package is checked before anything is decoded: a newer format than this player reads, a feature it does not have,
paths outside the package, an encrypted or oversized ZIP are refused with an error saying so.

| option | |
|---|---|
| `signal` | an `AbortSignal` that calls the load off: it rejects with an `AbortError` (or the signal's own reason) and the character before stays |
| `onProgress` | called with `{ step: 'download', progress }` as the files come in (0..1, always rising; bytes for a package, images for a folder; where the size is not known, 0 and then 1), then once with `{ step: 'build' }` as the character goes in |
| `poster` | the URL of a picture to show until the first frame (a featured character's `cover.webp`). It is the canvas's CSS background, so it fits the canvas's box, adds nothing to the page, and the canvas's own background comes back after. Only while the canvas shows nothing yet: over a character, that one stays until the next is ready |

**A new `load()` replaces one still running**, so the last one asked for is the one that plays, and the download before it
stops (Safari may keep the connection open). The one replaced rejects with an `AbortError`. Nobody has to catch it: a
page that only calls `player.load(a); player.load(b)` sees nothing in the console, while a real failure is reported as
any uncaught rejection is. A signal that is already aborted rejects at once and leaves the running load alone. The last
moment, when the model goes in, cannot be interrupted and takes a few milliseconds to a few hundred: a load that has
reached it finishes.

```js
const stop = new AbortController()
try {
  await player.load(url, { signal: stop.signal, poster: 'cover.webp', onProgress: (p) => { if (p.step === 'download') bar.value = p.progress } })
} catch (e) {
  if (e.name === 'AbortError') return                  // replaced by a newer load, or called off
  if (e.code === 'unreachable') say('Check the connection')
  else say(e.message)
}
```

**Errors.** What a load rejects with for a reason of its own is a `LivLivError` (from `@livliv-dev/player` and
`@livliv-dev/player/body`): `code` says what went wrong and `status` the HTTP status. The message is for people and can change.
`new Player()` throws the same class. A camera or microphone keeps the browser's own errors.

| `code` | |
|---|---|
| `no-webgl` | this browser or canvas gives no WebGL2 |
| `canvas-in-use` | the canvas already draws in a way this character cannot (a PNGTuber on a WebGL canvas) |
| `unreachable` | the file did not come: no connection, a connection that dropped, or another origin without a CORS header |
| `http` | the server said no (`status`) |
| `not-a-model` | not a model at all, or not one for this player (a VRM handed to a `Player`) |
| `invalid` | a model, but something in it is wrong or damaged |
| `too-large` | over this player's limits, or the GPU's memory |
| `newer-format` | written for a newer player |
| `missing-feature` | needs something this page or player does not have (a feature in its `requires` this player lacks) |
| `missing-file` | a file it names is not among the files |
| `context-lost` | the canvas's WebGL context is gone, see [below](#when-the-context-is-lost) |
| `released` | the canvas gave its context up with `dispose({ release: true })`: use a new canvas |

`ModelInfo`:

| field | |
|---|---|
| `name` | the character's name |
| `format`, `version` | `"livliv-model"` and 4, or `"livemaker-puppet"` and 3 for a package from before v4 (see [Format version](#format-version)) |
| `size` | `[width, height]` the character was drawn at |
| `fullBody` | a full-body character: it stands on the ground, framed by `view.fit` (see [Full-body characters](#full-body-characters)) |
| `expressions` | `{ id, label, labels }[]`: what `setExpression()` takes. Standard ids (`smile`, `shy`, `angry`, `sad`, `surprised` …, [FORMAT.md](FORMAT.md#appendix-a-standard-expression-ids-40)) mean the same on every model; `x_…` ids are the model's own. `label` is the name in `lang`, `labels` every language's |
| `watermark` | the mark drawn over the character: `"LivLiv"`, the owner's own text, or `null` |
| `meta` | a v4 package's `meta`: `author`, `license` (`{ id, url }`), `generator`, `created`, `watermark`; `null` before v4 |

`player.model` is the loaded model's `ModelInfo` (null before the first load), `player.expressions` its expressions.

### `params`

The pose and face, yours to set. Each frame the player starts from these, then adds the idle motion and the drivers on
top; it never writes them back, so a value you set stays until you change it.

| param | range | |
|---|---|---|
| `angleX`, `angleY`, `angleZ` | -30..30 | head turn (left/right), nod (up/down), tilt |
| `eyeLOpen`, `eyeROpen` | 0..1 | eyes open (1) / closed (0) |
| `eyeBallX`, `eyeBallY` | -1..1 | gaze |
| `browLY`, `browRY` | -1..1 | brows down / up |
| `mouthOpen` | 0..1 | mouth (closed, half, open frames) |
| `vowel` | -1..1 | mouth shape while open: round (o, u) at -1, wide (i, e) at +1, where the model has those frames |
| `smile` | 0..1 | the smile expression |
| `bodyX`, `bodyZ` | -10..10 | body turn and lean |
| `breath` | 0..1 | breathing |

With `idle` on, the idle motion sets the head, eyes, gaze, brows, body and breath, so your values for those count
only with `idle` off (or use a [driver](#drivers) to add to them). `mouthOpen`, `vowel` and `smile` are always yours.
`PARAM_RANGES` and `defaultParams()` are exported. Whoever sets them, the pose stays in these ranges, and a value that is
not a number counts as the default.

### Expressions and actions

- `setExpression(id, weight = 1): boolean`: eases over to that expression (ids from `expressions`; `null` = neutral).
  Returns false for an id the model doesn't have.
- `act(action)`: a short move over whatever else drives the character: `'nod'`, `'shake'`, `'tilt'`, `'hop'`, `'shy'`.
- `setAway(on)`: dozes (eyes closed, head down, a slow breath, expressions hidden), easing in, until `setAway(false)`.
- `lookAt(x, y)`: looks toward a point, each -1..1 from the canvas center (y up), and keeps looking there instead
  of following the pointer; `lookAt(null)` goes back to the pointer. Needs `idle`.
- `blink()`: blinks now (with `idle`).

### Placement and the loop

- `view`: `{ x, y, zoom, head, fit }`. `x`, `y` move the character by shares of the canvas (y up), `zoom` scales it about the
  center, `head: true` frames the head instead of the whole drawing (avatars, chat bubbles), `fit` is a full-body
  character's shot: `'frame'` (default), `'knee'` or `'whole'` (see [Full-body characters](#full-body-characters)).
- `play()`, `pause()`, `playing`. The loop also skips drawing while the canvas is scrolled out of view (unless `renderWhenHidden`).
- `resize()`: draws now at the canvas's current size. Only needed after resizing a paused player.
- `maxPixelRatio`: as the option, and it can be changed at any time.
- `snapshot()`: the pose as it is now, as a PNG data URL (with the mark).
- `getPose()`, `onFrame`, `renderPose()`: the pose as drawn, to record it or show it again, see [Recorded poses](#recorded-poses).
- `getAnchor('head' | 'body')`: where the head or the torso was drawn, see [Attachment points](#attachment-points).
- `canvasToModel(x, y)`: a point on the canvas (CSS px from its top left) in the model's own px, as the last frame drew it.
- `poke(x, y, strength = 1)`: a flick at a point in the model's px: the swinging pieces near it are thrown (a tap on a twin
  tail). Returns how many it moved: none on a model without any.
- `dispose({ release })`: stops, removes drivers, frees the character's GPU memory. A `load()` still running rejects, and a
  camera or microphone still starting (`startFaceTracking`, `startLipSync`) is let go as soon as it opens.

### Canvases and contexts

A browser allows about 16 WebGL contexts on a page and drops the oldest past that, which can be a character still showing.
So a page where characters come and go has two ways to stay under it:

- **Reuse canvases.** After `dispose()` the canvas keeps its context and can take a new `Player`. This is the only way that
  works everywhere: Safari does not get the room back from a released context.
- **Release what leaves.** `dispose({ release: true })` gives the context up, for a canvas leaving the page. Measured here, 40
  players came and went beside one that stayed, and it stayed (Chromium, Firefox). The canvas is spent after that: a new
  player on it throws `released`, unless it is made at once, in the same task, as a framework's unmount and mount is.

In **React**, this is the whole of it, and it is right under StrictMode, which mounts everything twice ([example/react.html](example/react.html)):

```jsx
function Character({ source }) {
  const canvas = useRef(null), player = useRef(null)
  useEffect(() => {
    const p = player.current = new Player(canvas.current)
    return () => p.dispose({ release: true })
  }, [])
  useEffect(() => {
    player.current.load(source).catch((e) => { if (e.name !== 'AbortError') console.error(e) })
  }, [source])
  return <canvas ref={canvas} style={{ width: 320, height: 400 }} />
}
```

### When the context is lost

A browser can take a page's WebGL context away: a phone reclaiming memory while the page is in the background, a graphics
driver restarting, too many contexts on the page. The character is gone from that canvas and does not come back by itself.
`player.contextLost` says so, and `player.onContextLost` is called once. Meanwhile frames do nothing, and `load()` rejects with
`context-lost`. The way back is a new canvas and a new player:

```js
function show(parent, source) {
  const canvas = document.createElement('canvas')
  parent.replaceChildren(canvas)
  const player = new Player(canvas)
  player.onContextLost = () => {
    player.dispose()
    const again = () => show(parent, source)
    if (document.hidden) addEventListener('visibilitychange', again, { once: true })  // when someone is back to see it
    else again()
  }
  player.load(source).catch(console.error)
  return player
}
```

### The mark

An exported package says which mark it carries (`meta.watermark` in `model.json`). The player draws it into the canvas,
the way livliv.ai shows it, so screenshots and recordings of the canvas carry it too:

- `livliv` (free plan): the LivLiv logo, medium-sized and light over the character and solid in the bottom-right
  corner; with `"center": false` (the featured characters), only the one in the corner
- `text` (your own mark, set on a paid plan): that text, small, in the bottom-right corner
- `none`: nothing

The mark is part of the package's licence (`meta.license`), not a lock: the player draws what the package asks for and
has no switch to hide it. A package without it is exported from a paid plan.

## Lip sync: `@livliv-dev/player/voice`

The mouth follows a voice: its loudness, and the vowel's shape where the model has round / wide mouth frames. Without
face tracking the voice also moves the head, brows and eyes a little, the way people move while they talk.

```js
import { createSpeech, startLipSync } from '@livliv-dev/player/voice'

// speech clips (TTS replies): played back to back, the mouth following each one exactly
const speech = createSpeech(player)
button.onclick = () => speech.unlock()          // once, inside a user gesture, or browsers block the sound
speech.say('/tts/reply-1.mp3')                  // a URL, a Blob, an ArrayBuffer or a fetch Response; queued
speech.onIdle = () => {}                        // the last clip has played
speech.stop()                                   // silence now

// live audio: the microphone (no source), a MediaStream (a call's remote voice), or an <audio> / <video> element
const sync = await startLipSync(player, audioElement)
sync.stop()
```

Options for both: `motion` (0..2, default 1: how much the voice moves the head; 0 = mouth only) and `bounce` (hop on
syllables, default false). `startLipSync` returns `{ level, gain, stop() }`. A stream or element you pass in stays
yours: `stop()` leaves it playing. Browsers let an `<audio>` element be routed through Web Audio only once, so after
`startLipSync(player, el)` that element always plays through the player's audio context (it still plays normally).

A `Response` plays as it comes in: a WAV streamed from a TTS service starts before it has all arrived.
`say(clip, { onStart, onEnd, onFail })` tells about that clip: `onStart` when it starts being heard, then once `onEnd`
(heard to the end) or `onFail` (no sound came, its download broke off, or `stop()` dropped it). `speech.volume` (0..1)
is the playback volume; at 0 the clip still plays on time and the mouth still moves. `speech.level` and `speech.vowel`
are the mouth's opening and the vowel now, for a meter. `speech.stream` is the voice as it plays, after the volume, a
`MediaStream` for a call or a recording: null before `unlock()`, then the same stream until `dispose()`, which ends it.
It has this speech's voice only, nothing else the page plays.

## Face tracking: `@livliv-dev/player/tracking`

The character follows a face in the webcam, with MediaPipe Face Landmarker running in the browser: camera images stay
on the device. Needs the `@mediapipe/tasks-vision` package (1.1.1) and downloads ~8 MB the first time (the wasm runtime
and the face model; cached after that). MediaPipe itself, as Google ships it, also sends usage statistics to Google
(`odml.pa.googleapis.com`) while it runs.

```js
import { preloadFaceModel, startFaceTracking } from '@livliv-dev/player/tracking'

cameraButton.onpointerenter = () => preloadFaceModel()      // optional: start the download early
const tracking = await startFaceTracking(player, {
  onProgress: (s) => console.log(s.step, s.progress),      // 'download' (0..1), 'prepare', 'camera'
})
tracking.face        // a face is seen now
tracking.calibrate() // the user's current pose becomes "facing front" (it also calibrates itself)
tracking.stop()
```

A refused or missing camera rejects with the browser's error, and stops the download unless `preloadFaceModel()` asked for it. `trace: 'synth'` plays a demo motion and asks for no camera,
which makes a good fallback (`example/camera.js` does all of this):

```js
const tracking = await startFaceTracking(player).catch((e) => {
  if (e.name === 'NotAllowedError') note('Camera not allowed. Turn it on from the icon in the address bar.')
  else if (e.name === 'NotFoundError') note('No camera found.')
  else console.error(e)
  return startFaceTracking(player, { trace: 'synth' })
})
```

| option | default | |
|---|---|---|
| `deviceId` | | a camera from `navigator.mediaDevices.enumerateDevices()`; without it, the default one |
| `mirror` | `true` | move like a mirror image |
| `smoothing` | `0.5` | 0 quick and shakier .. 1 steady and slower |
| `follow` | `0` | how much leaning toward / away from the camera moves the character (0..2) |
| `maxFps` | `'auto'` | how often to look for the face, at most: a number, or as often as the camera allows until that would take over half of the main thread (the model runs there), then less, 5 a second at least |
| `remember` | | keep the calibration on this device under this name (localStorage) |
| `wasmUrl` | jsDelivr | folder with MediaPipe's `vision_wasm_internal.{js,wasm}` and the `nosimd` pair |
| `modelUrl` | Google's bucket | `face_landmarker.task` |
| `trace` | | play a recorded face trace (URL) or `'synth'` (a built-in 24 s loop) instead of the camera, for tests |
| `profile` | | a response profile for the camera's values, see [Response profiles](#response-profiles) |

`tracking.video` is the camera's `<video>` element, for a preview (null with a `trace`). The tracker owns its stream
and stops it on `stop()`: show the element, don't stop its tracks.

By default the wasm comes from jsDelivr (`@mediapipe/tasks-vision@1.1.1/wasm`) and the model from Google's
`mediapipe-models` bucket. In production, host those files yourself and pass `wasmUrl` / `modelUrl`. While no face is
seen the character eases back to its idle motion.

Without a bundler, map the package in an import map:

```html
<script type="importmap">
  { "imports": { "@mediapipe/tasks-vision": "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/vision_bundle.mjs" } }
</script>
```

### With no third party

By default face tracking talks to three other hosts: jsDelivr (the runtime), Google's model bucket (the face model)
and Google's `odml.pa.googleapis.com` (MediaPipe's usage statistics, sent about once a minute while it runs). To talk
to none of them:

1. Host the files with your page: copy `node_modules/@mediapipe/tasks-vision/wasm/`, and
   [face_landmarker.task](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task)
   (3.6 MB). Without a bundler, serve `vision_bundle.mjs` too and point the import map at it.
2. Pass them: `startFaceTracking(player, { wasmUrl: '/mediapipe/wasm', modelUrl: '/mediapipe/face_landmarker.task' })`.
3. Block the statistics: MediaPipe has no option to turn them off, but a Content Security Policy that lets the page
   connect only to its own server stops them: the header `Content-Security-Policy: connect-src 'self'`, or
   `<meta http-equiv="Content-Security-Policy" content="connect-src 'self'">` in the page. Blocked, face tracking
   works the same (the browser logs one refused connection a minute).

With all three, the page makes no request to another host. Hosting the files and blocking only `odml.pa.googleapis.com`
(`connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com`) works too.

## Drivers

Lip sync and face tracking are drivers: code that moves the character every frame. Your own can be too:

```js
const remove = player.use({
  update(frame) {
    frame.params.angleX += 10 * Math.sin(frame.time)   // write: this frame only
    frame.add({ browLY: 0.3, browRY: 0.3 })            // add, kept in range
  },
})
remove()
```

`frame` has `params` (the pose so far), `dt`, `time`, `tracked` (a face tracker drives the head), `add(offsets)`,
`move` (`{ x, y, s }`: move / scale the picture this frame), `talk` (a talking bob, a share of the canvas, <= 0: lip sync
writes it) and `grounded` (a full-body character, whose feet stay on the ground: a move down crouches it, `move.x`
sways it and `talk` dips its upper body). `order` sorts drivers: face tracking -10, yours 0, lip sync 10. `dispose()`
is called when a driver is removed.

## Characters that aren't LivLiv models: `@livliv-dev/player/body`

A `BodyPlayer` plays a character a `Body` draws, with Player's API where it applies: `load()`, `params`, the idle
motion, `setExpression()`, `act()`, `lookAt()`, `blink()`, `use()` and the loop. Lip sync and face tracking work on it
as on a Player. Two bodies come with the package:

```js
import { BodyPlayer } from '@livliv-dev/player/body'
import { PngBody } from '@livliv-dev/player/png'
import { VrmBody } from '@livliv-dev/player/vrm'    // needs three and @pixiv/three-vrm

const png = new BodyPlayer(canvasA, new PngBody())
await png.load({ closed: 'me-closed.png', open: 'me-open.png', blink: 'me-blink.png' })  // name -> URL or Blob

const vrm = new BodyPlayer(canvasB, new VrmBody())
await vrm.load('/avatars/me.vrm')            // a URL, a File, or files picked
```

- **PNGTuber** (`@livliv-dev/player/png`): pictures named `closed` and `open` (the mouth), optionally `blink` and
  `blink-open` (any image the browser reads, 8192 px a side at most). One is shown at a time: the open one while the
  voice is loud, the blink ones when the eyes close. The picture sways, tilts and breathes with the head and body and
  hops with the voice; there are no expressions but the smile param, and no turn beyond that sway. `name.txt` names it.
  `new PngBody({ pixelated: true })` keeps pixel art sharp when it is drawn larger (`pixelated` can be changed at any
  time); a page that scales the canvas in CSS needs `image-rendering: pixelated` on it too.
- **VRM** (`@livliv-dev/player/vrm`): VRM 0.x and 1.0, drawn with [three.js](https://threejs.org) and
  [three-vrm](https://github.com/pixiv/three-vrm), which you install (`npm install three @pixiv/three-vrm`; three.js 0.170
  or newer, played here on 0.170, 0.186 and 0.187 with three-vrm 3.5.5; optional peer dependencies, so the rest of the
  package does not need them; TypeScript with `skipLibCheck: false` also needs `@types/three`). Files from VRoid Studio and UniVRM play. So does a real file from the VRM add-on for Blender; a fresh export from Blender hasn't been tested, and [issue #1](https://github.com/livliv-dev/player/issues/1) is still open. The head and neck turn, the spine sways, the eyes
  blink and look, the mouth takes the visemes (`aa`, `ee`, `ou`, or `ih`, `oh` where those are missing, from `mouthOpen` and `vowel`),
  and the expressions are the model's `happy`, `angry`, `sad`, `relaxed` and `surprised` where it has them, then any
  of its own under the names it gives them; hair and clothes swing by the model's own spring bones, and its constraints apply. Framed from the head to the hips with the arms down; no hands, no full body, no camera
  control. Without a bundler, map `three`, `three/examples/jsm/` and `@pixiv/three-vrm` in an import map, as
  `example/vrm.html` does.
  A file compressed with Draco, Meshopt or KTX2 needs decoders, which the player does not ship: without them `load()` says
  so, and `new VrmBody({ configureLoader: (loader) => { /* setDRACOLoader, setMeshoptDecoder, setKTX2Loader */ } })` is where
  yours go. Animation files (`.vrma`) are not played.
  A VRM carries its author's terms, and `load()` gives them in `model.meta` (`VrmTerms`), 1.0 and 0.x said alike: `author`,
  `license`, `use` (who may play it), `commercial`, `violence`, `sexual`, `redistribution` and `modification` (1.0 only), the
  file's own words in `raw`. The player does not enforce them. A page playing other people's avatars should show them and
  keep to them, as you would with a LivLiv package's `meta.license`.
- **Your own**: anything with `load(files)`, `render(canvas, pose, w, h, dt)`, `head()` and `dispose()` (the `Body`
  type), and if it cares which canvas it gets, `attach(canvas)`. One that draws with WebGL can also have `context()`, returning
  its context, so that `contextLost` and `dispose({ release })` work for it. `pose` has the params after the idle motion and the
  drivers, the picture's `move` and each expression's weight. `anchor(name)`, optional, gives its
  [attachment points](#attachment-points).

A failed `load()` keeps the character before, as on a Player. A canvas has one kind of context for good: a PNGTuber draws in 2D, a Player and a VRM in WebGL2, so a PNGTuber on a canvas that was a Player's (or the other way round) is refused with an error; give it its own.
A BodyPlayer takes the same `load()` options and its errors are the same, with one difference: a Body swaps its character
inside its own `load`, which cannot be interrupted, so a character already going in finishes and the newer one follows.
Downloads and loads still waiting are replaced, as on a Player. It draws no mark and has no `poke` or `canvasToModel`;
`view.head` is not used. `onContextLost` and `dispose({ release })` are for a VRM; a PNGTuber has no context to lose. Live2D models (`.moc3`) are not supported:
reading them takes Live2D's proprietary Cubism Core, under its own licence.

## Untrusted files

A model package is a file from anyone, and the player reads it as one: whatever is wrong with it, `load()` rejects with
an error and the model before stays. Before anything reaches the GPU:

- `.livliv`: at most 2048 entries and 256 MB unpacked, `model.json` 4 MB and `keyforms.json` 32 MB at most; a
  compressed entry stops inflating at the size its directory gives (a ZIP bomb goes no further); no paths outside the
  package, no encryption, no ZIP64.
- `model.json` (any version): a canvas of 8192 px a side at most, 512 layers, 2048 images, every layer's box inside
  twice the canvas, every image a path inside the package, numbers that are numbers. What a mesh would cost is held too,
  counted from the boxes before anything is built: 2 097 152 vertices in all, 1 048 576 bent by chains (the largest models
  built have 46 000 and 40 000), and a layer names a chain once.
- Images: 8192 px a side (or the GPU's limit, if lower) and 64 million pixels in all at most, checked once each image's
  size is known, before it is decoded in full.
- `keyforms.json` that does not fit its grid is left out (the character plays on the rig alone).
- A name, an expression's label and the mark's text are the author's text: show them with `textContent`, not as HTML.

These limits are `LIMITS` in `src/runtime/format.ts`; the largest model LivLiv has built uses a tenth of them or less.
A VRM is looked through before three.js's glTF loader parses it (`VRM_LIMITS` in `@livliv-dev/player/vrm`): a binary glTF, with
nothing outside itself (a file naming an outside URL is refused, so it cannot make the page fetch anything), 32 MB of
JSON, 16 777 216 vertices, pictures of 8192 px a side and 536 870 912 pixels in all, read from their headers before they are
decoded. Security reports: [SECURITY.md](SECURITY.md).

## Format version

`model.json` has `"format": "livliv-model"` and `"version"` (`FORMAT`, `FORMAT_VERSION`: 4 in this release). A
player plays every version up to its own and rejects a newer one with an error asking for a newer player, rather than
drawing it wrong; a model whose `requires` names a feature this player does not have is rejected the same way. Fields
it does not know it ignores. Packages from before v4 (`"livemaker-puppet"`, `LEGACY_FORMAT`, version 3, or no field)
play as they are. The rules for what changes the version: [FORMAT.md §9](FORMAT.md#9-versions-and-additions).

A full-body character's package lists the feature `full_body` (format 4.1), which this player has; 0.4 and earlier
refuse it with `missing-feature`.

## Full-body characters

A full-body character (`model.fullBody`) is drawn head to feet on a tall canvas and stands on the ground. Everything
above works on it as on a half-body one; what differs is the shot and how it moves:

- **The shot**: `view.fit` picks what the canvas shows. `'frame'` (the default) is its head and chest, so a full-body
  character fills a canvas as a half-body one does; `'knee'` shows it down to a little below the knees, `'whole'` the
  whole figure. `view.head`, `zoom`, `x` and `y` work on top of it. On a half-body character `fit` changes nothing.
- **Its feet stay on the ground**: the upper body turns and leans as one piece above the waist, and the whole figure
  sways from the ankles. A face tracker's sideways move sways it instead of sliding it; leaning toward the camera
  crouches it a little (the legs shorten, the feet stay) and leaning away is not followed; closer and further scale it
  (about the ground line when the whole figure shows). A hop crouches, flies and lands. Lip sync's talking bob dips the upper body. The hips follow
  the upper body and shift their weight a little by themselves, and a skirt's or coat's hem hangs behind them.
- **Drivers** see `frame.grounded`, and move it with `frame.move` and `frame.talk` as on any character: the player
  turns them into the sway, the crouch and the dip.

```js
const info = await player.load('/models/standing.livliv')
if (info.fullBody) player.view.fit = 'whole'   // the whole figure, on a tall canvas
```

## Browser support

WebGL2 and ES2023: Chrome / Edge 97+, Firefox 104+, Safari 15.4+. Tested on current desktop Chromium, Firefox and WebKit;
not yet on phones or in in-app WebViews.

## Building

```sh
npm install
npm run build          # dist/: index.js, body.js, png.js, vrm.js, tracking.js, voice.js (ES modules), chunks/ and types/
```

Examples: serve this repository's folder with any static server (for example `python3 -m http.server`) and open
`/example/` (a few lines) or `/example/demo.html` (expressions, actions, microphone, camera, open a folder;
`?model=<url>` loads another model from the same site). Both start with a featured character from `characters/`.

## Recorded poses

Each frame's pose can be kept and drawn again: a recording, a second window showing the same character, a video
rendered afterwards. `Player` and `BodyPlayer` both have:

- `getPose()`: the pose of the frame drawn last.
- `onFrame`: called after each frame with its pose.
- `renderPose(pose, dt = 0, size?)`: draws a pose on a paused player (it throws while playing).

```js
player.onFrame = (pose) => frames.push(pose)       // every frame drawn
output.pause()                                     // another player with the same character
output.renderPose(frames[i], 1 / 30, [1080, 1920])
```

A `PlaybackPose` is `{ params, move, expr, view }`: the final params (the idle motion, drivers, actions and the
response profile done), the picture's `move` (`x`, `y` shares of the canvas, y up, and a scale `s`, with actions and
the talking bob in it), each expression's weight as shown (0..1) and the view. It is a copy, safe to keep or send as
JSON.

`renderPose()` runs no idle motion, driver, action or profile: the pose is drawn as it was, kept in the params' ranges.
`dt` (seconds) moves the hair and the other springs on, so frames drawn one after another swing as they did live.
`size`, `[width, height]` in device pixels, draws at exactly that size, on a canvas that is not in the page too. The
player takes the pose's view, the mark stays, and `resize()` and `snapshot()` draw the same pose again until `play()`.
Before a model is loaded, after `dispose()` or once the context is lost, it draws nothing.

A full-body character's pose has three more numbers, as its feet stay on the ground: `crouch`, how far the hips went
down (a hop's crouch, a lean toward the camera), and `dip`, how far the upper body dipped on a syllable, both shares of
the frame's height (<= 0), and `talk`, the talking bob the dip came from. Its `move.y` is only a hop's lift (>= 0) and
`move.x` sways it from the ankles. `renderPose()` draws the crouch and the dip, holding a pose from elsewhere to what
live motion could do (no sinking, a crouch or dip of at most 0.15); a half-body character's pose has none of the three,
and a half-body character ignores them.

## Response profiles

A profile reshapes params one by one: a small head turn shown as a larger one, a mouth that is fully open at 0.7, brows
that move less.

```js
player.parameterProfile = {
  angleX: { input: [-15, 15], output: [-30, 30], curve: 1, smoothing: 0.2 },
  mouthOpen: { input: [0, 0.7], output: [0, 1], curve: 1, smoothing: 0 },
}
```

Each rule takes `input: [min, max]` (clamped there) onto `output: [min, max]`; an output from high to low reverses the
param. `curve` (0.2..3, 1 is straight) bends it, from 0 both ways on a range that crosses 0, so 0 stays where the
straight line puts it. `smoothing` (0 none .. 1 half a second) eases it. The twelve params a face tracker gives can
have one (`TRACKING_PARAMETERS`): `angleX`, `angleY`, `angleZ`, `eyeLOpen`, `eyeROpen`, `eyeBallX`, `eyeBallY`,
`browLY`, `browRY`, `mouthOpen`, `smile`, `bodyX`. An empty profile changes nothing.

- `player.parameterProfile` (or the option) reshapes the final pose, after the idle motion, drivers, speech and
  actions. `player.parameterSample` is the last frame's params before and after it (`{ input, output }`; null before
  the first frame). A new model starts its smoothing over.
- `startFaceTracking(player, { profile })` and `tracking.profile` reshape the camera's values only, and
  `tracking.sample` is those before and after. Changing it does not restart the camera.
- `TrackingFilter`, from `@livliv-dev/player/tracking`, is the same for inputs of your own (a controller, the
  network): `new TrackingFilter(profile)`, then `filter.apply(params, dt)` returns the reshaped params; `profile`,
  `sample`, and `reset()` when the input starts over.
- `readTrackingProfile(value)` reads a saved one (JSON): unknown params are left out, numbers kept in range.
  `parameterRule(key)` is a rule that changes nothing, to start from.

A profile is read when it is assigned, and the getters give a copy: to change one, assign a new one.

## Attachment points

`getAnchor('head' | 'body')` says where the head or the torso was drawn in the last frame, to put something on the
character that follows it (a hat, a sticker, a name tag): `{ x, y, rotation, scale }`, with `x`, `y` shares of the
canvas from its top left, `rotation` in radians (clockwise) and `scale` a width that fits there (about the head's, or
the shoulders' for the torso) as a share of the canvas's width. Call it after a frame, in `onFrame` for one. It is null
before the model's first frame, and for a point a body does not have. The point moves with actions, the view and the
body's own motion (on a full-body character, its sway, crouch and dip too); it is a point and an angle, not a skeleton, and does not bend what you put there. A `Body` of your
own can have `anchor(name)`; without it only `'head'` is there, from its `head()`.
