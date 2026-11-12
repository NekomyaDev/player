# Changelog

## 0.5.0

Full-body characters play, standing on the ground, and the free plan's mark has its new look. Half-body characters
draw as in 0.4, to the pixel. A page written for 0.4 needs no change; TypeScript code that builds a `Frame` or a
`ModelInfo` of its own (a test's stand-in) adds the new fields.

### New

- **Full-body characters**, livliv.ai's newer kind: drawn head to feet on a tall canvas, the feet on the ground. The
  upper body moves as a half-body character's; the whole figure sways from the ankles, the hips follow and shift their
  weight, a skirt's or coat's hem hangs behind them; a lean toward the camera and a hop crouch it, a hop lands, and
  lip sync dips the upper body instead of the whole picture. See [API.md](API.md#full-body-characters).
- `view.fit`: a full-body character's shot, `'frame'` (head and chest, the default), `'knee'` or `'whole'`.
- `ModelInfo.fullBody`; `frame.talk` (the talking bob, apart from `frame.move`) and `frame.grounded` for drivers; the
  `Fit` type.
- A full-body character's `PlaybackPose` has `crouch`, `dip` and `talk`, and `renderPose()` draws them.
- Format 4.1 ([FORMAT.md](FORMAT.md#full-body-characters-41)): `anchors.frame`, `anchors.body`,
  `anchors.hair_bottom_y`, `rig.lattice` and the feature `full_body`, in the schema too.
- A model's `tuning.fringe` (how far the bangs stand off the face, livliv.ai's feel setting) is read. livliv.ai's
  packages write it into the bangs' depth instead, so every player draws them alike.

### Changed

- **The free plan's mark over the character** is smaller and white inside a thin dark line, so it shows on light
  clothes as on dark ones, as on livliv.ai. The corner mark and the featured characters are unchanged.
- Lip sync puts its talking bob in `frame.talk` instead of adding it to `frame.move.y`; the picture moves as before.
- What drivers write to `frame.move` and `frame.talk` is kept to numbers: a NaN counts as no move.
- Full-body characters are no longer refused.

## 0.4.0

Ways to record a character and show it in more than one place, and two changes to what a character does: the chest
spring is off, and full-body characters wait for a later version. A page written for 0.3 needs no change.

### New

- Recorded poses: `getPose()`, `onFrame` and `renderPose(pose, dt, size)` on `Player` and `BodyPlayer`, to keep each
  frame's pose and draw it again, in another window or at a video's exact size. See [API.md](API.md#recorded-poses).
- `renderWhenHidden`: keep drawing while the canvas is out of view, for a live output or a recording.
- Response profiles, which reshape params one by one (range, curve, smoothing): `parameterProfile` and
  `parameterSample` on both players, `profile` and `sample` on face tracking, and `TrackingFilter`,
  `readTrackingProfile()`, `parameterRule()` and `TRACKING_PARAMETERS` from `@livliv-dev/player/tracking`. See
  [API.md](API.md#response-profiles).
- `getAnchor('head' | 'body')`: where the head and the torso were drawn, to attach things that follow the character. A
  `Body` of your own can give its own with `anchor()`.
- Face tracking: `deviceId` picks the camera, and `tracking.video` is its preview.
- Speech: `say()` takes a fetch `Response`, played as it streams in, and hooks (`onStart`, then `onEnd` or `onFail`);
  `volume`, `level`, `vowel`, and `stream`, the voice as a `MediaStream` for a call or a recording.
- `modelFiles()`: a model's own files, to save or package a character with a project.
- `new PngBody({ pixelated: true })`, for pixel art.

### Changed

- **The chest spring is off**, as on livliv.ai: the player ignores a saved `rig.body.bust`, so packages exported before
  keep still there too, and the featured characters now say 0. Breathing stays. At rest a character draws as in 0.3, to
  the pixel; the difference shows only on characters that had it, around the chest, while they breathe and move.
- **Full-body characters**, livliv.ai's newer kind (`anchors.body` in `model.json`), are refused with
  `missing-feature`: this version would show the whole tall canvas with the feet sliding. A later version plays them,
  and a `PlaybackPose` already has room for their moves (`crouch`, `dip`, `talk`, unused here).

### Fixed

- The expressions' `label` and `labels` keep their types on both players (#8).
- A streamed WAV plays at its own sample rate (#6).
- Face tracking tilts the head the same way as the face (#5).

### Featured characters

They are not in the npm package.

- 17 of the 21 rebuilt, as livliv.ai now shows them, and their covers redrawn.
- `rig.body.bust` is 0 in all of them.

## 0.3.0

The first version on npm, with the interface settled first: these change what a page written for 0.2 does.

### What to change

| 0.2 | 0.3 |
|---|---|
| `import ... from '@livliv/player'` and its subpaths | `'@livliv-dev/player'`, the package's name on npm. |
| `player.act('away')` | `player.setAway(true)` and `setAway(false)`. `act('away')` now throws: it was a switch among one-off moves. |
| `player.puppet` | No longer in the types. `player.poke()` and `player.canvasToModel()` are what pages used it for. The field still exists and can change in any version. |
| `player.load(a); player.load(b)` played `a`, then `b` | The new load replaces the one running, which rejects with an `AbortError`. If you catch errors, let this one through: `if (e.name === 'AbortError') return`. |
| `dispose()` on a load running rejected with an `Error` | It rejects with an `AbortError`, as `load()` on a disposed player does. |
| Errors told apart by their message | `e.code`, on a `LivLivError`. The messages can change. |

### New

- `load(source, { signal, onProgress, poster })`: call a load off, follow how far it has come, show a picture until the first frame.
- `LivLivError`, with a `code` for each reason, from `@livliv-dev/player` and `@livliv-dev/player/body`.
- `player.contextLost` and `player.onContextLost`: the page hears when the WebGL context is gone. See [API.md](API.md#when-the-context-is-lost).
- `dispose({ release: true })`: gives the WebGL context up, for a canvas leaving the page.
- `player.setAway()`, `player.poke()`, `player.canvasToModel()`.
- `example/react.html`.

### Changed

- A model that breaks while it is built leaves the character before as it was, to the pixel. It used to leave an empty canvas.
- The pose stays in the ranges of `PARAM_RANGES` on `Player` too, as it did on `BodyPlayer`. A value that is not a number counts as the default.
- `maxPixelRatio` can be read and changed on a `Player`.
- `snapshot()` on a `Player` draws first, so it is the pose as it is now, on a paused player too.
- A `BodyPlayer`'s `Frame.time` counts the frames before this one, as a `Player`'s does. Its idle motion runs one frame later.
- The two classes now share their code. Nothing a `Player` draws changed: frame by frame, with the same random numbers, 1300 frames each of 4 characters came out identical.

See the [commits](https://github.com/livliv-dev/player/commits/main) for what came before 0.3.
