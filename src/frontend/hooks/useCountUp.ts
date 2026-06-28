import { useEffect, useState } from 'react'

function parseStat(value: string) {
  const num = parseInt(value.replace(/[^0-9]/g, ''), 10)
  const suffix = value.replace(/[0-9]/g, '')
  return { num: isNaN(num) ? 0 : num, suffix }
}

export function useCountUp(value: string, active: boolean, duration = 1800) {
  const { num, suffix } = parseStat(value)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!active || num === 0) {
      setDisplay(num)
      return
    }
    let start = 0
    const step = Math.max(1, Math.ceil(num / (duration / 16)))
    const timer = setInterval(() => {
      start += step
      if (start >= num) {
        setDisplay(num)
        clearInterval(timer)
      } else {
        setDisplay(start)
      }
    }, 16)
    return () => clearInterval(timer)
  }, [active, num, duration])

  return `${display}${suffix}`
}
