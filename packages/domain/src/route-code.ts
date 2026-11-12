/**
 * Route code as used by the operator: 1-3 digits with an optional 1-2 letter suffix.
 *
 * Observed on the real sheets: `2`, `5`, `20`, `108`, `203`, `9A`, `9AT`, `1A`, `A1`,
 * `12G`, `12P`. Letter suffixes carry meaning that is still undocumented (legacy open
 * questions S2/S3/S17), so they are preserved verbatim rather than interpreted here.
 */
const ROUTE_CODE_PATTERN = /^\d{1,3}[A-Z]{0,2}$/

export class RouteCode {
  private constructor(readonly value: string) {}

  static parse(input: string): RouteCode {
    const normalized = input.replace(/[\s.]/g, '').toUpperCase()

    if (!ROUTE_CODE_PATTERN.test(normalized)) {
      throw new Error(`Invalid route code: "${input}" (expected digits plus optional letters)`)
    }

    return new RouteCode(normalized)
  }

  /** Numeric part, e.g. `9AT` -> 9. */
  get number(): number {
    const digits = /^\d+/.exec(this.value)?.[0]
    if (digits === undefined) {
      throw new Error(`Route code has no numeric part: "${this.value}"`)
    }
    return Number.parseInt(digits, 10)
  }

  /** Letter suffix including the leading marker, e.g. `9AT` -> `AT`, `5` -> ''. */
  get suffix(): string {
    return this.value.replace(/^\d+/, '')
  }

  equals(other: RouteCode): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}
