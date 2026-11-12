/**
 * Minimal ZIP writer (STORE, no compression).
 *
 * GTFS is distributed as a zip archive, and the platform has no zip API in Node's standard
 * library. Storing files uncompressed keeps the implementation auditable (no deflate
 * implementation to get wrong) and every GTFS consumer accepts it; feeds are a few hundred
 * kilobytes, so compression buys little.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) {
    const entry = CRC_TABLE[(crc ^ byte) & 0xff] ?? 0
    crc = (crc >>> 8) ^ entry
  }
  return (crc ^ 0xffffffff) >>> 0
}

export function createZip(files: Record<string, string>): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const entries = Object.entries(files).map(([name, content]) => {
    const nameBytes = encoder.encode(name)
    const data = encoder.encode(content)
    return { nameBytes, data, crc: crc32(data) }
  })

  const localSize = entries.reduce((sum, entry) => sum + 30 + entry.nameBytes.length + entry.data.length, 0)
  const centralSize = entries.reduce((sum, entry) => sum + 46 + entry.nameBytes.length, 0)
  const output = new Uint8Array(localSize + centralSize + 22)
  const view = new DataView(output.buffer)
  let offset = 0

  const localOffsets: number[] = []
  for (const entry of entries) {
    localOffsets.push(offset)
    view.setUint32(offset, 0x04034b50, true)
    view.setUint16(offset + 4, 20, true) // version needed
    view.setUint16(offset + 6, 0x0800, true) // UTF-8 filename flag
    view.setUint16(offset + 8, 0, true) // method: store
    view.setUint16(offset + 10, 0, true) // time
    view.setUint16(offset + 12, 0x21, true) // date (1980-01-01), fixed for reproducibility
    view.setUint32(offset + 14, entry.crc, true)
    view.setUint32(offset + 18, entry.data.length, true)
    view.setUint32(offset + 22, entry.data.length, true)
    view.setUint16(offset + 26, entry.nameBytes.length, true)
    view.setUint16(offset + 28, 0, true)
    offset += 30
    output.set(entry.nameBytes, offset)
    offset += entry.nameBytes.length
    output.set(entry.data, offset)
    offset += entry.data.length
  }

  const centralStart = offset
  entries.forEach((entry, index) => {
    const localOffset = localOffsets[index] ?? 0
    view.setUint32(offset, 0x02014b50, true)
    view.setUint16(offset + 4, 20, true) // version made by
    view.setUint16(offset + 6, 20, true) // version needed
    view.setUint16(offset + 8, 0x0800, true)
    view.setUint16(offset + 10, 0, true)
    view.setUint16(offset + 12, 0, true)
    view.setUint16(offset + 14, 0x21, true)
    view.setUint32(offset + 16, entry.crc, true)
    view.setUint32(offset + 20, entry.data.length, true)
    view.setUint32(offset + 24, entry.data.length, true)
    view.setUint16(offset + 28, entry.nameBytes.length, true)
    view.setUint16(offset + 30, 0, true)
    view.setUint16(offset + 32, 0, true)
    view.setUint16(offset + 34, 0, true)
    view.setUint16(offset + 36, 0, true)
    view.setUint32(offset + 38, 0, true) // external attributes
    view.setUint32(offset + 42, localOffset, true)
    offset += 46
    output.set(entry.nameBytes, offset)
    offset += entry.nameBytes.length
  })

  view.setUint32(offset, 0x06054b50, true)
  view.setUint16(offset + 4, 0, true)
  view.setUint16(offset + 6, 0, true)
  view.setUint16(offset + 8, entries.length, true)
  view.setUint16(offset + 10, entries.length, true)
  view.setUint32(offset + 12, offset - centralStart, true)
  view.setUint32(offset + 16, centralStart, true)
  view.setUint16(offset + 20, 0, true)

  return output
}

export type ZipEntry = { readonly name: string; readonly content: string }

/** Reads back the archives this module writes (STORE only). Used by tests and importers. */
export function readZip(archive: Uint8Array): ZipEntry[] {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength)
  const decoder = new TextDecoder()
  const entries: ZipEntry[] = []
  let offset = 0

  while (offset + 4 <= archive.length && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true)
    const size = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    if (method !== 0) {
      throw new Error('Only stored (uncompressed) zip entries are supported')
    }

    const nameStart = offset + 30
    const name = decoder.decode(archive.subarray(nameStart, nameStart + nameLength))
    const dataStart = nameStart + nameLength + extraLength
    entries.push({ name, content: decoder.decode(archive.subarray(dataStart, dataStart + size)) })
    offset = dataStart + size
  }

  return entries
}
