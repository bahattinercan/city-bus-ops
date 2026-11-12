import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { MATRIX_SHEET, ROTATION_SHEET, TEMPLATE_VERSION } from './template-layout'
import { SHEET_HEADERS, buildWeeklyWorkbook, type WeeklySheetInput } from './weekly-sheet'

const dayLabels = ['PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA', 'CUMARTESİ', 'PAZAR']

function input(rows = 45): WeeklySheetInput {
  return {
    organisationName: 'Kütahya Şehir İçi Ulaşım',
    weekStart: '2026-11-09',
    dayLabels,
    rows: Array.from({ length: rows }, (_, index) => ({
      sequence: index + 1,
      plate: String(index + 3).padStart(3, '0'),
      cells: index === 0 ? ['9A', 'YAT', 'x', '9A', '', '', ''] : ['', '', '', '', '', '', ''],
      standbyCode: index === 0 ? '7A' : '',
    })),
    dailyCounts: [5, 0, 6, 0, 1, 2, 0],
    rotation: [
      { group: '(6) Toki', dayLabel: 'ÇARŞAMBA', vehicleCount: 6 },
      { group: '(1) Kampüs/Konya', dayLabel: 'CUMA', vehicleCount: 1 },
    ],
  }
}

async function roundTrip(value: WeeklySheetInput) {
  const buffer = await buildWeeklyWorkbook(value)
  const workbook = new ExcelJS.Workbook()
  // ExcelJS types pin an older `Buffer` shape than the current @types/node; the runtime
  // value is a plain Buffer, so the cast is limited to this call signature.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0])
  return workbook
}

describe('weekly sheet', () => {
  it('pins the template version in the title band', async () => {
    const workbook = await roundTrip(input())
    const matrix = workbook.getWorksheet(MATRIX_SHEET.name)
    expect(String(matrix?.getCell('A1').value)).toContain('Haftalık Görev Planı')
    expect(String(matrix?.getCell('A2').value)).toContain(TEMPLATE_VERSION)
  })

  it('writes the header on row 3 and data from row 4', async () => {
    const workbook = await roundTrip(input())
    const matrix = workbook.getWorksheet(MATRIX_SHEET.name)
    expect(matrix?.getCell('A3').value).toBe(SHEET_HEADERS.sequence)
    expect(matrix?.getCell('B3').value).toBe(SHEET_HEADERS.plate)
    expect(matrix?.getCell('C3').value).toBe('PAZARTESİ')
    expect(matrix?.getCell('I3').value).toBe('PAZAR')
    expect(matrix?.getCell('J3').value).toBe(SHEET_HEADERS.standby)
    expect(matrix?.getCell('B4').value).toBe('003')
  })

  it('writes day cells and the standby code', async () => {
    const workbook = await roundTrip(input())
    const matrix = workbook.getWorksheet(MATRIX_SHEET.name)
    expect(matrix?.getCell('C4').value).toBe('9A')
    expect(matrix?.getCell('D4').value).toBe('YAT')
    expect(matrix?.getCell('E4').value).toBe('x')
    expect(matrix?.getCell('J4').value).toBe('7A')
  })

  it('puts daily counts and the weekly total on the totals row', async () => {
    const workbook = await roundTrip(input())
    const matrix = workbook.getWorksheet(MATRIX_SHEET.name)
    expect(matrix?.getCell('A49').value).toBe('TOPLAM')
    expect(matrix?.getCell('C49').value).toBe(5)
    expect(matrix?.getCell('J49').value).toBe(14)
  })

  it('fits 45 vehicles and refuses the 46th', async () => {
    await expect(roundTrip(input(45))).resolves.toBeDefined()
    await expect(roundTrip(input(46))).rejects.toThrow(/fits 45 vehicles/)
  })

  it('writes the rotation sheet', async () => {
    const workbook = await roundTrip(input())
    const rotation = workbook.getWorksheet(ROTATION_SHEET.name)
    expect(rotation?.getCell('A1').value).toBe('Görev grubu')
    expect(rotation?.getCell('A2').value).toBe('(6) Toki')
    expect(rotation?.getCell('B2').value).toBe('ÇARŞAMBA')
    expect(rotation?.getCell('C3').value).toBe(1)
  })
})
