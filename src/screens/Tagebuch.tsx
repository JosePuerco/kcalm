// Tagebuch nach Kern.dc.html und Leer.dc.html. Aufbau von oben: Tagesleiste · (Monatskalender) ·
// Übersichtskarte · (gemerkte Scans) · (leerer Tag) · Slot-Karten · „vollständig getrackt“.
// Die Wasser-Kachel des Prototyps entfällt (kein Wasser-Tracking, Jan 22.10.2026).
import { useCallback, useState } from 'react'
import { openAddSheet, openEditSheet, setDiaryDate, setSlotOpen, useDiaryState, useToday } from '../app/diaryState.ts'
import { useToast } from '../components/ui/toastContext.ts'
import { setDayComplete } from '../db/days.ts'
import { copyEntries, deleteEntry } from '../db/entries.ts'
import type { Entry } from '../db/types.ts'
import { loadDiary } from '../db/diary.ts'
import { useLiveQuery } from '../db/live.ts'
import { loadPendingItems } from '../db/pendingScans.ts'
import { addDays } from '../logic/dates.ts'
import { canEditAsFood } from '../logic/addFood.ts'
import { copiedMessage } from '../logic/copyDay.ts'
import { dayOverview, slotsForDay } from '../logic/diary.ts'
import { CompleteDayRow } from './tagebuch/CompleteDayRow.tsx'
import { CopyDaySheet } from './tagebuch/CopyDaySheet.tsx'
import { DayBar } from './tagebuch/DayBar.tsx'
import { EmptyDayCard } from './tagebuch/EmptyDayCard.tsx'
import { MonthCalendar } from './tagebuch/MonthCalendar.tsx'
import { OverviewCard } from './tagebuch/OverviewCard.tsx'
import { PendingScansRow, PendingScansSheet } from './tagebuch/PendingScans.tsx'
import { SlotCard } from './tagebuch/SlotCard.tsx'

export function Tagebuch() {
  const today = useToday()
  const state = useDiaryState()
  const date = state.date ?? today
  const [calendarOpen, setCalendarOpen] = useState(false)
  // Der Kalender zeigt zunächst den Monat des angezeigten Tags; die Monatspfeile blättern unabhängig
  const [calendarMonth, setCalendarMonth] = useState(date.slice(0, 7))
  const [weekOpen, setWeekOpen] = useState(false)
  const [swipedId, setSwipedId] = useState<string | null>(null)
  const [copyOpen, setCopyOpen] = useState(false)
  const [pendingOpen, setPendingOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const data = useLiveQuery(() => loadDiary(date, calendarMonth), [date, calendarMonth])
  const pending = useLiveQuery(loadPendingItems, [])

  const goTo = (next: string) => {
    setDiaryDate(next, today)
    setCalendarMonth(next.slice(0, 7))
  }

  const remove = async (entry: Entry) => {
    setSwipedId(null)
    try {
      await deleteEntry(entry.id)
      toast(`${entry.nameSnapshot} gelöscht`)
    } catch (error) {
      console.error(error)
      toast('Löschen fehlgeschlagen')
    }
  }

  const edit = (entry: Entry) => (canEditAsFood(entry) || entry.kind === 'quick') && openEditSheet(entry.id)

  const likeYesterday = async () => {
    setBusy(true)
    try {
      toast(copiedMessage((await copyEntries(addDays(date, -1), date)).length))
    } catch (error) {
      console.error(error)
      toast('Kopieren fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  const markComplete = (complete: boolean) =>
    setDayComplete(date, complete).catch((error: unknown) => {
      console.error(error)
      toast('Speichern fehlgeschlagen')
    })

  const closePending = useCallback(() => setPendingOpen(false), [])

  const toggleCalendar = () => {
    if (!calendarOpen) setCalendarMonth(date.slice(0, 7))
    setCalendarOpen(!calendarOpen)
  }

  return (
    <>
      <DayBar
        date={date}
        today={today}
        calendarOpen={calendarOpen}
        complete={data?.complete ?? false}
        onToggleCalendar={toggleCalendar}
        onStep={(by) => goTo(addDays(date, by))}
      />
      <main className="scroll-area px-screen-x pb-scroll-bottom-padding gap-card-gap flex flex-col pt-1">
        {calendarOpen && data && (
          <MonthCalendar
            month={calendarMonth}
            selected={date}
            today={today}
            completeDates={data.completeDates}
            onMonth={setCalendarMonth}
            onPick={(picked) => {
              goTo(picked)
              setCalendarOpen(false)
            }}
          />
        )}
        {data && (
          <>
            <OverviewCard
              overview={dayOverview(date, today, data.dayEntries, data.weekKcal, data.goal)}
              selected={date}
              weekOpen={weekOpen}
              onToggleWeek={() => setWeekOpen(!weekOpen)}
              complete={data.complete}
              weekComplete={data.weekComplete}
            />
            {pending && pending.length > 0 && (
              <PendingScansRow count={pending.length} onOpen={() => setPendingOpen(true)} />
            )}
            {data.dayEntries.length === 0 && (
              <EmptyDayCard
                label={date === today ? 'Gestern' : 'Vortag'}
                yesterday={data.yesterday}
                busy={busy}
                onLikeYesterday={() => void likeYesterday()}
                onCopy={() => setCopyOpen(true)}
              />
            )}
            {slotsForDay(data.slots, data.dayEntries).map((day) => {
              // Standard: Slots mit Einträgen offen; eingeklappte merkt sich die App bis zum Neustart
              const open = day.entries.length > 0 && (state.open[day.slot.id] ?? true)
              return (
                <SlotCard
                  key={day.slot.id}
                  day={day}
                  open={open}
                  flashId={state.flashId}
                  swipedId={swipedId}
                  onSwipe={setSwipedId}
                  onEdit={edit}
                  onDelete={(entry) => void remove(entry)}
                  onToggle={() => setSlotOpen(day.slot.id, !open)}
                  onAdd={() => openAddSheet(day.slot.id)}
                />
              )
            })}
            <CompleteDayRow complete={data.complete} onChange={(c) => void markComplete(c)} />
          </>
        )}
      </main>
      {data && pending && (
        <PendingScansSheet
          open={pendingOpen}
          onClose={closePending}
          items={pending}
          slots={data.slots}
          today={today}
        />
      )}
      {data && (
        <CopyDaySheet
          open={copyOpen}
          onClose={() => setCopyOpen(false)}
          target={date}
          slots={data.slots}
          completeDates={data.completeDates}
        />
      )}
    </>
  )
}
