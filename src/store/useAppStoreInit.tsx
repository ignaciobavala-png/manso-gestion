import { useEffect } from 'react'
import { useAppStore } from './useAppStore'

export function AppStoreInitializer() {
  const fetchData = useAppStore(state => state.fetchData)
  const isInitialized = useAppStore(state => state.isInitialized)
  
  useEffect(() => {
    if (!isInitialized) {
      fetchData()
    }
  }, [fetchData, isInitialized])
  
  return null
}