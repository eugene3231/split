import { useEffect } from 'react'

type UseLoadingTickerOptions = {
  isActive: boolean
  onTick: () => void
  intervalMs?: number
}

export function useLoadingTicker({ isActive, onTick, intervalMs = 1800 }: UseLoadingTickerOptions) {
  useEffect(() => {
    if (!isActive) {
      return
    }

    const intervalId = window.setInterval(() => {
      onTick()
    }, intervalMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [intervalMs, isActive, onTick])
}
