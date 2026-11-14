import Link from 'next/link'
import { sql } from 'drizzle-orm'
import type { ReactNode } from 'react'
import {
  DRIVER_RULE_CATALOG,
  DRIVER_RULE_CODES,
  LABOUR_LIMITS,
  ROTATION_CYCLE_WEEKS,
  RULE_CATALOG,
  RULE_CODES,
} from '@citybus/domain'
import { requireSession } from '@/lib/auth'
import { allRows, getOrganisation } from '@/lib/db'

export const dynamic = 'force-dynamic'

type StepKey = 'network' | 'plan' | 'drivers' | 'reports' | 'driver'

type Step = {
  readonly key: StepKey
  readonly title: string
  /** roles that actually reach this screen */
  readonly audience: readonly string[]
  readonly roles: string
  readonly href: string
  readonly action: string
  readonly body: ReactNode
}

const STEPS: readonly Step[] = [
  {
    key: 'network',
    audience: ['admin', 'planner'],
    title: 'Ağ & Tarife',
    roles: 'yönetici · planlama',
    href: '/network',
    action: 'Ağ & Tarife ekranını aç',
    body: (
      <>
        Önce hat, durak ve sefer tanımlayın. Bir hatta sefer ekleyebilmek için o hatta en az iki durak
        bağlı olmalı. Durak saatleri iki uç arasında eşit dağıtılır. Seferler olmadan haftalık plan
        üretilemez.
      </>
    ),
  },
  {
    key: 'plan',
    audience: ['admin', 'planner', 'dispatcher'],
    title: 'Haftalık Plan',
    roles: 'yönetici · planlama · santral',
    href: '/plan',
    action: 'Haftalık Plan ekranını aç',
    body: (
      <>
        Haftayı seçip <strong>Haftayı üret</strong> ile planı oluşturun. Plan, {ROTATION_CYCLE_WEEKS}{' '}
        haftalık rotasyon kuralına göre görev gruplarını günlere dağıtır. Kural denetimi yeşilse{' '}
        <strong>Yayınla</strong> ile planı kilitleyin. Tek bir hücreyi elle düzelttiğinizde o hücre
        kilitlenir ve yeniden üretimde korunur. Aynı ekrandaki <strong>Toplu düzenleme</strong> paneliyle
        birden çok hücreyi tek seferde değiştirebilirsiniz: satırlar <code>plaka gün kod</code> biçiminde
        yazılır, önizleme onaylanmadan hiçbir şey yazılmaz.
      </>
    ),
  },
  {
    key: 'drivers',
    audience: ['admin', 'planner', 'dispatcher'],
    title: 'Şoförler',
    roles: 'yönetici · planlama · santral',
    href: '/drivers',
    action: 'Şoförler ekranını aç',
    body: (
      <>
        <strong>Şoför ata (run cutting)</strong> görev pencerelerini şoförlere paylaştırır. Santral bu
        ekrandan takas isteklerini onaylar veya reddeder, arıza bildirimlerini kapatır, izin/rapor
        kaydı girer.
      </>
    ),
  },
  {
    key: 'reports',
    audience: ['admin', 'planner', 'dispatcher'],
    title: 'Raporlar',
    roles: 'yönetici · planlama · santral',
    href: '/reports',
    action: 'Raporlar ekranını aç',
    body: (
      <>
        Haftanın sayaçları, günlük dağılım, kural ihlali özeti, denetim izi ve plan geçmişi burada.
        Haftalık planı Excel olarak indirmek için üstteki <strong>Excel indir</strong> düğmesini
        kullanın.
      </>
    ),
  },
  {
    key: 'driver',
    audience: ['driver'],
    title: 'Benim Haftam',
    roles: 'şoför',
    href: '/driver',
    action: 'Benim Haftam ekranını aç',
    body: (
      <>
        Şoför hesabı yalnız kendi haftasını görür: gün, araç, başlangıç–bitiş ve mola. Takas isteği
        santrale gönderilir, arıza bildirimi kaydı açar.
      </>
    ),
  },
]

function state(organisationId: string): { trips: number; plans: number } {
  const [row] = allRows<{ trips: number; plans: number }>(sql`
    select
      (select count(*) from trip t
        join route r on r.id = t.route_id
        where r.organisation_id = ${organisationId}) as trips,
      (select count(*) from plan_version where organisation_id = ${organisationId}) as plans
  `)
  return { trips: Number(row?.trips ?? 0), plans: Number(row?.plans ?? 0) }
}

