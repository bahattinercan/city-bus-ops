import ExcelJS from 'exceljs'
import { MATRIX_SHEET, ROTATION_SHEET, TEMPLATE_VERSION } from './template-layout'

export type WeeklySheetRow = {
  readonly sequence: number
  readonly plate: string
  /** Seven cells, Monday first; `YAT` for an idle vehicle, `x` for standby. */
  readonly cells: readonly string[]
  /** Route code printed in the NÖBET column, or empty. */
  readonly standbyCode: string
}

export type WeeklySheetInput = {
  readonly organisationName: string
  /** Monday of the week, `YYYY-MM-DD`. */
  readonly weekStart: string
  readonly dayLabels: readonly string[]
  readonly rows: readonly WeeklySheetRow[]
  readonly dailyCounts: readonly number[]
  readonly rotation: readonly {
    readonly group: string
    readonly dayLabel: string
    readonly vehicleCount: number
  }[]
}

export const SHEET_HEADERS = {
  sequence: 'SIRA',
  plate: 'PLAKA',
  standby: 'NÖBET',
} as const

const FIRST_COLUMN = 1
const PLATE_COLUMN = 2
const FIRST_DAY_COLUMN = 3

/**
 * Builds the weekly plan workbook in the operator's own layout (template v2.0).
 *
 * Coordinates are the contract: summary band `A1:J2`, header row 3, data rows 4..48,
 * daily counts and the weekly total on row 49. Changing them breaks years of muscle memory
 * and the printed sheet, so they are pinned by tests.
 */
export async function buildWeeklyWorkbook(input: WeeklySheetInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'City Bus Ops'
  workbook.created = new Date(Date.UTC(2026, 0, 1))

  const matrix = workbook.addWorksheet(MATRIX_SHEET.name, {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  })

  matrix.mergeCells('A1:J1')
  matrix.getCell('A1').value = `${input.organisationName} — Haftalık Görev Planı`
  matrix.getCell('A1').font = { bold: true, size: 14 }
  matrix.getCell('A1').alignment = { horizontal: 'center' }

  matrix.mergeCells('A2:J2')
  matrix.getCell('A2').value = `${input.weekStart} haftası · şablon ${TEMPLATE_VERSION}`
  matrix.getCell('A2').alignment = { horizontal: 'center' }
  matrix.getCell('A2').font = { size: 10, color: { argb: 'FF555555' } }

  const headerRow = matrix.getRow(MATRIX_SHEET.headerRow)
  headerRow.getCell(FIRST_COLUMN).value = SHEET_HEADERS.sequence
  headerRow.getCell(PLATE_COLUMN).value = SHEET_HEADERS.plate
  input.dayLabels.forEach((label, index) => {
    headerRow.getCell(FIRST_DAY_COLUMN + index).value = label
  })
  headerRow.getCell(FIRST_DAY_COLUMN + 7).value = SHEET_HEADERS.standby
  headerRow.font = { bold: true }
  headerRow.alignment = { horizontal: 'center' }
  headerRow.eachCell((cell) => {
    cell.border = { bottom: { style: 'thin' } }
  })

  input.rows.forEach((row, index) => {
    const sheetRow = MATRIX_SHEET.firstDataRow + index
    if (sheetRow > MATRIX_SHEET.lastDataRow) {
      throw new Error(
        `The sheet fits ${MATRIX_SHEET.lastDataRow - MATRIX_SHEET.firstDataRow + 1} vehicles, got ${input.rows.length}`,
      )
    }
    const line = matrix.getRow(sheetRow)
    line.getCell(FIRST_COLUMN).value = row.sequence
    line.getCell(PLATE_COLUMN).value = row.plate

    row.cells.slice(0, 7).forEach((value, dayIndex) => {
      const cell = line.getCell(FIRST_DAY_COLUMN + dayIndex)
      cell.value = value
      cell.alignment = { horizontal: 'center' }
      if (value === 'YAT') {
        cell.font = { color: { argb: 'FF999999' } }
      }
      if (value === 'x') {
        cell.font = { bold: true }
      }
    })
    line.getCell(FIRST_DAY_COLUMN + 7).value = row.standbyCode === '' ? null : row.standbyCode
    line.getCell(FIRST_DAY_COLUMN + 7).alignment = { horizontal: 'center' }
  })

  const totalsRow = matrix.getRow(MATRIX_SHEET.totalsRow)
  totalsRow.getCell(FIRST_COLUMN).value = 'TOPLAM'
  input.dailyCounts.slice(0, 7).forEach((count, index) => {
    totalsRow.getCell(FIRST_DAY_COLUMN + index).value = count
  })
  totalsRow.getCell(FIRST_DAY_COLUMN + 7).value = input.dailyCounts.reduce((sum, count) => sum + count, 0)
  totalsRow.font = { bold: true }
  totalsRow.alignment = { horizontal: 'center' }

  matrix.getColumn(1).width = 6
  matrix.getColumn(2).width = 9
  for (let column = FIRST_DAY_COLUMN; column <= FIRST_DAY_COLUMN + 6; column += 1) {
    matrix.getColumn(column).width = 9
  }
  matrix.getColumn(FIRST_DAY_COLUMN + 7).width = 9
  matrix.views = [{ state: 'frozen', ySplit: MATRIX_SHEET.headerRow }]
  matrix.pageSetup.printArea = `A1:J${MATRIX_SHEET.totalsRow}`

  const rotation = workbook.addWorksheet(ROTATION_SHEET.name)
  const rotationHeader = rotation.getRow(1)
  rotationHeader.values = ['Görev grubu', 'Bu haftaki gün', 'Araç sayısı']
  rotationHeader.font = { bold: true }
  input.rotation.forEach((entry, index) => {
    const row = rotation.getRow(index + 2)
    row.values = [entry.group, entry.dayLabel, entry.vehicleCount]
  })
  rotation.getColumn(1).width = 24
  rotation.getColumn(2).width = 16
  rotation.getColumn(3).width = 12

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
