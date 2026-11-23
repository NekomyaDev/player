import { LivLivError, type LivLivErrorCode } from './errors'
import { readModel } from './runtime/format'
import { isZip, leavesPackage, unzip, ZIP_LIMITS } from './zip'
import type { LoadOptions } from './base'
import type { ModelSource } from './index'

const fail = (message: string) => new LivLivError('too-large', `LivLiv: ${message}`)
/** a file larger than its own limit (`limit`), or all of them larger than a package may be */
const tooLarge = (file?: string, limit = 0) => fail(limit ? `${file} is larger than ${limit} bytes` : `the model's files are larger than ${ZIP_LIMITS.bytes} bytes in all`)
/** a file's path in the package, for tools that write the files out: refused when it would leave the package, as unzip
 *  refuses it (the same rule, leavesPackage), and, more strictly than load(), when it holds a control character (NUL
 *  among them) or `:` (on Windows `x.webp:y` names a stream inside x.webp). `#` and `?` are names like any other */
const pathOf = (path: string) => {
  const value = path.replace(/\\/g, '/').replace(/^(\.\/)+/, '')
  if (!value || leavesPackage(value)) throw new LivLivError('invalid', `LivLiv: the model file path ${JSON.stringify(path.slice(0, 200))} is outside its package`)
  if (/[\u0000-\u001f\u007f:]/.test(value)) throw new LivLivError('invalid', `LivLiv: the model file path ${JSON.stringify(path.slice(0, 200))} has a character a file name cannot safely have (a control character or ":")`)
  return value
}

/** The package's own model.json among its files' paths: the shallowest, the shortest path that is `model.json` or ends
 *  in `/model.json` (the first of those as long, in the order given). What load() plays; undefined when there is none.
 *  For a tool that reads a package's files before handing them to the player */
export function packageModelJson(paths: Iterable<string>): string | undefined {
  let best: string | undefined
  for (const p of paths) if ((p === 'model.json' || p.endsWith('/model.json')) && (best === undefined || p.length < best.length)) best = p
  return best
}

/** model.json read as the player reads it, its errors as a LivLivError */
function manifestOf(text: string) {
  try {
    return readModel(JSON.parse(text))
  } catch (e) {
    const err = e as Error & { code?: LivLivErrorCode }
    throw new LivLivError(e instanceof SyntaxError ? 'not-a-model' : err.code ?? 'invalid', `LivLiv: ${e instanceof SyntaxError ? 'model.json is not JSON' : err.message}`, { cause: e })
  }
}

/** Original model files for a portable project. Keeps the manifest, metadata and watermark unchanged.
 * A remote folder includes all declared textures and optional files; a failed fetch rejects the export. */
export async function modelFiles(source: ModelSource, options: Pick<LoadOptions, 'signal' | 'onProgress'> = {}): Promise<Map<string, Blob>> {
  const { signal, onProgress } = options
  signal?.throwIfAborted()
  let total = 0
  const read = async (url: URL, limit = ZIP_LIMITS.bytes) => {
    const r = await fetch(url, { signal }).catch((e) => {
      if (signal?.aborted || (e as Error)?.name === 'AbortError') throw e
      throw new LivLivError('unreachable', `LivLiv: could not load ${url.pathname}: unreachable, or on another origin that sends no CORS header`, { cause: e })
    })
    if (!r.ok) throw new LivLivError('http', `LivLiv: could not load ${url.pathname} (HTTP ${r.status})`, { status: r.status })
    const reader = r.body?.getReader(), chunks: Uint8Array<ArrayBuffer>[] = []
    if (!reader) {
      const blob = await r.blob()
      total += blob.size
      if (blob.size > limit || total > ZIP_LIMITS.bytes) throw tooLarge(url.pathname, blob.size > limit ? limit : 0)
      return blob
    }
    let size = 0
    try {
      for (;;) {
        signal?.throwIfAborted()
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength; total += value.byteLength
        if (size > limit || total > ZIP_LIMITS.bytes) throw tooLarge(url.pathname, size > limit ? limit : 0)
        chunks.push(value)
      }
    } catch (error) { await reader.cancel(error); throw error }
    return new Blob(chunks, { type: r.headers.get('content-type') ?? '' })
  }
  if (typeof source === 'string' || source instanceof URL) {
    const url = new URL(String(source), typeof document === 'undefined' ? undefined : document.baseURI)
    if (/\.(livliv|zip)$/i.test(url.pathname)) return modelFiles(await read(url), options)
    if (!url.pathname.endsWith('.json')) url.pathname = url.pathname.replace(/\/?$/, '/') + 'model.json'
    const manifest = await read(url, ZIP_LIMITS.modelJson), model = manifestOf(await manifest.text())
    const paths = new Set<string>()
    for (const layer of model.layers) for (const p of [layer.texture, ...(layer.frames ?? []), layer.mask, layer.talk, layer.brow_tex]) {
      if (p) paths.add(pathOf(layer.webp ? p.replace(/\.png$/, '.webp') : p))
    }
    for (const p of [model.keyforms, model.files?.avatar, model.files?.cover, model.files?.preview]) if (p) paths.add(pathOf(p))
    if (paths.size >= ZIP_LIMITS.entries) throw fail(`the model names more than ${ZIP_LIMITS.entries - 1} files`)
    const files = new Map<string, Blob>([['model.json', manifest]])
    onProgress?.({ step: 'download', progress: 0 })
    for (const path of paths) {
      const asset = new URL(path, url), base = new URL('.', url), query = new URLSearchParams(url.search)
      if (asset.origin !== base.origin || !asset.pathname.startsWith(base.pathname) || /%(?:2f|5c)/i.test(asset.pathname)) throw new LivLivError('invalid', `LivLiv: ${JSON.stringify(path.slice(0, 200))} is outside the model's folder`)
      if (model.tex) query.set('v', model.tex)
      asset.search = query.toString()
      files.set(path, await read(asset))
      onProgress?.({ step: 'download', progress: (files.size - 1) / paths.size })
    }
    signal?.throwIfAborted()
    return files
  }
  let files = new Map<string, Blob>()
  const checked = (m: Map<string, Blob>) => { for (const k of m.keys()) pathOf(k); return m }
  if (source instanceof Blob) return checked(await unzip(source, signal))
  if (source instanceof Map) for (const [name, blob] of source) files.set(pathOf(name), blob)
  else if (Symbol.iterator in source) for (const file of source as Iterable<File>) files.set(pathOf(file.webkitRelativePath || file.name), file)
  else for (const [name, blob] of Object.entries(source)) files.set(pathOf(name), blob)
  if (![...files.keys()].some((name) => name === 'model.json' || name.endsWith('/model.json'))) {
    for (const blob of files.values()) if (await isZip(blob)) { files = checked(await unzip(blob, signal)); break }
  }
  if (files.size > ZIP_LIMITS.entries) throw fail(`the model has ${files.size} files, more than ${ZIP_LIMITS.entries}`)
  for (const blob of files.values()) { total += blob.size; if (total > ZIP_LIMITS.bytes) throw tooLarge() }
  signal?.throwIfAborted()
  return files
}
