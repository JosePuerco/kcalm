// Export nach Export.dc.html: Vorlage „Monatsauswertung Claude“, Zeitraum, Ebene, Format, Spalten,
// Live-Vorschau und Teilen (Ersatz per Download). Rechenlogik in src/logic/export.ts.
// Startet jedes Mal mit der Vorlage; die Auswahl wird nicht gespeichert.
import { useMemo, useState } from 'react'
import { useToday } from '../../app/diaryState.ts'
import { href } from '../../app/router.ts'
import { shareOrDownload } from '../../app/share.ts'
import { IconBack, IconDiary } from '../../components/icons/icons.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { Segmented } from '../../components/ui/Segmented.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { loadExportData, type ExportData } from '../../db/export.ts'
import { useLiveQuery } from '../../db/live.ts'
import type { LocalDate } from '../../db/types.ts'
import {
  CLAUDE_TEMPLATE,
  EXPORT_COLUMNS,
  columnsFor,
  exportFile,
  exportRange,
  exportTable,
  isTemplate,
  rangeText,
  shareLabel,
  toCsv,
  toJson,
  type ExportColumn,
  type ExportFormat,
  type ExportLevel,
  type ExportRangeKind,
  type ExportSettings,
} from '../../logic/export.ts'

const back = href('einstellungen')

const RANGES: readonly { value: ExportRangeKind; label: string }[] = [
  { value: 'lastMonth', label: 'Letzter Monat' },
  { value: 'weeks4', label: '4 Wochen' },
  { value: 'all', label: 'Alles' },
  { value: 'free', label: 'Frei…' },
]

const LEVELS: readonly { value: ExportLevel; label: string }[] = [
  { value: 'entries', label: 'Einträge' },
  { value: 'slots', label: 'Slots' },
  { value: 'days', label: 'Tage' },
  { value: 'weeks', label: 'Wochen' },
]

const FORMATS: readonly { value: ExportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
]

/** Zeilen in der Vorschau; JSON ist pro Zeile viel höher */
const PREVIEW_ROWS: Readonly<Record<ExportFormat, number>> = { csv: 3, json: 1 }

const template = (): ExportSettings => ({ ...CLAUDE_TEMPLATE, columns: new Set(CLAUDE_TEMPLATE.columns) })

export function ExportScreen() {
  const today = useToday()
  const data = useLiveQuery(() => loadExportData(today), [today])
  return (
    <>
      <header className="pt-safe-header flex shrink-0 items-center justify-between pr-2 pl-1">
        <a href={back} aria-label="Zurück" className="press text-text flex size-11 items-center justify-center">
          <IconBack />
        </a>
        <h1 className="text-sheet-title">Export</h1>
        <span className="w-11" />
      </header>
      {data && <ExportBody data={data} today={today} />}
    </>
  )
}

