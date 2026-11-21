import { useEffect, useRef } from 'react'

// A bottom sheet over the page. Closes with the Close button, a tap outside,
// or Escape. Focus moves to Close on opening and returns to where it was.
export default function Modal({ title, onClose, children }) {
  const closeButton = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (closeButton.current) closeButton.current.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (previous && previous.focus) previous.focus()
    }
  }, [])

  return (
    <div className="sheetbg" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row sheet__head">
          <h2>{title}</h2>
          <button ref={closeButton} type="button" className="btn sec" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}