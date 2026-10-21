// Datei über das Teilen-Menü weitergeben („In Dateien sichern“ → iCloud Drive), Ersatz per Download.
// Lehre aus Mixli: Teilen kann auf iOS ohne Grund scheitern, deshalb gibt es immer den Download.

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

export async function shareOrDownload(file: File): Promise<ShareOutcome> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (error) {
      // Abbrechen im Teilen-Menü ist kein Fehler: dann auch keinen Download aufzwingen
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      console.warn('Teilen fehlgeschlagen, Download stattdessen', error)
    }
  }
  download(file)
  return 'downloaded'
}

function download(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  // Safari braucht die Adresse noch kurz nach dem Klick
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
