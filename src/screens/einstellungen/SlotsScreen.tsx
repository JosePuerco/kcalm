// Einstellungen → Mahlzeiten-Slots: derselbe Editor wie in der Ersteinrichtung, mit „Sichern“.
import { useState } from 'react'
import { href, navigate } from '../../app/router.ts'
import { Button } from '../../components/ui/Button.tsx'
import { SubScreen, SubScreenTitle } from '../../components/ui/SubScreen.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { useLiveQuery } from '../../db/live.ts'
import { getSlots, saveSlots } from '../../db/slots.ts'
import type { Slot } from '../../db/types.ts'
import { validateSlots, type SlotErrors, type SlotInput } from '../../logic/slots.ts'
import { SlotEditor } from '../setup/SlotEditor.tsx'

const back = href('einstellungen')

export function SlotsScreen() {
  const slots = useLiveQuery(getSlots, [])
  // Erst nach dem Laden den Editor zeigen, damit er mit den gespeicherten Slots startet
  if (!slots) return <SubScreen back={back} />
  return <SlotsBody initial={slots} />
}

function toInput(s: Slot): SlotInput {
  return { id: s.id, name: s.name, timeFrom: s.timeFrom ?? '', timeTo: s.timeTo ?? '' }
}

function SlotsBody({ initial }: { initial: Slot[] }) {
  const toast = useToast()
  const [slots, setSlots] = useState(() => initial.map(toInput))
  const [errors, setErrors] = useState<{ errors: SlotErrors; general?: string }>({ errors: {} })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const r = validateSlots(slots)
    if (!r.ok) return setErrors({ errors: r.errors, general: r.general })
    setSaving(true)
    try {
      await saveSlots(r.slots)
      toast('Gespeichert')
      navigate(back, { replace: true })
    } catch (error) {
      console.error(error)
      toast('Speichern fehlgeschlagen')
      setSaving(false)
    }
  }

  return (
    <SubScreen back={back}>
      <SubScreenTitle title="Mahlzeiten-Slots" meta="Entfernte Slots mit Einträgen bleiben an ihren Tagen sichtbar." />
      <SlotEditor slots={slots} errors={errors.errors} general={errors.general} onChange={setSlots} />
      <Button className="w-full" disabled={saving} onClick={() => void save()}>
        Sichern
      </Button>
    </SubScreen>
  )
}
