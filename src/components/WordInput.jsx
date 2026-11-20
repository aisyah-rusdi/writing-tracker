// Large word-count box. Digits only, so a stray letter or "e" can't get in.
export default function WordInput({ value, onChange }) {
  return (
    <input
      className="word-input"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="0"
      aria-label="Words written"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 7))}
    />
  )
}