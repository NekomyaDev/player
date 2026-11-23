#!/usr/bin/env node
// Each featured character as one file, characters/<id>.livliv, next to its folder (FORMAT.md §1: model.json first, images
// and model.json stored, keyforms.json deflated). The examples load these: one request instead of one per image, which on
// a slow path saves more than half the wait. Written by `npm run build`, not kept in git: they would only double what the
// repository holds. The bytes depend on the files alone (no dates), so a build changes nothing it need not. The cover stays
// out: it is what a page shows before the package arrives.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { crc32, deflateRawSync } from 'node:zlib'

// (another folder of characters as the argument: the Pages workflow packs the retired ones this way)
const root = process.argv[2] ? path.resolve(process.argv[2]) : fileURLToPath(new URL('../characters/', import.meta.url))

function zip(dir) {
  const list = (at = '') => fs.readdirSync(path.join(dir, at), { withFileTypes: true }).flatMap((e) => {
    const p = at ? `${at}/${e.name}` : e.name
    return e.isDirectory() ? list(p) : [p]
  }).sort()
  const names = ['model.json', ...list().filter((f) => f !== 'model.json' && f !== 'cover.webp')]
  const local = [], central = []
  let at = 0
  for (const name of names) {
    const raw = fs.readFileSync(path.join(dir, name)), deflate = name === 'keyforms.json'
    const data = deflate ? deflateRawSync(raw, { level: 9 }) : raw, file = Buffer.from(name), crc = crc32(raw)
    const method = deflate ? 8 : 0
    const h = Buffer.alloc(30)
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(method, 8); h.writeUInt16LE(0x21, 12)
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(file.length, 26)
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(method, 10); c.writeUInt16LE(0x21, 14)
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(file.length, 28); c.writeUInt32LE(at, 42)
    local.push(h, file, data); central.push(c, file)
    at += 30 + file.length + data.length
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(at, 16)
  return Buffer.concat([...local, cd, end])
}

let n = 0, bytes = 0
for (const e of fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }) : []) {
  if (!e.isDirectory()) continue
  const b = zip(path.join(root, e.name))
  fs.writeFileSync(path.join(root, `${e.name}.livliv`), b)
  n++; bytes += b.length
}
console.log(`characters: ${n} packages, ${(bytes / 1e6).toFixed(1)} MB`)
