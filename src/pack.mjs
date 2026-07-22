/**
 * Bundle the composed frames into one store-upload-ready ZIP.
 *
 * The frames land in `outDir/<device>/NN.png` (and `outDir/<variant>/<device>/…`
 * with variants) — organised for looking at, not for handing to a store. A
 * non-CI user wants a single file, sorted into the shape the upload UIs expect:
 * platform, then device, then the exact pixel slot, then locale. This produces
 * exactly that, and it does it WITHOUT a zip dependency — the archive is written
 * by hand from `node:zlib`, the same self-contained stance that has the tool ship
 * its own Chromium and ffmpeg rather than lean on what happens to be installed.
 *
 * The archive is deterministic: a fixed 1980 DOS timestamp (the ZIP epoch), files
 * emitted in sorted order. Re-running on the same frames yields the same bytes, so
 * a committed bundle diffs cleanly.
 */
import { deflateRawSync } from 'node:zlib'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, sep, extname, basename, dirname } from 'node:path'
import { DEVICES } from './devices.mjs'

/** CRC-32 (the ZIP variant), table built once. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/**
 * A minimal ZIP writer. `entries` is `[{ name, data }]`; every file is deflated
 * (method 8) with a fixed timestamp. Emits local headers, the central directory,
 * and the end-of-central-directory record — enough for every unzip tool and every
 * store upload. Names use forward slashes, as the format requires.
 */
export function zipSync(entries) {
  const DOS_TIME = 0 // 00:00:00
  const DOS_DATE = (1 << 5) | 1 // 1980-01-01: year 0, month 1, day 1
  const chunks = []
  const central = []
  let offset = 0

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name.split(sep).join('/'), 'utf8')
    const comp = deflateRawSync(data)
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0x0800, 6) // flags: bit 11 = names are UTF-8
    local.writeUInt16LE(8, 8) // method: deflate
    local.writeUInt16LE(DOS_TIME, 10)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(comp.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28) // extra len
    chunks.push(local, nameBuf, comp)

    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4) // version made by
    cd.writeUInt16LE(20, 6) // version needed
    cd.writeUInt16LE(0x0800, 8) // flags: bit 11 = names are UTF-8
    cd.writeUInt16LE(8, 10) // method
    cd.writeUInt16LE(DOS_TIME, 12)
    cd.writeUInt16LE(DOS_DATE, 14)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(comp.length, 20)
    cd.writeUInt32LE(data.length, 24)
    cd.writeUInt16LE(nameBuf.length, 28)
    cd.writeUInt16LE(0, 30) // extra
    cd.writeUInt16LE(0, 32) // comment
    cd.writeUInt16LE(0, 34) // disk start
    cd.writeUInt16LE(0, 36) // internal attrs
    cd.writeUInt32LE(0, 38) // external attrs
    cd.writeUInt32LE(offset, 42) // local header offset
    central.push(Buffer.concat([cd, nameBuf]))

    offset += local.length + nameBuf.length + comp.length
  }

  const cdBuf = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4) // this disk
  eocd.writeUInt16LE(0, 6) // cd start disk
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(cdBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20) // comment len
  return Buffer.concat([...chunks, cdBuf, eocd])
}

/** Every PNG under `dir`, as paths relative to it, sorted. */
async function pngsUnder(dir, root = dir) {
  const out = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await pngsUnder(p, root)))
    else if (extname(e.name) === '.png') out.push(relative(root, p))
  }
  return out
}

/** ios | android, from the device kind (android phones and tablets both start `android`). */
const platformOf = (device) => (/^android/.test(device.kind) ? 'android' : 'ios')

/**
 * Where a composed frame belongs in the bundle. A relpath like
 * `[<variant>/]<deviceOut>/<file>` becomes
 * `[<variant>/]<platform>/<deviceOut> <W>×<H>/[<locale>/]<file>` — the store's own
 * hierarchy. An unrecognised device folder is passed through under `other/` rather
 * than dropped, so nothing silently vanishes from the archive.
 */
export function bundlePath(relPath, locale) {
  const parts = relPath.split(sep)
  const file = parts.pop()
  const deviceOut = parts.pop() // immediate parent is the device folder
  const prefix = parts // anything above it (a variant name), kept
  const device = Object.values(DEVICES).find((d) => d.out === deviceOut)
  if (!device) return [...prefix, 'other', deviceOut, file].join('/')
  const slot = `${deviceOut} ${device.size[0]}x${device.size[1]}`
  return [...prefix, platformOf(device), slot, ...(locale ? [locale] : []), file].join('/')
}

/**
 * Read every composed PNG in `outDir`, lay them out store-ready, and write the
 * ZIP to `zipPath`. Returns the entry names written (sorted) so the caller can
 * print what went in.
 */
export async function pack({ outDir, zipPath, locale }) {
  const rels = await pngsUnder(outDir)
  const entries = []
  for (const rel of rels) {
    entries.push({ name: bundlePath(rel, locale), data: await readFile(join(outDir, rel)) })
  }
  entries.sort((a, b) => a.name.localeCompare(b.name))
  await writeFile(zipPath, zipSync(entries))
  return entries.map((e) => e.name)
}
