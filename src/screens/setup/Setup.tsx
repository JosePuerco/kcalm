// Ersteinrichtung in 4 Schritten nach Start.dc.html (Schritt 2 ist der Prototyp; 1, 3 und 4 im selben Stil,
// mit Jan abgestimmt): 1 Slots, 2 Profil, 3 Optionen, 4 Backup-Hinweis.
// Gespeichert wird erst am Ende in einem Rutsch (completeSetup), Abbrechen hinterlässt nichts.
import { useState, type ReactNode } from 'react'
import { IconBack } from '../../components/icons/icons.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { Switch } from '../../components/ui/Switch.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { completeSetup } from '../../db/setup.ts'
import { emptyProfileForm, profileFieldId, validateProfileForm, type ProfileErrors } from '../../logic/profileForm.ts'
import { DEFAULT_SLOTS, validateSlots, type SlotErrors } from '../../logic/slots.ts'
import { useBackupImport } from '../useBackupImport.tsx'
import { ProfileFields } from './ProfileFields.tsx'
import { SlotEditor } from './SlotEditor.tsx'

const STEPS = 4

export function Setup() {
  const toast = useToast()
  const backupImport = useBackupImport()
  const [step, setStep] = useState(1)
  const [slots, setSlots] = useState(() => DEFAULT_SLOTS.map((s) => ({ ...s })))
  const [slotErrors, setSlotErrors] = useState<{ errors: SlotErrors; general?: string }>({ errors: {} })
  const [profile, setProfile] = useState(emptyProfileForm)
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({})
  const [estimate, setEstimate] = useState(false)
  const [saving, setSaving] = useState(false)

  const next = async () => {
    if (step === 1) {
      const r = validateSlots(slots)
      if (!r.ok) return setSlotErrors({ errors: r.errors, general: r.general })
      setSlotErrors({ errors: {} })
    }
    if (step === 2) {
      const r = validateProfileForm(profile)
      if (!r.ok) {
        setProfileErrors(r.errors)
        const first = Object.keys(r.errors)[0]
        if (first) document.getElementById(profileFieldId(first))?.focus()
        return
      }
      setProfileErrors({})
    }
    if (step < STEPS) return setStep(step + 1)

    // Beide Prüfungen sind oben schon gelaufen; hier nur noch die Daten holen
    const s = validateSlots(slots)
    const p = validateProfileForm(profile)
    if (!s.ok || !p.ok) return
    setSaving(true)
    try {
      // Danach zeigt die App von selbst das Tagebuch (isSetupDone wird live abgefragt)
      await completeSetup({ slots: s.slots, profile: p.data, estimate })
    } catch (error) {
      console.error(error)
      toast('Speichern fehlgeschlagen')
      setSaving(false)
    }
  }

  const content: Record<number, { title: string; text: string; body: ReactNode }> = {
    1: {
      title: 'Deine Mahlzeiten',
      text: 'Slots ordnen dein Tagebuch. Die Uhrzeit bestimmt, welcher Slot beim Hinzufügen vorgewählt ist.',
      body: <SlotEditor slots={slots} errors={slotErrors.errors} general={slotErrors.general} onChange={setSlots} />,
    },
    2: {
      title: 'Dein erstes Profil',
      text: 'Weitere Profile wie Diät oder Erhalt legst du später in den Einstellungen an.',
      body: <ProfileFields values={profile} errors={profileErrors} onChange={setProfile} />,
    },
    3: {
      title: 'Optionen',
      text: 'Das kannst du später in den Einstellungen ändern.',
      body: (
        <Card padded={false}>
          <ToggleRow
            label="Verbrauchsschätzung"
            sub="Gewicht per Kurzbefehl aus Apple Health"
            checked={estimate}
            onChange={setEstimate}
          />
        </Card>
      ),
    },
    4: {
      title: 'Deine Daten',
      text: 'Kcalm speichert alles nur auf diesem iPhone, ohne Konto und ohne Server.',
      body: (
        <>
          <Card className="text-label text-muted flex flex-col gap-2 leading-[1.45]">
            <p>
              Sichere regelmäßig unter Einstellungen → Backup, zum Beispiel in iCloud Drive. Ist das letzte Backup
              älter als 14 Tage, erinnert dich Kcalm daran.
            </p>
            <p>Wenn du Kcalm neu installiert hast, kannst du hier dein Backup einspielen.</p>
          </Card>
          <Button variant="secondary" className="w-full" onClick={backupImport.pick}>
            Backup importieren
          </Button>
        </>
      ),
    },
  }
  const current = content[step] ?? content[1]!

  return (
    <>
      <header className="pt-safe-header flex shrink-0 items-center justify-between px-2">
        {step > 1 ? (
          <button
            type="button"
            aria-label="Zurück"
            onClick={() => setStep(step - 1)}
            className="press text-text flex size-11 items-center justify-center"
          >
            <IconBack />
          </button>
        ) : (
          <span className="size-11" />
        )}
        <div className="flex gap-1.5" role="progressbar" aria-label={`Schritt ${step} von ${STEPS}`} aria-valuenow={step} aria-valuemin={1} aria-valuemax={STEPS}>
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`h-[5px] w-[22px] rounded-[3px] ${i < step ? 'bg-accent' : 'bg-switch-off'}`} />
          ))}
        </div>
        <span className="text-secondary text-muted w-11 text-center">
          {step}/{STEPS}
        </span>
      </header>

      <div className="shrink-0 px-5 pt-[18px] pb-1.5">
        <h1 className="text-title">{current.title}</h1>
        <p className="text-label text-muted mt-1.5 leading-[1.45]">{current.text}</p>
      </div>

      {/* key: jeder Schritt beginnt oben */}
      <main key={step} className="scroll-area px-screen-x gap-card-gap flex flex-col pt-2.5 pb-4">
        {current.body}
      </main>

      <div className="px-screen-x shrink-0 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <Button className="w-full" disabled={saving} onClick={() => void next()}>
          {step < STEPS ? 'Weiter' : 'Los geht’s'}
        </Button>
      </div>
      {backupImport.element}
    </>
  )
}

type ToggleProps = { label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }

function ToggleRow({ label, sub, checked, onChange }: ToggleProps) {
  return (
    <div className="flex min-h-[60px] items-center gap-2.5 px-4 py-2">
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-body">{label}</span>
        <span className="text-small text-muted">{sub}</span>
      </span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}
