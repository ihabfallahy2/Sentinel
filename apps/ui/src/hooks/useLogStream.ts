import { useEffect, useState } from 'react'
import { getLogStreamUrl } from '../api/sentinelClient'

const MAX_LINES = 800

export function useLogStream(projectId: string | null): { lines: string[]; clear: () => void } {
  const [lines, setLines] = useState<string[]>([])

  const clear = () => {
    setLines([])
  }

  useEffect(() => {
    if (!projectId) {
      return
    }
    const url = getLogStreamUrl(projectId)
    if (!url) {
      return
    }
    const es = new EventSource(url)
    es.onmessage = (event) => {
      let line = event.data
      try {
        line = JSON.parse(event.data as string) as string
      } catch {
        /* raw */
      }
      setLines((prev) => [...prev, String(line)].slice(-MAX_LINES))
    }
    es.onerror = () => {
      es.close()
    }
    return () => {
      es.close()
    }
  }, [projectId])

  return { lines, clear }
}
