// @livliv-dev/player/runtime: the renderer and the motion modules underneath Player and BodyPlayer, for code that runs its
// own frame loop and drives them itself (livliv.ai does). An advanced entry: it is the runtime as it is, outside the
// compatibility promise of the package's other entries, and may change in a minor version. Pin the exact version.
// It shares its code with the other entries (no second copy on a page that imports both); MediaPipe still loads only
// when face tracking starts.

// the renderer
export {
  Puppet, IdleDriver, defaultParams, PARAM_RANGES, smooth, eyeFade, BLINK_HOLD, blinkOpen, blinkOver, defaultRig, defaultTuning, keyformsFit, lidCurveFits,
  loadBlob, loadImage, packUrl, FRINGE_MAX, fringeScale, fringeTop,
} from './runtime/puppet'
export type { Params, Tuning, ModelDef, LayerDef, KeyformFile, Rig, ChainDef, BrowLine, MeshView, LayerHit } from './runtime/puppet'
// the model file: reading it, its limits
export {
  readModel, FORMAT, FORMAT_VERSION, LEGACY_FORMAT, LEGACY_VERSION, FEATURES, LIMITS, latticeCell, latticeOf, pickLabel, langOf, uiLang,
} from './runtime/format'
export type { Labels, ModelMeta, ModelFiles, Watermark } from './runtime/format'
// full-body characters
export { fullBody, fitBox, BODY_POINTS, type Fit, type FullBody, type BodyAnchors } from './runtime/fullbody'
// motion: the idle, actions, talking, filters
export { LivelyIdle, IDLE_STYLE, IDLE_MOVES, pointAt, type IdleStyle } from './runtime/idle'
export { ActionPlayer, type ActionId } from './runtime/actions'
export { TalkMotion } from './runtime/talk'
export { OneEuro } from './runtime/filters'
// face tracking, voice, speech, recorded face traces
export { FaceTracker, LOST_AFTER, V, loadFaceModel, setFaceModelFiles, type StartStep } from './runtime/tracking'
export { VoiceMeter } from './runtime/voice'
export { VowelCue, vowelTrack } from './runtime/vowel'
export { SpeechPlayer, envelope, type ClipHooks } from './runtime/speech'
export { TraceSource, TraceRecorder, SynthStats, synthTrace, BS, LM, type Frame as TraceFrame } from './runtime/trace'
// the mark: its look and how it is drawn
export * as brand from './runtime/brand'
