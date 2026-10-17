// Schalter 52 × 32, an = Akzent, Knopf 26 federt (motion.switchKnob).
type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

export function Switch({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-[52px] flex-none rounded-full transition-colors duration-200 ${checked ? 'bg-accent' : 'bg-switch-off'}`}
    >
      <span
        className="bg-on-accent shadow-knob absolute top-[3px] left-[3px] size-[26px] rounded-full"
        style={{
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          transition:
            'transform var(--kc-motion-switch-knob-duration) var(--kc-motion-switch-knob-easing)',
        }}
      />
    </button>
  )
}
