/** Sheet-style time handling: the operator writes 06:00, the database stores 360. */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—'
  const normalized = ((minutes % 1440) + 1440) % 1440
  const hours = Math.floor(normalized / 60)
  const rest = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

/** Total minutes after midnight; an overnight trip may exceed 1440. */
export function formatMinutesLong(minutes: number): string {
  if (minutes < 1440) return formatMinutes(minutes)
  return `${formatMinutes(minutes)}+1`
}

export function parseClock(input: string): number {
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(input.trim())
  if (match === null || match[1] === undefined || match[2] === undefined) {
    throw new Error(`Saat biçimi geçersiz: "${input}" (beklenen SS:DD)`)
  }
  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2], 10)
  if (hours > 47 || minutes > 59) {
    throw new Error(`Saat aralık dışı: "${input}"`)
  }
  return hours * 60 + minutes
}

/** Monday of the week containing `date` (UTC), as YYYY-MM-DD. */
export function weekStart(date: Date): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const weekday = utc.getUTCDay() === 0 ? 7 : utc.getUTCDay()
  utc.setUTCDate(utc.getUTCDate() - (weekday - 1))
  return utc.toISOString().slice(0, 10)
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
