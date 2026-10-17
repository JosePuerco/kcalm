// Eingabefeld mit Beschriftung darüber und Fehlertext darunter.
// Schrift 16 px (text-body-large), sonst zoomt iOS beim Antippen.
import { useId, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  label: string
  error?: string
}

export function TextField({ label, error, id, ...rest }: Props) {
  const fallbackId = useId()
  const inputId = id ?? fallbackId
  const errorId = `${inputId}-error`
  return (
    <div className="flex flex-col py-2">
      <label htmlFor={inputId} className="text-small text-muted">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="text-body-large text-text placeholder:text-muted min-h-touch-min w-full min-w-0 bg-transparent outline-none"
        {...rest}
      />
      {error && (
        <span id={errorId} className="text-small text-danger">
          {error}
        </span>
      )}
    </div>
  )
}
