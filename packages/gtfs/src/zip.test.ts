import { describe, expect, it } from 'vitest'
import { createZip, crc32, readZip } from './zip'

describe('crc32', () => {
  it('matches the reference value for "123456789"', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  it('is zero for empty input', () => {
    expect(crc32(new Uint8Array())).toBe(0)
  })
})

describe('zip', () => {
  const files = {
    'agency.txt': 'agency_id,agency_name\ncitybus,Kütahya\n',
    'stops.txt': 'stop_id,stop_name\nS1,"Durak, merkez"\n',
  }

  it('starts with a local file header', () => {
    const archive = createZip(files)
    const view = new DataView(archive.buffer)
    expect(view.getUint32(0, true)).toBe(0x04034b50)
  })

  it('round-trips every file', () => {
    const entries = readZip(createZip(files))
    expect(entries.map((entry) => entry.name)).toEqual(['agency.txt', 'stops.txt'])
    expect(entries[0]?.content).toBe(files['agency.txt'])
    expect(entries[1]?.content).toBe(files['stops.txt'])
  })

  it('records the archive size in the end-of-central-directory', () => {
    const archive = createZip(files)
    const view = new DataView(archive.buffer)
    const endOffset = archive.length - 22
    expect(view.getUint32(endOffset, true)).toBe(0x06054b50)
    expect(view.getUint16(endOffset + 10, true)).toBe(2)
    expect(view.getUint32(endOffset + 16, true)).toBeLessThan(endOffset)
  })

  it('handles an empty archive', () => {
    expect(readZip(createZip({}))).toEqual([])
  })
})
