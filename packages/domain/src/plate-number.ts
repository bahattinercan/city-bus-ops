/**
 * Fleet plate number as printed on the weekly plan (3 digits, zero padded).
 *
 * The operator's sheets identify a bus by a 3-digit fleet number (003, 134, 229),
 * not by a road licence plate. Leading zeros are significant and must survive
 * every round trip (Excel cell, DB column, URL, print).
 */
const PLATE_PATTERN = /^\d{1,3}$/

export class PlateNumber {
  private constructor(readonly value: string) {}

  static parse(input: string): PlateNumber {
    const trimmed = input.trim()

    if (!PLATE_PATTERN.test(trimmed)) {
      throw new Error(`Invalid fleet plate number: "${input}" (expected 1-3 digits)`)
    }

    return new PlateNumber(trimmed.padStart(3, '0'))
  }

  /** Numeric form, for sorting and range checks. */
  get number(): number {
    return Number.parseInt(this.value, 10)
  }

  equals(other: PlateNumber): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}
