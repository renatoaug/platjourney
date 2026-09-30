/** useState kept in the app cache: the Interests screen keeps its filter, page, open editor and typed draft across navigation, since the screen unmounts when the player leaves. */
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import { useApp } from '../../app/app-state'

export function useKept<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const { cache } = useApp()
  const [value, setValue] = useState<T>(() => (key in cache ? (cache[key] as T) : initial))
  useEffect(() => {
    cache[key] = value
  }, [cache, key, value])
  return [value, setValue]
}
