// Server-Push (Phase 14e, Entwurf mit Jan abgestimmt am 12.11.2026, kein Prototyp):
// Schalter, Server (Adresse, Token, Sichern), Status (letzte Übertragung, ausstehend, letzter Fehler, Jetzt übertragen).
// Adresse und Token liegen nur in localStorage dieses Geräts, nie im Backup.
import { useState } from 'react'
import { runPush, savePushConfig, usePendingPushCount, usePushView } from '../../app/pushSync.ts'
import { href } from '../../app/router.ts'
import { IconBack } from '../../components/icons/icons.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { TextField } from '../../components/ui/TextField.tsx'
import { ToggleRow } from '../../components/ui/ToggleRow.tsx'
import { useToast } from '../../components/ui/toastContext.ts'
import { checkToken, normalizeServerUrl } from '../../logic/push.ts'
import { lastSuccessText, manualPushMessage, pendingText } from '../../logic/pushView.ts'
import { Group } from './Group.tsx'

const back = href('einstellungen')

export function PushScreen() {
  return (
    <>
      <header className="pt-safe-header flex shrink-0 items-center justify-between pr-2 pl-1">
        <a href={back} aria-label="Zurück" className="press text-text flex size-11 items-center justify-center">
          <IconBack />
        </a>
        <h1 className="text-sheet-title">Server-Push</h1>
        <span className="w-11" />
      </header>
      <main className="scroll-area px-screen-x gap-card-gap flex flex-col pt-2 pb-[calc(24px+env(safe-area-inset-bottom))]">
        <PushBody />
      </main>
    </>
  )
}

function PushBody() {
  const toast = useToast()
  const push = usePushView()
  const pending = usePendingPushCount(push)
  const { config, state } = push

  const [serverUrl, setServerUrl] = useState(config.serverUrl)
  const [token, setToken] = useState(config.token)
  const [showToken, setShowToken] = useState(false)
  const [errors, setErrors] = useState<{ url?: string; token?: string }>({})
  const changed = serverUrl !== config.serverUrl || token !== config.token

  const save = () => {
    const url = normalizeServerUrl(serverUrl)
    const checked = checkToken(token)
    setErrors({ url: url.ok ? undefined : url.error, token: checked.ok ? undefined : checked.error })
    if (!url.ok || !checked.ok) return
    setServerUrl(url.value)
    setToken(checked.value)
    savePushConfig({ ...config, serverUrl: url.value, token: checked.value })
    toast('Gesichert')
  }

  const pushManually = async () => {
    const outcome = await runPush()
    toast(outcome ? manualPushMessage(outcome) : 'Übertragen fehlgeschlagen')
  }

  return (
    <>
      <Card padded={false}>
        <ToggleRow
          label="Automatisch übertragen"
          sub="Kopie deiner Daten an deinen eigenen Server. Kcalm funktioniert ohne ihn genauso."
          checked={config.enabled}
          onChange={(enabled) => savePushConfig({ ...config, enabled })}
        />
      </Card>

      <Group title="Server">
        <Card padded={false} className="px-card-padding flex flex-col py-1.5">
          <TextField
            label="Adresse"
            type="url"
            inputMode="url"
            placeholder="https://…"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            value={serverUrl}
            error={errors.url}
            onChange={(e) => setServerUrl(e.target.value)}
          />
          <div className="border-line flex items-end gap-2 border-t">
            <div className="min-w-0 flex-1">
              <TextField
                label="Token"
                type={showToken ? 'text' : 'password'}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                value={token}
                error={errors.token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <Button variant="text" className="mb-2" onClick={() => setShowToken((v) => !v)}>
              {showToken ? 'Verbergen' : 'Anzeigen'}
            </Button>
          </div>
          <div className="flex justify-end py-2">
            <Button variant="small" disabled={!changed} onClick={save}>
              Sichern
            </Button>
          </div>
        </Card>
      </Group>

      <Group title="Status">
        <Card padded={false} className="px-card-padding flex flex-col py-1.5">
          <StatusRow label="Letzte Übertragung" value={lastSuccessText(state)} />
          <StatusRow label="Ausstehend" value={pending === undefined ? ' ' : pendingText(pending)} border />
          <StatusRow label="Letzter Fehler" value={state.lastError ?? '–'} warn={state.lastError !== null} border />
        </Card>
        <Button
          variant="secondary"
          className="mt-1.5 w-full"
          disabled={!config.enabled || push.running}
          onClick={() => void pushManually()}
        >
          {push.running ? 'Überträgt …' : 'Jetzt übertragen'}
        </Button>
      </Group>
    </>
  )
}

function StatusRow({ label, value, warn, border }: { label: string; value: string; warn?: boolean; border?: boolean }) {
  return (
    <div className={`flex min-h-[48px] items-center gap-3 ${border ? 'border-line border-t' : ''}`}>
      <span className="text-body flex-1">{label}</span>
      <span className={`text-label max-w-[60%] text-right ${warn ? 'text-warn-text' : 'text-muted'}`}>{value}</span>
    </div>
  )
}
