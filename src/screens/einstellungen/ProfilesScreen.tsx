// Profile und Ziele nach Profil.dc.html: Profil-Chips (aktives mit Punkt) + „Neu“, Wochenbudget und Makros wie
// in der Ersteinrichtung. Aktives Profil: Hinweis „Aktiv seit …“; inaktives: „Ab nächstem Montag“ (Standard)
// oder „Ab heute“ + „… aktivieren“. „Sichern“ erscheint, sobald etwas geändert ist (im Prototyp nicht gezeigt).
// Wasser-Ziel kommt mit Phase 7.
import { useState } from 'react'
import { useToday } from '../../app/diaryState.ts'
import { href } from '../../app/router.ts'
import { IconBack } from '../../components/icons/icons.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { useLiveQuery } from '../../db/live.ts'
import {
  activateProfile,
  cancelScheduled,
  createProfile,
  loadProfiles,
  saveProfile,
  type ActivateMode,
  type ProfilesData,
} from '../../db/profiles.ts'
import { nextMonday } from '../../logic/dates.ts'
import { dateWithWeekday } from '../../logic/diary.ts'
import {
  emptyProfileForm,
  profileFieldId,
  profileToForm,
  validateProfileForm,
  type ProfileErrors,
  type ProfileFormValues,
} from '../../logic/profileForm.ts'
import { latestVersion, profileStatus } from '../../logic/profiles.ts'
import { ProfileFields } from '../setup/ProfileFields.tsx'

const back = href('einstellungen')
const NEW = 'neu'

export function ProfilesScreen() {
  const data = useLiveQuery(loadProfiles, [])
  return (
    <>
      <header className="pt-safe-header flex shrink-0 items-center justify-between pr-2 pl-1">
        <a href={back} aria-label="Zurück" className="press text-text flex size-11 items-center justify-center">
          <IconBack />
        </a>
        <h1 className="text-sheet-title">Profile und Ziele</h1>
        <span className="w-11" />
      </header>
      {data && <ProfilesBody data={data} />}
    </>
  )
}

