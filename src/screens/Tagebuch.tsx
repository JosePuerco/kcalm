// Tagebuch nach Kern.dc.html und Leer.dc.html. Aufbau von oben: Tagesleiste · (Monatskalender) ·
// Übersichtskarte · (leerer Tag) · Slot-Karten. Die Wasser-Kachel kommt in Phase 7.
import { useState } from 'react'
import { openAddSheet, setDiaryDate, setSlotOpen, useDiaryState, useToday } from '../app/diaryState.ts'
import { loadDiary } from '../db/diary.ts'
import { useLiveQuery } from '../db/live.ts'
import { addDays } from '../logic/dates.ts'
import { dayOverview, slotsForDay } from '../logic/diary.ts'
import { DayBar } from './tagebuch/DayBar.tsx'
import { EmptyDayCard } from './tagebuch/EmptyDayCard.tsx'
import { MonthCalendar } from './tagebuch/MonthCalendar.tsx'
import { OverviewCard } from './tagebuch/OverviewCard.tsx'
import { SlotCard } from './tagebuch/SlotCard.tsx'

export function Tagebuch() {
  const today = useToday()
  const state = useDiaryState()
  const date = state.date ?? today
  const [calendarOpen, setCalendarOpen] = useState(false)
  // Der Kalender zeigt zunächst den Monat des angezeigten Tags; die Monatspfeile blättern unabhängig
  const [calendarMonth, setCalendarMonth] = useState(date.slice(0, 7))
  const [weekOpen, setWeekOpen] = useState(false)
  const data = useLiveQuery(() => loadDiary(date, calendarMonth), [date, calendarMonth])

  const goTo = (next: string) => {
    setDiaryDate(next, today)
    setCalendarMonth(next.slice(0, 7))
  }

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
            />
            {data.dayEntries.length === 0 && (
              <EmptyDayCard label={date === today ? 'Gestern' : 'Vortag'} yesterday={data.yesterday} />
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
                  onToggle={() => setSlotOpen(day.slot.id, !open)}
                  onAdd={() => openAddSheet(day.slot.id)}
                />
              )
            })}
          </>
        )}
      </main>
    </>
  )
}