function ExportBody({ data, today }: { data: ExportData; today: LocalDate }) {
  const toast = useToast()
  const [settings, setSettings] = useState<ExportSettings>(template)
  const [free, setFree] = useState<{ from: LocalDate | ''; to: LocalDate | '' }>({ from: '', to: '' })
  const [sharing, setSharing] = useState(false)

  const { level, format, columns } = settings
  const range = exportRange(settings.range, today, { firstDate: data.firstDate, ...free })
  const available = columnsFor(level, data.weightEnabled)
  const chosen = available.filter((c) => columns.has(c))
  const table = useMemo(
    () => (range ? exportTable(level, columns, { ...data.input, range }, data.weightEnabled) : null),
    // range ist je Render ein neues Objekt; seine Werte reichen als Abhängigkeit
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, level, columns, range?.from, range?.to],
  )
  const canShare = table !== null && table.keys.length > 0 && table.rows.length > 0

  const update = (changes: Partial<ExportSettings>) => setSettings((s) => ({ ...s, ...changes }))

  const pickRange = (kind: ExportRangeKind) => {
    // „Frei…“ startet mit dem bisherigen Zeitraum, damit nur noch angepasst werden muss
    if (kind === 'free' && range && !free.from && !free.to) setFree({ from: range.from, to: range.to })
    update({ range: kind })
  }

  const toggleColumn = (column: ExportColumn) => {
    const next = new Set(columns)
    if (next.has(column)) next.delete(column)
    else next.add(column)
    update({ columns: next })
  }

  const share = async () => {
    if (!table || !range) return
    setSharing(true)
    try {
      const file = exportFile(table, format, { range, exportedAt: new Date().toISOString() })
      await shareOrDownload(new File([file.text], file.name, { type: file.type }))
    } catch (error) {
      console.error(error)
      toast('Export fehlgeschlagen')
    } finally {
      setSharing(false)
    }
  }

  const preview = !table
    ? ''
    : table.keys.length === 0
      ? 'Keine Spalten gewählt'
      : format === 'csv'
        ? toCsv(table, PREVIEW_ROWS.csv)
        : toJson(table, { range: range!, exportedAt: new Date().toISOString() }, PREVIEW_ROWS.json)

  const isTpl = isTemplate(settings, data.weightEnabled)

  return (
    <>
      <main className="scroll-area px-screen-x gap-card-gap flex flex-col pt-2 pb-4">
        <button
          type="button"
          onClick={() => setSettings(template())}
          aria-pressed={isTpl}
          className={`press bg-card rounded-card flex items-center gap-3 border-[1.5px] px-4 py-3.5 text-left ${
            isTpl ? 'border-accent' : 'border-transparent'
          }`}
        >
          <span className="rounded-tile bg-accent-soft text-accent-text flex size-10 shrink-0 items-center justify-center">
            <IconDiary size={20} />
          </span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-body font-semibold">Vorlage: Monatsauswertung Claude</span>
            <span className="text-small text-muted">
              Letzter Monat · Tage · JSON · kcal, Makros, Ballaststoffe, Budget{data.weightEnabled ? ', Gewicht' : ''}
            </span>
          </span>
        </button>

        <Card className="flex flex-col gap-3 py-3.5">
          <section className="flex flex-col gap-2">
            <h2 className="text-secondary text-muted">Zeitraum</h2>
            <div className="flex flex-wrap gap-1.5">
              {RANGES.map((r) => {
                const on = settings.range === r.value
                return (
                  <button
                    key={r.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pickRange(r.value)}
                    className={`press rounded-chip text-secondary min-h-[34px] px-3 font-medium ${
                      on ? 'bg-text text-bg' : 'bg-bg text-text'
                    }`}
                  >
                    {r.label}
                  </button>
                )
              })}
            </div>
            {settings.range === 'free' && (
              <div className="grid grid-cols-2 gap-2">
                <DateField label="Von" value={free.from} max={today} onChange={(from) => setFree((f) => ({ ...f, from }))} />
                <DateField label="Bis" value={free.to} max={today} onChange={(to) => setFree((f) => ({ ...f, to }))} />
              </div>
            )}
            <span className="text-small text-muted">{rangeHint(settings.range, range, free)}</span>
          </section>
          <section className="border-line flex flex-col gap-2 border-t pt-3">
            <h2 className="text-secondary text-muted">Ebene</h2>
            <Segmented label="Ebene" options={LEVELS} value={level} onChange={(l) => update({ level: l })} inCard />
          </section>
          <section className="border-line flex flex-col gap-2 border-t pt-3">
            <h2 className="text-secondary text-muted">Format</h2>
            <Segmented label="Format" options={FORMATS} value={format} onChange={(f) => update({ format: f })} inCard />
          </section>
        </Card>

        <Card className="py-3.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-body font-semibold">Spalten</h2>
            <span className="text-small text-muted">{chosen.length} gewählt</span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {EXPORT_COLUMNS.filter((c) => available.includes(c.key)).map((c) => {
              const on = columns.has(c.key)
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleColumn(c.key)}
                  className={`press rounded-small-button text-secondary min-h-8 border px-2.5 font-medium ${
                    on ? 'bg-accent-soft text-accent-text border-accent-soft-border' : 'bg-card text-muted border-line'
                  }`}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        </Card>

        <Card className="py-3.5">
          <h2 className="text-body font-semibold">Vorschau</h2>
          <div className="bg-bg rounded-tile mt-2.5 overflow-x-auto px-3 py-2.5">
            <pre className="text-tiny text-text m-0 font-mono leading-[1.6] whitespace-pre">{preview || ' '}</pre>
          </div>
        </Card>
      </main>
      <div className="px-screen-x shrink-0 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <Button className="w-full" disabled={!canShare || sharing} onClick={() => void share()}>
          {table ? shareLabel(table, format) : 'Teilen'}
        </Button>
      </div>
    </>
  )
}

function rangeHint(
  kind: ExportRangeKind,
  range: ReturnType<typeof exportRange>,
  free: { from: string; to: string },
): string {
  if (range) return rangeText(range)
  if (kind === 'all') return 'Noch keine Daten'
  if (!free.from || !free.to) return 'Start und Ende frei wählen'
  return 'Start liegt nach dem Ende'
}

function DateField({
  label,
  value,
  max,
  onChange,
}: {
  label: string
  value: string
  max: string
  onChange: (value: LocalDate | '') => void
}) {
  return (
    <label className="rounded-field bg-bg flex min-w-0 flex-col px-3 py-1.5">
      <span className="text-small text-muted">{label}</span>
      {/* Eigene Datumsauswahl von iOS; 16 px, sonst zoomt iOS beim Antippen */}
      <input
        type="date"
        value={value}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="text-body-large text-text min-h-touch-min w-full min-w-0 bg-transparent outline-none"
      />
    </label>
  )
}