function ProfilesBody({ data }: { data: ProfilesData }) {
  const toast = useToast()
  const today = useToday()
  const status = profileStatus(data.assignments, data.versions, today)
  const [selected, setSelected] = useState(status.activeProfileId ?? data.profiles[0]?.id ?? NEW)
  const formFor = (id: string): ProfileFormValues => {
    const profile = data.profiles.find((p) => p.id === id)
    const version = latestVersion(data.versions, id)
    return profile && version ? profileToForm(profile.name, version) : emptyProfileForm()
  }
  const [values, setValues] = useState(() => formFor(selected))
  const [dirty, setDirty] = useState(selected === NEW)
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [mode, setMode] = useState<ActivateMode>('nextMonday')
  const [busy, setBusy] = useState(false)

  const isNew = selected === NEW
  const isActive = selected === status.activeProfileId
  const scheduled = status.scheduled?.profileId === selected ? status.scheduled : null
  const activeName = data.profiles.find((p) => p.id === status.activeProfileId)?.name ?? ''

  const select = (id: string) => {
    setSelected(id)
    setValues(id === NEW ? emptyProfileForm() : formFor(id))
    setDirty(id === NEW)
    setErrors({})
    setMode('nextMonday')
  }

  /** Prüfen und speichern; liefert die Profil-id oder null bei Fehlern */
  const persist = async (): Promise<string | null> => {
    const r = validateProfileForm(values)
    if (!r.ok) {
      setErrors(r.errors)
      const first = Object.keys(r.errors)[0]
      if (first) document.getElementById(profileFieldId(first))?.focus()
      return null
    }
    setErrors({})
    if (isNew) {
      const { profile } = await createProfile(r.data)
      return profile.id
    }
    if (dirty) await saveProfile(selected, r.data, today)
    return selected
  }

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      console.error(error)
      toast('Speichern fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    run(async () => {
      const id = await persist()
      if (!id) return
      toast('Gespeichert')
      setDirty(false)
      if (isNew) setSelected(id)
    })

  const activate = () =>
    run(async () => {
      const id = await persist()
      if (!id) return
      await activateProfile(id, mode, today)
      setDirty(false)
      setSelected(id)
      toast(mode === 'today' ? `${values.name.trim()} gilt ab heute` : `${values.name.trim()} gilt ab ${dateWithWeekday(nextMonday(today))}`)
    })

  const unschedule = (id: string) =>
    run(async () => {
      await cancelScheduled(id)
      toast('Wechsel zurückgenommen')
    })

  const starts: { value: ActivateMode; title: string; sub: string }[] = [
    {
      value: 'nextMonday',
      title: `Ab nächstem Montag, ${dateWithWeekday(nextMonday(today)).slice(3, 9)}`,
      sub: activeName ? `Die laufende Woche bleibt bei ${activeName}` : 'Die laufende Woche bleibt ohne Profil',
    },
    { value: 'today', title: 'Ab heute', sub: 'Restbudget dieser Woche wird anteilig umgerechnet' },
  ]

  return (
    <>
      <div className="flex shrink-0 gap-1.5 overflow-x-auto px-4 pt-2 pb-2.5 [scrollbar-width:none]">
        {data.profiles.map((p) => {
          const on = p.id === selected
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => select(p.id)}
              aria-pressed={on}
              className={`press text-label flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 font-semibold whitespace-nowrap ${
                on ? 'bg-text text-bg' : 'bg-card text-text'
              }`}
            >
              {p.name}
              {p.id === status.activeProfileId && (
                <span className={`size-1.5 rounded-full ${on ? 'bg-bg' : 'bg-accent'}`} aria-label="aktiv" />
              )}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => select(NEW)}
          aria-pressed={isNew}
          className={`press text-label flex min-h-9 shrink-0 items-center rounded-full px-3.5 font-semibold whitespace-nowrap ${
            isNew ? 'bg-text text-bg' : 'bg-card text-accent-text'
          }`}
        >
          + Neu
        </button>
      </div>

      <main className="scroll-area px-screen-x gap-card-gap flex flex-col pb-[calc(24px+env(safe-area-inset-bottom))]">
        <ProfileFields
          values={values}
          errors={errors}
          onChange={(v) => {
            setValues(v)
            setDirty(true)
          }}
        />

        {isActive && (
          <div className="bg-accent-soft text-accent-text rounded-card text-label px-4 py-3.5 leading-[1.45]">
            Aktiv seit {status.activeSince ? dateWithWeekday(status.activeSince) : '–'}. Änderungen gelten ab heute;
            vergangene Tage behalten ihre damaligen Ziele.
          </div>
        )}

        {(dirty || isNew) && (isActive || scheduled) && (
          <Button className="w-full" disabled={busy} onClick={() => void save()}>
            Sichern
          </Button>
        )}

        {scheduled && (
          <Card className="flex flex-col gap-3">
            <span className="text-label text-muted">
              Wird ab {dateWithWeekday(scheduled.validFrom)} aktiv. Bis dahin gilt {activeName || 'kein Profil'}.
            </span>
            <Button variant="secondary" className="w-full" disabled={busy} onClick={() => void unschedule(scheduled.id)}>
              Wechsel zurücknehmen
            </Button>
          </Card>
        )}

        {!isActive && !scheduled && (
          <>
            {dirty && !isNew && (
              <Button variant="secondary" className="w-full" disabled={busy} onClick={() => void save()}>
                Sichern ohne aktivieren
              </Button>
            )}
            {isNew && (
              <Button variant="secondary" className="w-full" disabled={busy} onClick={() => void save()}>
                Anlegen ohne aktivieren
              </Button>
            )}
            <Card>
              <span className="text-body font-semibold">Aktivieren</span>
              <div className="mt-2.5 flex flex-col gap-2" role="radiogroup" aria-label="Ab wann">
                {starts.map((s) => {
                  const on = mode === s.value
                  return (
                    <button
                      key={s.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setMode(s.value)}
                      className={`press rounded-field flex min-h-14 items-center gap-3 border-[1.5px] px-3.5 py-2 text-left ${
                        on ? 'border-accent bg-accent-soft' : 'border-line bg-card'
                      }`}
                    >
                      <span
                        className={`flex size-5 flex-none items-center justify-center rounded-full border-2 ${on ? 'border-accent' : 'border-line'}`}
                      >
                        <span className={`size-2.5 rounded-full ${on ? 'bg-accent' : ''}`} />
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-label font-semibold">{s.title}</span>
                        <span className="text-small text-muted">{s.sub}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <Button className="mt-3 w-full" disabled={busy} onClick={() => void activate()}>
                {values.name.trim() || 'Profil'} aktivieren
              </Button>
            </Card>
          </>
        )}
      </main>
    </>
  )
}
