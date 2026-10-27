import { useEffect, useRef, useState } from 'react'

/** Cell height in em; taller than 1 so the outlined glyphs aren't clipped. */
const CELL = 1.3

function Digit({ d }: { d: number }) {
  // new columns start at 0 and roll up to their value
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setShown(d), 20)
    return () => clearTimeout(t)
  }, [d])
  return (
    <span className="relative inline-block overflow-hidden text-center" style={{ height: `${CELL}em`, width: '0.62em', lineHeight: CELL }}>
      <span
        className="absolute inset-x-0 top-0 flex flex-col"
        style={{ transform: `translateY(${-shown * CELL}em)`, transition: 'transform 0.9s cubic-bezier(0.25, 1.4, 0.45, 1)' }}
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} style={{ height: `${CELL}em`, lineHeight: CELL }}>
            {n}
          </span>
        ))}
      </span>
    </span>
  )
}

/** A slot-machine style rolling number. */
export function Odometer({ value, className = '' }: { value: number; className?: string }) {
  const digits = String(Math.max(0, Math.floor(value))).split('')
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)
  useEffect(() => {
    if (value > prev.current && ref.current) {
      const el = ref.current
      el.classList.remove('total-bump')
      void el.offsetWidth
      el.classList.add('total-bump')
    }
    prev.current = value
  }, [value])
  return (
    <span ref={ref} className={`inline-flex items-center ${className}`} aria-label={`$${value}`}>
      <span style={{ marginRight: '0.04em', lineHeight: CELL }}>$</span>
      {digits.map((d, i) => (
        <Digit key={digits.length - i} d={Number(d)} />
      ))}
    </span>
  )
}
