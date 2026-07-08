interface NumFieldProps {
  label?: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  title?: string
}

export function NumField({ label, value, onChange, step = 1, min = 0, title }: NumFieldProps) {
  const input = (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ''}
      step={step}
      min={min}
      title={title}
      onChange={(e) => {
        const v = parseFloat(e.target.value)
        onChange(Number.isFinite(v) ? v : 0)
      }}
    />
  )
  if (!label) return input
  return (
    <label className="field">
      <span>{label}</span>
      {input}
    </label>
  )
}

interface TextFieldProps {
  label?: string
  value: string
  onChange: (v: string) => void
}

export function TextField({ label, value, onChange }: TextFieldProps) {
  const input = <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
  if (!label) return input
  return (
    <label className="field">
      <span>{label}</span>
      {input}
    </label>
  )
}
