// Rückkamera für den Scanner. Startet erst, wenn der Scanner offen ist (also nach dem Tipp auf
// den Scan-Knopf), stoppt beim Schließen und wenn die App in den Hintergrund geht.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export type CameraStatus = 'starting' | 'running' | 'denied' | 'unavailable'

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean }

function useVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible')
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
  return visible
}

async function openStream(): Promise<MediaStream | CameraStatus> {
  if (!navigator.mediaDevices?.getUserMedia) return 'unavailable'
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    })
  } catch (error) {
    return error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'unavailable'
  }
}

export function useCamera(video: RefObject<HTMLVideoElement | null>) {
  const visible = useVisible()
  const [status, setStatus] = useState<CameraStatus>('starting')
  const [torch, setTorch] = useState({ supported: false, on: false })
  const track = useRef<MediaStreamTrack | null>(null)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    let stream: MediaStream | null = null

    void openStream().then(async (result) => {
      if (typeof result === 'string') {
        if (!cancelled) setStatus(result)
        return
      }
      stream = result
      if (cancelled || !video.current) return result.getTracks().forEach((t) => t.stop())
      video.current.srcObject = result
      // play() kann abgelehnt werden (z. B. Stromsparmodus); autoPlay + muted startet dann trotzdem
      await video.current.play().catch(() => undefined)
      const videoTrack = result.getVideoTracks()[0] ?? null
      track.current = videoTrack
      const capabilities = videoTrack?.getCapabilities?.() as TorchCapabilities | undefined
      setTorch({ supported: capabilities?.torch === true, on: false })
      setStatus('running')
    })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
      track.current = null
      setStatus('starting')
    }
  }, [visible, video])

  const toggleTorch = useCallback(async () => {
    const current = track.current
    if (!current || !torch.supported) return
    const on = !torch.on
    try {
      await current.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
      setTorch({ supported: true, on })
    } catch {
      setTorch({ supported: false, on: false })
    }
  }, [torch])

  return { status, torch, toggleTorch }
}
