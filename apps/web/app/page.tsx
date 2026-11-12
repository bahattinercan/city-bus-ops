import { DAY_TYPES, PlateNumber, dayIndex, printLabel } from '@citybus/domain'
import { MATRIX_SHEET, TEMPLATE_VERSION, dayColumn } from '@citybus/xlsx'

type Milestone = {
  readonly id: string
  readonly scope: string
  readonly state: 'done' | 'next' | 'pending'
}

const MILESTONES: readonly Milestone[] = [
  { id: 'M0', scope: 'İskele: workspace, Next.js, Postgres bağlantısı, CI', state: 'done' },
  { id: 'M1', scope: 'Domain + şema + filo seed + kural kataloğu', state: 'next' },
  { id: 'M2', scope: 'Hat / durak / sefer editörü + GTFS çıkışı', state: 'pending' },
  { id: 'M3', scope: 'Araç bloklama, görev + 7 haftalık rotasyon, kural motoru', state: 'pending' },
  { id: 'M4', scope: 'Şoför: kayıt, run cutting, roster, izin, takas, PWA', state: 'pending' },
  { id: 'M5', scope: '.xlsx (şablon v2.0) + PDF + görev kartı + KPI', state: 'pending' },
  { id: 'M6', scope: 'Roller, audit, yedek, deploy, demo tenant', state: 'pending' },
]

const STATE_LABEL: Record<Milestone['state'], string> = {
  done: 'TAMAM',
  next: 'SIRADA',
  pending: 'BEKLİYOR',
}

const SAMPLE_PLATE = PlateNumber.parse('3')

export default function Home() {
  return (
    <main>
      <h1>City Bus Ops</h1>
      <p className="lead">Şehir içi otobüs operasyon sistemi — planlama, görev ve şoför yönetimi.</p>

      <section>
        <h2>Yol haritası</h2>
        <table>
          <thead>
            <tr>
              <th>Faz</th>
              <th>Kapsam</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {MILESTONES.map((milestone) => (
              <tr key={milestone.id}>
                <td>{milestone.id}</td>
                <td>{milestone.scope}</td>
                <td className={`state ${milestone.state === 'done' ? 'done' : 'pending'}`}>
                  {STATE_LABEL[milestone.state]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Bağlı paketler (canlı kontrol)</h2>
        <ul className="checks">
          <li>
            <code>@citybus/domain</code> plaka normalizasyonu: <code>&quot;3&quot;</code> →{' '}
            <code>{SAMPLE_PLATE.value}</code> (sayısal {SAMPLE_PLATE.number})
          </li>
          <li>
            <code>@citybus/xlsx</code> şablon sürümü: <code>{TEMPLATE_VERSION}</code> · sayfa{' '}
            <code>{MATRIX_SHEET.name}</code> · veri satırı{' '}
            <code>
              {MATRIX_SHEET.firstDataRow}–{MATRIX_SHEET.lastDataRow}
            </code>{' '}
            · nöbet kolonu <code>{MATRIX_SHEET.standbyColumn}</code>
          </li>
          <li>
            Gün → kolon eşlemesi:{' '}
            {DAY_TYPES.map((day) => `${printLabel(day)} (${dayIndex(day)})=${dayColumn(day)}`).join(
              ' · ',
            )}
          </li>
        </ul>
      </section>

      <footer>
        M0 iskeleti. Veritabanı (Postgres + PostGIS) M1&apos;de bağlanır. Doğrulama:{' '}
        <code>pnpm verify</code>
      </footer>
    </main>
  )
}