const CELL_CODES: ReadonlyArray<{ code: string; meaning: string }> = [
  { code: '9A', meaning: 'O gün bu hattın görevinde' },
  { code: '-20', meaning: 'Ek görev (20 dakika)' },
  { code: 'x', meaning: 'Nöbet — görev yok, yedek' },
  { code: '12.00', meaning: 'Günün ilk sefer saati' },
  { code: 'YAT', meaning: 'Yatan araç, o gün görev yok' },
]

type Tip = { readonly symptom: string; readonly cause: ReactNode; readonly audience: readonly string[] }

const OFFICE = ['admin', 'planner', 'dispatcher'] as const

const TIPS: readonly Tip[] = [
  {
    symptom: 'Haftalık plan üretilmiyor',
    cause: (
      <>
        Tarifede sefer yok. <Link href="/network">Ağ &amp; Tarife</Link> ekranından en az bir hatta iki
        durak ve bir sefer ekleyin.
      </>
    ),
    audience: OFFICE,
  },
  {
    symptom: 'Plan yayınlanmıyor',
    cause: (
      <>
        Sert kural ihlali var. Kural denetimi tablosundaki kodları düzeltin veya hücreyi elle düzenleyip
        kilitleyin.
      </>
    ),
    audience: OFFICE,
  },
  {
    symptom: 'Hücre değişmiyor',
    cause: (
      <>
        Elle düzenlenen hücre kilitlidir (R8). Kilidi açmak için planı yeniden üretin ya da hücreyi
        yeniden düzenleyin.
      </>
    ),
    audience: OFFICE,
  },
  {
    symptom: 'Takas isteği görünmüyor',
    cause: (
      <>
        İstek yalnız son plan sürümlerinde listelenir; istek plan yayınlandıktan sonra santrale düşer.
      </>
    ),
    audience: OFFICE,
  },
  {
    symptom: 'Görevlerim boş görünüyor',
    cause: (
      <>
        O hafta için plan üretilmemiş ya da size görev atanmamış olabilir. Haftayı değiştirip yeniden
        bakın; sürüyorsa santralden planı isteyin.
      </>
    ),
    audience: ['driver'],
  },
  {
    symptom: 'Arıza bildirimim listede yok',
    cause: <>Liste yalnız son beş bildirimi gösterir; kapatılan bildirim listeden düşer.</>,
    audience: ['driver'],
  },
  {
    symptom: 'Şoför kendi haftasını göremiyor',
    cause: (
      <>
        Hesap bir şoför kaydına bağlı değil. <Link href="/drivers">Şoförler</Link> ekranından kaydı
        eşleştirin.
      </>
    ),
    audience: OFFICE,
  },
]

const HARD_RULES = RULE_CODES.filter((code) => RULE_CATALOG[code].severity === 'hard')
const SOFT_RULES = RULE_CODES.filter((code) => RULE_CATALOG[code].severity === 'soft')
const HARD_DRIVER_RULES = DRIVER_RULE_CODES.filter((code) => DRIVER_RULE_CATALOG[code].severity === 'hard')
const SOFT_DRIVER_RULES = DRIVER_RULE_CODES.filter((code) => DRIVER_RULE_CATALOG[code].severity === 'soft')

