import { useMemo } from 'react'

// A short burst in the theme colours. The parent removes it after a few seconds.
// With reduced motion switched on, the CSS hides it (and the parent skips it).
const PIECES = 30

export default function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        colour: i % 3,
      })),
    []
  )
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          className={`confetti__piece c${p.colour}`}
          style={{ left: `${p.left}vw`, animationDelay: `${p.delay}s` }}
        />
      ))}
    </div>
  )
}