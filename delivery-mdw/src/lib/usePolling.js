import { useEffect } from 'react'

/** Calls `fn` every `ms` while the tab is visible, and right away when it becomes visible again. */
export default function usePolling(fn, ms = 30000) {
  useEffect(() => {
    const tick = () => document.visibilityState === 'visible' && fn()
    const id = setInterval(tick, ms)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [fn, ms])
}