export default async function HelpPage() {
  const session = await requireSession(['admin', 'planner', 'dispatcher', 'driver'])
  const organisation = await getOrganisation()
  const { trips, plans } = state(organisation.id)
  const steps = STEPS.filter((step) => step.audience.includes(session.role))
  const tips = TIPS.filter((tip) => tip.audience.includes(session.role))
  const office = session.role !== 'driver'

  const current: StepKey | null =
    session.role === 'driver'
      ? 'driver'
      : trips === 0
        ? 'network'
        : plans === 0
          ? 'plan'
          : 'reports'

  return (
    <>
      <h1>Nasıl Kullanılır</h1>
      <p className="lead">
        <span>{organisation.name}</span>
        <span className="badge">rol {session.role}</span>
        <span className="badge">{ROTATION_CYCLE_WEEKS} haftalık döngü</span>
        <span className="muted">sıra: tarife → plan → şoför → rapor</span>
      </p>

      <h3>Adım adım akış</h3>
      <div className="steps">
        {steps.map((step, index) => (
          <section key={step.key} className={step.key === current ? 'step step-now' : 'step'}>
            <div className="step-head">
              <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
              <h2>{step.title}</h2>
              <span className="badge">{step.roles}</span>
              {step.key === current && (
                <span className="badge ok">
                  <span className="led ok" />
                  buradan başla
                </span>
              )}
            </div>
            <p className="step-body">{step.body}</p>
            <Link className="step-link" href={step.href}>
              {step.action} →
            </Link>
          </section>
        ))}
      </div>

      <h3>Plan tablosu nasıl okunur</h3>
      <p className="hint">
        Satırlar araç (plaka), kolonlar haftanın günleri. Hücre, o aracın o günkü görevini gösterir.
        Elle düzenlenen hücre kilitlidir ve yeniden üretimde değişmez. Tablonun son satırı günlük
        görev sayısıdır.
      </p>
      <table>
        <thead>
          <tr>
            <th>Hücre kodu</th>
            <th>Anlamı</th>
          </tr>
        </thead>
        <tbody>
          {CELL_CODES.map((row) => (
            <tr key={row.code}>
              <td>
                <strong>{row.code}</strong>
              </td>
              <td className="muted">{row.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Kurallar ve yayın</h3>
      <p className="hint">
        Plan, {RULE_CODES.length} operasyon kuralı (R1–R{RULE_CODES.length}) ve{' '}
        {DRIVER_RULE_CODES.length} şoför çalışma kuralı (L1–L{DRIVER_RULE_CODES.length}) ile denetlenir.
        Sert kural ihlali yayını bloke eder; yumuşak kural yalnız uyarır. Sürüş{' '}
        {LABOUR_LIMITS.maxDrivingMinutes / 60} saat, görev penceresi{' '}
        {LABOUR_LIMITS.maxDutyMinutes / 60} saat, iki görev arası dinlenme en az{' '}
        {LABOUR_LIMITS.minRestBetweenDutiesMinutes / 60} saat.
      </p>
      <table>
        <thead>
          <tr>
            <th>Grup</th>
            <th className="num">Adet</th>
            <th>Kodlar</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <span className="badge hard">sert</span> yayını bloke eder
            </td>
            <td className="num">{HARD_RULES.length + HARD_DRIVER_RULES.length}</td>
            <td className="muted">{[...HARD_RULES, ...HARD_DRIVER_RULES].join(' · ')}</td>
          </tr>
          <tr>
            <td>
              <span className="badge soft">yumuşak</span> uyarır
            </td>
            <td className="num">{SOFT_RULES.length + SOFT_DRIVER_RULES.length}</td>
            <td className="muted">{[...SOFT_RULES, ...SOFT_DRIVER_RULES].join(' · ')}</td>
          </tr>
        </tbody>
      </table>
      {office && (
        <p className="hint">
          İhlal gördüğünüzde <Link href="/plan">Haftalık Plan</Link> ekranındaki kural denetimi tablosu
          kodu, şiddeti ve mesajı birlikte gösterir.
        </p>
      )}

      <h3>Roller</h3>
      <table>
        <thead>
          <tr>
            <th>Ekran</th>
            <th className="num">yönetici</th>
            <th className="num">planlama</th>
            <th className="num">santral</th>
            <th className="num">şoför</th>
          </tr>
        </thead>
        <tbody>
          {[
            { screen: 'Özet', roles: [true, true, true, false] },
            { screen: 'Ağ & Tarife', roles: [true, true, false, false] },
            { screen: 'Haftalık Plan', roles: [true, true, true, false] },
            { screen: 'Şoförler', roles: [true, true, true, false] },
            { screen: 'Raporlar', roles: [true, true, true, false] },
            { screen: 'Benim Haftam', roles: [false, false, false, true] },
          ].map((row) => (
            <tr key={row.screen}>
              <td>{row.screen}</td>
              {row.roles.map((allowed, index) => (
                <td key={index} className="num">
                  {allowed ? '✓' : '–'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Çıktılar</h3>
      <table>
        <tbody>
          <tr>
            <td>GTFS arşivi</td>
            <td className="muted">
              <Link href="/api/gtfs">zip indir</Link> — giriş gerektirmez, dışa aktarım her zaman
              üretilir (elle düzenlenmez)
            </td>
          </tr>
          {office && (
            <tr>
              <td>Haftalık plan</td>
              <td className="muted">
                <Link href="/plan">Haftalık Plan</Link> ekranındaki <strong>Excel indir</strong>{' '}
                bağlantısı — basılı şablon hücre haritasını kullanır
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h3>Sık takılınan yerler</h3>
      <table>
        <thead>
          <tr>
            <th>Belirti</th>
            <th>Neden ve çözüm</th>
          </tr>
        </thead>
        <tbody>
          {tips.map((tip) => (
            <tr key={tip.symptom}>
              <td>{tip.symptom}</td>
              <td className="muted">{tip.cause}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
