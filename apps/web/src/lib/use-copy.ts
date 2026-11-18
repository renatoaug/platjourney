import { useEffect, useState } from 'react'

// How long a copy button says it copied.
const COPIED_MS = 1800

/** Copies `text` and says so for a moment on the button itself, instead of a toast. */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(null), COPIED_MS)
    return () => clearTimeout(id)
  }, [copied])
  const copy = async (text: string) => {
    await navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(text)
  }
  return { copied, copy }
}
