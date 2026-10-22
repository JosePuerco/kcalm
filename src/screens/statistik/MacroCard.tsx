// Makros Ø pro Tag gegen Ziel als 8-px-Balken. Über 100 % bleibt der Balken voll, die Zahl zeigt den Wert.
import { Card } from '../../components/ui/Card.tsx'
import { ProgressBar } from '../../components/ui/ProgressBar.tsx'
import { formatNumber, UNKNOWN } from '../../logic/format.ts'
import type { StatsMacro } from '../../logic/stats.ts'

export function MacroCard({ macros }: { macros: StatsMacro[] }) {
  return (
    <Card>
      <h2 className="text-body font-semibold">Makros · Ø pro Tag</h2>
      <div className="mt-3 flex flex-col gap-3">
        {macros.map((m) => {
          const eaten = m.eaten?.value == null ? UNKNOWN : `${m.eaten.atLeast ? 'mind. ' : ''}${formatNumber(m.eaten.value)} g`
          return (
            <div key={m.key} className="flex flex-col gap-[5px]">
              <div className="text-secondary flex justify-between gap-2">
                <span>{m.label}</span>
                <span>
                  <span className="font-semibold">{eaten}</span>
                  {m.goal !== null && (
                    <span className="text-muted">
                      {' '}
                      / {formatNumber(m.goal)} g{m.ratio !== null && ` · ${formatNumber(m.ratio * 100)} %`}
                    </span>
                  )}
                </span>
              </div>
              <ProgressBar value={m.ratio ?? 0} height={8} label={m.label} />
            </div>
          )
        })}
      </div>
    </Card>
  )
}
