// Schutz gegen eine iOS-Eigenheit (Jan, 27.10.2026): Öffnet sich die Tastatur, schiebt iOS die ganze Seite
// hoch, damit das Eingabefeld sichtbar bleibt. Verschwindet das Feld, solange die Tastatur offen ist (z. B. Tipp
// auf ein Suchergebnis), schiebt iOS die Seite manchmal nicht zurück: alles bleibt verschoben, unten ist es
// leer. Die App-Hülle scrollt selbst nie, also wird sie ohne offene Tastatur immer auf den Anfang gesetzt.
// Dasselbe kann beim Fokussieren eines Elements außerhalb des Bildschirms passieren (Sheet beim Öffnen).

const SHELL = ['html', 'body', '#root', '[data-shell]']

/** Hat ein Eingabefeld den Fokus (Tastatur offen)? Dann darf iOS die Seite verschieben. */
function typing(): boolean {
  const el = document.activeElement
  if (el instanceof HTMLTextAreaElement) return true
  if (!(el instanceof HTMLInputElement)) return false
  return !['button', 'checkbox', 'radio', 'range', 'file', 'submit', 'reset', 'color'].includes(el.type)
}

function reset() {
  if (typing()) return
  if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0)
  for (const selector of SHELL) {
    const el = document.querySelector(selector)
    if (el && (el.scrollTop !== 0 || el.scrollLeft !== 0)) el.scrollTo(0, 0)
  }
}

export function installKeyboardGuard() {
  // Nach dem Fokuswechsel prüfen, wenn der neue Fokus schon steht
  window.addEventListener('focusout', () => setTimeout(reset, 50))
  // Tastatur zu (auch ohne focusout, wenn das Feld einfach verschwindet)
  window.visualViewport?.addEventListener('resize', reset)
  // Scrollen von Elementen steigt nicht bis zum Fenster auf: in der Capture-Phase auf dem Dokument abfangen.
  // reset prüft nur die Hülle, Scrollbereiche in den Screens bleiben unberührt.
  document.addEventListener('scroll', reset, { capture: true, passive: true })
}
