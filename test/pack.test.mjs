/**
 * Phase 10: the store-ready ZIP bundle.
 *
 * The archive is written by hand from node:zlib, so the load-bearing test is a
 * real round-trip — zip it, parse the container back, inflate every entry, and
 * confirm the bytes and the CRC survive. A ZIP that unzips in Node but not in the
 * store's uploader is the failure that matters, so the decoder here is deliberately
 * independent of the writer (it re-reads the central directory, it does not trust
 * the writer's own offsets).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inflateRawSync } from 'node:zlib'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zipSync, bundlePath, pack } from '../src/pack.mjs'

/** A minimal, independent ZIP reader: walk the central directory, inflate each entry. */
function unzip(buf) {
  // Find the end-of-central-directory record (fixed 22 bytes here — no comment).
  const eocd = buf.length - 22
  assert.equal(buf.readUInt32LE(eocd), 0x06054b50, 'EOCD signature present')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16) // central dir offset
  const out = {}
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, 'central header signature')
    const crc = buf.readUInt32LE(p + 16)
    const comp = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const localOff = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    // Jump to the local header to find where the data starts.
    const lNameLen = buf.readUInt16LE(localOff + 26)
    const lExtra = buf.readUInt16LE(localOff + 28)
    const dataAt = localOff + 30 + lNameLen + lExtra
    const data = inflateRawSync(buf.subarray(dataAt, dataAt + comp))
    out[name] = { data, crc }
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32)
  }
  return out
}

// CRC-32, to independently confirm the writer stored the right checksum.
function crc32(b) {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) {
    c ^= b[i]
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}

test('zipSync round-trips content and stores the correct CRC', () => {
  const a = Buffer.from('the quick brown fox '.repeat(40))
  const b = Buffer.from([137, 80, 78, 71, ...Array.from({ length: 300 }, (_, i) => i % 256)])
  const zip = zipSync([
    { name: 'ios/6.9 1290x2796/01-a.png', data: a },
    { name: 'android/android-phone 1080x2160/02-b.png', data: b },
  ])
  const got = unzip(zip)
  assert.deepEqual(got['ios/6.9 1290x2796/01-a.png'].data, a, 'entry A round-trips')
  assert.deepEqual(got['android/android-phone 1080x2160/02-b.png'].data, b, 'entry B round-trips')
  assert.equal(got['ios/6.9 1290x2796/01-a.png'].crc, crc32(a), 'CRC of A is correct')
})

test('zipSync is deterministic — same input, same bytes', () => {
  const e = [{ name: 'x/01.png', data: Buffer.from('same') }]
  assert.deepEqual(zipSync(e), zipSync(e), 'no clock or randomness leaks in')
})

test('bundlePath sorts a frame into platform / device-slot / [locale]', () => {
  assert.equal(bundlePath('6.9/01-nearby.png'), 'ios/6.9 1290x2796/01-nearby.png')
  assert.equal(bundlePath('android-phone/02-x.png'), 'android/android-phone 1080x2160/02-x.png')
  // A variant prefix above the device folder is preserved.
  assert.equal(bundlePath('B-ocean/6.9/01-a.png'), 'B-ocean/ios/6.9 1290x2796/01-a.png')
  // A locale becomes its own level under the slot.
  assert.equal(bundlePath('6.9/01-a.png', 'fr'), 'ios/6.9 1290x2796/fr/01-a.png')
  // An unrecognised device folder is passed through under other/, never dropped.
  assert.equal(bundlePath('weird/03-y.png'), 'other/weird/03-y.png')
})

test('pack reads a composed outDir, lays it out, and writes a valid zip', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'shots-pack-'))
  try {
    await mkdir(join(dir, '6.9'), { recursive: true })
    await mkdir(join(dir, 'android-phone'), { recursive: true })
    const home = Buffer.from('home-frame-bytes '.repeat(20))
    await writeFile(join(dir, '6.9', '01-home.png'), home)
    await writeFile(join(dir, '6.9', '02-chat.png'), Buffer.from('chat'))
    await writeFile(join(dir, 'android-phone', '01-home.png'), Buffer.from('android'))

    const zipPath = join(dir, 'bundle.zip')
    const names = await pack({ outDir: dir, zipPath })
    assert.deepEqual(
      names,
      [
        'android/android-phone 1080x2160/01-home.png',
        'ios/6.9 1290x2796/01-home.png',
        'ios/6.9 1290x2796/02-chat.png',
      ],
      'sorted, store-ready layout',
    )
    const got = unzip(await import('node:fs').then((fs) => fs.promises.readFile(zipPath)))
    assert.deepEqual(got['ios/6.9 1290x2796/01-home.png'].data, home, 'the real frame bytes survive the trip')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
